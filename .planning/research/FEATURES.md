# Feature Research: Near-Realtime Data Sources & Scoring Overhaul

**Domain:** Travel safety platform -- near-realtime data source integration
**Researched:** 2026-03-22
**Confidence:** MEDIUM (data source APIs verified; blending methodology is novel design work)

## Feature Landscape

### Table Stakes (Users Expect These)

Features the platform must have for scores to reflect current crises rather than stale annual data.

| Feature | Why Expected | Complexity | Pillar | Notes |
|---------|--------------|------------|--------|-------|
| **GDELT Stability Index** | Only free source providing daily conflict instability scores per country, updated every 15 min | MEDIUM | Conflict | API: `https://api.gdeltproject.org/api/v1/dash_stabilitytimeline/dash_stabilitytimeline?LOC={fips}&VAR=instability&OUTPUT=csv&TIMERES=day&SMOOTH=3`. Uses FIPS codes (not ISO) -- need mapping table. Returns CSV with date + instability ratio. Free, no auth, no documented rate limit. Fetch daily with `TIMERES=day` for 180-day history. |
| **GDACS Natural Disaster Alerts** | Only free near-realtime source for earthquakes, floods, cyclones, volcanoes, wildfires, droughts at country level | MEDIUM | Environment | API: `https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ;TC;FL;VO;WF;DR&fromdate={30d_ago}&todate={today}&alertlevel=red;orange`. Returns JSON with country, severity (green/orange/red), alert score. Free, no auth. Also available as RSS at `www.gdacs.org/xml/rss.xml`. |
| **ReliefWeb Disasters & Reports** | UN-curated humanitarian crisis reports with country tagging, updated continuously | MEDIUM | Conflict, Health | API: `https://api.reliefweb.int/v2/disasters` and `/v2/reports`. JSON, free, no auth. Filter by country, date, disaster type. Provides crisis severity context that GDELT misses (humanitarian angle). Updated as reports come in (effectively daily). |
| **WHO Disease Outbreak News** | Authoritative source for active disease outbreaks per country, critical for health pillar | HIGH | Health | API: `https://www.who.int/api/news/diseaseoutbreaknews`. Returns JSON with title, summary, regions, publication date. No documented auth. Country filtering via Regions relationship. Parsing challenge: semi-structured text, no severity score -- need NLP or keyword extraction. Updated as outbreaks declared (weekly-ish cadence). |
| **Government Travel Advisory Updates** | Already fetched daily; need to ensure freshness and add more countries (CA, AU, NZ advisories) | LOW | Crime | Existing fetchers for US + UK. Consider adding Canada (`travel.gc.ca`) and Australia (`smartraveller.gov.au`) for broader advisory coverage. RSS feeds available for both. Incremental complexity on existing pattern. |
| **Baseline + Signal Blending Formula** | Core scoring change: annual indices as baseline, realtime sources as modifiers | HIGH | All | Without this, adding realtime sources is pointless. Must design: (1) baseline from annual sources (GPI, World Bank, INFORM Risk), (2) realtime signal that adjusts baseline up/down, (3) decay function so old events fade. See Architecture notes below. |

### Differentiators (Competitive Advantage)

Features that would set IsItSafeToTravel apart from competitors like TravelOffPath, SafetyIndex.net, or government advisory sites.

