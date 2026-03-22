# Domain Pitfalls: v3.0 Data Sources & Scoring Overhaul

**Domain:** Adding near-realtime data sources to a travel safety composite index
**Researched:** 2026-03-22
**Focus:** Specific risks when grafting realtime event data onto an existing 18-indicator, 5-pillar annual-baseline scoring system (248 countries, daily pipeline)

---

## Critical Pitfalls

Mistakes that cause score unreliability, user trust erosion, or require architectural rewrites.

### Pitfall 1: Score Volatility -- Daily Noise Masquerading as Safety Signal

**Severity:** CRITICAL
**What goes wrong:** Adding a realtime source (GDELT events, news sentiment, ACLED daily counts) directly into the weighted formula causes scores to fluctuate wildly day-to-day. A single mass-casualty event or media storm causes a country's score to drop 2-3 points overnight, then recover the next day when the news cycle moves on. Users see Germany go from 8.5 to 6.2 on a Tuesday and back to 8.3 on Wednesday. This destroys trust in the entire scoring system.

**Why it happens in this codebase:** The current `normalize.ts` uses fixed min/max ranges (e.g., `acled_fatalities: { min: 0, max: 10000 }`). A realtime event count fed through the same normalization will swing between 0.0 and 1.0 based on single-day spikes. The `computeCountryScore` in `engine.ts` averages all pillar indicators equally (`sum / foundCount`) -- a volatile realtime indicator gets the same weight as stable annual GPI data within the pillar.

**Consequences:**
- Users screenshot volatile scores and mock the site on social media
- Historical trend charts in `history-index.json` become jagged noise instead of meaningful trends
- The global score (arithmetic mean of all countries) oscillates sympathetically
- SEO country pages cached by Google show stale scores that conflict with the next day's score

**Prevention:**
1. **Exponential moving average (EMA):** Never feed raw daily counts into scoring. Apply a 14-day or 30-day EMA to smooth realtime signals before normalization. Store the rolling window in a `realtime-buffer.json` alongside daily snapshots.
2. **Baseline + delta architecture:** Compute the annual baseline score separately from realtime adjustments. Realtime signals only apply a bounded adjustment (e.g., max +/- 1.5 points on the 1-10 scale). This is the most important architectural decision for v3.0.
3. **Minimum observation window:** Require at least 7 days of data before a new realtime signal affects the score. One bad day should not move scores.
4. **Score change dampening:** Cap maximum daily score change at 0.3 points. If the raw calculation says Cuba should drop from 5.2 to 2.1 overnight, apply the change over multiple days.

**Detection:** Monitor the standard deviation of daily score changes per country. If any country's score changes by more than 0.5 points in a single day, the pipeline should log a warning. Add a `score-drift.test.ts` that catches this in CI.

**Phase:** Must be addressed in the scoring formula redesign phase (first), before adding any new sources.

**Real-world reference:** The Travel Off Path Traveler Safety Index uses a "Mandatory 24-Hour Editorial Audit" where humans review data spikes daily to filter out anomalies before they impact scores. An automated EMA achieves the same goal without human cost.

---

### Pitfall 2: Breaking Historical Continuity -- The "v3 Cliff" Problem

**Severity:** CRITICAL
**What goes wrong:** Adding new indicators and changing the formula changes all scores on a single day. Every country's history chart shows a visible discontinuity -- a "cliff" where the old scores end and new scores begin with different absolute values. Users perceive this as a real-world safety change rather than a methodology change. Comparing "is Italy safer this year than last year?" becomes impossible across the boundary.

**Why it happens in this codebase:** The `writeHistoryIndex()` function in `history.ts` reads all snapshots and builds continuous time series. It has no concept of methodology versions. When weights change (currently `version: "4.0.0"` in `weights.json`), the history index stitches old and new scores together as if they are comparable. The `DailySnapshot` type stores `weightsVersion` but nothing downstream uses it for continuity correction.

