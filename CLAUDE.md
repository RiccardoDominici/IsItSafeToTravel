# CLAUDE.md — isitsafetotravel.org

Free, open-source travel-safety platform. **Astro 6 SSG** + Tailwind v4, deployed on
**Cloudflare Pages**. 248 countries × 7 languages (en, it, es, fr, pt, zh, de) ≈ 1892
prerendered static pages. No SSR. Focus: Core Web Vitals, classic SEO, and citability by
AI answer engines.

## Commands

| Command | What |
|---|---|
| `npm run dev` | Astro dev server |
| `npm run build` | `generate:og` → `generate:llms` → `astro build` → `validate:seo`. **Slow (~400s)** — the OG step regenerates 248 images. To iterate faster, run `npx astro build` directly (OG/llms already on disk) then `npm run validate:seo`. |
| `npm run validate:seo` | Post-build SEO gate (`scripts/validate-seo.ts`) against `dist/client`. **Must stay all-pass** before committing SEO/schema changes. |
| `npm run generate:llms` | Regenerate `public/llms.txt` + `public/llms-full.txt` (fast). |
| `npm run pipeline` / `npx tsx src/pipeline/run.ts [YYYY-MM-DD]` | Run the data pipeline (fetch → score → snapshot → news). |
| `npx tsx --test src/pipeline/news/__tests__/engine.test.ts` | News-engine unit tests (plain `node --test` fails — needs tsx). |
| `npx tsx scripts/send-daily-digest.ts --dry-run` | Newsletter digest dry-run (no emails, no D1 writes). |

## Do NOT hand-edit generated files (a PreToolUse hook blocks this)

| Generated output | Edit instead |
|---|---|
| `public/llms.txt`, `public/llms-full.txt` | `scripts/generate-llms-full.ts` |
| `public/scores.json`, `data/scores/**`, `data/raw/**`, `data/history/**`, `data/sentiment/**`, `data/news/**` | the pipeline (`src/pipeline/run.ts`) |
| `public/og/**` | `scripts/generate-og-images.ts` |
| `dist/**` | `npm run build` |

## Deploy & the daily pipeline

- Push to `master` → `deploy.yml` runs `npm run build` + `wrangler pages deploy`. Committing
  to master ships to production (per project convention — commit+push after changes).
- `data-pipeline.yml` runs daily, commits `data: update safety scores …`, and triggers deploy.
  **Before pushing, `git pull --rebase --autostash`** — the bot commits often and will reject a
  stale push.