| Feature | Value Proposition | Complexity | Pillar | Notes |
|---------|-------------------|------------|--------|-------|
| **INFORM Severity Index** | Monthly-updated crisis severity for 100+ active crises, composite of impact + conditions + complexity -- bridges gap between annual INFORM Risk and daily signals | LOW | All | Available via ACAPS API: `https://api.acaps.org/api/v1/inform-severity-index/`. Requires free registration for auth token. Monthly updates. JSON response with country-level severity 0-5 scale. Excellent "middle frequency" signal between annual and daily data. |
| **Crisis Event Timeline** | Show users a timeline of recent events (disasters, outbreaks, conflict spikes) that affected a country's score | MEDIUM | N/A (UX) | Differentiator vs competitors who show only static scores. Requires storing event metadata from GDELT/GDACS/ReliefWeb alongside scores. Country detail page enhancement. |
| **Score Change Alerts Indicator** | Visual indicator on map/cards showing "score changed significantly in last 7 days" (up/down arrow, delta) | LOW | N/A (UX) | Trivial to compute from history-index.json. Powerful UX signal that the platform is alive and current. No new data source needed. |
| **USGS Earthquake Feed** | Real-time earthquake data with magnitude, location, tsunami warning | LOW | Environment | GeoJSON feed: `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson`. Free, no auth. Significant earthquakes only (M4.5+). Need reverse geocoding to map to countries. Supplements GDACS with faster earthquake detection. |
| **Data Freshness Transparency** | Show users when each data source was last updated, per country | LOW | N/A (UX) | Already have `fetchedAt` in SourceMeta. Surface it in UI with "last updated: 2h ago" style badges. Builds trust. No new data needed. |
| **GHO Health Indicators** | WHO Global Health Observatory provides 2300+ health indicators per country | MEDIUM | Health | OData API at `https://ghoapi.azureedge.net/api/`. Free, no auth. WARNING: WHO announced deprecation "near end of 2025" -- replacement is Athena API, status unclear. LOW confidence this will be stable. Defer unless existing World Bank health indicators prove insufficient. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full GDELT Event Database ingestion** | "More data = better scores" | GDELT produces millions of events/day. BigQuery or raw file download is massive. Overkill for country-level daily scoring. | Use GDELT Stability Dashboard API which pre-aggregates to country-level instability ratios. One CSV fetch per country vs parsing terabytes. |
| **EM-DAT Natural Disaster Database** | Comprehensive historical disaster data | No API -- Excel download only, requires account registration, non-commercial license, data released periodically not in realtime | Use GDACS for realtime disaster alerts + INFORM for annual disaster risk baseline. EM-DAT is backward-looking; we need forward-looking signals. |
| **Social media sentiment analysis** | "Detect emerging crises from Twitter/X" | Requires paid API access ($100+/mo for X API), NLP pipeline, high noise ratio, political bias risk, violates budget constraint | GDELT already analyzes global media tone; use its `tone` variable as proxy for sentiment without building our own NLP. |
| **Real-time push notifications** | "Alert users when score changes" | Requires server infrastructure (WebSockets/push service), user accounts, notification preferences -- contradicts static site architecture and "no user accounts" constraint | Show score delta badges on the static site. Users who care can check daily. Consider email digest as future v4 feature. |
| **City/region-level scoring** | "Paris is safe even if some French overseas territories aren't" | Requires sub-national data for all sources (most only provide country-level), multiplies data volume by 10-100x, UX complexity | GDELT supports ADM1 regions. Flag as future v4 feature. For now, keep country-level with advisory text noting regional variations. |
| **UNHCR Displacement Data** | Shows refugee flows indicating instability | Updated quarterly at best, primarily about refugee hosting (not traveler safety), complex to normalize | Displacement is already captured indirectly via INFORM Risk Index components. Adding raw UNHCR data adds complexity without proportional insight for travelers. |
| **HDX/OCHA Humanitarian Data Exchange** | 18,000+ humanitarian datasets | Meta-platform, not a single API. Each dataset has different format, schema, update frequency. Integration cost is unbounded. | Cherry-pick specific HDX datasets via their individual APIs (INFORM Severity is on HDX but has its own API via ACAPS). Do not build a generic HDX connector. |

## Data Sources per Pillar (Summary Matrix)

| Pillar (Weight) | Current Sources | Proposed New Sources | Update Frequency | Free? | Auth? |
|-----------------|----------------|---------------------|------------------|-------|-------|
| **Conflict (30%)** | GPI (annual), ACLED (weekly), WB Political Stability (annual) | GDELT Stability (daily), ReliefWeb Reports (continuous) | Daily | Yes | GDELT: no, ReliefWeb: no |
| **Crime (25%)** | WB Rule of Law (annual), US Advisory (as issued), UK Advisory (as issued) | Canada Advisory (RSS), Australia Advisory (RSS) | As issued | Yes | No |
| **Health (20%)** | WB Child Mortality (annual), INFORM Health (annual), INFORM Epidemic (annual) | WHO DON (as issued), INFORM Severity health dimension (monthly) | Weekly-ish | Yes | WHO: no, ACAPS: token |
| **Governance (15%)** | WB Gov Effectiveness (annual), WB Corruption (annual), INFORM Governance (annual) | No new realtime sources identified | Annual | Yes | No |
| **Environment (10%)** | WB Air Pollution (annual), INFORM Natural (annual), INFORM Climate (annual) | GDACS Disaster Alerts (realtime), USGS Earthquakes (realtime) | Daily | Yes | No |