**Consequences:**
- Trend charts show misleading jumps that look like real safety events
- Users cannot compare pre-v3 and post-v3 scores meaningfully
- SEO country pages cached by Google show old scores conflicting with new ones
- The global safety benchmark shifts overnight without any real-world cause

**Prevention:**
1. **Historical backfill is feasible and essential.** The `data/raw/YYYY-MM-DD/` directories store parsed raw data going back to 2012. Use the existing `scripts/backfill-historical.ts` pattern to recalculate all historical scores with the new formula. This is the project's most valuable existing asset for this problem.
2. **Parallel scoring period:** Run both old and new formulas simultaneously for 2-4 weeks before switching. Store both in snapshots during the transition.
3. **Version-aware history index:** Tag each data point with the formula version. On the front-end, add a subtle dashed vertical line at methodology change dates on trend charts.
4. **Announce the change:** Add a banner or methodology changelog. Users who track specific countries need to know scores shifted due to methodology, not events.

**Detection:** Compare the mean absolute difference between the last old-formula snapshot and first new-formula snapshot. If the average country score shifts by more than 0.5, the transition is too abrupt and needs backfill.

**Phase:** Must be planned before implementation. Historical backfill should be a dedicated task early in the milestone, using existing raw data archives.

---

### Pitfall 3: GDELT English-Language Media Bias Corrupting Safety Scores

**Severity:** CRITICAL
**What goes wrong:** If GDELT is added as a realtime news/event source, it over-represents English-language media, creating a systematic bias: countries covered heavily by anglophone media (Middle East, China, Russia) appear more dangerous than countries with equivalent problems but less English-language coverage (Francophone Africa, Central Asia, Southeast Asia). Mali and Chad have comparable conflict levels to some Middle Eastern countries but get a fraction of the GDELT event volume.

**Why it matters for this project:** The UK Office for National Statistics has formally documented this bias. Academic research confirms GDELT inherits "media biases -- framing, regional disparities, and language issues -- that distort coverage." The project states "politically neutral" scoring as a constraint -- GDELT as a direct scoring input violates this.

**How it differs from ACLED (already in the pipeline):** ACLED explicitly corrects for coverage gaps through local researcher networks in Africa, Asia, and Latin America. ACLED's methodology includes verification and deduplication. GDELT does neither -- it purely reflects media volume.

**Consequences:**
- Systematic score penalty for countries that attract Western media attention
- Systematic score bonus for countries that Western media ignores (some genuinely dangerous places score better)
- Political perception that the site has Western/anglophone editorial bias
- Undermines the project's stated goal of "politically neutral" scoring

**Prevention:**
1. **Do not use GDELT as a direct scoring input.** Use it only as a crisis detection trigger -- if GDELT event volume for a country spikes 3x above its own 30-day baseline, flag it for investigation, but do not feed raw GDELT counts into the score formula.
2. **If GDELT must be used:** Normalize per-country GDELT events relative to that country's own historical median, not cross-country. A spike in Chad events is meaningful for Chad, but comparing Chad's absolute event count to the UK's is meaningless.
3. **Prefer ACLED over GDELT for conflict data.** ACLED already exists in the pipeline (`src/pipeline/fetchers/acled.ts`) and has researcher-verified methodology. Adding GDELT for conflict would be redundant and worse.
4. **Use GDELT only for crisis velocity detection:** Compare today's event count to the rolling 30-day average for the same country. A 300% spike is a signal regardless of absolute volume.

**Detection:** Compare any new realtime source's coverage map to the full 248-country list. If the source covers fewer than 150 countries, it should not be a direct scoring input.

**Phase:** Source selection phase -- decide what each source is used for before writing any fetcher code.

---

### Pitfall 4: Score Inflation/Deflation When Adding Indicators to Existing Pillars

