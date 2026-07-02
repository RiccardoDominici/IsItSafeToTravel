# Phase 39: Community Sentiment Score (Phase 1 — display-only) - Context

**Gathered:** 2026-07-02 (decisions locked by user on 2026-06-05; recorded in project memory)
**Status:** Ready for planning

<domain>
## Phase Boundary

Visitors on a country page can calibrate the official 1–10 safety score with a 5-level
"does this feel right?" vote. Votes are ingested live by a Cloudflare Pages Function into
D1, aggregated once a day by the existing GitHub Actions pipeline into static data, and
surfaced as a NEW translated 6th pillar "Sentiment" on country pages — **display-only,
weight 0, the total score is NOT affected**. The methodology page (all 7 languages)
documents the pillar and states clearly that it does not affect the total.

Out of scope (Phase 2, later): weighting Sentiment into the total score and rebalancing
the existing 5 pillar weights.
</domain>

<decisions>
## Implementation Decisions

### Vote mechanism (LOCKED by user 2026-06-05)
- **D-01:** CALIBRATION, not like/dislike. User sees the official score and says whether it feels off. Binary voting explicitly rejected.
- **D-02:** 5 levels — "molto alto / alto / giusto / basso / molto basso" (way too high / too high / about right / too low / way too low) → signed deltas **−2 / −1 / 0 / +1 / +2**. "Score troppo alto" ⇒ community thinks safety is LOWER ⇒ negative delta.
- **D-03:** The aggregate is a community **correction** to the algorithmic score, not an independent rating.

### Sentiment pillar (LOCKED by user 2026-06-05)
- **D-04:** Surfaced as a NEW 6th pillar "Sentiment" alongside conflict/crime/health/governance/environment on the country page, styled like the others.
- **D-05:** Pillar label translated in **all 7 languages** (en, it, es, fr, pt, zh, de) via `src/i18n/ui.ts`, like every other UI label.
- **D-06:** **Phase 1 = display-only.** Effective weight 0. `src/pipeline/scoring/engine.ts`'s weighted geometric mean stays exactly the current 5 pillars. The pillar is visible but inert.
- **D-07:** Resolution of the open "absolute vs correction" tension → the pillar DISPLAYS an absolute community-perceived value = `clamp(official_score + capped_correction, 1, 10)` so it reads on the same 1–10 scale as the other pillars; the DATA MODEL stores raw signed deltas (votes) and the aggregated correction. Show the correction explicitly next to it (e.g. "+0.4 vs official") plus vote count. Revisit mapping in Phase 2.

### Aggregation & caps
- **D-08:** Aggregate = recency-weighted mean of vote deltas, scaled to score points, with a hard **cap of ±1.0 point** (community nudges, never overrides the algorithm). Cap and scaling live as named constants — easily tunable.
- **D-09:** Minimum vote floor before the pillar shows data (default: 5 votes per country); below the floor show a localized "not enough votes yet" state with the vote CTA.
- **D-10:** Keep a daily time series of the aggregated correction per country (reuse the score-history pattern under `data/`), so evolution over time can be charted later. Baking daily matches the existing score cadence.

### Architecture (LOCKED by user 2026-06-05 — Cloudflare-native; NOT Supabase, NOT pure GHA)
- **D-11:** **Ingestion:** Cloudflare **Pages Function** in this same Pages project (`functions/api/vote` at repo root → `/api/vote`) writing append-only vote rows to **D1** (edge SQLite). Zero new vendors; same deploy + secrets as today.
- **D-12:** **Anti-abuse:** rate-limit + dedupe per visitor inside the Function (privacy-preserving: salted hash of IP, never store raw IP — the site advertises a zero-cookie architecture) + **Cloudflare Turnstile**, but Turnstile must be **env-gated**: if `TURNSTILE_SECRET_KEY` / public site key are not configured, the endpoint still works (verification skipped, rate-limit still on). One-time widget creation is a manual user step.
- **D-13:** **Aggregation/baking:** the existing **daily GitHub Actions pipeline** (`src/pipeline/run.ts`, `data-pipeline.yml`, 06:00 UTC) pulls vote aggregates from D1 (Cloudflare HTTP API using an API token secret), normalizes, and bakes Sentiment into static data. Pages stay fully static (Astro 6 SSG, no SSR); the pillar updates once a day.
- **D-14:** **Graceful degradation everywhere:** if D1 is unreachable / token missing / no votes, the pipeline completes normally and the site builds with the last-known (or empty) sentiment data. The vote endpoint failing must never break the static site.
- **D-15:** D1 binding for the Pages Function is declared in a `wrangler.toml` in the repo (Pages supports config-file bindings) so `wrangler pages deploy` in `deploy.yml` keeps working. **The D1 database is ALREADY PROVISIONED** (created 2026-07-02 via Cloudflare API): name `isitsafetotravel-sentiment`, `database_id: 83acaffe-32ff-43fc-b68f-5343d01000d5`, region WEUR. Use these exact values in `wrangler.toml` (binding name `DB`). Schema migration still needs to be applied (a task must apply the schema via the Cloudflare D1 HTTP API or `wrangler d1 execute --remote`).
- **D-16:** Free-tier budget (verified 2026-06-05): Functions 100k req/day, D1 5M reads + 100k writes/day. Design must not exceed this at current traffic (single INSERT per vote; aggregation reads once daily).

