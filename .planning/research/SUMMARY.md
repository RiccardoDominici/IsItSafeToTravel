# Project Research Summary

**Project:** IsItSafeToTravel.com — v3.0 Near-Realtime Data Sources & Scoring Overhaul
**Domain:** Travel safety composite index — real-time data pipeline integration
**Researched:** 2026-03-22
**Confidence:** MEDIUM-HIGH

## Executive Summary

IsItSafeToTravel.com is an automated travel safety scoring platform that computes composite 1-10 safety scores for 248 countries from multiple public data sources. The v3.0 overhaul adds four near-realtime data sources (GDELT, ReliefWeb, HDX HAPI, WHO DONs) to a daily pipeline currently driven by three annual indices (GPI, World Bank WGI, INFORM Risk) plus ACLED and government advisories. The recommended approach is to graft realtime signals onto the existing architecture as a bounded adjustment layer — not to replace the annual baselines — because annual peer-reviewed indices provide a stable, authoritative foundation while realtime sources capture crises that annual data misses entirely. Zero new npm dependencies are required; the existing `papaparse` and Node 22 native `fetch()` handle all new sources.

The critical technical decision is formula design before any new fetcher code. The current scoring engine averages all indicators equally. Adding realtime event counts to this formula without tier separation produces wildly volatile scores, systematic English-language media bias (from GDELT), and silent score distribution shifts across all 248 countries. Research into competing approaches confirms the only viable architecture is explicit baseline+signal separation: annual indices contribute 70% of the score, realtime signals contribute at most 30%, and exponential freshness decay governs each source's influence based on data age. This formula degrades gracefully to pure baseline scoring when all realtime sources fail, making migration safe.

The highest-risk element of this milestone is historical continuity. The codebase stores parsed raw data going back to 2012, which makes a full historical backfill technically feasible. Without it, adding new indicators produces a visible "v3 cliff" in every country's trend chart that users will interpret as a real-world safety event. The recommended sequencing is: formula design and backfill planning first, then new fetchers one at a time, then production rollout. Never change the formula and add sources simultaneously.

## Key Findings

### Recommended Stack

No new production npm dependencies are required. The existing pipeline already has `papaparse` (CSV parsing for GDELT), Node 22 native `fetch()` (all HTTP calls), and `AbortSignal.timeout()` (per-request timeouts). The only optional addition is `rss-parser` as a fallback if the WHO DONs JSON API proves unreliable — defer until actually needed.

Four new fetcher files are added to the existing `src/pipeline/fetchers/` directory following the exact pattern established in `acled.ts`. Three new config and utility files are needed: `sources.json` (source tier and decay parameters), `freshness.ts` (decay weight calculator), and `fips-to-iso3.ts` (static FIPS-to-ISO3 mapping for GDELT). The Astro SSG front-end is entirely unchanged.

**Core technologies:**
- **papaparse** ^5.5.3 — CSV parsing for GDELT Stability API output — already installed, no change needed
- **Node 22 native fetch()** — HTTP for all new fetchers — established pattern, no change
- **GDELT Stability Timeline API** — free, no auth, daily instability scores per country — medium confidence due to undocumented rate limits and FIPS country codes requiring a mapping table
- **ReliefWeb API v2** — UN OCHA humanitarian crises, free JSON, requires free appname — highest confidence of the four new sources (10+ years stable, well-documented)
- **HDX HAPI v2** — conflict events + displacement, free JSON, beta API — medium confidence; consolidates ACLED and UNHCR data but API may change
- **WHO DONs API** — active disease outbreaks, free JSON, no auth — medium confidence; country filtering is poorly documented, may need text parsing fallback

### Expected Features

**Must have (table stakes — v3.0 Core):**
- **GDELT Stability fetcher** — only free near-realtime conflict instability signal per country; blocks the core value proposition of v3.0
- **GDACS Disaster Alerts fetcher** — only free near-realtime environment signal (earthquakes, floods, cyclones); fills the environment pillar's realtime gap
- **Baseline + Signal Blending formula** — without this, adding realtime sources produces noise, not insight; critical path blocker for everything else
- **FIPS-to-ISO3 mapping table** — one-time static artifact, prerequisite for GDELT
- **Updated weights.json** — new indicator registrations and rebalanced pillar weights for realtime signals
- **Score change delta indicator** — low-effort visual proof the platform is now dynamic; high perception impact
- **Methodology page update (5 languages)** — transparency is a core project value; must ship with formula changes, not after