**Severity:** CRITICAL
**What goes wrong:** Adding a new indicator to a pillar changes the pillar's score for all countries, even if the new indicator carries the same conceptual weight. This happens silently because the math looks correct but the output distribution shifts.

**Why it happens in this codebase:** The averaging in `computeCountryScore` (engine.ts line 54) divides by `foundCount`, not by a fixed expected count. If you add `gdelt_events` to the conflict pillar (currently 6 indicators), countries where GDELT data exists now have 7 indicators averaged. The GDELT indicator's distribution may not align with the existing 6. Example: if GDELT reports 50 events for Norway (normalized to ~0.95 given its low conflict) while existing indicators average 0.85, Norway's conflict pillar score silently inflates from 0.85 to 0.86. Multiply this across all pillars and 248 countries and the entire score distribution shifts.

**The OECD explicitly warns:** "Small changes in the weighting and aggregation of constituent measures can dramatically alter relative positioning" in their Handbook on Constructing Composite Indicators.

**Consequences:**
- Every country's score changes even though nothing happened in the real world
- Countries with data for the new indicator get a different effective formula than countries without it
- The `dataCompleteness` metric changes meaning (a country now needs more indicators for 100%)
- Country rankings shuffle due to methodology, not reality

**Prevention:**
1. **Fixed indicator weights within pillars:** Instead of equal averaging, assign explicit sub-weights to each indicator within a pillar. When adding a new indicator, explicitly decide how much weight it gets and reduce others proportionally. This requires changing the `PillarWeight` type in `types.ts` to include per-indicator weights.
2. **Distribution alignment test:** Before adding any new indicator, compute its cross-country distribution. Compare the mean and standard deviation to existing indicators in the same pillar. If they differ by more than 0.15 in normalized space, the indicator needs its own normalization calibration.
3. **A/B scoring test:** Compute all 248 country scores with and without the new indicator. If more than 10% of countries change by more than 0.3 points, the integration needs calibration.
4. **Update `normalize.ts` ranges from real data:** New indicators need empirically-derived min/max from actual data, not guesses. The current ranges were likely set from observed data -- new indicators need the same treatment.

**Detection:** Extend `weights-config.test.ts` with a "score stability" snapshot test that catches large score distribution shifts when indicators are added.

**Phase:** Scoring formula redesign phase, before any new fetcher is wired into production.

---

## Moderate Pitfalls

### Pitfall 5: Data Gaps Widening for Small/Island/Developing Countries

**Severity:** MODERATE
**What goes wrong:** Realtime sources have worse coverage for small, island, or developing nations. ACLED focuses on conflict-affected countries. GDELT under-represents countries with less media infrastructure. World Bank data lags 2-3 years for many developing countries. Adding more sources that cover only 120 of 248 countries creates a two-tier scoring system: well-scored countries (with 15+ indicators) and poorly-scored countries (with 5-8 indicators defaulting to neutral 0.5).

**Why it matters here:** The current `engine.ts` assigns `score = 0.5` (neutral) when `foundCount === 0` for a pillar (line 52). This means Tuvalu, Nauru, or Comoros get a neutral conflict score -- neither safe nor dangerous -- which is wrong (most small island nations are very safe). Adding more realtime indicators that only cover large countries widens this gap. The site currently scores 248 countries but realtime sources may only cover 80-150 of them.

**Prevention:**
1. **Regional proxy logic:** For countries with no direct data from a source, inherit scores from their geographic/economic peer group (Pacific Islands inherit from New Zealand/Fiji average, Caribbean states from regional averages).
2. **Completeness-weighted scoring:** Instead of neutral 0.5 for missing data, weight the pillar contribution by data completeness in the composite calculation. A pillar with 0% data should contribute zero to the weighted sum (not 0.5 * weight).
3. **Minimum data threshold display:** If a country has data for fewer than 40% of expected indicators, display "limited data" alongside the score rather than presenting it as equally reliable.
4. **Coverage dashboard:** Track which countries are actually covered by each source. Surface this in the methodology page for transparency.

