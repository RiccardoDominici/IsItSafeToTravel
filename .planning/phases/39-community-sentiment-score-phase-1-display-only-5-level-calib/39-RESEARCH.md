# Phase 39: Community Sentiment Score (Phase 1 — display-only) - Research

**Researched:** 2026-07-02
**Domain:** Cloudflare Pages Functions + D1 (edge write path) bolted onto an Astro 6 SSG; daily GitHub Actions aggregation; a new display-only 6th pillar rendered at build time; i18n across 7 locales.
**Confidence:** HIGH (the hardest question — "does a live write endpoint work in this static project?" — is answered by three Pages Functions already live in this exact repo).

## Summary

This phase does not break new architectural ground for the project: the repo **already ships Cloudflare Pages Functions** (`functions/index.ts` root language redirect, `functions/_middleware.ts` canonical-host redirect, `functions/api/feedback.ts` a POST endpoint that calls Resend). They deploy with the current `wrangler pages deploy dist/client --project-name=isitsafetotravel` command and are live in production. So the only genuinely new pieces are: (1) a `functions/api/vote.ts` that writes to **D1**, (2) making the existing `wrangler.toml` an *active* Pages config so the D1 binding attaches, (3) a daily pipeline step that pulls vote aggregates from D1 over the HTTP API and bakes a small static file, and (4) a display-only 6th pillar card + vote widget on the country page, translated ×7.

The single load-bearing configuration fact: **the current `wrangler.toml` is being ignored at deploy** because a Pages config file is only recognized when it contains `pages_build_output_dir` [CITED: developers.cloudflare.com/pages/functions/wrangler-configuration]. To attach a D1 binding via config (D-15), the plan must add `pages_build_output_dir = "dist/client"` to `wrangler.toml`. Doing so makes the file authoritative for compatibility settings too — a real risk to the existing functions that must be verified after wiring.

Everything else has a clean in-repo pattern to copy: the vote widget mirrors the feedback form's `<script define:vars>` + `fetch('/api/…', {method:'POST'})`; the aggregation step mirrors the pipeline's `fetch()`-based fetchers and its `writeJson`/`data/` snapshot idiom; the sentiment history reuses the score-history concept but **must live in its own small `data/sentiment/` files** (never appended to the 73 MB `history-index.json`). No new npm packages are required.

**Primary recommendation:** Copy the three established repo patterns (Pages Function POST endpoint, pipeline `fetch()` step + `data/` JSON artifact, `<script define:vars>` progressive-enhancement widget). Store sentiment as **raw signed-delta vote rows in D1** and bake a **separate `data/sentiment/latest.json` + `data/sentiment/history.json`** at build. Keep `engine.ts` and `weights.json` completely untouched — the pillar is display-only by virtue of never entering the scoring loop, not by a weight-0 entry.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Vote mechanism**
- **D-01:** CALIBRATION, not like/dislike. User sees the official score and says whether it feels off. Binary voting explicitly rejected.
- **D-02:** 5 levels — "molto alto / alto / giusto / basso / molto basso" (way too high / too high / about right / too low / way too low) → signed deltas **−2 / −1 / 0 / +1 / +2**. "Score troppo alto" ⇒ community thinks safety is LOWER ⇒ negative delta.
- **D-03:** The aggregate is a community **correction** to the algorithmic score, not an independent rating.

**Sentiment pillar**
- **D-04:** NEW 6th pillar "Sentiment" alongside conflict/crime/health/governance/environment on the country page, styled like the others.
- **D-05:** Pillar label translated in **all 7 languages** (en, it, es, fr, pt, zh, de) via `src/i18n/ui.ts`.
- **D-06:** **Phase 1 = display-only. Effective weight 0.** `src/pipeline/scoring/engine.ts`'s weighted geometric mean stays exactly the current 5 pillars. The pillar is visible but inert.
- **D-07:** The pillar DISPLAYS an absolute community-perceived value = `clamp(official_score + capped_correction, 1, 10)` on the same 1–10 scale; the DATA MODEL stores raw signed deltas (votes) and the aggregated correction. Show the correction explicitly next to it (e.g. "+0.4 vs official") plus vote count. Revisit mapping in Phase 2.

**Aggregation & caps**
- **D-08:** Aggregate = recency-weighted mean of vote deltas, scaled to score points, with a hard **cap of ±1.0 point**. Cap and scaling live as named constants — easily tunable.
- **D-09:** Minimum vote floor before the pillar shows data (default: **5 votes** per country); below the floor show a localized "not enough votes yet" state with the vote CTA.
- **D-10:** Keep a daily time series of the aggregated correction per country (reuse the score-history pattern under `data/`). Baking daily matches the existing score cadence.

**Architecture (Cloudflare-native; NOT Supabase, NOT pure GHA)**
- **D-11:** Ingestion = Cloudflare **Pages Function** in this same Pages project (`functions/api/vote` → `/api/vote`) writing append-only vote rows to **D1**. Zero new vendors; same deploy + secrets.
- **D-12:** Anti-abuse = rate-limit + dedupe per visitor inside the Function (privacy-preserving: **salted hash of IP, never store raw IP** — zero-cookie architecture) + **Cloudflare Turnstile**, but Turnstile must be **env-gated**: if `TURNSTILE_SECRET_KEY` / public site key are not configured, the endpoint still works (verification skipped, rate-limit still on). One-time widget creation is a manual user step.
- **D-13:** Aggregation/baking = the existing **daily GitHub Actions pipeline** (`src/pipeline/run.ts`, `data-pipeline.yml`, 06:00 UTC) pulls vote aggregates from D1 (Cloudflare HTTP API using an API token secret), normalizes, and bakes Sentiment into static data. Pages stay fully static; the pillar updates once a day.
- **D-14:** **Graceful degradation everywhere:** if D1 is unreachable / token missing / no votes, the pipeline completes normally and the site builds with last-known (or empty) sentiment data. The vote endpoint failing must never break the static site.
- **D-15:** D1 binding for the Pages Function is declared in a `wrangler.toml` in the repo so `wrangler pages deploy` keeps working. D1 DB creation is done by the orchestrator via Cloudflare API/MCP; `database_id` gets committed in `wrangler.toml`.
- **D-16:** Free-tier budget: Functions 100k req/day, D1 5M reads + 100k writes/day. Design must not exceed this (single INSERT per vote; aggregation reads once daily).

**Frontend widget**
- **D-17:** Vote widget on the country page near the score/pillar display; shows official-score context, asks the 5-level calibration question. All strings localized ×7. After voting: thank-you state + dedupe via localStorage (soft) so the same visitor isn't re-prompted for that country.
- **D-18:** Plain progressive-enhancement JS (fetch POST to `/api/vote`), matching the site's existing no-framework client-script patterns. No cookies. If JS disabled or endpoint down, the widget degrades silently.