**Should have (v3.x — add after core validation):**
- **ReliefWeb Reports fetcher** — humanitarian context beyond GDELT; medium priority, well-documented API
- **WHO DON fetcher** — disease outbreaks; complex text parsing, valuable for health pillar
- **INFORM Severity Index fetcher** — monthly bridge between annual and daily data; requires free ACAPS account
- **Canada + Australia advisory fetchers** — incremental improvement, low risk, existing fetcher pattern
- **Crisis Event Timeline on country page** — UX differentiator; requires event metadata storage model

**Defer (v4+):**
- USGS Earthquake Feed (GDACS already covers earthquakes)
- GHO Health Indicators (WHO API deprecation in flux)
- Sub-national (ADM1) scoring (exponentially more complex)
- Email/RSS score change notifications (requires infrastructure beyond static site)
- Real-time push notifications (contradicts static site architecture)

**Anti-features to explicitly avoid:**
- Full GDELT Event Database ingestion (billions of events; use pre-aggregated Stability API instead)
- EM-DAT database (no API, manual Excel download only)
- Social media sentiment analysis (paid API, NLP pipeline, violates neutrality constraint)
- HDX/OCHA generic connector (18,000 datasets, each with different schema — unbounded integration cost)

### Architecture Approach

The architecture extends the existing clean 5-stage sequential pipeline (Fetch → Load Raw → Score → Snapshot → History Index) with a new tiered scoring engine. All fetchers continue to run in parallel via `Promise.allSettled` and write `{source}-parsed.json` to `data/raw/{date}/`. The fundamental change is in the scoring stage: indicators are separated into BASELINE tier (annual indices: GPI, World Bank, INFORM) and SIGNAL tier (realtime sources: GDELT, ReliefWeb, ACLED, advisories, HDX, WHO DONs), with freshness-decay-weighted blending between them. The static file output format is unchanged; the Astro SSG build remains untouched.

**Major components:**
1. **New fetchers** (`gdelt.ts`, `reliefweb.ts`, `hdx.ts`, `who-dons.ts`) — follow exact `acled.ts` pattern; write country-level aggregates, not event-level detail; fail gracefully with `findLatestCached()` fallback
2. **`freshness.ts`** — exponential decay weight calculator; `weight = e^(-ln(2)/halfLifeDays * ageDays)`, clamped to zero at maxAgeDays; fully independent, unit-testable in isolation
3. **`sources.json`** — source tier config with per-source decay parameters (GDELT: 3-day half-life; ACLED: 14-day; annual baselines: 365-day); drives both scoring engine and methodology page content
4. **`engine.ts` (modified)** — new `computePillarScore()` separates baseline vs signal indicators, computes freshness-weighted averages for each tier, blends at max 30% signal influence scaled by data completeness
5. **`fips-to-iso3.ts`** — static 250-entry FIPS-to-ISO3 lookup table; one-time artifact, no external dependency

### Critical Pitfalls

1. **Score volatility from raw realtime counts** — Never feed raw daily event counts directly into the scoring formula. Apply a 14-30 day EMA or use the baseline+signal bounded adjustment architecture. Raw GDELT data for Germany during an election cycle will drag its safety score down despite no real change in safety. Prevention: baseline contributes 70%, signal caps at 30%, max daily score change capped at 0.3 points.

2. **The "v3 Cliff" — breaking historical continuity** — Changing the formula creates a visible discontinuity in every country's trend chart that users interpret as a real-world safety event. Prevention: backfill all historical snapshots using the `data/raw/YYYY-MM-DD/` archives that exist back to 2012 before shipping the new formula. This is technically feasible and essential.