**Detection:** After each pipeline run, count how many countries have `dataCompleteness < 0.4`. If this number increases after adding a new source, the source is creating a coverage gap problem.

**Phase:** Scoring formula redesign -- the neutral-default behavior (`score = 0.5`) should be reconsidered before adding sources that make the gap worse.

---

### Pitfall 6: API Reliability and Cascading Staleness

**Severity:** MODERATE
**What goes wrong:** Adding more external API dependencies increases the probability that at least one fails on any given pipeline run. The current system has 5 fetchers running via `Promise.allSettled` (fetchers/index.ts). Adding 3-4 more realtime sources means 8-9 external API calls daily. ACLED already requires API keys and has pagination limits (5000 rows per call). GDELT APIs are rate-limited. Industry data shows average API uptime fell from 99.66% to 99.46% between 2024-2025 -- 60% more downtime year-over-year.

**The hidden problem:** When a realtime source fails, the pipeline falls back to cached data via `findLatestCached()`. But if the source stays down for days, the "realtime" score is actually a week-old score. Users see "Last updated: today" on the page (because the pipeline ran today) but the underlying realtime data is stale. Nothing surfaces this to the user.

**Current resilience (good):** The `fetchAllSources` uses `Promise.allSettled` and the pipeline succeeds if at least one source works. The `findLatestCached` pattern in `acled.ts` is solid. The `FetchResult` type already stores errors and timestamps.

**Prevention:**
1. **Staleness indicator per source:** Track how old each source's data actually is (not when the pipeline ran, but when the source was last successfully fetched fresh). Surface this in country detail pages.
2. **Timeout budget:** The current ACLED fetcher uses `AbortSignal.timeout(60_000)` (60 seconds). With 8-9 parallel fetchers, total pipeline time could still exceed CI limits if sources are slow. Reduce individual timeouts to 45 seconds.
3. **Circuit breaker pattern:** If a source fails 3 consecutive days, stop retrying and alert (via GitHub Actions annotation or scheduled issue). Do not silently serve multi-day-old "realtime" data.
4. **Dependency budget:** Cap external API dependencies at 8-10 total. Each new source must justify itself against the reliability cost. Prefer sources with bulk download options (like GPI Excel) over APIs.

**Detection:** Add per-source age tracking to `pipeline-result` logging. Alert if any source's data is more than 3 days old for "realtime" sources or 90 days old for annual sources.

**Phase:** Pipeline hardening, after source selection but before production rollout.

---

### Pitfall 7: Pipeline Timeout in CI/CD

**Severity:** MODERATE
**What goes wrong:** The GitHub Actions build pipeline has time limits. The Cloudflare Pages build timeout is 20 minutes. Adding realtime sources that require large data downloads or pagination increases pipeline duration. ACLED already fetches all events for a 30-day window with `limit=0` (acled.ts line 65) -- this can be tens of thousands of records. Adding GDELT bulk data or another large-dataset source could push the pipeline past timeout limits.

