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
| `npm run pipeline` / `npx tsx src/pipeline/run.ts [YYYY-MM-DD]` | Run the data pipeline (fetch → score → snapshot). |

## Do NOT hand-edit generated files (a PreToolUse hook blocks this)

| Generated output | Edit instead |
|---|---|
| `public/llms.txt`, `public/llms-full.txt` | `scripts/generate-llms-full.ts` |
| `public/scores.json`, `data/scores/**`, `data/raw/**`, `data/history/**`, `data/sentiment/**` | the pipeline (`src/pipeline/run.ts`) |
| `public/og/**` | `scripts/generate-og-images.ts` |
| `dist/**` | `npm run build` |

## Deploy & the daily pipeline

- Push to `master` → `deploy.yml` runs `npm run build` + `wrangler pages deploy`. Committing
  to master ships to production (per project convention — commit+push after changes).
- `data-pipeline.yml` runs daily at **06:00 UTC**, commits `data: update safety scores …`,
  and triggers deploy. **Before pushing, `git pull --rebase --autostash`** — the bot commits
  often and will reject a stale push.

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

## Scoring (`src/pipeline/scoring/engine.ts`) — Formula v9.1

Uncertainty-weighted (Bayesian shrinkage) scoring. Per pillar: precision-weighted value shrunk
toward a conservative advisory/region-informed prior (`p̂ = (n·p + K·μ)/(n + K)`, K=1.0) —
missing data collapses to the prior, never inflates. Composite = weighted **geometric** mean of
5 pillars (conflict 30% / crime 25% / health 20% / governance 15% / environment 10%, UNCHANGED)
blended with an acute soft-min term over conflict+crime (λ=0.25, down-only), times a count-damped
severe-advisory modifier (`1 − 0.32·severeShare·nAdv/(nAdv+6)`); `score = 1 + 9·composite^0.96`.
Crime = GPI Safety & Security (67%) + World Bank intentional-homicide rate (33%, precision scaled
by population, half-saturation `P_HALF=200000` — small-population homicide rates are damped as
statistical noise). Conflict = GPI overall (32.75%) + GPI militarisation (11.25%) + advisory
consensus `A` (28%) + UCDP GED conflict-deaths (28%, log-normalized, `D_MAX=24000`). A continuous
advisory nudge/severe ramp replaces hard thresholds — no hard caps, floors, or eligibility gates.
Scores ≈ [3.4, 8.9], mean ~6.60; bands UNCHANGED: <5 danger / 5–6 high caution / 6–7 moderate /
7–8 good / ≥8 excellent. Constants frozen in `weights.json` (key stays `formulaV9` regardless of
formula version); parity fixture: `scripts/verify-formula-v91-parity.ts`. `confidence` field per
country (score-adjacent "limited data" UI flag below 0.4).

## Known constraints

- Build is the main friction (~400s). Prefer `astro build` + `validate:seo` when iterating.
- `data/scores/history-index.json` is large (~73MB) and approaching GitHub limits.