- The daily run is **started at 06:05 UTC by a Cloudflare Worker** (`workers/pipeline-trigger`,
  `workflow_dispatch`, retries at 06:40 and 08:05), because GitHub's own cron fired 4–8 h late in
  Sept–Oct 2026. GitHub's cron (06:17) stays as a fallback; its `guard` job skips it once today's
  run succeeded. Manual corrective runs: `gh workflow run data-pipeline.yml -f skip_digest=true`
  (titled "(no digest)", never counted as the day's run). The Worker deploys separately:
  `npx wrangler deploy --config workers/pipeline-trigger/wrangler.toml` (see its README).

## i18n & hreflang (single source of truth)

- Route slugs are **localized**: `country` / `paese` / `pais` / `pays` / `land`, etc. The map
  lives in `src/i18n/ui.ts` (`routes`).
- `src/i18n/utils.ts` `getLocalizedPath` / `getAlternateLinks` build all cross-locale URLs.
  **Both** the HTML `<head>` hreflang (`Base.astro`) **and** the sitemap (`astro.config.mjs`
  `serialize()`) use these — keep them as the one slug source. (Astro's built-in sitemap i18n
  matcher can't handle localized slugs; we override `item.links` in `serialize()`.)

## SEO / schema invariants

- JSON-LD generators: `src/lib/seo.ts`. Country page `@graph` **must** contain
  `WebPage + Place + FAQPage + TouristDestination + Dataset` — `validate-seo.ts` asserts this.
- Rankings use a **data-coverage floor** (`hasSufficientData`, 4+ sources) in
  `src/lib/hub-data.ts`; the same threshold is duplicated in `scripts/generate-llms-full.ts`
  (`MIN_RANKING_SOURCES`). Keep them in sync, or sparse micro-territories pollute the lists.

## Scoring (`src/pipeline/scoring/engine.ts`) — Formula v10.1 (weights 10.1.0)

Specs: v10 `.planning/quick/261014-formula-v10/SPEC.md` (origin: an external critique of stale,
mislabelled and irrelevant data); v10.1 = four changes from the 2026-10-15 consistency audit
(`scripts/calibration/consistency/`), each gated by `scripts/calibration/compare-formulas.ts`
(audit constraints, community votes, extremes, band changes, 2026-03 reference set). Mechanics
are v9.1's: uncertainty-weighted (Bayesian shrinkage) scoring, per pillar a precision-weighted
value shrunk toward a conservative advisory/region-informed prior (`p̂ = (n·p + K·μ)/(n + K)`,
K=1.0; μ = 0.45 + region offset + advisory nudge, clamped to [0.32, 1], so at most 0.675).
Composite = weighted **geometric** mean of 5 pillars (conflict 30% / crime 25% / health 20% /
governance 15% / environment 10%) blended with an acute soft-min over conflict+crime (λ=0.25,
down-only), times a count-damped severe-advisory modifier (`1 − 0.32·severity·nAdv/(nAdv+6)`,
severity = tier-weighted share with level 4 = 1, **level 3 = 0.5**, levels 1–2 = 0);
`score = 1 + 9·composite^0.96`. Pillar key `environment` stays; its UI label is "Natural hazards".
- Conflict = GPI overall (32.75%) + GPI militarisation (11.25%) + advisory consensus `A` (28%) +
  UCDP GED deaths (28%, log, `D_MAX=24000`; inside the pillar the curve keeps falling past D_MAX,
  floor −0.5, so a 75,000-death war ranks below a 24,000 one); `gpi_conflict` is fetched but
  unscored. Crime = GPI Safety & Security (67%) + World Bank homicide (33%, population-damped,
  `P_HALF=200000`). Health = INFORM Access to health care (55%) + INFORM Epidemic (45%).
  Governance = 3 V-Dem indices + the INFORM **Governance** column (25% each). Environment =
  INFORM Natural (25%) + ReliefWeb (10%) + GDACS (10%), where INFORM Natural scores
  `1 − √(exposure × lack of coping capacity)/10` (`inform_coping`, an engine input only, like
  `wb_population`). No GPI sub-indicators (labels ambiguous), no WHO road deaths (licence forbids
  modification and use next to commercial promotion).
- Only the newest edition of a source counts; a non-advisory value older than `maxAgeYears` (5)
  is missing. INFORM's newest `.xlsx` is discovered on each run (`fetchers/inform-discovery.ts`,
  `inform-edition.ts`) and downloaded only when the edition changes; its year is the edition's.
- Health/governance/environment get a frozen per-pillar affine map (`pillarCalibration`, fitted
  once on 2026-10-14 under v10, never refitted; `scripts/calibrate-v10.ts` reproduces it under
  `v10Configuration`, which strips the v10.1 options).
- **Grey rule:** < `minSources` (4) independent sources → `score: null`,
  `scoreStatus: 'insufficient_data'`, unless the danger guard fires (≥ 3 governments at level 4,
  level-4 severeShare ≥ 0.5, or UCDP deaths > 0). A source counts (and is listed in
  `ScoredCountry.sources`) only when it supplies a value the score uses and is not a disaster-alert
  feed (`scoring/coverage.ts`, the one definition for the engine, rankings, llms.txt and news):
  a population-only World Bank entry is not a source. 65 grey places on 2026-10-15. UI code must
  go through `src/lib/score-status.ts` (`isScored`, `officialScore`, `scoredOnly`, `buildRankMap`),
  never read `.score` directly: grey places show "Partial data" and no number anywhere.
- **Community:** the sentiment stage (Stage 2c) runs BEFORE scoring. Vote → perceived score
  (published score + 0.5·delta; grey places take an absolute rating 1–5 → 2…10; legacy votes
  are anchored via `data/sentiment/legacy-anchors.json`), 180-day window, 30-day half-life, one
  origin country ≤ 50% of the weight. Active at ≥ 30 votes from ≥ 3 origins:
  `score = dataScore + clamp(Z·(P − dataScore), ±1.0)`, `Z = nEff/(nEff+30)`.
Scores ≈ [3.1, 9.0], mean ~6.69 (2026-10-15 data); bands UNCHANGED: <5 danger / 5–6 high caution / 6–7 moderate /
7–8 good / ≥8 excellent. Constants frozen in `src/pipeline/config/weights.json` (key stays
`formulaV9` regardless of formula version); parity: `scripts/verify-formula-v10-parity.ts` on
`scripts/fixtures/v10/raw-2026-10-14` (re-frozen for v10.1). Before changing the formula, run
`npx tsx scripts/calibration/compare-formulas.ts --detail` and keep the gate. Snapshots before
2026-10-15 are v9.1 (trend charts mark the switch). `confidence` field per country
(score-adjacent "limited data" UI flag below 0.4).

## Daily news ("safety movers") + newsletter

- Pipeline Stage 7 (`src/pipeline/news/engine.ts`, non-fatal) diffs the two latest score
  snapshots into language-neutral `NewsEvent`s (6 types: severe_advisory, new_country,
  top10_change, band_change, rank_overtake, score_jump) → `data/news/YYYY-MM-DD.json` +
  rolling `data/news/index.json` (cooldown state). Movement events are suppressed below
  `MIN_NEWS_CONFIDENCE` (0.4, = the "limited data" UI flag); severe_advisory/new_country
  are exempt. `params.confidence` is internal-only — renderers must never show it. Rendering is i18n-template-based
  (`news.*` keys in `src/i18n/ui.ts`, `renderNewsEvent` in `src/lib/news.ts`) — never put
  pre-rendered text in the data files. Homepage section self-hides on 0-event days.
- Newsletter: D1 `subscribers`/`digest_log` tables live in the **isitsafetotravel-sentiment**
  DB (same binding as votes). Double opt-in via `functions/api/{subscribe,confirm,unsubscribe}.ts`;
  Resend adapter in `functions/lib/email.ts`. Daily digest = GH Actions step after the pipeline
  (`scripts/send-daily-digest.ts`), sends only on ≥1-event days, idempotent via `digest_log`;
  needs `RESEND_API_KEY` in **GitHub** secrets (already a Pages secret). Consent record is
  GDPR-load-bearing (`consent_version`, no raw IP — see
  `.planning/quick/260711-daily-news-and-mailing-list/LEGAL-PRIVACY-ASSESSMENT.md`).
- Votes store voter country (`country_iso`, from `request.cf.country`) — country-level only,
  never raw IP.

## Known constraints

- Build is the main friction (~400s). Prefer `astro build` + `validate:seo` when iterating.
- `data/scores/history-index.json` is large (~73MB) and approaching GitHub limits.