**Documentation**
- **D-19:** Methodology page ×7 gains a Sentiment section: how community calibration works, the 5 levels, the cap, and an explicit statement that in Phase 1 it does **NOT** affect the total score. Localized methodology slugs come from `src/i18n/ui.ts` `routes`.
- **D-20:** Privacy policy pages get a short addition covering vote processing (salted-hash dedupe, no raw IP retention, Turnstile when enabled) — keep it honest with the zero-cookie claim (localStorage note).

**Scope guards**
- **D-21:** Sentiment does NOT enter: map category filters, comparison page, rankings/hub pages, llms.txt generators, OG images. Country page + methodology + privacy only.
- **D-22:** `npm run validate:seo` must stay all-pass — country page `@graph` (WebPage + Place + FAQPage + TouristDestination + Dataset) untouched or still valid.

### Claude's Discretion
- Exact recency-weighting curve (e.g. half-life) and the vote-row schema details.
- Rate-limit thresholds (e.g. N votes/IP-hash/day) and salt rotation scheme.
- Widget visual design within existing Tailwind v4 design language.
- Whether sentiment static data lives near `public/scores.json` or a new `data/sentiment/` + `public/` artifact (pick what the country pages read cleanly at build; do NOT hand-edit generated files — extend generators/pipeline).
- Naming of i18n keys, component file names, D1 table names.

### Deferred Ideas (OUT OF SCOPE)
- **Phase 2:** weight Sentiment into the total (pick weight, rebalance 30/25/20/15/10, decide geometric-mean folding in `engine.ts`).
- Recency-window filtering UI / sentiment history charts on the country page (data collected from day one; charting later).
- Turnstile widget creation + `TURNSTILE_SECRET_KEY` secret — one-time manual user step (env-gated until then).
- Granting the GHA pipeline's Cloudflare API token D1 read permission — manual user step; pipeline degrades gracefully until done.
</user_constraints>

## Project Constraints (from CLAUDE.md)

These are enforced with the same authority as locked decisions:

- **Generated-file hook (PreToolUse):** hand-edits are BLOCKED for `public/llms.txt`, `public/llms-full.txt`, `public/scores.json`, `data/scores/**`, `data/raw/**`, `data/history/**`, `public/og/**`, `dist/**`. Sentiment data must be produced by pipeline/generator code, never hand-written. **`data/sentiment/**` is NOT in the current blocklist** — a new dir sidesteps the hook, but the pipeline must still own it. `[VERIFIED: CLAUDE.md + repo grep]`
- **Build is slow (~400s)** because `generate:og` re-renders 248 images. When iterating, run `npx astro build` then `npm run validate:seo` directly (OG/llms already on disk). `[CITED: CLAUDE.md]`
- **`npm run validate:seo` must stay all-pass** before committing SEO/schema changes (D-22). `[CITED: CLAUDE.md]`
- **i18n single source of truth** is `src/i18n/ui.ts` (`ui` blocks + `routes`); both HTML hreflang (`Base.astro`) and the sitemap (`astro.config.mjs serialize()`) derive from it. `[VERIFIED: files read]`
- **`engine.ts` scoring is a weighted geometric mean of 5 pillars** with a hard cap and critical floor — Phase 1 must not touch this. `[CITED: CLAUDE.md + engine.ts read]`
- **Before pushing, `git pull --rebase --autostash`** — the daily bot commits often. `[CITED: CLAUDE.md]`
- Commit + push to `master` ships production. `[CITED: CLAUDE.md; memory feedback_always_deploy]`

<phase_requirements>
## Phase Requirements

No formal REQ-IDs are mapped for Phase 39 (it postdates the v4.0 requirement set in `.planning/REQUIREMENTS.md`). Scope is defined entirely by decisions **D-01 … D-22** above. The mapping the planner should use:

| Decision | Description | Research Support |
|----------|-------------|------------------|
| D-11, D-15, D-16 | Vote ingestion via Pages Function + D1 binding in wrangler.toml | §Standard Stack, §Pattern 1, §Pitfall 1 (pages_build_output_dir), §Environment Availability |
| D-12 | Rate-limit + salted-hash dedupe + env-gated Turnstile | §Pattern 3, §Security Domain, §Don't Hand-Roll |
| D-13, D-14 | Daily pipeline pulls D1 via HTTP API, bakes static, degrades gracefully | §Pattern 2, §Pattern 5, §Pitfall 4 |
| D-01…D-03, D-07, D-08, D-09 | Calibration data model, correction cap, vote floor | §Pattern 4 (data model), §Code Examples (aggregation) |
| D-04, D-05, D-06, D-17, D-18 | Display-only 6th pillar + widget, ×7 i18n, engine untouched | §Pattern 6, §Architecture, §Pitfall 5 |
| D-10 | Own small sentiment history file | §Pitfall 2, §Runtime State Inventory |
| D-19, D-20 | Methodology + privacy docs ×7 | §Code Examples (i18n), §Pattern 7 |
| D-21, D-22 | Scope containment + SEO gate stays green | §Pitfall 6, §Security not applicable to schema |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Accept a vote (HTTP POST) | API/Backend (Pages Function `functions/api/vote.ts`) | — | Only dynamic surface allowed; SSG can't accept writes. Precedent: `functions/api/feedback.ts`. |
| Store votes | Database (D1) | — | Append-only rows + cheap SQL aggregation at the edge; free tier ample (D-16). |
| Bot defense (Turnstile verify) | API/Backend (Function, `siteverify`) | Client (widget renders token) | Secret never leaves the server; token minted client-side. Env-gated (D-12). |
| Rate-limit / dedupe | API/Backend (Function + D1 count query) | Client (localStorage soft-dedupe) | Hard limit server-side (salted-hash); soft UX suppression client-side (D-17). |
| Aggregate votes → correction | Build/CI (GHA daily pipeline) | Database (D1 read via HTTP API) | Matches existing daily score cadence; keeps pages static (D-13). |
| Bake sentiment into static data | Build/CI (`src/pipeline`) | — | Own `data/sentiment/*.json`, read at build (D-10). |
| Render 6th pillar + correction | Frontend SSG (Astro build, `[slug].astro`) | — | Display-only; read at `getStaticPaths` (D-04, D-06). |
| Vote widget UI + submit | Browser/Client (inline `<script define:vars>`) | — | Progressive enhancement; degrades silently (D-18). |
| Translated labels/copy | Frontend SSG (`src/i18n/ui.ts`) | — | Single source of truth (D-05). |
| Docs (methodology/privacy) | Frontend SSG (per-locale `.astro` pages) | — | Localized slugs from `routes` (D-19, D-20). |

## Standard Stack

### Core

