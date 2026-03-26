# Phase 30: Tier 2 HTML Sources Batch 1 - Research

**Researched:** 2026-03-26
**Domain:** HTML scraping of government travel advisory websites
**Confidence:** MEDIUM

## Summary

This phase adds 8 HTML-scraping advisory fetchers for countries with structured but non-API data. Research reveals that these 8 sources have very different data architectures: Austria provides a structured JavaScript object (`bmeiaCountrySecurityInfos`) that is essentially JSON; France has per-country pages with color-coded advisories but no single listing; New Zealand's SafeTravel site loads content via JavaScript (not server-rendered); Hong Kong has a simple alert system but currently has a blanket "red" advisory for all countries; and Finland/Ireland/Brazil/Philippines each require per-country page crawling or have limited structured data.

The existing codebase uses regex-based HTML parsing (no cheerio). While adding cheerio would simplify parsing, the established pattern uses raw regex on fetched HTML. The `normalizeToUnified()` generic mapper already exists in `advisory-levels.ts` and handles N-level to 1-4 conversion, which is needed for Austria (6-level -> 4), Hong Kong (3-level -> 4), and Finland (4-level but text-based).

**Primary recommendation:** Follow the tier-1 pattern exactly -- create `advisories-tier2a.ts` with 8 sub-fetchers, each producing `RawIndicator[]` and `AdvisoryInfoMap`. Use cheerio (new dependency) for reliable HTML parsing since these sources have complex HTML structures that regex alone handles poorly. Extend `AdvisoryInfoMap` and `ScoredCountry.advisories` with `fr?`, `nz?`, `ie?`, `fi?`, `hk?`, `br?`, `at?`, `ph?` keys.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked -- all at Claude's discretion (infrastructure phase).