## Feature Dependencies

```
Baseline + Signal Blending Formula
    +-- requires --> FIPS-to-ISO country code mapping (for GDELT)
    +-- requires --> Realtime signal normalization (0-1 scale per source)
    +-- requires --> Decay function design (events fade over time)
    +-- requires --> At least one realtime source fetcher working

GDELT Stability Fetcher
    +-- requires --> FIPS-to-ISO mapping table
    +-- requires --> CSV parser for GDELT output format

GDACS Disaster Alerts Fetcher
    +-- requires --> JSON/XML parser for GDACS event format
    +-- requires --> Country extraction from event coordinates

WHO DON Fetcher
    +-- requires --> Text parsing / keyword extraction for severity
    +-- requires --> Country mapping from WHO region codes

ReliefWeb Fetcher
    +-- requires --> JSON filter construction for API v2

INFORM Severity Fetcher
    +-- requires --> ACAPS account registration (free)
    +-- requires --> Auth token management in pipeline

Score Change Indicators (UX)
    +-- requires --> Baseline + Signal Blending Formula (to produce meaningful deltas)

Crisis Event Timeline (UX)
    +-- requires --> Event metadata storage (new data model alongside scores)
    +-- requires --> At least GDELT + GDACS + ReliefWeb fetchers

Methodology Page Update
    +-- requires --> Baseline + Signal Blending Formula (to document)
    +-- requires --> All new fetchers (to list sources)
```

### Dependency Notes

- **Blending formula is the critical path.** Every new data source is useless without a formula that incorporates realtime signals into the 1-10 score.
- **FIPS-to-ISO mapping is a one-time artifact** but blocks GDELT integration. GDELT uses adapted FIPS country codes (e.g., "IS" for Israel, "GM" for Germany), not ISO-3166. A static lookup table of ~250 entries resolves this.
- **ACAPS auth token is the only new credential needed.** All other proposed sources are fully open. Token can be stored as a GitHub Actions secret alongside existing ACLED credentials.
- **WHO DON is the hardest fetcher to build** because it returns semi-structured text, not numeric scores. Consider a simple approach: count active outbreaks per country in last 90 days, normalize by historical average.

## MVP Definition (v3.0)

### Launch With (v3.0 Core)

Must-haves for the scoring overhaul to be meaningful.

- [ ] **GDELT Stability fetcher** -- daily country instability scores, highest-impact new signal for conflict pillar
- [ ] **GDACS Disaster Alerts fetcher** -- active disaster alerts per country, fills environment pillar realtime gap
- [ ] **Baseline + Signal Blending formula** -- design and implement the weighted blend of annual + realtime data
- [ ] **FIPS-to-ISO mapping table** -- prerequisite for GDELT
- [ ] **Updated weights.json** -- new indicators registered, weights rebalanced for realtime signals
- [ ] **Methodology page update (all 5 languages)** -- document new sources and formula transparently
- [ ] **Score change delta indicator** -- show users the platform is now dynamic (low effort, high perception impact)

### Add After Validation (v3.x)

Add once core blending is working and validated against known crises.

- [ ] **ReliefWeb Reports fetcher** -- humanitarian context layer; validate that it adds signal beyond GDELT
- [ ] **WHO DON fetcher** -- disease outbreaks; complex to parse but valuable for health pillar
- [ ] **INFORM Severity Index fetcher** -- monthly bridge between annual and daily data; needs ACAPS account
- [ ] **Canada + Australia advisory fetchers** -- incremental improvement to crime pillar; low risk
- [ ] **Crisis Event Timeline on country page** -- UX differentiator; requires event metadata storage

### Future Consideration (v4+)

Defer until v3.0 proves the blending approach works.