| Library / Primitive | Version | Purpose | Why Standard |
|---------------------|---------|---------|--------------|
| Cloudflare Pages Functions | platform (via `wrangler` 4.75.0) | The `/api/vote` write endpoint | Already used in this repo (`functions/api/feedback.ts`, `functions/index.ts`); same deploy path, zero new vendor `[VERIFIED: repo]` |
| Cloudflare D1 | platform | Append-only vote storage + SQL aggregation | Edge SQLite; the CONTEXT-locked choice (D-11); free tier covers this (D-16) `[VERIFIED: CONTEXT + CF pricing docs]` |
| Cloudflare Turnstile | platform | Bot mitigation on `/api/vote` (env-gated) | Same vendor; free; `siteverify` server-side check `[CITED: developers.cloudflare.com/turnstile]` |
| D1 REST HTTP API | v4 | GHA pipeline reads aggregates from D1 | `POST /accounts/{id}/d1/database/{db}/query`; callable with plain `fetch()` — no wrangler install in the pipeline `[CITED: api.cloudflare.com d1 query]` |
| Web Crypto `crypto.subtle` | Workers runtime | SHA-256 salted IP hashing (dedupe) | Available in Workers WITHOUT `nodejs_compat`; portable, no dep `[CITED: Workers runtime]` |
| Astro 6 SSG | `^6.0.6` | Build-time render of the pillar + widget markup | Existing framework `[VERIFIED: package.json]` |
| Tailwind v4 | `^4.2.2` | Widget/pillar styling | Existing design system `[VERIFIED: package.json]` |
| node:test + tsx | node 22 (CI) / `tsx ^4.21` | Unit tests for aggregation math | Existing test idiom (`node --import tsx --test`) `[VERIFIED: package.json + engine.test.ts]` |

### Supporting