**Prevention:**
1. **Measure current pipeline duration** before adding any sources. Establish a baseline.
2. **Separate fetch from build:** Run data fetching as a separate GitHub Actions step that caches results. The Astro build step only reads cached scored data -- it never fetches live.
3. **Paginate large datasets:** For ACLED, switch from `limit=0` to paginated fetching (5000 rows per page, per ACLED's recommendation). For any new source, implement pagination from the start.
4. **Fail fast on slow sources:** If a source takes more than 30 seconds, abort and use cache. One slow API should not block the entire pipeline.
5. **Per-stage timing:** The current `run.ts` logs total duration -- extend this with per-stage timestamps to identify bottlenecks.

**Detection:** Log pipeline stage durations. Set a CI alert if total pipeline time exceeds 10 minutes.

**Phase:** Pipeline architecture phase, concurrent with adding new fetchers.

---

### Pitfall 8: Normalization Range Drift for Realtime Indicators

**Severity:** MODERATE
**What goes wrong:** The current `normalize.ts` uses hardcoded min/max ranges. For annual indices like GPI (range 1-5), these are stable. For realtime event counts, the range can shift dramatically. A war breaks out and suddenly a country reports 50,000 fatalities in a month -- exceeding the `max: 10000` cap. The normalization clamps it to 0 (most dangerous), but there is no differentiation between 10,000 and 50,000 fatalities.

**The reverse problem:** During peaceful months, all countries cluster near 0 events. The fixed normalization spreads them across 0-1, magnifying trivial differences. A country with 3 events and one with 12 events get very different normalized scores even though both are effectively safe.

**Specific example in the codebase:** `acled_events: { min: 0, max: 5000 }`. During a major conflict escalation, a country could exceed 5000 events in 30 days. The normalization would clamp it to exactly 0.0 -- identical to a country with 5000 events. Meanwhile, in peacetime, the 0-50 range that most safe countries fall into gets compressed into 0.99-1.0, losing resolution.

**Prevention:**
1. **Log-scale normalization for count data:** Use `log(value + 1)` before normalization for event counts and fatalities. This compresses the range naturally: log(1) = 0, log(100) = 4.6, log(10000) = 9.2, log(50000) = 10.8. Differences between 0 and 100 events are captured as well as differences between 10,000 and 50,000.
2. **Percentile-based normalization:** Instead of fixed min/max, normalize based on the current cross-country distribution. The 5th and 95th percentiles become the effective range. This adapts automatically but adds computation each run.
3. **Separate normalization strategies:** Keep fixed ranges for annual indicators (GPI, WGI) where the scale is defined by the source. Use adaptive normalization for realtime event counts where the natural scale varies.
4. **Quarterly range review:** If using fixed ranges, schedule a quarterly check of actual data distributions against hardcoded min/max.

**Detection:** Log how many countries hit the normalization floor (0.0) or ceiling (1.0) for each indicator. If more than 15% of countries are clamped at either end, the range is wrong.

**Phase:** Scoring formula redesign phase, as part of normalization overhaul.

---

## Minor Pitfalls

### Pitfall 9: Documentation Debt -- Methodology Page Becomes Incoherent

**Severity:** MINOR (but compounds and eventually becomes critical for user trust)
**What goes wrong:** The methodology page currently explains 5 pillars with their indicators and weights. Adding new sources and changing the formula without simultaneously updating the methodology page in all 5 languages (EN, IT, ES, FR, PT) creates a mismatch. Users read "conflict pillar uses GPI, ACLED, and World Bank" but the actual formula now includes additional sources. Transparency -- the project's explicitly stated core value ("every factor and weight explained") -- erodes silently.

**Prevention:**
1. **Methodology-as-code:** Generate methodology page content from `weights.json` and source metadata rather than hand-writing explanations. When the formula changes, the page updates automatically.
2. **Translation checklist:** Every formula change must include a translation ticket for all 5 languages before the change ships.
3. **Version the methodology page:** Show "Scoring Formula v5.0" with a changelog. Users can see when and why the formula changed.
4. **Source metadata file:** The existing `config/sources.json` should be expanded to include human-readable descriptions, update frequencies, and coverage notes for each source -- consumed by both the pipeline and the methodology page.

**Detection:** Diff the indicator list in `weights.json` against the indicators mentioned on the methodology page. Automate this as a build-time check.

**Phase:** Documentation phase, must ship simultaneously with formula changes -- not after.

---

### Pitfall 10: Over-Engineering the Formula

**Severity:** MINOR (but wastes significant development time)
**What goes wrong:** Temptation to build sophisticated ML-based scoring, Bayesian updating, Kalman filters, or complex decay functions when a simple weighted average with smoothing would work. The current formula is elegant: normalize, average per pillar, weighted sum, map to 1-10. Adding neural sentiment analysis or adaptive weighting algorithms makes the formula impossible to explain on the methodology page.

**Why it matters here:** The project explicitly values formula transparency ("every factor and weight explained"). The Travel Off Path safety index uses human editorial audits precisely because algorithmic complexity creates unexplainable scores. A traveler asking "why is France rated 7.2?" needs a simple answer, not a description of a Bayesian posterior update.

**Prevention:**
1. **Explainability test:** If the formula change cannot be explained in one paragraph on the methodology page, it is too complex.
2. **Additive, not multiplicative:** Keep the structure as weighted average. Realtime signals should adjust the baseline, not multiply it or feed into a separate model.
3. **Maximum 25 total indicators:** More indicators does not mean better scores. Each indicator must pass a signal-to-noise test and justify its inclusion.
4. **Resist GDELT sentiment/tone scores:** GDELT's "tone" metric is noisy and culturally biased. Using it as a direct input would violate the neutrality constraint.
5. **Complexity budget:** Set a maximum parameter count (indicators + weights + smoothing constants) before design begins. If it exceeds 30, simplify.

**Detection:** Count the number of tunable parameters in the formula. If it exceeds 30, the formula is over-engineered for this use case.

**Phase:** Formula design phase. Set complexity budget before implementation begins.

---

### Pitfall 11: Double-Counting Risk From Correlated Sources

**Severity:** MINOR
**What goes wrong:** Adding GDELT alongside ACLED for conflict data means both sources report on the same underlying events. ACLED's `acled_events` and a potential `gdelt_conflict_events` indicator are correlated. Including both in the conflict pillar does not add independent information -- it effectively doubles the weight of well-covered conflicts while still missing under-reported ones.

**Similarly:** Adding WHO health alerts alongside INFORM's `inform_epidemic` double-counts epidemic risk. The existing travel advisories (US + UK in the crime pillar) already correlate strongly with conflict and governance indicators in other pillars.

**Prevention:**
1. **Correlation check:** Before adding a new indicator, compute its Pearson correlation with existing indicators in the same pillar across the 248-country dataset. If r > 0.7, one should be removed or they should share a combined weight.
2. **One source per concept:** Map each indicator to a specific concept (armed conflict intensity, governance quality, epidemic risk). Two indicators should not map to the same concept within a pillar.
3. **Prefer authoritative over voluminous:** ACLED with researcher verification beats GDELT with media volume for conflict measurement. Keep ACLED, do not add a second conflict event source covering the same ground.

**Detection:** After adding indicators, compute pairwise correlations within each pillar. Flag any pair with r > 0.7.

**Phase:** Source selection phase, before adding new fetchers.

---

### Pitfall 12: Realtime Source Introduces New Country Name Mapping Failures

**Severity:** MINOR
**What goes wrong:** The ACLED fetcher already uses `getCountryByName()` to map country names to ISO3 codes (acled.ts line 161). Each new realtime source uses its own country naming convention. GDELT uses FIPS codes. WHO uses different English spellings. A realtime source that calls it "Republic of Korea" will not match a country list entry for "South Korea." Events for unmatched countries are silently dropped.

**Prevention:**
1. **Extend the country alias map:** The `config/countries.ts` `getCountryByName` function needs a comprehensive alias table. Add known variant names before implementing new fetchers.
2. **Log unmatched countries:** Every fetcher should log when `getCountryByName` returns null. The ACLED fetcher already silently `continue`s -- add a warning log.
3. **Test coverage:** For each new source, fetch a sample dataset and check how many unique country names map successfully. If more than 5% fail to map, the alias table needs expansion.

**Detection:** Add a "country mapping" log line to each fetcher showing matched vs. unmatched country names.

**Phase:** Fetcher implementation phase, as part of each new source integration.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|-------------|---------------|----------|------------|
| Source selection | Adding GDELT as direct scoring input (P3) | CRITICAL | Use GDELT only as crisis trigger, not scoring input |
| Source selection | Adding correlated indicators (P11) | MINOR | Correlation matrix before adding |
| Scoring formula redesign | Score volatility from raw realtime data (P1) | CRITICAL | EMA smoothing + bounded adjustments + baseline+delta |
| Scoring formula redesign | Score inflation/deflation from new indicators (P4) | CRITICAL | A/B scoring test, explicit sub-weights per indicator |
| Scoring formula redesign | Breaking historical continuity (P2) | CRITICAL | Historical backfill using existing raw data archives |
| Scoring formula redesign | Normalization range drift (P8) | MODERATE | Log-scale for counts, quarterly range review |
| Scoring formula redesign | Small country data gaps widen (P5) | MODERATE | Regional proxies, completeness-weighted scoring |
| Pipeline implementation | API reliability cascade (P6) | MODERATE | Staleness indicators, circuit breakers, source age tracking |
| Pipeline implementation | CI/CD timeout (P7) | MODERATE | Separate fetch from build, per-source timeouts |
| Pipeline implementation | Country name mapping failures (P12) | MINOR | Comprehensive alias table, unmatched-name logging |
| Documentation | Methodology page drift (P9) | MINOR | Generate from weights.json, translation checklist |
| Formula design | Over-engineering (P10) | MINOR | Explainability test, complexity budget of 30 params max |

## Integration Risk Matrix

The most dangerous combination is implementing multiple changes simultaneously:

| Change A | Change B | Compounding Risk |
|----------|----------|-----------------|
| New formula weights | New indicator sources | Cannot tell if score shifts come from weights or data |
| Realtime smoothing (EMA) | Historical backfill | EMA needs a warm-up period; backfilled history has no EMA buffer |
| New normalization strategy | New indicators | Cannot calibrate ranges without stable historical baseline |
| Multiple new fetchers | Pipeline timeout reduction | More sources = more failure points in tighter time budget |

**Recommended sequencing:** Change the formula FIRST with existing data sources. Validate stability. THEN add new sources one at a time. THEN backfill history. Never change formula and sources simultaneously.

## Sources

- [ONS GDELT Data Quality Note](https://www.ons.gov.uk/peoplepopulationandcommunity/birthsdeathsandmarriages/deaths/methodologies/globaldatabaseofeventslanguageandtonegdeltdataqualitynote) -- English media over-representation analysis
- [OECD Handbook on Constructing Composite Indicators](https://www.oecd.org/en/publications/handbook-on-constructing-composite-indicators-methodology-and-user-guide_9789264043466-en.html) -- Weighting/aggregation methodology risks
- [GDELT API Rate Limiting](https://blog.gdeltproject.org/ukraine-api-rate-limiting-web-ngrams-3-0/) -- Rate limit documentation
- [ACLED API Documentation](https://acleddata.com/acled-api-documentation) -- Pagination limits (5000 rows per call)
- [Travel Off Path Traveler Safety Index](https://www.traveloffpath.com/traveler-safety-index/) -- Real-world approach to realtime scoring with 24-hour editorial audit
- [Uptrends State of API Reliability 2025](https://www.uptrends.com/state-of-api-reliability-2025) -- API uptime declining 60% YoY
- [MDPI: GDELT Development and Application](https://www.mdpi.com/2306-5729/10/10/158) -- Systematic bias in GDELT event extraction
- [Springer: Methodological Framework of Composite Indices](https://link.springer.com/article/10.1007/s11205-017-1832-9) -- Weighting and aggregation robustness analysis
- [Oxford Tandfonline: GDELT Protest Event Analysis](https://www.tandfonline.com/doi/full/10.1080/19312458.2022.2128099) -- Western-centric bias documentation

---
*Pitfalls research for: v3.0 Data Sources & Scoring Overhaul milestone of IsItSafeToTravel*
*Researched: 2026-03-22*