- [ ] **USGS Earthquake Feed** -- supplements GDACS but lower priority since GDACS covers earthquakes
- [ ] **GHO Health Indicators** -- WHO API in flux (deprecation); wait for stable replacement
- [ ] **Sub-national (ADM1) scoring** -- GDELT supports it, but exponentially more complex
- [ ] **Data freshness badges in UI** -- polish feature, low priority vs core scoring
- [ ] **Email/RSS score change notifications** -- requires infrastructure beyond static site

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Pipeline Dependency | Priority |
|---------|------------|---------------------|---------------------|----------|
| Baseline + Signal Blending Formula | HIGH | HIGH | Core (blocks everything) | P1 |
| GDELT Stability Fetcher | HIGH | MEDIUM | FIPS mapping | P1 |
| GDACS Disaster Alerts Fetcher | HIGH | MEDIUM | None | P1 |
| FIPS-to-ISO Mapping | LOW (invisible) | LOW | None | P1 |
| Updated weights.json | HIGH | MEDIUM | Formula design | P1 |
| Methodology Page Update (5 langs) | MEDIUM | MEDIUM | All P1 features | P1 |
| Score Change Delta Indicator | MEDIUM | LOW | Blending formula | P1 |
| ReliefWeb Fetcher | MEDIUM | MEDIUM | None | P2 |
| WHO DON Fetcher | MEDIUM | HIGH | Text parsing | P2 |
| INFORM Severity Fetcher | MEDIUM | LOW | ACAPS account | P2 |
| Canada + Australia Advisories | LOW | LOW | Existing pattern | P2 |
| Crisis Event Timeline | MEDIUM | MEDIUM | Event storage model | P2 |
| USGS Earthquake Feed | LOW | LOW | None | P3 |
| GHO Health Indicators | LOW | MEDIUM | WHO API stability | P3 |
| Sub-national Scoring | HIGH | VERY HIGH | All sources need ADM1 | P3 |

## Competitor Feature Analysis

| Feature | TravelOffPath (SafetyIndex) | Gov Advisory Sites (US/UK) | Numbeo Safety Index | Our Approach |
|---------|---------------------------|---------------------------|--------------------|----|
| Score freshness | "Real-time" (crowdsourced + gov baseline) | Updated as issued (irregular) | Crowdsourced (stale for small countries) | Daily automated from 8+ sources |
| Scoring transparency | Opaque ("proprietary algorithm") | Single advisory level (1-4) | User-reported perception only | Fully transparent: every weight, every source, every indicator |
| Number of sources | Unknown (claims "anonymous voting") | 1 government per site | 1 (user surveys) | 8+ verified public sources per country |
| Near-realtime crisis detection | Claims realtime via crowdsourcing | Slow (days to update advisories) | No realtime capability | GDELT (15min delay) + GDACS (hours) + ReliefWeb (daily) |
| Historical trends | No | No | Limited | Full historical charts with drag-to-zoom (existing) |
| Multilingual | English only | Single language per site | English only | 5 languages (EN/IT/ES/FR/PT) |
| Free/open | Free but closed methodology | Free | Free but closed | Free AND open methodology |

## Blending Architecture Notes

Research into how travel safety platforms blend baselines with realtime signals reveals no open-source standard. Commercial platforms (Dataminr, Crisis24, Riskline) use proprietary approaches. The Skift Travel Health Index provides the closest public methodology: it compares current performance to baseline readings from the same period in the previous year.

**Recommended approach for IsItSafeToTravel:**

```
final_score = baseline_weight * annual_score + signal_weight * realtime_modifier

where:
- annual_score = existing pillar-weighted composite (GPI, WB, INFORM Risk, advisories)
- realtime_modifier = decayed aggregate of recent events normalized to 0-1
- baseline_weight = 0.70 (annual data is still the foundation)
- signal_weight = 0.30 (realtime adjusts, does not dominate)
- decay function: event_weight = e^(-days_since_event / half_life)
- half_life = 30 days (events lose half their impact weight after 30 days)
```

This means a severe crisis in Cuba would immediately drag its score down by up to 30% of the score range, then gradually recover as the crisis ages. Annual indices still anchor the score, preventing volatile swings from media-driven event noise.

**Key design constraints:**
- Realtime signals can only make scores WORSE, not better (a quiet news day does not make a dangerous country safe)
- Annual baseline provides the floor; realtime signals provide upward adjustment to danger
- If no realtime data exists for a country, score equals the annual baseline (graceful degradation)
- Maximum realtime impact capped at 30% of total score to prevent noise domination

## Update Frequency Summary