| Item | Purpose | When to Use |
|------|---------|-------------|
| `import.meta.env.PUBLIC_TURNSTILE_SITEKEY` | Build-time flag: render Turnstile widget only when a public sitekey is configured | Astro exposes `PUBLIC_`-prefixed env to client bundles `[CITED: docs.astro.build/en/guides/environment-variables]` |
| `data/sentiment/latest.json` + `data/sentiment/history.json` | The baked sentiment artifacts, read at build by a new `src/lib/sentiment.ts` | Mirrors `data/scores/latest.json` + `lib/scores.ts` load pattern (D-10) |
| Turnstile client script `https://challenges.cloudflare.com/turnstile/v0/api.js` | Renders the widget | CDN script (not npm); needs CSP allowance |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| D1 REST HTTP API in the pipeline | `wrangler d1 execute <db> --remote --command "…" --json` (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`) | Works, but adds a wrangler invocation + parsing; the repo's fetchers are all plain `fetch()`, so the HTTP API is a cleaner fit `[CITED: CF docs]` |
| D1 binding via `wrangler.toml` | Dashboard binding (Settings → Bindings → D1) | Dashboard works but isn't in git; D-15 requires the config-file route so deploys stay reproducible |
| `crypto.subtle` (Web Crypto) | `node:crypto` (requires `nodejs_compat`) | Web Crypto avoids a compat-flag dependency and is the Workers-idiomatic choice |
| Loose `context: any` typing in the Function | Add `@cloudflare/workers-types` devDep for `D1Database`/`PagesFunction` | `feedback.ts` uses `context: any`; adding types is a new package (see Package Legitimacy Audit). Recommend loose typing to keep zero new deps. |

**Installation:** None. **This phase adds zero npm packages** — every piece is a platform primitive already reachable from the repo. `wrangler` (4.75.0) is already available; `@astrojs/cloudflare` (^13.1.2) is already a dependency. `[VERIFIED: package.json + npx wrangler --version]`

**Version verification (run before finalizing):** No package versions to verify because nothing is installed. If the planner opts into strict typing, verify `npm view @cloudflare/workers-types version` and run the Package Legitimacy Gate first.

## Package Legitimacy Audit

**Not applicable — this phase installs no external packages.** All capabilities use Cloudflare platform primitives (Pages Functions, D1, Turnstile), the Workers-native Web Crypto API, the D1 REST API over `fetch()`, and existing repo dependencies (`astro`, `tailwindcss`, `tsx`, `@astrojs/cloudflare`).

The only *optional* package the planner might consider is `@cloudflare/workers-types` (devDependency, for `D1Database`/`PagesFunction` types). If chosen, it must pass the Package Legitimacy Gate (`slopcheck install @cloudflare/workers-types --json`; `npm view @cloudflare/workers-types`). It is an official Cloudflare package, but registry existence alone is not verification. **Recommendation: skip it** and follow the `feedback.ts` precedent (`context: any`), keeping the audit trivially empty.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No installs in this phase |

## Architecture Patterns

### System Architecture Diagram

```
                         ┌───────────────────────── BROWSER (country page) ─────────────────────────┐
                         │  5-level calibration widget (inline <script define:vars>)                 │
                         │  • reads official score already on page                                   │
                         │  • soft-dedupe via localStorage: sentiment-voted-{iso3}                    │
                         │  • (if PUBLIC_TURNSTILE_SITEKEY set) renders Turnstile → token             │
                         └───────────────┬───────────────────────────────────────────────────────────┘
                                         │ fetch POST /api/vote  { iso3, delta(-2..2), officialScore, token? }
                                         ▼
     ┌──────────────────────── CLOUDFLARE PAGES FUNCTION  functions/api/vote.ts ─────────────────────────┐
     │  onRequestPost(context):                                                                            │
     │   1. validate body (iso3 ∈ known set, delta ∈ {-2..2})                                              │
     │   2. IF env.TURNSTILE_SECRET_KEY → POST challenges.cloudflare.com/turnstile/v0/siteverify (else skip)│
     │   3. voter_hash = SHA-256(env.VOTE_HASH_SALT + clientIP + iso3 + weekBucket)  (Web Crypto)          │
     │   4. rate-limit/dedupe: SELECT count FROM votes WHERE iso3=? AND voter_hash=? AND created_at> window │
     │   5. INSERT INTO votes (iso3, delta, official_score, voter_hash, created_at)   ← env.DB (D1)         │
     │   6. return 200 {ok:true}    (any failure → 4xx/5xx; NEVER affects static pages)                    │
     └───────────────┬─────────────────────────────────────────────────────────────────────────────────┘
                     │ append-only rows
                     ▼
             ┌──────────────┐        binding: env.DB  (declared in wrangler.toml [[d1_databases]])
             │   D1 (votes) │
             └──────┬───────┘
                    │ once/day, read-only over HTTPS
                    │ POST api.cloudflare.com/client/v4/accounts/{id}/d1/database/{db}/query
                    ▼
   ┌───────────────── GITHUB ACTIONS  data-pipeline.yml (06:00 UTC) → src/pipeline/run.ts ─────────────────┐
   │  Stage 6 (NEW): sentiment aggregation                                                                  │
   │   • fetch votes (windowed) from D1 HTTP API  (env: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, D1 id) │
   │   • per country: recency-weighted mean of deltas → scale → clamp ±1.0  → perceived = clamp(off+corr,1,10)│
   │   • floor: count < 5 ⇒ insufficient                                                                    │
   │   • IF D1 unreachable / token missing ⇒ keep last-known file, log warning, DO NOT fail the run (D-14)   │
   │   • writeJson data/sentiment/latest.json  (small)                                                      │
   │   • append today's point to data/sentiment/history.json  (small, NOT history-index.json)              │
   │  commit step: git add data/sentiment/  ← REQUIRED workflow edit                                        │
   └───────────────┬────────────────────────────────────────────────────────────────────────────────────┘
                   │ committed → triggers deploy.yml → npm run build
                   ▼
   ┌───────────── ASTRO BUILD (SSG)  src/pages/<lang>/country/[slug].astro ───────────────┐
   │  getStaticPaths → loadSentiment(iso3) from data/sentiment/latest.json (new lib)       │
   │  <SentimentPillar> card: perceived value (1–10 bar) + "+0.4 vs official" + vote count  │
   │  OR localized "not enough votes yet" state + vote CTA (count < 5)                      │
   │  engine.ts / weights.json UNTOUCHED → total score identical (weight 0 by omission)     │
   └───────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
functions/
└── api/
    └── vote.ts                 # NEW  /api/vote  (mirror feedback.ts structure)
wrangler.toml                   # EDIT add pages_build_output_dir + [[d1_databases]]
db/
└── sentiment-schema.sql        # NEW  D1 schema (applied once via wrangler d1 execute --remote --file)
src/
├── lib/
│   └── sentiment.ts            # NEW  loadSentiment(iso3) reads data/sentiment/latest.json at build
├── pipeline/
│   ├── run.ts                  # EDIT add Stage 6: sentiment aggregation (after history index)
│   └── sentiment/
│       ├── fetch-votes.ts      # NEW  D1 HTTP API client (fetch); returns [] on any failure
│       └── aggregate.ts        # NEW  recency-weighted mean, scale, cap constants + math
├── components/country/
│   └── SentimentPillar.astro   # NEW  display card + vote widget (inline <script>)
├── i18n/ui.ts                  # EDIT +sentiment.* keys ×7 locales (ui blocks)
└── pages/<lang>/
    ├── country/[slug].astro    # EDIT (×7 templates) render <SentimentPillar>
    ├── methodology/index.astro # EDIT (×7) add Sentiment section (D-19)
    └── legal/index.astro       # EDIT (×7) privacy addition (D-20)
data/
└── sentiment/                  # NEW  pipeline-owned (NOT hook-blocked, but generator-only)
    ├── latest.json
    └── history.json
```

### Pattern 1: Pages Function POST endpoint (mirror `feedback.ts`)

**What:** A `functions/api/vote.ts` exporting `onRequestPost` (+ `onRequestOptions` for CORS preflight, though same-origin needs none). File-based routing maps it to `/api/vote`. `[VERIFIED: repo — feedback.ts → /api/feedback is live]`

**When to use:** The one dynamic surface. Everything else stays SSG.

**Example (structure to copy, from the live feedback endpoint):**
```typescript
// Source: functions/api/feedback.ts (this repo) — proven deploy path
export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json();
    // validate…
    const db = context.env?.DB;          // D1 binding (see wrangler.toml)
    if (!db) return json({ ok: false }, 200); // graceful: never 500 the UX
    // … Turnstile (env-gated) … dedupe … INSERT …
    return json({ ok: true }, 200);
  } catch {
    return json({ ok: false }, 200);
  }
}
```
Client IP: `context.request.headers.get('CF-Connecting-IP')` (Cloudflare-set). `[CITED: Cloudflare request headers]`

### Pattern 2: Pipeline aggregation step reading D1 over HTTP (mirror the fetchers)

**What:** A new stage in `run.ts` after `writeHistoryIndex()`. It calls the D1 query API with `fetch()`, aggregates, and writes `data/sentiment/*.json`. It returns cleanly on any error (missing env, non-200, thrown) so the daily run never fails because of sentiment (D-14).

**Example (D1 query over HTTP — the exact call the pipeline makes):**
```typescript
// Source: api.cloudflare.com D1 query endpoint [CITED]
const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${dbId}/query`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sql: 'SELECT iso3, delta, created_at FROM votes WHERE created_at > ?;',
      params: [cutoffEpochSeconds],
    }),
  }
);
// response: { success, result: [{ results: [...rows], meta }] }
const rows = (await res.json())?.result?.[0]?.results ?? [];
```
Env vars needed by the pipeline step: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (already repo secrets — used by `deploy.yml`), plus the D1 `database_id` (committed in `wrangler.toml`; read it or hard-code as a constant). The **token must be granted D1 read** — a manual user step; until then, the API returns an auth error and the step degrades gracefully.

### Pattern 3: Env-gated Turnstile server verification

**What:** If `env.TURNSTILE_SECRET_KEY` is present, POST to `siteverify` and reject on `success:false`; if absent, skip entirely (D-12).

**Example:**
```typescript
// Source: developers.cloudflare.com/turnstile/get-started/server-side-validation [CITED]
if (context.env.TURNSTILE_SECRET_KEY) {
  const v = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: context.env.TURNSTILE_SECRET_KEY,
      response: body.token ?? '',
      remoteip: context.request.headers.get('CF-Connecting-IP') ?? '',
    }),
  });
  const out = await v.json(); // { success, "error-codes", hostname, challenge_ts }
  if (!out.success) return json({ ok: false, reason: 'turnstile' }, 403);
}
```
Test keys (dev/CI, no real widget): sitekey `1x00000000000000000000AA` (always pass), secret `1x0000000000000000000000000000000AA` (always pass); `2x…AB` / `2x…0AA` always fail; `3x00000000000000000000FF` forces interactive. `[CITED: developers.cloudflare.com/turnstile/troubleshooting/testing]`

### Pattern 4: Data model — raw deltas in D1, correction baked

**D1 schema (Claude's discretion, D-07/D-08):**
```sql
CREATE TABLE IF NOT EXISTS votes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  iso3           TEXT    NOT NULL,
  delta          INTEGER NOT NULL,          -- -2..+2 (validate in Function)
  official_score REAL,                      -- score shown at vote time (audit/context)
  voter_hash     TEXT    NOT NULL,          -- SHA-256(salt+ip+iso3+weekBucket); never raw IP
  created_at     INTEGER NOT NULL           -- unix epoch seconds, server time
);
CREATE INDEX IF NOT EXISTS idx_votes_iso3_created ON votes (iso3, created_at);
CREATE INDEX IF NOT EXISTS idx_votes_dedupe       ON votes (iso3, voter_hash, created_at);
```
`data/sentiment/latest.json` (small — one row per country with data):
```json
{ "generatedAt": "2026-07-02T06:00:00Z",
  "countries": { "JPN": { "count": 42, "avgDelta": -0.31, "correction": -0.4, "perceived": 7.9, "official": 8.3 } } }
```
`data/sentiment/history.json`: `{ "JPN": [{ "date": "2026-07-02", "correction": -0.4, "count": 42 }] }`.

### Pattern 5: Aggregation math (recency-weighted mean, cap constants)

Reuse the project's freshness-decay idiom (`src/pipeline/scoring/freshness.ts` uses exponential half-life). Named, tunable constants (D-08):
```typescript
export const SENTIMENT_HALF_LIFE_DAYS = 30;   // recency weighting
export const SENTIMENT_DELTA_SCALE   = 0.5;   // score-points per unit avg delta
export const SENTIMENT_CORRECTION_CAP = 1.0;  // hard ± cap (D-08)
export const SENTIMENT_MIN_VOTES      = 5;    // display floor (D-09)
// weight_i = 0.5 ** (ageDays_i / HALF_LIFE); avgDelta = Σ(w·delta)/Σw
// correction = clamp(avgDelta * SCALE, -CAP, +CAP)
// perceived  = clamp(official + correction, 1, 10)
```

### Pattern 6: Display-only pillar (engine untouched)

**What:** The 6th pillar is a **separate data path**, not a `PillarScore` in `country.pillars`. `engine.ts` iterates only `weightsConfig.pillars` (the 5 in `weights.json`), so leaving both untouched guarantees weight 0 (D-06). Render `<SentimentPillar>` styled like `PillarBreakdown.astro` (label column + SVG bar + `value/10`), plus the correction badge and vote count.

**Why not add it to `country.pillars`:** that array feeds `writeHistoryIndex()` (pillarHistory) and the scoring composite — adding a 6th entry would silently perturb both. Keep sentiment out of `ScoredCountry`.

### Pattern 7: i18n keys + docs across 7 locales

`src/i18n/ui.ts` has 7 `ui` blocks (en starts line 21; per-locale `country.pillar.*` clusters near lines 58, 538, …) and a `routes` map (line 3365) with methodology slugs (`methodology`/`metodologia`/`methodologie`/`methodik`). Add a `sentiment.*` key cluster to **each** of the 7 `ui` blocks (label, question, the 5 level labels, "vs official", vote-count, thank-you, "not enough votes", widget CTA, error). Methodology + privacy pages exist per-locale under the localized slugs (e.g. `src/pages/de/methodik/index.astro`, `src/pages/de/impressum/…`).

### Anti-Patterns to Avoid
- **Putting sentiment in `public/scores.json` / `data/scores/**`:** hook-blocked and pipeline-owned; would also bloat the score snapshot. Use `data/sentiment/`.
- **Appending sentiment history to `history-index.json`:** it's already ~73 MB and near GitHub's limit. Own file only (D-10).
- **Adding a 6th entry to `weights.json` / `country.pillars`:** perturbs the geometric mean and pillar history. Keep the pillar entirely outside the scoring types.
- **`node:crypto` for hashing:** needs `nodejs_compat`; use Web Crypto `crypto.subtle`.
- **Storing raw IP or setting a cookie:** violates the zero-cookie claim (D-12/D-20). Salted hash only; localStorage for soft UX dedupe.
- **Adding sentiment JSON-LD (AggregateRating) to the country `@graph`:** risks the validate-seo invariant and is out of scope (D-21). Plain HTML only in Phase 1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bot/spam defense | Custom CAPTCHA / honeypot | Cloudflare Turnstile (env-gated) | Same vendor, free, `siteverify` server check (D-12) |
| Vote storage + aggregation | JSON blob in KV / a git-committed votes file | D1 (SQL, indexed, append-only) | Concurrency-safe writes at the edge; SQL GROUP BY; the locked choice (D-11) |
| Querying D1 from CI | Custom SQLite export/import | D1 REST query API over `fetch()` | One HTTPS call; matches the pipeline's fetcher idiom |
| IP hashing | Bespoke hash | Web Crypto `crypto.subtle.digest('SHA-256', …)` | Built into the Workers runtime; no dep, no compat flag |
| Recency weighting | New decay code | Mirror `src/pipeline/scoring/freshness.ts` half-life pattern | Consistent with existing scoring; tested idiom |
| Client POST + states | New fetch framework | Copy `feedback/index.astro` `<script define:vars>` block | Proven progressive-enhancement pattern in this repo (D-18) |

**Key insight:** Nearly every sub-problem already has a concrete, working implementation in this repo or is a first-class Cloudflare primitive. The phase is mostly *wiring proven pieces*, not inventing.

## Runtime State Inventory

> This phase creates new runtime state (a D1 database) rather than renaming existing state, but the inventory questions still surface required non-code actions.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **NEW** D1 database `votes` table. No existing datastore stores sentiment today. | Create D1 DB (orchestrator, via CF API/MCP per D-15); apply `db/sentiment-schema.sql` via `wrangler d1 execute <db> --remote --file=…`. |
| Live service config | **Pages project binding**: the D1 binding must attach to the `isitsafetotravel` Pages project. Declared in `wrangler.toml` `[[d1_databases]]` — takes effect only once `pages_build_output_dir` is added (see Pitfall 1). Turnstile widget (if enabled) is created in the CF dashboard — a **manual user step**, not in git (deferred). | Add binding to `wrangler.toml`; commit `database_id`. Verify existing functions still work after config activation. |
| OS-registered state | None. | None — verified: no launchd/Task Scheduler/pm2 involvement; deploy is GHA + wrangler-action. |
| Secrets / env vars | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` **already exist** as repo secrets (used by `deploy.yml`). NEW server secrets: `VOTE_HASH_SALT` (Pages secret), optional `TURNSTILE_SECRET_KEY` (Pages secret). NEW build env (optional): `PUBLIC_TURNSTILE_SITEKEY`. The existing API token likely **lacks D1 read permission** — granting it is a manual user step (deferred); pipeline degrades until then. | Set Pages secrets via `wrangler pages secret put …` or dashboard (manual). Add `CLOUDFLARE_*` env to the pipeline step in `data-pipeline.yml`. |
| Build artifacts / installed pkgs | None new (no npm installs). `.wrangler/` local state is gitignored. | None. |

**Additional required workflow edit (not a "rename" but a state-flow gap):** `data-pipeline.yml`'s commit step (`git add data/raw/ data/scores/ public/scores.json` + `data/history/`) must also `git add data/sentiment/`, or the daily-baked sentiment history never persists to the repo. `[VERIFIED: data-pipeline.yml read]`

## Common Pitfalls

### Pitfall 1: The current `wrangler.toml` is inert — adding the D1 binding silently does nothing without `pages_build_output_dir`
**What goes wrong:** You add `[[d1_databases]]` to `wrangler.toml`, deploy, and `env.DB` is `undefined` in the Function.
**Why it happens:** A `wrangler.toml` is only treated as a **Pages** config when it contains `pages_build_output_dir`. The current file (`name`, `compatibility_date`, `compatibility_flags` only) is ignored at deploy — which is why the existing functions work without it. `[CITED: developers.cloudflare.com/pages/functions/wrangler-configuration; VERIFIED: wrangler.toml read]`
**How to avoid:** Add `pages_build_output_dir = "dist/client"` (matches `outDir` in `astro.config.mjs` and the deploy positional). Then `[[d1_databases]] binding="DB" database_name=… database_id=…`.
**Warning signs:** Deploy logs show no D1 binding; `env.DB` null at runtime.

### Pitfall 2 (SECONDARY RISK of Pitfall 1's fix): activating the config makes it authoritative over the dashboard
**What goes wrong:** Once `pages_build_output_dir` is present, wrangler treats the file's `compatibility_date`/`compatibility_flags`/bindings as the source of truth and will **override** any settings currently configured in the Pages dashboard for the existing functions.
**Why it happens:** Config file precedence for Pages once it's recognized.
**How to avoid:** Keep the existing `compatibility_date = "2026-03-01"` and `compatibility_flags = ["nodejs_compat"]` in the file (they're already there). After the first deploy, **smoke-test the existing surfaces**: root `/` language redirect (`functions/index.ts`) and the feedback form (`functions/api/feedback.ts`). Write the vote Function to NOT depend on `nodejs_compat` (use Web Crypto) so it works regardless of the flag.
**Warning signs:** Root redirect or feedback form breaks after the config-activating deploy.

### Pitfall 3: `history-index.json` bloat
**What goes wrong:** Reusing `history-index.json` for the sentiment time series pushes a 73 MB file toward GitHub's 100 MB hard limit.
**Why it happens:** It's the obvious "score history" file to reach for.
**How to avoid:** `data/sentiment/history.json` is a separate, tiny file (D-10; memory `project_history_file_growth`).
**Warning signs:** `history-index.json` diff grows on sentiment commits.

### Pitfall 4: Sentiment failure breaks the daily run or the build
**What goes wrong:** Missing token / no D1 permission / zero votes throws and aborts `run.ts`, or the build can't find `data/sentiment/latest.json`.
**Why it happens:** No graceful path (violates D-14).
**How to avoid:** The aggregation stage catches everything and returns `[]`; if the API fails, keep the last-known file (don't overwrite with empty); ship an empty-but-valid `latest.json` on first run so `loadSentiment()` always resolves; country page renders the "not enough votes" state when a country is absent/below floor.
**Warning signs:** Pipeline exit code ≠ 0 attributable to sentiment; build error on missing file.

### Pitfall 5: Accidentally affecting the total score
**What goes wrong:** Sentiment leaks into `country.pillars` or `weights.json` and nudges the geometric mean.
**Why it happens:** Treating it like a real pillar.
**How to avoid:** Sentiment lives entirely outside `ScoredCountry`/`engine.ts`. Add a test asserting a country's total `score` is byte-identical with and without sentiment data present.
**Warning signs:** `score-drift-guard` / `data02-score-range` tests move; global average shifts.

### Pitfall 6: Breaking `validate:seo` (D-22)
**What goes wrong:** New markup or a stray JSON-LD block drops the country `@graph` below its required `[WebPage, Place, FAQPage, TouristDestination, Dataset]`, or duplicates a meta description.
**Why it happens:** `validate-seo.ts` samples 12 country pages and asserts those 5 `@graph` types + description uniqueness. `[VERIFIED: validate-seo.ts read]`
**How to avoid:** Add plain HTML only; do NOT emit sentiment JSON-LD in Phase 1 (D-21). Don't touch `buildCountryJsonLd`/`buildCountryMetaDescription`. Run `npx astro build && npm run validate:seo` — expect the current all-pass count to hold.
**Warning signs:** validate:seo failure count > 0.

### Pitfall 7: CSP (Report-Only today) needs Turnstile origins when the widget is enabled
**What goes wrong:** The Turnstile script/iframe generates CSP violation *reports* (won't block — the header is `Content-Security-Policy-Report-Only`), and would break if the site ever flips to enforcing CSP.
**Why it happens:** `public/_headers` CSP lists `script-src`/`frame-src`/`connect-src` without `challenges.cloudflare.com`. The `/api/vote` POST itself is fine (`connect-src 'self'`, same origin). `[VERIFIED: public/_headers read]`
**How to avoid:** When enabling Turnstile, add `https://challenges.cloudflare.com` to `script-src`, `frame-src`, and `connect-src` in `public/_headers`. Inline widget `<script define:vars>` is already covered by `script-src 'unsafe-inline'`.
**Warning signs:** CSP report noise; widget iframe blocked under a future enforcing policy.

### Pitfall 8: Free-tier "rows read" accounting on aggregation
**What goes wrong:** A daily `SELECT *` full-table scan counts every scanned row against the 5M/day read budget as the table grows.
**Why it happens:** D1 bills rows read (scanned), not rows returned.
**How to avoid:** Index `(iso3, created_at)`, always constrain with `WHERE created_at > ?` (e.g. last 180 days), and prune very old rows in a later phase. At realistic vote volumes this is negligible, but the index + window keep it safe. `[CITED: D1 pricing docs]`
**Warning signs:** D1 read-usage climbing disproportionately to vote count.

## Code Examples

### `wrangler.toml` after edit (the wiring that makes D1 reachable)
```toml
# Source: developers.cloudflare.com/pages/functions/wrangler-configuration [CITED]
name = "isitsafetotravel"
pages_build_output_dir = "dist/client"        # NEW — activates this as a Pages config
compatibility_date = "2026-03-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"                                # → context.env.DB in functions/api/vote.ts
database_name = "isitsafetotravel-sentiment"
database_id = "<committed after wrangler d1 create>"

# Optional: mirror the binding for preview deployments (master→production only today,
# so top-level alone suffices; add if preview branches must also write votes).
# [[env.preview.d1_databases]]
# binding = "DB"
# database_name = "isitsafetotravel-sentiment"
# database_id = "<same or a separate preview DB>"
```

### Salted, cookie-free voter hash (Web Crypto — no `nodejs_compat`)
```typescript
// Source: Workers Web Crypto (crypto.subtle) [CITED]
async function voterHash(salt: string, ip: string, iso3: string): Promise<string> {
  const weekBucket = Math.floor(Date.now() / (7 * 864e5)); // rotates weekly (unlinkable over time)
  const data = new TextEncoder().encode(`${salt}:${ip}:${iso3}:${weekBucket}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
```

### Client widget submit (copy of the feedback pattern, D-18)
```html
<!-- Source: src/pages/en/feedback/index.astro (this repo) -->
<script define:vars={{ iso3: country.iso3, thanks: t('sentiment.thanks') }}>
  const key = `sentiment-voted-${iso3}`;
  if (localStorage.getItem(key)) { /* show thank-you, hide buttons */ }
  document.querySelectorAll('[data-delta]').forEach(btn => btn.addEventListener('click', async () => {
    const delta = Number(btn.dataset.delta);
    try {
      await fetch('/api/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iso3, delta /*, token */ }) });
    } catch { /* silent — content unaffected (D-18) */ }
    localStorage.setItem(key, '1'); /* show thanks */
  }));
</script>
```

### Build-time load (mirror `lib/scores.ts`)
```typescript
// src/lib/sentiment.ts — read at getStaticPaths, never throws
import fs from 'node:fs'; import path from 'node:path';
const P = path.join(process.cwd(), 'data', 'sentiment', 'latest.json');
export function loadSentiment(iso3: string) {
  try { return JSON.parse(fs.readFileSync(P, 'utf-8')).countries?.[iso3] ?? null; }
  catch { return null; } // no file yet → pillar shows "not enough votes" (D-09/D-14)
}
```

## State of the Art

| Old Approach | Current Approach | When | Impact |
|--------------|------------------|------|--------|
| Pages Functions configured only via dashboard | `wrangler.toml` with `pages_build_output_dir` + bindings, reproducible in git | Wrangler 3.45+/ongoing | D-15 is viable; `database_id` lives in git `[CITED]` |
| `node:crypto` in Workers | Web Crypto `crypto.subtle` (no compat flag) | Long-standing | Zero-dep hashing |
| External DB vendor (Supabase) for votes | D1 edge SQLite, same account | D1 GA (2024) | No new vendor (D-11) |

**Deprecated/outdated:** None material. Note training-era guides that configure Pages D1 bindings *only* via dashboard predate config-file support — the config-file route (D-15) is current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Adding `pages_build_output_dir` to the existing `wrangler.toml` won't disrupt the live `functions/index.ts` + `feedback.ts` (compat settings stay as the file already declares them) | Pitfall 2 | Existing redirect/feedback could change behavior on first deploy — **mitigated by an explicit post-deploy smoke test** in the plan |
| A2 | The existing `CLOUDFLARE_API_TOKEN` will need **explicitly granted D1 read** before the pipeline can query (deploy tokens are often Pages-scoped only) | Pattern 2, Runtime Inventory | Pipeline can't read votes until token is regranted — **already deferred as a manual step; pipeline degrades gracefully (D-14)** |
| A3 | Astro exposes `import.meta.env.PUBLIC_TURNSTILE_SITEKEY` to the client bundle at build | Supporting stack | If wrong, the widget can't read the sitekey at build — verify against Astro env-vars docs before implementing; low risk (documented, long-standing) |
| A4 | Vote volume stays far below 100k writes/day and full-table reads stay within 5M/day | D-16, Pitfall 8 | Only at implausibly high traffic; index + window mitigate |
| A5 | Turnstile test keys (`1x…AA` / `1x…0AA`) are current | Pattern 3 | Only affects local/CI testing; verify on the CF testing page |

## Open Questions

1. **Does the existing deploy API token already have D1 permissions, or is a new/expanded token needed?**
   - Known: `deploy.yml` uses `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`; both exist as repo secrets.
   - Unclear: whether that token's scope includes D1 read (needed by the pipeline).
   - Recommendation: plan for graceful degradation (D-14) and list "grant token D1 read" as the manual user step (already deferred). The vote-write path uses the D1 *binding*, not the token, so ingestion works regardless.

2. **One D1 database for prod, or separate preview DB?**
   - Known: master→production only; no preview-branch writes today.
   - Recommendation: single top-level `[[d1_databases]]` binding (production). Add `[[env.preview.d1_databases]]` only if preview branches must accept votes.

3. **Where does the pipeline read `database_id` from?**
   - Recommendation: read it from `wrangler.toml` (parse) or define it as a shared constant in `src/pipeline/sentiment/`. Committing it in `wrangler.toml` per D-15 makes the toml the single source; a tiny TOML read or a duplicated constant both work.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `wrangler` | D1 create + schema apply + local dev | ✓ | 4.75.0 (`npx wrangler`) | — |
| `@astrojs/cloudflare` | (present; Pages runtime types) | ✓ | ^13.1.2 | — |
| Node.js | build + pipeline | ✓ | v25.6.1 local / 22 in CI | — |
| Cloudflare D1 database | vote storage | ✗ (not created yet) | — | **Blocking for ingestion** — orchestrator creates it (D-15, Task #4) |
| D1 binding attached to Pages project | `env.DB` in Function | ✗ | — | Blocking — via `wrangler.toml` after `pages_build_output_dir` added |
| `CLOUDFLARE_API_TOKEN` w/ D1 read | pipeline aggregation | ✗ (token exists, D1 perm unverified) | — | Pipeline degrades gracefully (D-14); manual grant deferred |
| `VOTE_HASH_SALT` (Pages secret) | dedupe hashing | ✗ | — | Function can default to a build-time constant salt, but a real secret is recommended |
| `TURNSTILE_SECRET_KEY` / `PUBLIC_TURNSTILE_SITEKEY` | bot defense | ✗ | — | Env-gated — endpoint + widget work without it (D-12) |
| `@cloudflare/workers-types` | (only if strict typing chosen) | ✗ (absent) | — | Use `context: any` per `feedback.ts` — no install |

**Missing dependencies with no fallback (must be provisioned):** the D1 database + its Pages binding (Task #4 in the task list). Everything else has a graceful fallback or is env-gated.

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node built-in `node:test` + `node:assert` (via `tsx`) |
| Config file | none — scripts in `package.json` (`test:pipeline`, `test:freshness`) |
| Quick run command | `node --import tsx --test src/pipeline/**/__tests__/*.test.ts` (scoped file for the changed module) |
| Full suite command | `npm run test:pipeline && npm run test:freshness` then `npx astro build && npm run validate:seo` |

### Phase Requirements → Test Map
| Decision | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|--------------|
| D-08 | recency-weighted mean → scale → clamp ±1.0 | unit | `node --import tsx --test src/pipeline/sentiment/__tests__/aggregate.test.ts` | ❌ Wave 0 |
| D-07 | `perceived = clamp(official + correction, 1, 10)` | unit | (same file) | ❌ Wave 0 |
| D-09 | count < 5 ⇒ insufficient (no correction shown) | unit | (same file) | ❌ Wave 0 |
| D-06 | total `score` byte-identical with/without sentiment present | unit | extend `src/pipeline/scoring/__tests__/engine.test.ts` OR new guard | ❌ Wave 0 |
| D-01/D-02 | Function rejects delta ∉ {−2..2}, unknown iso3 | integration | `wrangler pages dev` + local D1: `curl -XPOST :8788/api/vote` | ❌ Wave 0 (manual/local) |
| D-12 | dedupe: 2nd vote same hash/window rejected; Turnstile skipped when secret absent | integration | local D1 seeded; assert row count | ❌ Wave 0 (manual/local) |
| D-14 | pipeline completes with D1 unreachable / empty | unit | mock `fetch` → aggregation returns `[]`, keeps last file | ❌ Wave 0 |
| D-22 | country `@graph` invariant + description uniqueness intact | integration | `npx astro build && npm run validate:seo` (existing gate) | ✅ exists |
| D-05/D-19 | 7 locales render pillar/CTA; hreflang intact | integration | `validate:seo` hreflang checks (existing) | ✅ exists |

### Sampling Rate
- **Per task commit:** the scoped unit file (`aggregate.test.ts`) + `tsc`/`astro check` where relevant.
- **Per wave merge:** `npm run test:pipeline && npm run test:freshness`.
- **Phase gate:** `npx astro build && npm run validate:seo` green (D-22), plus a manual `wrangler pages dev` smoke of `/api/vote` against a local D1.

### Wave 0 Gaps
- [ ] `src/pipeline/sentiment/__tests__/aggregate.test.ts` — covers D-07/D-08/D-09/D-14 (pure functions; no network).
- [ ] Score-invariance guard — asserts D-06 (sentiment presence never changes `score`).
- [ ] Local D1 for integration: `wrangler d1 create` (or `--local`) + `wrangler pages dev dist/client --d1 DB=<name>`; seed rows to exercise dedupe.
- [ ] No new framework install needed — `node:test` + `tsx` already present.

## Security Domain

> `security_enforcement` not set in config (absent = enabled). This phase adds a **public, unauthenticated write endpoint** — real attack surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Anonymous by design (community votes); identity is a salted, rotating hash only |
| V3 Session Management | no | Zero cookies, no sessions (D-12/D-20); localStorage is soft UX only |
| V4 Access Control | partial | Rate-limit + dedupe per salted-hash + Turnstile (env-gated) is the only "access" gate |
| V5 Input Validation | **yes** | Validate `iso3` ∈ known country set, `delta` ∈ {−2..2}, reject oversized/malformed bodies (mirror feedback.ts length caps) |
| V6 Cryptography | **yes** | SHA-256 via Web Crypto for hashing only (not secrecy); salt stored as a secret; never hand-roll |
| V7 Error Handling & Logging | yes | Never log raw IP; the Function returns generic 4xx/5xx; failures must not leak internals |
| V13 API Security | **yes** | The `/api/vote` endpoint — method allow-list (POST), body-size cap, Turnstile, rate-limit |

### Known Threat Patterns for {Pages Function + D1 + public vote endpoint}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via `iso3`/`delta` | Tampering | **Parameterized queries** (`?` params) — D1 prepared statements / REST `params` array; never string-concat SQL |
| Ballot stuffing / spam votes | Tampering, Repudiation | Salted-hash dedupe window + per-hash daily cap + Turnstile (env-gated) |
| PII leak (raw IP) | Information Disclosure | Hash IP with secret salt + weekly bucket; never store or log raw IP (D-12/D-20) |
| Endpoint abuse to exhaust free tier / DoS | Denial of Service | Cloudflare edge rate-limiting; single INSERT/vote; 100k writes/day headroom (D-16); Turnstile when enabled |
| Score manipulation displayed as fact | Tampering | Hard ±1.0 correction cap (D-08); pillar labeled community-derived; vote floor (D-09) |
| Cross-origin abuse | Spoofing | Same-origin POST (`connect-src 'self'`); optional origin/hostname check via Turnstile `hostname` field |
| Config-activation regressions | (operational) | Post-deploy smoke test of existing functions (Pitfall 2) |

## Sources

### Primary (HIGH confidence)
- **This repo** (read directly): `functions/api/feedback.ts`, `functions/index.ts`, `functions/_middleware.ts`, `wrangler.toml`, `.github/workflows/deploy.yml` + `data-pipeline.yml`, `astro.config.mjs`, `src/pipeline/run.ts` + `scoring/{engine,history,snapshot}.ts` + `utils/fs.ts`, `src/lib/scores.ts`, `src/i18n/{ui,utils}.ts`, `src/components/country/{PillarBreakdown,PillarDetailTable,ScoreHero}.astro`, `src/pages/en/country/[slug].astro`, `src/pages/en/feedback/index.astro`, `src/layouts/Base.astro`, `public/_headers`, `scripts/validate-seo.ts`, `src/pipeline/types.ts`, `package.json`.
- Cloudflare Pages Wrangler configuration — https://developers.cloudflare.com/pages/functions/wrangler-configuration/ (`pages_build_output_dir` required; `[[d1_databases]]` fields; env overrides)
- Cloudflare D1 query REST API — https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/query/ (`POST /accounts/{id}/d1/database/{db}/query`)
- Cloudflare Turnstile server-side validation — https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ (`siteverify` endpoint + params + response)
- Cloudflare Turnstile testing keys — https://developers.cloudflare.com/turnstile/troubleshooting/testing/
- Cloudflare D1 limits/pricing — https://developers.cloudflare.com/d1/platform/limits/ + /pricing/ (5M reads, 100k writes, 5GB, 500MB/DB, 10 DBs — free)

### Secondary (MEDIUM confidence)
- Cloudflare Pages Functions bindings/routing — https://developers.cloudflare.com/pages/functions/bindings/ + /routing/ (dashboard binding alt; file-based routing `functions/api/vote → /api/vote`)
- Astro environment variables (`PUBLIC_` client exposure) — https://docs.astro.build/en/guides/environment-variables/ (A3, verify at implementation)

### Tertiary (LOW confidence)
- None relied upon.

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every primitive is either already live in this repo or documented on canonical Cloudflare pages fetched this session.
- Architecture: **HIGH** — three existing Pages Functions + the pipeline's fetch/`data/` idiom are direct templates.
- Config wiring (`pages_build_output_dir` + D1 binding): **HIGH** on the requirement, **MEDIUM** on zero-regression to existing functions (A1/Pitfall 2 — mitigated by a smoke test, not fully de-risked without a live deploy).
- Pitfalls: **HIGH** — grounded in the repo's own constraints (hook, 73 MB history file, Report-Only CSP, validate-seo assertions).

**Research date:** 2026-07-02
**Valid until:** ~2026-08-01 for Cloudflare platform specifics (stable); re-verify D1 free-tier numbers and Turnstile test keys if implementing after that.