### Claude's Discretion
- Follow the pattern established in Phase 29 (advisories-tier1.ts)
- Create advisories-tier2a.ts for this batch
- Use cheerio or similar for HTML parsing (check what's already in project deps)
- Each fetcher must handle page changes gracefully (log warning, use cache)
- Country name to ISO3 mapping required for each source
- Reuse normalization module from Phase 29

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HTML-01 | Pipeline fetches France advisory levels from diplomatie.gouv.fr RSS/HTML daily | RSS feed at `/spip.php?page=backend_fcv` provides country names + links; per-country pages have color-coded levels (vert/jaune/orange/rouge). Need per-country crawl for levels. French name matching needed via `countries.ts` `name.fr` field. |
| HTML-02 | Pipeline fetches New Zealand advisory levels from SafeTravel.govt.nz daily | 4-level system matching US scale. Destinations page likely JavaScript-rendered. May need to crawl individual country pages at `/destinations/{country}`. |
| HTML-03 | Pipeline fetches Ireland security ratings from DFA daily | 4-level system (Normal/Caution/Avoid Non-Essential/Do Not Travel). ireland.ie returns 403 to bots -- need User-Agent or alternative URL. Individual country pages at `/en/dfa/overseas-travel/advice/{country}/` may be accessible. |
| HTML-04 | Pipeline fetches Finland advisory levels from um.fi daily | 4 text-based levels in Finnish. um.fi returns 403. ~160 countries covered. Need to find accessible endpoint or use finlandabroad.fi as alternative. |
| HTML-05 | Pipeline fetches Hong Kong OTA alert levels daily | 3 levels: Amber/Red/Black, 85 countries. Currently blanket Red for all. `sb.gov.hk/eng/ota/` has CSS classes `yellowAlert`/`redAlert` for lists. Individual pages at `/eng/ota/note-{Country}.html`. |
| HTML-06 | Pipeline fetches Brazil advisory levels from Itamaraty daily | Portal consular has TLS issues. Brazil does NOT have a formal numbered level system -- issues ad-hoc advisories per country. May need to be dropped or use simplified approach. |
| HTML-07 | Pipeline fetches Austria advisory levels from BMEIA daily | Best source: JavaScript object `bmeiaCountrySecurityInfos` on `/reise-services/reisewarnungen` page. 4-level system (not 6 as initially thought). ISO2 country codes as keys. Structured JSON-in-HTML. |
| HTML-08 | Pipeline fetches Philippines alert levels from DFA daily | 4-level crisis alert system. dfa.gov.ph returns 403. Advisories posted as individual articles, not a structured listing. May need alternative approach. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cheerio | 1.2.0 | HTML/XML parsing | Standard for Node.js server-side HTML parsing, handles malformed HTML, jQuery-like API |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (built-in) fetch | Node 18+ | HTTP requests | Already used throughout pipeline |
| (existing) normalizeToUnified | - | N-level to 1-4 mapping | For Austria 4-level, HK 3-level, Finland text-based |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| cheerio | Regex (current approach) | Regex is fragile for complex HTML; cheerio handles malformed markup and makes selector-based extraction reliable |
| cheerio | node-html-parser | Lighter weight but less battle-tested; cheerio is the ecosystem standard |

**Installation:**
```bash
npm install cheerio
```

**Version verification:** cheerio 1.2.0 is current as of 2026-03-26.

## Architecture Patterns

### Recommended Project Structure
```
src/pipeline/
  fetchers/
    advisories-tier2a.ts    # NEW: 8 sub-fetchers for this batch
  normalize/
    advisory-levels.ts      # EXTEND: add normalizeFrColor, normalizeHkAlert, etc.
```

### Pattern 1: Sub-Fetcher Architecture (from tier-1)
**What:** Each source is an async function returning `{ indicators, advisoryInfo }`. Main orchestrator calls each in try/catch.
**When to use:** Always -- this is the established pattern.
**Example:**
```typescript
// Source: advisories-tier1.ts (existing pattern)
async function fetchFrAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};
  // ... fetch + parse + normalize
  return { indicators, advisoryInfo };
}
```

### Pattern 2: Country Name Matching for Non-English Sources
**What:** Build language-specific name maps from existing `countries.ts` data.
**When to use:** For France (French names), Finland (Finnish names via English fallback).
**Example:**
```typescript
// Build French name -> CountryEntry map from existing data
const frNameMap = new Map<string, CountryEntry>();
for (const country of COUNTRIES) {
  frNameMap.set(country.name.fr.toLowerCase(), country);
}
// Also add common variants
frNameMap.set('etats-unis', getCountryByIso3('USA')!);
```

### Pattern 3: JavaScript Object Extraction (Austria)
**What:** Extract JSON data from inline `<script>` tags using regex then parse.
**When to use:** When source embeds structured data in JavaScript variables.
**Example:**
```typescript
const match = html.match(/bmeiaCountrySecurityInfos\s*=\s*(\{[\s\S]*?\});/);
if (match) {
  const data = JSON.parse(match[1]);
  // data["HT"] = { security: 4, securityPartial: 0, link: "...", title: "Haiti" }
}
```

### Anti-Patterns to Avoid
- **Scraping JavaScript-rendered content:** NZ SafeTravel appears to render via JS. Use SSR-available data or find API endpoints instead.
- **Assuming all sources have listing pages:** France, NZ, Ireland, Finland require per-country crawling.
- **Over-fetching:** Rate limit all per-country crawlers. Use concurrency 3-5 for politeness.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing | Custom regex for complex DOM | cheerio selectors | Regex breaks on malformed HTML, attribute variations, nested tags |
| N-level normalization | Per-source math | `normalizeToUnified(value, min, max)` | Already exists, handles edge cases |
| Country name matching | Manual lookup tables | `getCountryByName()` + language-specific maps from `COUNTRIES` | Leverage existing multilingual name data |
| Concurrent fetching | Custom Promise logic | `fetchBatch()` (already exists in tier-1) | Worker queue pattern already proven |

## Source-by-Source Analysis

### 1. France (diplomatie.gouv.fr) -- HTML-01
**Level system:** 4 colors: vert (green=1), jaune (yellow=2), orange (3), rouge (red=4)
**Data access:** RSS feed at `/spip.php?page=backend_fcv` lists countries + links. Per-country pages at `/fr/conseils-aux-voyageurs/conseils-par-pays-destination/{country}/` contain color-coded advisory text mentioning "rouge", "orange", "jaune" etc.
**Strategy:** Fetch RSS to get country list + URLs, then batch-crawl per-country pages to extract color from advisory text. Match French country names using `countries.ts` `name.fr`.
**Level mapping:** Direct 4-to-4: vert->1, jaune->2, orange->3, rouge->4
**Concerns:** ~200 per-country fetches needed. Use concurrency 3-5. French name matching requires building fr name map from existing data.
**Confidence:** MEDIUM -- RSS confirmed working, per-country page structure confirmed via Afghanistan test.

### 2. New Zealand (SafeTravel.govt.nz) -- HTML-02
**Level system:** 4 levels: Normal precautions (1), Increased caution (2), Avoid non-essential (3), Do not travel (4)
**Data access:** Main destinations page appears JavaScript-rendered (WebFetch returned empty content area). Individual country pages likely at `/destinations/{country-slug}`.
**Strategy:** Try fetching the destinations page first. If JS-rendered, build a slug list from our COUNTRIES and probe `/destinations/{english-name-slug}` for each. Extract level text from page content.
**Level mapping:** Direct 4-to-4 (same scale as US)
**Concerns:** JS rendering may block server-side fetching. Need to verify if individual country pages are server-rendered. May need to find alternative data source.
**Confidence:** LOW -- could not verify page structure. JS rendering is a blocker risk.

### 3. Ireland (DFA) -- HTML-03
**Level system:** 4 levels: Normal Precautions (1), Exercise Caution (2), Avoid Non-Essential Travel (3), Do Not Travel (4)
**Data access:** ireland.ie returned 403 to WebFetch. Old domain dfa.ie may still work. Individual country pages at `/en/dfa/overseas-travel/advice/{country}/`.
**Strategy:** Try fetching country listing or individual pages with proper User-Agent. Build slug list from country names. Parse security rating from individual pages.
**Level mapping:** Direct 4-to-4
**Concerns:** 403 blocking. May need different User-Agent or Accept headers. Old dfa.ie domain could be fallback.
**Confidence:** LOW -- blocked by 403, structure unknown.

### 4. Finland (um.fi) -- HTML-04
**Level system:** 4 text-based levels in Finnish: Noudata tavanomaista varovaisuutta (Normal=1), Noudata erityista varovaisuutta (Special caution=2), Valta tarpeetonta matkustamista (Avoid unnecessary=3), Valta kaikkea matkustamista (Avoid all=4)
**Data access:** um.fi returned 403. ~160 countries covered. Individual notices at um.fi/matkustustiedote.
**Strategy:** Try um.fi with different User-Agent. If blocked, try finlandabroad.fi which mirrors content. Parse Finnish text for level keywords.
**Level mapping:** Direct 4-to-4 (text matching)
**Concerns:** 403 blocking on um.fi. Finnish text matching needed. finlandabroad.fi as fallback.
**Confidence:** LOW -- blocked by 403.

### 5. Hong Kong (Security Bureau OTA) -- HTML-05
**Level system:** 3 levels: Amber (signs of threat=1), Red (significant=3), Black (severe=4). No alert = level 1.
**Data access:** OTA main page accessible. CSS classes `yellowAlert`/`redAlert` exist. 85 countries listed. Individual country pages at `/eng/ota/note-{Country}.html`. However, current blanket Red alert masks per-country data.
**Strategy:** Fetch destinations page, extract country list from links (`/eng/ota/info-{Country}.html` pattern). Fetch individual pages to get alert level. Look for alert images/CSS classes (red.png, amber.png, black.png).
**Level mapping:** normalizeToUnified(value, 1, 3) or manual: Amber->2, Red->3, Black->4, None->1
**Concerns:** Currently blanket Red for all countries (COVID legacy?). Per-country data may be more granular. 85-country limit means lower coverage than other sources.
**Confidence:** MEDIUM -- page structure partially confirmed.

### 6. Brazil (Itamaraty) -- HTML-06
**Level system:** Brazil does NOT have a formal numbered level system. Issues ad-hoc advisories and alerts ("alertas e avisos") per country/situation.
**Data access:** gov.br portal returned 404. portalconsular.itamaraty.gov.br has TLS certificate issues. No structured country-level data found.
**Strategy:** RECOMMEND DEFERRING. Brazil's advisory system is event-based (like crisis alerts), not a standing per-country rating. This does not fit the pipeline's per-country advisory level model.
**Level mapping:** N/A -- no standing level system
**Concerns:** No structured data available. Would require text analysis of ad-hoc advisories.
**Confidence:** HIGH (confident it should be deferred -- not suitable for this pipeline pattern)

### 7. Austria (BMEIA) -- HTML-07
**Level system:** 4 levels (confirmed, not 6 as originally stated): 1=Sichere Lage (safe), 2=Sicherheitsrisiko (risk), 3=Hohes Sicherheitsrisiko (high risk), 4=Reisewarnung (travel warning)
**Data access:** BEST SOURCE IN BATCH. Page at `/reise-services/reisewarnungen` contains JavaScript object `bmeiaCountrySecurityInfos` with structured data: `{"HT":{"security":4,"securityPartial":0,"link":"...","title":"Haiti"}}`. Uses ISO2 country codes as keys.
**Strategy:** Fetch the warnings page, extract `bmeiaCountrySecurityInfos` JS object via regex, JSON.parse it. Map ISO2 codes to ISO3 via `getCountryByIso2()`. Direct level reading.
**Level mapping:** Direct 1-4 mapping (already unified scale!)
**Concerns:** JS object format could change. Country codes are ISO2 (need conversion). `securityPartial` flag indicates regional warnings (use max of security and securityPartial).
**Confidence:** HIGH -- structured data confirmed, extraction pattern clear.

### 8. Philippines (DFA) -- HTML-08
**Level system:** 4 crisis alert levels: Alert 1 (Precautionary=1), Alert 2 (Restriction=2), Alert 3 (Voluntary Repatriation=3), Alert 4 (Mandatory Repatriation=4)
**Data access:** dfa.gov.ph returned 403. Advisories are published as individual news articles, not a structured listing. Country-specific alert levels are mentioned in article titles/content.
**Strategy:** Try accessing with different headers. If accessible, parse the travel advisories listing page for articles mentioning "Alert Level" + country names. Extract level from text.
**Level mapping:** Direct 4-to-4
**Concerns:** 403 blocking. Article-based format is less structured. Only countries with active alerts are listed (most countries have no alert = level 1 default).
**Confidence:** LOW -- blocked by 403, article-based format is messy.

## Common Pitfalls

### Pitfall 1: 403 Blocking by Government Websites
**What goes wrong:** Many government sites (Ireland, Finland, Philippines, Brazil) block automated requests.
**Why it happens:** WAF rules, bot detection, missing User-Agent.
**How to avoid:** Set proper `User-Agent: IsItSafeToTravel/1.0 (safety research project)` header. Add `Accept: text/html` header. Consider adding `Accept-Language` for non-English sites. Implement fallback to cached data on 403.
**Warning signs:** Consistent 403 responses regardless of User-Agent.

### Pitfall 2: JavaScript-Rendered Content
**What goes wrong:** Fetching HTML returns empty content area because data is loaded via JavaScript.
**Why it happens:** Modern web frameworks render content client-side.
**How to avoid:** Check if source has an API endpoint, RSS feed, or embedded JSON data in the initial HTML. The SafeTravel NZ site may fall into this category.
**Warning signs:** HTML body is mostly empty `<div id="app">` containers.

### Pitfall 3: French/Non-English Country Name Matching
**What goes wrong:** `getCountryByName("Bresil")` returns undefined because it only searches English names.
**Why it happens:** The nameMap only indexes `name.en`.
**How to avoid:** Build language-specific maps from existing `countries.ts` data. The French names are already in the dataset (`name.fr`).
**Warning signs:** Very low country match rate.

### Pitfall 4: Blanket Advisories Masking Per-Country Data
**What goes wrong:** Hong Kong's blanket Red alert makes all countries appear Level 3+.
**Why it happens:** COVID-era or crisis-era blanket advisories override granular data.
**How to avoid:** Check individual country pages even when blanket advisory exists. Log warning if all countries return same level.
**Warning signs:** 100% of countries returning the same advisory level.

### Pitfall 5: AdvisoryInfoMap Type Explosion
**What goes wrong:** Adding 8 more optional keys to the type makes the interface unwieldy.
**Why it happens:** Each source gets its own key.
**How to avoid:** Use the established pattern (just add optional keys). Consider if future phases should use `Record<string, AdvisoryInfo>` instead. For now, follow existing convention.
**Warning signs:** Type errors when trying to access new keys.

## Code Examples

### Extending AdvisoryInfoMap Type
```typescript
// In advisories.ts - add new keys
export type AdvisoryInfoMap = Record<string, {
  us?: AdvisoryInfo;
  uk?: AdvisoryInfo;
  ca?: AdvisoryInfo;
  au?: AdvisoryInfo;
  de?: AdvisoryInfo;
  nl?: AdvisoryInfo;
  jp?: AdvisoryInfo;
  sk?: AdvisoryInfo;
  // Tier 2a
  fr?: AdvisoryInfo;
  nz?: AdvisoryInfo;
  ie?: AdvisoryInfo;
  fi?: AdvisoryInfo;
  hk?: AdvisoryInfo;
  br?: AdvisoryInfo;  // Only if Brazil is implemented
  at?: AdvisoryInfo;
  ph?: AdvisoryInfo;
}>;

// In types.ts ScoredCountry.advisories - same additions
```

### Austria Fetcher (best structured source)
```typescript
async function fetchAtAdvisories(rawDir: string, fetchedAt: string, currentYear: number): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const response = await fetch('https://www.bmeia.gv.at/reise-services/reisewarnungen', {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const html = await response.text();
  const match = html.match(/bmeiaCountrySecurityInfos\s*=\s*(\{[\s\S]*?\});/);
  if (!match) throw new Error('bmeiaCountrySecurityInfos not found in page');

  const data = JSON.parse(match[1]) as Record<string, { security: number; securityPartial: number; title: string }>;

  for (const [iso2, entry] of Object.entries(data)) {
    const country = getCountryByIso2(iso2);
    if (!country) continue;
    const level = Math.min(4, Math.max(1, Math.max(entry.security, entry.securityPartial))) as UnifiedLevel;
    indicators.push({ countryIso3: country.iso3, indicatorName: 'advisory_level_at', value: level, year: currentYear, source: 'advisories_at', fetchedAt });
    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].at = { level, text: AT_LEVEL_TEXT[level], source: 'Austrian Federal Ministry', url: `https://www.bmeia.gv.at${entry.link || ''}`, updatedAt: fetchedAt };
  }
  return { indicators, advisoryInfo };
}
```

### France Color Extraction
```typescript
function normalizeFrColor(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('rouge') || lower.includes('formellement deconseille')) return 4;
  if (lower.includes('orange') || lower.includes('deconseille sauf raison')) return 3;
  if (lower.includes('jaune') || lower.includes('vigilance renforcee')) return 2;
  return 1; // vert / vigilance normale
}
```

### New Normalization Functions Needed
```typescript
// advisory-levels.ts additions
export function normalizeFrColor(color: string): UnifiedLevel { /* vert/jaune/orange/rouge */ }
export function normalizeHkAlert(alert: string): UnifiedLevel { /* amber/red/black -> 2/3/4 */ }
export function normalizeIeRating(rating: string): UnifiedLevel { /* text-based 4-level */ }
export function normalizeFiLevel(text: string): UnifiedLevel { /* Finnish text-based 4-level */ }
export function normalizePhAlert(level: number): UnifiedLevel { /* 1-4 direct mapping */ }
// Austria and NZ: direct 1-4 / 4-level, use normalizeToUnified or direct
```

## Implementation Priority / Feasibility Ranking

| Source | Feasibility | Data Quality | Priority |
|--------|------------|--------------|----------|
| Austria (BMEIA) | HIGH - structured JS object | HIGH - all countries, clear levels | 1st |
| France | MEDIUM - RSS + per-country crawl | HIGH - 191 countries, 4 colors | 2nd |
| Hong Kong | MEDIUM - static HTML | MEDIUM - only 85 countries, blanket alert issue | 3rd |
| New Zealand | LOW-MEDIUM - may be JS-rendered | HIGH - 4 levels, good coverage | 4th |
| Ireland | LOW - 403 blocking | HIGH - 4 levels | 5th |
| Philippines | LOW - 403 blocking, article format | MEDIUM - only crisis countries listed | 6th |
| Finland | LOW - 403 blocking | HIGH - 160 countries | 7th |
| Brazil | NOT FEASIBLE - no structured level system | N/A | Drop or defer |

## Recommendation: Drop Brazil (HTML-06)

Brazil's Itamaraty does not maintain a per-country advisory level system comparable to other sources. Their "alertas e avisos" are event-driven, ad-hoc notifications (similar to crisis alerts). This makes it incompatible with the pipeline's per-country advisory level model. The portal also has TLS certificate issues. Recommend marking HTML-06 as "not applicable" and proceeding with 7 sources.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Regex HTML parsing | cheerio/DOM parsing | 2020+ | More reliable extraction from complex HTML |
| Per-source custom normalization | Generic normalizeToUnified() | Phase 29 | Handles any N-level system |

## Open Questions

1. **New Zealand SafeTravel JS rendering**
   - What we know: Destinations page returns near-empty HTML for server-side fetch
   - What's unclear: Whether individual country pages are server-rendered
   - Recommendation: Try fetching `/destinations/afghanistan` to test. If empty, NZ may need to be deferred.

2. **403-blocked sites (Ireland, Finland, Philippines)**
   - What we know: These return 403 to WebFetch tool
   - What's unclear: Whether the pipeline's `fetch()` with proper User-Agent will succeed where WebFetch failed
   - Recommendation: Implement with proper headers and graceful fallback. Test at runtime. If still blocked, log warning and skip.

3. **Hong Kong blanket Red alert**
   - What we know: As of 2026-03-26, a blanket Red alert applies to "all overseas countries/territories"
   - What's unclear: Whether individual country pages have more granular data
   - Recommendation: Implement per-country fetching. If all return Red, the source still provides valid (if undifferentiated) data.

4. **AdvisoryInfoMap type approach for 30+ sources**
   - What we know: Current approach uses named optional keys per source
   - What's unclear: Whether this scales to 30+ sources
   - Recommendation: Keep current pattern for this phase. Consider refactoring to `Record<string, AdvisoryInfo>` in a future phase.

## Sources

### Primary (HIGH confidence)
- WebFetch of bmeia.gv.at/reise-services/reisewarnungen -- confirmed `bmeiaCountrySecurityInfos` JS object structure
- WebFetch of diplomatie.gouv.fr/spip.php?page=backend_fcv -- confirmed RSS feed structure
- WebFetch of diplomatie.gouv.fr Afghanistan page -- confirmed color-coded advisory system
- WebFetch of safetravel.govt.nz/travel-advice-levels -- confirmed 4-level system
- WebFetch of sb.gov.hk/eng/ota/ -- confirmed 3-level OTA system and CSS classes
- Wikipedia Outbound_Travel_Alert_System -- confirmed Amber/Red/Black levels with definitions
- Existing codebase: advisories-tier1.ts, advisories.ts, advisory-levels.ts -- confirmed patterns

### Secondary (MEDIUM confidence)
- WebSearch for Philippines DFA crisis alert levels -- 4-level system confirmed via multiple news sources
- WebSearch for Ireland DFA security ratings -- 4-level system confirmed via dfa.ie
- WebSearch for Finland um.fi advisory levels -- 4 Finnish text-based levels confirmed
- WebSearch for Austria BMEIA -- 4-level (not 6) confirmed via visahq.com news

### Tertiary (LOW confidence)
- Brazil Itamaraty advisory structure -- only US-centric results found, no structured Brazilian system confirmed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - cheerio is the established Node.js HTML parser
- Architecture: HIGH - follows proven tier-1 pattern exactly
- Source analysis (Austria): HIGH - structured data confirmed
- Source analysis (France): MEDIUM - RSS + per-country confirmed, crawl approach clear
- Source analysis (HK): MEDIUM - structure partially confirmed
- Source analysis (NZ, IE, FI, PH): LOW - blocked or JS-rendered, approach uncertain
- Source analysis (Brazil): HIGH confidence it should be dropped

**Research date:** 2026-03-26
**Valid until:** 2026-04-10 (government sites may change structure)