3. **GDELT English-language media bias** — GDELT measures media volume, not ground truth. Countries with heavy anglophone media coverage (Middle East, Russia) appear systematically more dangerous than equivalently-dangerous countries that receive less Western coverage (Francophone Africa, Central Asia). Prevention: do not use GDELT for cross-country comparison. Use it only for within-country crisis velocity detection (spike relative to the country's own 30-day rolling baseline).

4. **Score inflation/deflation when adding indicators** — The current `foundCount`-based averaging in `engine.ts` changes the effective weight of all existing indicators when a new one is added. A country with GDELT data gets a different formula than one without. Prevention: implement explicit per-indicator sub-weights within pillars; run A/B scoring test before any indicator goes live (reject if more than 10% of countries shift by more than 0.3 points).

5. **Normalization range drift for realtime counts** — Fixed `min/max` ranges in `normalize.ts` suited annual indices but fail for event counts. A major war can exceed the `acled_events: max 5000` cap, causing all countries above threshold to score identically. Prevention: use log-scale normalization for event count data; log how many countries hit the normalization floor or ceiling after each run — more than 15% clamped signals a broken range.

## Implications for Roadmap

The sequencing constraint from combined research is unambiguous: **formula before fetchers, backfill before launch**. The pitfalls research explicitly warns against changing formula and adding sources simultaneously — each change must be validated independently before the next is introduced.

### Phase 1: Foundation — Types, Config, and Formula Design

**Rationale:** The scoring formula is the critical path blocker. Every new fetcher is useless without a formula that correctly incorporates its signal. Starting with formula design also forces explicit decisions about source roles (baseline vs signal, decay parameters) before writing any data-fetching code. This phase produces no visible user change but prevents all four critical pitfalls identified in research.

**Delivers:** Extended `types.ts` with `fetchedAt`/`dataDate`/`SourceTier` fields; `sources.json` with tier and decay parameters for all 9 sources; `freshness.ts` with unit tests; `fips-to-iso3.ts` static mapping; modified `engine.ts` with baseline+signal blending using only existing sources initially; A/B scoring test infrastructure that will validate later phases.

**Features addressed:** Baseline + Signal Blending formula (P1)
**Pitfalls avoided:** Score volatility (P1), score inflation from indicator addition (P4), normalization range drift (P8)
**Research flag:** Standard patterns — formula math is well-established. No additional research phase needed.

### Phase 2: Historical Backfill

**Rationale:** Must happen before any new indicators reach production. The `data/raw/YYYY-MM-DD/` directories contain parsed data back to 2012. A backfill script recalculates all historical snapshots with the new formula and writes corrected score files. Without this, the v3 cliff appears in every trend chart on launch day and is irreversible once users see it.

**Delivers:** Backfilled `history-index.json` with consistent scores across formula versions; `weights.json` version bumped to 5.0.0; methodology changelog entry; version-aware trend chart annotation at formula change date. Note: backfill applies to formula changes only — new sources (GDELT, ReliefWeb) cannot be backfilled as their historical data does not exist in the archives.

**Pitfalls avoided:** Historical continuity cliff (P2 — CRITICAL)
**Research flag:** Standard patterns — existing `scripts/backfill-historical.ts` pattern is documented. No additional research needed.

### Phase 3: First New Fetchers (ReliefWeb + GDACS)

**Rationale:** ReliefWeb has the highest API confidence (UN-backed, 10+ years stable, ISO3 native, well-documented) and should be first. GDACS fills the environment pillar's realtime gap with no auth required. Both integrate cleanly with the formula designed in Phase 1. Validate each fetcher against known crises (2023 Turkey earthquake, 2024 Sudan conflict) before proceeding to Phase 4.

**Delivers:** `fetchers/reliefweb.ts` producing `reliefweb_active_disasters` and `reliefweb_severity` indicators; GDACS fetcher producing environment disaster signals; updated `normalize.ts` ranges derived from real data (not guesses); updated `weights.json` pillar assignments; GitHub Actions secrets `RELIEFWEB_APPNAME`.

**Features addressed:** ReliefWeb Fetcher (P2), GDACS Disaster Alerts Fetcher (P1)
**Pitfalls avoided:** API reliability cascade (P6 — log staleness per source from the start); country name mapping failures (P12 — extend alias table before each new source)
**Research flag:** Both APIs are well-documented with official guides. No additional research phase needed.

### Phase 4: GDELT Stability Fetcher

**Rationale:** GDELT is the highest-impact conflict signal but also the most complex: per-country sequential fetching (~2 minutes at 500ms spacing for 248 countries), FIPS code mapping, and media bias that must be explicitly contained. Implement after Phase 3 validates the fetcher pattern and formula tier behavior. The `fips-to-iso3.ts` table from Phase 1 unblocks this.

**Delivers:** `fetchers/gdelt.ts` with per-country CSV fetching using `papaparse`; `gdelt_instability` indicator in conflict pillar capped at 15% of pillar weight; per-country self-relative spike detection (not cross-country comparison) to avoid media bias.

**Features addressed:** GDELT Stability Fetcher (P1)
**Pitfalls avoided:** GDELT media bias (P3 — CRITICAL); double-counting with ACLED (P11 — GDELT fills velocity signal role, ACLED fills verified event count role)
**Research flag:** GDELT rate limits are undocumented — empirical testing with 10-country sample batch before committing to full 248-country fetch. May need to reduce scope to top-100 countries by travel volume if timing exceeds CI budget.

### Phase 5: WHO DONs Fetcher + Health Pillar Completion

**Rationale:** WHO DONs is the hardest fetcher (semi-structured text, no numeric severity score, country filtering poorly documented). Defer until the pipeline is stable with Phases 3-4. The health pillar baseline (WB child mortality, INFORM health/epidemic) is already strong; this phase enhances rather than enables it.

**Delivers:** `fetchers/who-dons.ts` counting active outbreaks per country in last 90 days via title text parsing + existing `getCountryByName()`; `who_active_outbreaks` indicator in health pillar; ACAPS INFORM Severity fetcher if account registered (optional enhancement).

**Features addressed:** WHO DON Fetcher, INFORM Severity Index Fetcher (both P2)
**Pitfalls avoided:** Over-engineering (P10 — count-based approach, not NLP severity parsing in v3)
**Research flag:** WHO DONs country filtering via OData needs investigation. Fetching all recent DONs and parsing country from title ("Disease - Country" format) is the planned fallback. Light research during implementation recommended.

### Phase 6: Validation, Tuning, and Methodology Documentation

**Rationale:** Run all 9 sources for 2-4 weeks with both old and new formulas in parallel. Compare outputs against known historical crises. Tune decay parameters and signal influence weight based on real evidence. Update methodology page in all 5 languages. Only then flip production to the new formula as the canonical output.

**Delivers:** Side-by-side formula comparison report; empirically tuned decay parameters in `sources.json`; methodology page updated in EN/IT/ES/FR/PT; Score Change Delta Indicator UX component; `score-drift.test.ts` in CI that catches single-day changes above 0.5 points.

**Features addressed:** Score Change Delta Indicator (P1), Methodology Page Update (P1 — all 5 languages)
**Pitfalls avoided:** Documentation drift (P9 — generate methodology content from `weights.json` and `sources.json`); over-engineering (P10 — tuning based on real data, not theoretical guesses)
**Research flag:** Translation workflow for 5 languages may need coordination. Standard documentation work, no technical research needed.

### Phase Ordering Rationale

- Formula must precede fetchers because adding realtime counts to the current equal-averaging formula guarantees critical pitfalls 1, 3, and 4 simultaneously
- Backfill must precede production launch because the v3 cliff is visible and irreversible once users see it
- ReliefWeb before GDELT because lower complexity validates the fetcher pattern and formula tier behavior before tackling GDELT's sequential per-country fetching and bias mitigation
- WHO DONs last among fetchers because it is the most complex (text parsing) and the health pillar already has strong annual baselines
- Validation phase at end because decay parameters need real-world data to tune, not theoretical estimates

### Research Flags

Phases needing empirical investigation during implementation:
- **Phase 4 (GDELT):** Rate limits undocumented; per-country fetch timing needs empirical measurement with a small batch before committing to all 248 countries; consider top-100 scope reduction if timing is a blocker
- **Phase 5 (WHO DONs):** Country filtering via OData is poorly documented; title-parsing regex for "Disease - Country" format needs validation against real DON samples before implementation commits to the approach

Phases with well-established patterns (no additional research needed):
- **Phase 1 (Formula):** Exponential decay is mathematically well-defined; `sources.json` config pattern follows existing `weights.json` precedent
- **Phase 2 (Backfill):** Existing `scripts/backfill-historical.ts` pattern; same pipeline code, different date range
- **Phase 3 (ReliefWeb/GDACS):** Both APIs have detailed official documentation; ISO3-native or well-documented country code handling
- **Phase 6 (Documentation):** Standard multilingual update; methodology content generated from config files

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new npm dependencies; all additions are API integrations over established `fetch()` + `papaparse` pattern already in production |
| Features | MEDIUM | Must-have features are clear. Blending formula has no open-source standard — must be designed from first principles. GDACS not in original STACK.md scope but clearly needed for environment pillar. |
| Architecture | HIGH | Baseline+signal tier separation is the only viable architecture; all four alternatives explicitly documented as anti-patterns with concrete failure modes in ARCHITECTURE.md |
| Pitfalls | HIGH | All four critical pitfalls well-sourced from OECD composite index methodology, ONS GDELT bias research, and academic analysis. Sequencing constraints are unambiguous. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **GDELT rate limits:** Undocumented. Must test empirically with 10-country sample before committing to 248-country sequential fetch. If rate limiting activates, fallback plan is regional batching or top-100 countries by travel volume.
- **HDX HAPI beta stability:** API is v0.9.x. Endpoints may change. Treat as optional enhancement rather than core signal; fall back to direct ACLED for conflict events if HDX HAPI proves unreliable.
- **WHO DONs OData filtering:** Exact filter syntax for `diseaseoutbreaknews` endpoint is poorly documented. Plan to fetch all recent DONs and filter client-side by date, then extract country from title text. Validate against real samples before committing.
- **Decay parameter calibration:** Proposed half-life values (GDELT: 3 days, ACLED: 14 days, annual: 365 days) are reasoned estimates. Actual tuning requires running both formulas in parallel for 2-4 weeks and comparing against known historical crisis events.
- **GDACS scope:** GDACS was identified in FEATURES.md as a table-stakes P1 source for the environment pillar but was not included in the STACK.md fetcher list. Confirm GDACS vs ReliefWeb for environment pillar coverage before implementation (they are complementary, not redundant, but priority needs to be set).
- **Historical backfill scope boundary:** New source data (GDELT, ReliefWeb) cannot be backfilled — historical raw archives do not contain these sources. Only the formula change is backfillable. The history charts will correctly show baseline-only scores before the v3 launch date, then richer baseline+signal scores after. Communicate this in the methodology changelog.
- **Methodology page translation workload:** Updating the formula documentation in EN, IT, ES, FR, PT is significant content work. Consider generating the source list and weights table directly from `sources.json` and `weights.json` to reduce manual translation surface area.

## Sources

### Primary (HIGH confidence)
- [ReliefWeb API Documentation](https://apidoc.reliefweb.int/) — v2 endpoints, field schema, filtering syntax
- [HDX HAPI Documentation](https://hdx-hapi.readthedocs.io/) — API v2 endpoints, country codes, app_identifier auth
- [OECD Handbook on Constructing Composite Indicators](https://www.oecd.org/en/publications/handbook-on-constructing-composite-indicators-methodology-and-user-guide_9789264043466-en.html) — weighting and aggregation risks, distribution alignment requirement
- [GDACS API Quick Start 2025](https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v1.pdf) — event types, filtering, alert severity levels
- [ACLED API Documentation](https://acleddata.com/acled-api-documentation) — existing fetcher pattern validation, pagination limits
- [WHO Disease Outbreak News API](https://www.who.int/api/news/diseaseoutbreaknews/sfhelp) — endpoint reference

### Secondary (MEDIUM confidence)
- [GDELT Stability Dashboard API](https://blog.gdeltproject.org/announcing-the-gdelt-stability-dashboard-api-stability-timeline/) — API verified to exist and return CSV; rate limits undocumented
- [ONS GDELT Data Quality Note](https://www.ons.gov.uk/peoplepopulationandcommunity/birthsdeathsandmarriages/deaths/methodologies/globaldatabaseofeventslanguageandtonegdeltdataqualitynote) — English media over-representation analysis underpinning Pitfall 3
- [Uptrends State of API Reliability 2025](https://www.uptrends.com/state-of-api-reliability-2025) — API uptime declining 60% YoY; informs circuit breaker and staleness tracking recommendations
- [Travel Off Path Traveler Safety Index](https://www.traveloffpath.com/traveler-safety-index/) — competitor methodology; 24-hour editorial audit is the manual equivalent of EMA smoothing
- [Skift Travel Health Index Methodology](https://research.skift.com/reports/methodology/) — baseline+current comparison approach for realtime blending

### Tertiary (LOW confidence)
- [WHO GHO OData API](https://www.who.int/data/gho/info/gho-odata-api) — health indicators; API deprecation announced near end of 2025; deferred to v4+
- HDX HAPI v2 endpoint stability — beta API; based on current docs which may change before implementation

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