| Source | Type | Update Cadence | Data Lag | Reliability |
|--------|------|---------------|----------|-------------|
| GPI | Annual baseline | Once/year (June) | 6-12 months | HIGH -- established index |
| World Bank WGI | Annual baseline | Once/year | 12-18 months | HIGH -- gold standard |
| INFORM Risk | Annual baseline | Once/year | 6-12 months | HIGH -- EU JRC backed |
| ACLED | Semi-realtime | Weekly | 1-2 weeks | HIGH -- academic standard, needs API key |
| US/UK Advisories | As-issued | Days-weeks | Hours-days | HIGH -- official government |
| **GDELT Stability** | **Near-realtime** | **Every 15 min** | **Minutes** | **MEDIUM -- media-derived, noisy** |
| **GDACS Alerts** | **Near-realtime** | **Hours** | **Hours** | **HIGH -- UN/EU system** |
| **ReliefWeb** | **Continuous** | **Daily** | **Hours-days** | **HIGH -- UN OCHA curated** |
| **WHO DON** | **As-issued** | **Weekly-ish** | **Days** | **HIGH -- WHO authority** |
| **INFORM Severity** | **Monthly** | **Monthly** | **Weeks** | **HIGH -- ACAPS/EU JRC** |
| **Canada/AU Advisories** | **As-issued** | **Days-weeks** | **Hours** | **HIGH -- official government** |

## Data Quality Considerations

1. **GDELT noise problem:** GDELT measures media coverage, not ground truth. A country trending on social media (e.g., Olympics) will spike in "instability" even without actual danger. Mitigation: use `SMOOTH=3` parameter for 3-day rolling average, and cap GDELT's contribution to the conflict pillar at 15% (half the pillar's weight).

2. **GDACS false positives:** Small earthquakes (M3-4) trigger alerts but pose no travel risk. Mitigation: filter to `alertlevel=red;orange` only, ignoring green alerts.

3. **WHO DON parsing difficulty:** Outbreak news is text, not structured data. A Nipah virus outbreak in Kerala, India differs vastly in severity from a seasonal flu advisory. Mitigation: count active outbreaks per country as a simple signal; do NOT attempt to parse severity from text in v3.0.

4. **Country code mismatches:** GDELT uses FIPS, WHO uses WHO region codes, ACLED uses ISO3, advisories use mixed formats. Mitigation: build a robust country code mapping module that all fetchers use. This is a one-time investment that prevents per-fetcher bugs.

5. **Missing data graceful degradation:** Many small countries (Tuvalu, Nauru) will have zero realtime signals. Mitigation: the blending formula must handle zero-signal gracefully by falling back to annual baseline only. Already designed into the proposed formula.

## Sources

- [GDELT Stability Dashboard API](https://blog.gdeltproject.org/announcing-the-gdelt-stability-dashboard-api-stability-timeline/) -- API docs and country code lookup
- [GDELT Project Data Access](https://www.gdeltproject.org/data.html) -- overview of all GDELT data products
- [GDACS API Quick Start (2025 PDF)](https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v1.pdf) -- endpoints, filtering, event types
- [GDACS Overview](https://www.gdacs.org/About/overview.aspx) -- RSS feeds and alert categories
- [ReliefWeb API Documentation](https://apidoc.reliefweb.int/endpoints) -- v2 endpoints, filtering, field tables
- [WHO Disease Outbreak News API](https://www.who.int/api/news/diseaseoutbreaknews/sfhelp) -- REST endpoint reference
- [ACAPS API / INFORM Severity](https://api.acaps.org/) -- crisis severity index with monthly updates
- [INFORM Severity on HDX](https://data.humdata.org/dataset/inform-global-crisis-severity-index) -- data download and methodology
- [USGS Earthquake Feed](https://earthquake.usgs.gov/earthquakes/feed/) -- GeoJSON realtime earthquake data
- [WHO GHO OData API](https://www.who.int/data/gho/info/gho-odata-api) -- health indicators (deprecation warning)
- [EM-DAT Emergency Events Database](https://www.emdat.be/) -- historical disasters (no API, Excel only)
- [TravelOffPath Traveler Safety Index](https://www.traveloffpath.com/traveler-safety-index/) -- competitor methodology
- [Skift Travel Health Index Methodology](https://research.skift.com/reports/methodology/) -- baseline comparison approach

---
*Feature research for: Near-realtime data sources and scoring overhaul*
*Researched: 2026-03-22*
