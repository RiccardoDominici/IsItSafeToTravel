# Phase 2: Data Pipeline and Scoring Engine - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated daily pipeline that fetches public safety indices and produces composite 1-10 scores for 200+ countries. Includes data fetching from 3+ public sources, normalization, composite scoring with category breakdowns, and historical storage. Does NOT include frontend display, map rendering, or country pages — those are Phases 3-4.

</domain>

<decisions>
## Implementation Decisions

### Data sources & fetching
- Primary sources: Global Peace Index (GPI), INFORM Risk Index, ACLED conflict data, government travel advisories (US State Dept, UK FCDO)
- Sources without REST APIs (e.g., GPI CSV) fetched via direct download and parsed
- Each source normalized to 0-1 range before combining into composite score
- If a source is unavailable or rate-limited: use cached last-known data, log warning, continue pipeline — never block the entire run for one source

### Scoring formula design
- 5 category sub-scores as required: conflict, crime, health, governance, environment
- Category weights stored in external JSON config file (not hardcoded) — equal weights as starting default
- Missing data handled gracefully: score with available categories, include data completeness percentage per country
- Composite score output: 1-10 scale with one decimal precision (e.g., 7.3), rounded to integer for display contexts

### Storage & history format
- Computed scores stored as JSON files in the repository (git-tracked), one snapshot per day
- Directory structure: `data/scores/YYYY-MM-DD.json` for daily snapshots, plus `data/scores/latest.json` as current copy
- Raw fetched data retained in `data/raw/YYYY-MM-DD/` for auditability and debugging
- All history retained in repo — frontend reads last 30/90 days for trend analysis

### Pipeline architecture
- GitHub Actions cron workflow running on a 24h schedule
- Node.js/TypeScript scripts consistent with the Astro project stack
- Per-source try/catch — pipeline continues if individual source fails, exit code reflects partial failures
- JSON output in `data/` directory, imported by Astro pages at build time (static generation compatible)

### Claude's Discretion
- Exact GitHub Actions cron schedule timing
- TypeScript project structure for pipeline scripts (src/pipeline/ or scripts/ or similar)
- Specific parsing libraries for CSV/Excel/JSON sources
- Country code standard (ISO 3166-1 alpha-2 vs alpha-3) — pick what best serves downstream consumers
- Retry logic for transient network failures
- Logging format and verbosity levels

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — Core value, constraints (near-zero budget, free APIs only, Cloudflare hosting)
- `.planning/REQUIREMENTS.md` — DATA-01 through DATA-05 define pipeline requirements
- `.planning/STATE.md` — Blockers: data source access verification needed, scoring weights must be externalized

### Prior phase context
- `.planning/phases/01-project-foundation/01-CONTEXT.md` — Phase 1 decisions: Astro 6, Tailwind CSS 4, Cloudflare Pages, Node.js >=22.12

### Research (from Phase 1)
- `.planning/research/STACK.md` — Technology stack decisions (Astro, Cloudflare)
- `.planning/research/ARCHITECTURE.md` — Architecture patterns, SSG approach

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/i18n/utils.ts` — i18n utilities, country name translations may be needed for score output
- `.github/workflows/deploy.yml` — Existing CI/CD workflow, pipeline cron workflow follows same patterns
- `package.json` — Node.js >=22.12, ESM project (`"type": "module"`)

### Established Patterns
- Astro 6 with Tailwind CSS 4, TypeScript, ESM modules
- Cloudflare Pages deployment via GitHub Actions
- No existing data processing patterns — this phase establishes them

### Integration Points
- Pipeline output (`data/scores/latest.json`) will be consumed by Astro pages in Phases 3-4
- Country codes in score data must align with map library country codes (Phase 3)
- Historical data format must support sparkline/trend rendering (Phase 4, CTRY-03)
- Source metadata must support citation rendering (Phase 4, CTRY-05)

</code_context>

<specifics>
## Specific Ideas

- Budget constraint is critical: all data sources must be free/open-access — no paid APIs or data subscriptions
- Pipeline must be fully automated with zero manual intervention (DATA-04)
- Transparency is a core value: raw data retention and clear source attribution enable the methodology page (Phase 5, TRNS-01)
- Scoring weights externalized so they can be adjusted without code changes (noted as blocker in STATE.md)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-data-pipeline-and-scoring-engine*
*Context gathered: 2026-03-19*