### Frontend widget
- **D-17:** Vote widget sits on the country page near the score/pillar display: shows the official score context and asks the 5-level calibration question. All strings localized in 7 languages. After voting: thank-you state + dedupe via localStorage (soft) so the same visitor isn't re-prompted for that country.
- **D-18:** Plain progressive-enhancement JS (fetch POST to `/api/vote`), matching the site's existing no-framework client-script patterns. No cookies. If JS disabled or endpoint down, the widget degrades silently (site content unaffected).

### Documentation (LOCKED by user 2026-06-05)
- **D-19:** Methodology page in **all 7 languages** gains a Sentiment section: how community calibration works, the 5 levels, the cap, and an explicit statement that in Phase 1 it does **NOT** affect the total score. Localized methodology slugs come from `src/i18n/ui.ts` `routes`.
- **D-20:** Privacy policy pages get a short addition covering vote processing (salted-hash dedupe, no raw IP retention, Turnstile when enabled) — keep it honest with the zero-cookie claim (localStorage note).

### Scope guards
- **D-21:** Sentiment does NOT enter: map category filters, comparison page, rankings/hub pages, llms.txt generators, OG images. Country page + methodology + privacy only. (Keeps Phase 1 contained.)
- **D-22:** `npm run validate:seo` must stay all-pass — country page `@graph` (WebPage + Place + FAQPage + TouristDestination + Dataset) untouched or still valid.

### Claude's Discretion
- Exact recency-weighting curve (e.g. half-life) and the vote-row schema details
- Rate-limit thresholds (e.g. N votes/IP-hash/day) and salt rotation scheme
- Widget visual design within existing Tailwind v4 design language
- Whether sentiment static data lives in `public/scores.json` vicinity or a new `data/sentiment/` + `public/` artifact (pick what the country pages can read at build time cleanly; do NOT hand-edit generated files — extend generators/pipeline)
- Naming of i18n keys, component file names, D1 table names
</decisions>

<specifics>
## Specific Ideas

- The calibration model works because the country page already shows the official score the user reacts to.
- Reuse the score-history pattern (`data/scores/**`) for the sentiment time series — but beware `data/scores/history-index.json` is ~73MB and near GitHub limits; keep sentiment history in its own small file(s), NOT appended to history-index.json.
- "Community can nudge ±X, not override the algo" — the cap is a product stance, surface it in the methodology text.
</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scoring & pipeline
- `src/pipeline/scoring/engine.ts` — weighted geometric mean of 5 pillars; Phase 1 must NOT change the total-score math
- `src/pipeline/run.ts` — daily pipeline entry (fetch → score → snapshot); sentiment aggregation step hooks in here
- `.github/workflows/data-pipeline.yml` — daily 06:00 UTC batch; commits data + triggers deploy
- `.github/workflows/deploy.yml` — build + `wrangler pages deploy` on master push

### i18n & pages
- `src/i18n/ui.ts` — `languages`, `ui` string blocks per locale, `routes` localized slugs (single source of truth)
- `src/i18n/utils.ts` — `getLocalizedPath` / `getAlternateLinks`
- Country page templates under `src/pages/` per locale (localized `country`/`paese`/`pais`/`pays`/`land` slugs) — pillar display markup to extend
- Methodology pages `src/pages/<lang>/methodology/index.astro` (localized slugs)

### SEO invariants
- `scripts/validate-seo.ts` — post-build gate; must stay all-pass
- `src/lib/seo.ts` — JSON-LD generators (country `@graph` invariant)
- `CLAUDE.md` — generated-files table (llms.txt, scores.json, og/** are generator-owned; a PreToolUse hook blocks hand-edits)

### Project memory (inlined above; original at)
- `~/.claude/projects/-Users-riccardo-Developer-VibeCoding-Isitsafetotravel/memory/project_community_score.md` — full decision record 2026-06-05
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Score-history time-series pattern (`data/scores/**`, history charts) — model for sentiment history
- Existing pillar display components on country pages — extend for a 6th display-only pillar
- i18n plumbing (`ui.ts` + utils) — add `sentiment.*` keys across 7 locales
- Daily pipeline fetcher pattern (fetch → parse → data/raw → score) — sentiment aggregation is a new, simpler step (D1 HTTP API → aggregate → bake)

### Established Patterns
- Astro 6 SSG only, no SSR — the ONLY dynamic surface is the new Pages Function
- Graceful source fallback: every pipeline source degrades without breaking the run — sentiment must follow
- Atomic commits per task; commit+push to master deploys production

### Integration Points
- `functions/api/vote.ts` (new, repo root `functions/` dir — Cloudflare Pages Functions convention)
- `wrangler.toml` (new) — D1 binding for Pages
- Country page pillar section + new vote widget component
- `src/pipeline/run.ts` + new `src/pipeline/fetchers|sentiment` module
- Methodology + privacy pages ×7 locales
</code_context>

<deferred>
## Deferred Ideas

- **Phase 2:** weight Sentiment into the total (pick weight, rebalance the current 30/25/20/15/10, decide how it folds into the geometric mean in engine.ts)
- Recency-window filtering UI / sentiment history charts on the country page (data is collected from day one; charting can come later)
- Turnstile widget creation + `TURNSTILE_SECRET_KEY` secret — one-time manual user step (feature is env-gated until then)
- Granting the GHA pipeline's Cloudflare API token D1 read permission — manual user step; pipeline degrades gracefully until done
</deferred>

---

*Phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib*
*Context gathered: 2026-07-02*
