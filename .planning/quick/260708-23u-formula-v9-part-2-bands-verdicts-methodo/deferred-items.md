# Deferred Items — quick-260708-23u (Formula v9 PART 2)

Out-of-scope discoveries surfaced while executing this plan. None were fixed here (per the
plan's explicit `files_modified` scope + deviation-rule scope boundary) — logged for a future
quick task or phase.

## 1. `CLAUDE.md` "Scoring" section is now stale

`CLAUDE.md`'s own "Scoring (`src/pipeline/scoring/engine.ts`)" section still describes the
removed v8.x mechanism verbatim: "a hard cap (Level-4 'Do Not Travel' advisory → score ≤ 2) and
a critical floor (any well-measured pillar < 0.25 caps the score)". This is now factually wrong
post Formula v9 (PART 1 + this plan). `CLAUDE.md` was not in this plan's `files_modified` list,
so it was left untouched. Recommend a short follow-up edit describing v9 (uncertainty-weighted
Bayesian shrinkage, no hard caps/floors) to keep the project's own agent-facing docs accurate.

## 2. `README.md` has broader pre-v9 staleness beyond the Scoring Methodology section

Fixed in this plan: the "Scoring Methodology" section, the "Tiered scoring" Features bullet, the
"tiered baseline+signal architecture" phrase in the intro paragraph, and the `scoring/` line in
the project-structure diagram.

NOT fixed (pre-existing, unrelated to v9, out of this plan's scope):
- "**7 public data sources**" (intro paragraph, line 15) and the Data Sources table (lines
  29-41) only list 7 source *providers* — the real number is 40+ (37 government advisories +
  World Bank/V-Dem/GPI/INFORM/ReliefWeb/GDACS), a pre-existing undercount unrelated to the v9
  formula change.
- "World Bank WGI" is referenced twice (Features bullet line 23, Data Sources table line 33) —
  WGI was retired and replaced by V-Dem Institute v16 back in quick-260511-k2m (2026-05-11).
  This README was never updated for that migration.
- The project-structure diagram's locale list ("EN, IT, ES, FR, PT locale routing" /
  `i18n/ ... (en, it, es, fr, pt)`) is missing zh/de, added in Phase 38 (2026-05-03).
- Fetcher count ("7 fetchers") undercounts the actual number of advisory-source fetcher modules.

## 3. `src/lib/colors.ts` — undocumented duplicate of `map-utils.ts`'s color scale (FIXED, not deferred)

Not a deferral — flagging for visibility since it wasn't in the plan's `files_modified` list.
`src/lib/colors.ts` had the identical stale `.domain([1, 5.5, 10])` d3 color scale as
`map-utils.ts` (its own comment says "MUST match src/lib/map-utils.ts hex constants exactly").
It backs `scoreToColor()`, used by ScoreHero's badge background, GlobalScoreBanner, TrendChart,
TrendSparkline, Search, and all `/compare/` pages across all 7 locales. Fixed alongside
map-utils.ts in Task 1 (Rule 1 — directly in scope of "map color buckets... recalibrate to the
new bands").

## 4. `methodology.indicator.A` — missing i18n key (FIXED, not deferred)

Not a deferral — flagging for visibility. `weights.json` v9.0.0 (shipped in PART 1) added a
synthetic `A` (advisory-consensus) indicator to the Conflict pillar's `indicators` array, but no
`methodology.indicator.A` i18n key existed. Since PART 1 was already live on production, the
methodology page's Category Weights table was rendering the literal string `"undefined"` in the
Conflict row's indicator list. Fixed in Task 2 (added the key ×7 locales) as a Rule 1 bug fix,
since it directly affects the methodology page this plan was chartered to correct.
