# Phase 32: Tier 3 Complex Sources Batch 1 - Research

**Researched:** 2026-03-26
**Domain:** Web scraping of non-English government travel advisory sites (Italian, Spanish, Korean, Chinese, Taiwanese, Indian)
**Confidence:** MEDIUM

## Summary

This phase adds 6 complex advisory fetchers to the pipeline. These sources are "complex" because they involve non-Latin scripts (Korean, Chinese), text-based level extraction without formal structured systems, and in some cases JS-rendered pages that resist simple HTML scraping.

The established pattern from `advisories-tier2a.ts` and `advisories-tier2b.ts` is well-proven: a single file containing multiple sub-fetchers, each wrapped in try/catch, with a main export function that orchestrates them all. The new file should be `advisories-tier3a.ts` following this convention. Each sub-fetcher produces `RawIndicator[]` and `AdvisoryInfoMap` entries, and the main function writes `advisories-tier3a-parsed.json` and `advisories-tier3a-info.json`.

Key challenges: Italy's site (viaggiaresicuri.it) is JS-rendered and may require fetching PDF country sheets or the per-country API pages. Spain has no formal advisory level system -- only text-based recommendations. South Korea has an open data API on data.go.kr that provides structured advisory data (best source in this batch). Taiwan has a clean 4-level color system. China uses ad-hoc text alerts with 3 informal levels. India's MEA site returns 403 and has only ad-hoc advisories.

**Primary recommendation:** Create `advisories-tier3a.ts` following the tier2a/2b pattern exactly. Prioritize South Korea (API) and Taiwan (structured HTML) as highest-yield sources. Accept sparse results from text-based sources (Italy, Spain, China, India).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion per CONTEXT.md.

### Claude's Discretion
All implementation choices are at Claude's discretion. Key constraints:
- Create advisories-tier3a.ts following tier2a/tier2b pattern
- Use cheerio for HTML parsing
- Non-Latin scripts (Korean, Chinese) need careful pattern matching
- Text-based sources may produce sparse results -- acceptable
- Graceful failure on all sources

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CPLX-01 | Pipeline fetches Italy advisory data from Viaggiare Sicuri daily | Italy uses ISO3-based PDF country sheets at `/schede_paese/pdf/{ISO3}.pdf` and web pages at `/find-country/country/{ISO3}`. No formal level system -- text pattern matching needed on Italian text. |
| CPLX-02 | Pipeline fetches Spain advisory data from exteriores.gob.es daily | Spain has no formal level system. Country listing page has `settingsDelegationCountries` JS variable with country names/embassy data but NO advisory levels. Per-country pages have text recommendations. |
| CPLX-03 | Pipeline fetches South Korea advisory levels from 0404.go.kr daily | Korea has open data API at `apis.data.go.kr/1262000/SptravelWarningServiceV2` with 4 levels: Level 1 (Travel Caution), Level 2 (Travel Restraint), Level 3 (Departure Recommended), Level 4 (Travel Prohibited). Requires API key from data.go.kr. |
| CPLX-04 | Pipeline fetches Taiwan advisory levels from BOCA daily | Taiwan BOCA has 4 levels: Gray (Alert), Yellow (Caution), Orange (Avoid Travel), Red (Leave Immediately). Countries grouped by region in HTML tables. URL pattern: `/sp-trwa-content-{ID}-{HASH}-1.html`. |
| CPLX-05 | Pipeline fetches China advisory data from cs.mfa.gov.cn daily | China MFA uses ad-hoc safety reminders with 3 informal text levels: "Exercise Caution", "Proceed with Caution", "Do Not Travel". Listed chronologically. Country names extracted from advisory title text. |
| CPLX-06 | Pipeline fetches India advisory data from MEA daily | India MEA at mea.gov.in/travel-advisories.htm returns 403. Alternative page at travel-advisory.htm may work. Ad-hoc advisories only, no formal level system. English text. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cheerio | (already installed) | HTML parsing | Used by all tier2a/2b fetchers, proven pattern |
| node:path | built-in | File path operations | Standard Node.js |

### Supporting
No additional libraries needed. All dependencies already in the project.

## Architecture Patterns

### Recommended Project Structure
```
src/pipeline/
  fetchers/
    advisories-tier3a.ts    # NEW: 6 sub-fetchers for complex sources
  normalize/
    advisory-levels.ts      # ADD: normalizeItLevel, normalizeEsLevel, normalizeKrLevel, normalizeTwLevel, normalizeCnLevel, normalizeInLevel
```

### Pattern 1: Sub-Fetcher Pattern (from tier2a.ts)
**What:** Each source is an independent async function returning `FetcherResult` (`{ indicators, advisoryInfo }`). The main export function calls each in try/catch and merges results.
**When to use:** Always -- this is the established pattern.
**Example:**
```typescript
async function fetchItAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};
  // ... fetch and parse ...
  return { indicators, advisoryInfo };
}
```

### Pattern 2: Cache Fallback Pattern (from tier2a.ts)
**What:** If all sub-fetchers fail (allIndicators.length === 0), attempt to load from `findLatestCached('advisories-tier3a-parsed.json')`.
**When to use:** Always -- at the end of the main export function.

### Pattern 3: AdvisoryInfoMap Type Extension
**What:** The `AdvisoryInfoMap` type in `advisories.ts` and `ScoredCountry.advisories` in `types.ts` must be extended with new source keys: `it`, `es`, `kr`, `tw`, `cn`, `in`.
**When to use:** Required for each new source.

### Anti-Patterns to Avoid
- **Fetching all country pages individually without throttling:** Use `fetchBatch()` with concurrency limit (5) as tier2a does for NZ.
- **Assuming country names match exactly:** Always use `getCountryByName()` / `getCountryByIso2()` / `getCountryByIso3()` with fuzzy matching where needed.
- **Hard-failing on encoding issues:** Non-Latin text may have encoding variants; use `.normalize('NFD')` for accent stripping.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing | Custom regex on HTML | cheerio | Already used everywhere, handles malformed HTML |
| Country name matching | Custom lookup maps | `getCountryByName()`, `getCountryByIso2()`, `getCountryByIso3()` | Already handles English, Italian, Spanish, French, Portuguese names |
| Level normalization | Inline level mapping | Dedicated functions in `advisory-levels.ts` | Consistent with existing pattern, testable |

## Common Pitfalls

### Pitfall 1: JS-Rendered Content (Italy)
**What goes wrong:** `viaggiaresicuri.it` pages return mostly CSS/JS with no actual content in the HTML body.
**Why it happens:** React/Vue SPA that loads content client-side.
**How to avoid:** Use the PDF country sheets at `https://www.viaggiaresicuri.it/schede_paese/pdf/{ISO3}.pdf` as a more reliable data source, OR iterate over COUNTRIES using ISO3 codes to hit `/find-country/country/{ISO3}` pages. Accept that this source may yield sparse results.
**Warning signs:** Response HTML contains only `<div id="root">` or similar SPA markers.

### Pitfall 2: Korea API Requires Registration
**What goes wrong:** The Korea data.go.kr API requires an API key obtained through registration.
**Why it happens:** Government open data portals require key registration.
**How to avoid:** Fall back to scraping the HTML at `0404.go.kr/travelAlert/apntStatus/stepTravelAlert` or the country list page. Alternatively, skip API key requirement and scrape the public-facing website directly.
**Warning signs:** API returns 401/403.

### Pitfall 3: India MEA Returns 403
**What goes wrong:** `mea.gov.in/travel-advisories.htm` returns HTTP 403 Forbidden.
**Why it happens:** Likely WAF or bot protection.
**How to avoid:** Try alternative URL `mea.gov.in/travel-advisory.htm` (singular). Use appropriate User-Agent header. Accept empty results if blocked.
**Warning signs:** Consistent 403 responses.

### Pitfall 4: China Advisory Text Not Per-Country
**What goes wrong:** China's advisories are listed chronologically as news items, not per-country.
**Why it happens:** China issues ad-hoc alerts rather than maintaining per-country level pages.
**How to avoid:** Parse the advisory list page, extract country names from titles using Chinese country name matching, and extract level from keyword matching on the advisory text.
**Warning signs:** Same country appearing multiple times with different dates.

### Pitfall 5: Spain Has No Advisory Levels
**What goes wrong:** The Spain `settingsDelegationCountries` data contains embassy/consulate info but NO advisory levels.
**Why it happens:** Spain's travel recommendations are purely textual, per-country, without a standardized level system.
**How to avoid:** Accept that Spain may only produce sparse or no results from the listing page. Per-country scraping of embassy/consulate recommendation pages could extract text-based levels, but the effort-to-yield ratio is low.
**Warning signs:** No level/risk data in the JS variable.

### Pitfall 6: Type Extension Required in Multiple Files
**What goes wrong:** Adding new advisory source keys requires changes in `advisories.ts` (AdvisoryInfoMap type), `types.ts` (ScoredCountry.advisories), and `scoring/engine.ts` (loading tier3a info).
**Why it happens:** Advisory info flows through multiple typed interfaces.
**How to avoid:** Update all three locations together: `advisories.ts` AdvisoryInfoMap, `types.ts` ScoredCountry.advisories, and `engine.ts` to load `advisories-tier3a-info.json`.

## Code Examples

### Sub-Fetcher Registration Pattern (from tier2a.ts)
```typescript
// In the main export function:
try {
  console.log('[ADVISORIES-T3A] Fetching South Korea (MOFA) advisories...');
  const result = await fetchKrAdvisories(rawDir, fetchedAt, currentYear);
  allIndicators.push(...result.indicators);
  mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
  const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
  console.log(`[ADVISORIES-T3A] KR: ${count} countries`);
} catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
  console.warn(`[ADVISORIES-T3A] KR fetch failed: ${msg}`);
  errors.push(`KR: ${msg}`);
}
```

### Level Text Maps Pattern
```typescript
const KR_LEVEL_TEXT: Record<number, string> = {
  1: '여행유의 (Travel Caution)',
  2: '여행자제 (Travel Restraint)',
  3: '출국권고 (Departure Recommended)',
  4: '여행금지 (Travel Prohibited)',
};

const TW_LEVEL_TEXT: Record<number, string> = {
  1: '灰色提醒 (Gray Alert)',
  2: '黃色注意 (Yellow Caution)',
  3: '橙色避免前往 (Orange Avoid Travel)',
  4: '紅色儘速離境 (Red Leave Immediately)',
};
```

### Indicator Creation Pattern
```typescript
indicators.push({
  countryIso3: country.iso3,
  indicatorName: 'advisory_level_kr',
  value: level,
  year: currentYear,
  source: 'advisories_kr',
  fetchedAt,
});
```

### Required Type Extensions
```typescript
// In advisories.ts AdvisoryInfoMap, add:
it?: AdvisoryInfo;
es?: AdvisoryInfo;
kr?: AdvisoryInfo;
tw?: AdvisoryInfo;
cn?: AdvisoryInfo;
in?: AdvisoryInfo;

// In types.ts ScoredCountry.advisories, add same keys.
```

### Required engine.ts Addition
```typescript
// In scoring/engine.ts, after tier2b loading block:
const tier3aInfoPath = join(process.cwd(), 'data', 'raw', dataDate, 'advisories-tier3a-info.json');
const tier3aInfo = readJson<AdvisoryInfoMap>(tier3aInfoPath);
if (tier3aInfo) {
  for (const [iso3, info] of Object.entries(tier3aInfo)) {
    if (!advisoryInfoMap[iso3]) advisoryInfoMap[iso3] = {};
    Object.assign(advisoryInfoMap[iso3], info);
  }
  console.log(`  Merged tier-3a advisory info`);
}
```

### Required index.ts Addition
```typescript
// Import and wire up:
import { fetchTier3aAdvisories } from './advisories-tier3a.js';
export { fetchTier3aAdvisories } from './advisories-tier3a.js';

// Add to fetchAllSources Promise.allSettled array:
fetchTier3aAdvisories(date),

// Add to sourceNames array:
'advisories_tier3a'
```

## Source-by-Source Implementation Notes

### Italy (Viaggiare Sicuri) -- CPLX-01
- **URL Pattern:** `https://www.viaggiaresicuri.it/find-country/country/{ISO3}` (JS-rendered, may fail)
- **PDF Alternative:** `https://www.viaggiaresicuri.it/schede_paese/pdf/{ISO3}.pdf` (reliable but requires PDF parsing)
- **Recommendation:** Try the web page first. If JS-rendered (empty body), fall back to a simpler approach: iterate COUNTRIES, try to fetch each page, look for Italian advisory keywords. Accept sparse results.
- **Level mapping:** No formal system. Use Italian text matching:
  - "sconsigliato" / "non recarsi" -> Level 4
  - "sconsigliati i viaggi" / "evitare" -> Level 3
  - "cautela" / "attenzione" -> Level 2
  - Default -> Level 1
- **Country matching:** Uses ISO3 codes directly in URL, so `COUNTRIES` list maps perfectly.

### Spain (exteriores.gob.es) -- CPLX-02
- **URL:** `https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Recomendaciones-de-viaje.aspx`
- **Data available:** `settingsDelegationCountries` JS variable has country names + embassy links, but NO advisory levels.
- **Recommendation:** Extract country list from JS variable. For each, could attempt to fetch the embassy/consulate recommendation page, but those don't have formal levels either. Most pragmatic: parse the JS variable for country names, default all to level 1, and optionally scan per-country pages for Spanish keywords.
- **Level mapping:** No formal system. Use Spanish text matching:
  - "se desaconseja todo viaje" / "no viajar" -> Level 4
  - "se desaconseja" / "evitar" -> Level 3
  - "precaucion" / "prudencia" -> Level 2
  - Default -> Level 1
- **Yield expectation:** LOW -- may only find levels for high-risk countries.

### South Korea (0404.go.kr) -- CPLX-03
- **API:** `http://apis.data.go.kr/1262000/SptravelWarningServiceV2/getSptravelWarningListV2`
  - Requires `ServiceKey` (registration needed)
  - Parameters: `numOfRows`, `pageNo`, `returnType=JSON`, `cond[country_iso_alp2::EQ]`
  - Returns structured JSON with advisory levels
- **HTML Fallback:** `https://0404.go.kr/travelAlert/apntStatus/stepTravelAlert` -- shows 4 levels with tabs
- **Country page pattern:** `https://www.0404.go.kr/dev/country_view.mofa?idx={id}`
- **Level system:** 4 levels exactly matching unified scale:
  - Level 1: 여행유의 (Travel Caution) -- blue
  - Level 2: 여행자제 (Travel Restraint) -- yellow
  - Level 3: 출국권고 (Departure Recommended) -- red
  - Level 4: 여행금지 (Travel Prohibited) -- black
- **Recommendation:** Since API requires registration, scrape the HTML pages instead. Try the country list at `/ntnSafetyInfo/list` or parse the travel alert status page.
- **Country matching:** Uses ISO2 codes in API; HTML may use Korean country names.

### Taiwan (BOCA) -- CPLX-04
- **URL:** `https://www.boca.gov.tw/sp-trwa-list-1.html`
- **Structure:** Countries grouped by region in HTML tables with level text in cells.
- **Level system:** 4 levels (matches unified scale directly):
  - Level 1: 灰色提醒 (Gray Alert)
  - Level 2: 黃色注意 (Yellow Caution)
  - Level 3: 橙色避免前往 (Orange Avoid Travel)
  - Level 4: 紅色儘速離境 (Red Leave Immediately)
- **Country matching:** Tables have Chinese country names AND English country names (found in the HTML).
- **Recommendation:** Parse the listing page tables. Match country names using English names where available. HIGH yield expected.

### China (cs.mfa.gov.cn) -- CPLX-05
- **URL:** `https://cs.mfa.gov.cn/gyls/lsgz/lsyj/` (safety reminders page)
- **Structure:** Chronological list of advisory items with format `[YYYY-MM-DD] Advisory Title`
- **Advisory URL pattern:** `./YYYYMM/tYYYYMMDD_{id}.shtml`
- **Level system:** 3 informal text levels:
  - "暂勿前往" (Do not travel) -> Level 4
  - "谨慎前往" (Proceed with caution) -> Level 3
  - "注意安全" (Exercise caution) -> Level 2
  - No advisory -> Level 1
- **Country extraction:** Country names appear in advisory titles in Chinese (e.g., "提醒中国公民近期避免前往日本").
- **Recommendation:** Parse the listing page for recent advisories. Extract Chinese country names from titles. Match against COUNTRIES list using Chinese names (not in current countries.ts -- will need a supplementary Chinese name map). Accept sparse results (only countries with active advisories).
- **Yield expectation:** LOW -- only countries with active recent advisories will appear.

### India (MEA) -- CPLX-06
- **Primary URL:** `https://www.mea.gov.in/travel-advisories.htm` (returns 403)
- **Alternative:** `https://www.mea.gov.in/travel-advisory.htm` (may work)
- **Detail pages:** `https://www.mea.gov.in/advisories-details.htm?{id}`
- **Structure:** List of advisory titles with links, in English.
- **Level system:** No formal system. Ad-hoc advisories only.
- **Level mapping:** English text matching (similar to existing SG/RS normalizers):
  - "do not travel" / "leave immediately" -> Level 4
  - "avoid" / "defer" / "reconsider" -> Level 3
  - "caution" / "exercise" -> Level 2
  - Default -> Level 1
- **Recommendation:** Try both URLs. Parse the advisory list. Extract country names from titles. Accept sparse results.
- **Yield expectation:** LOW -- India issues few advisories.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single advisories.ts file | Tiered files (tier1, tier2a, tier2b) | Phase 30-31 | Separate files by complexity |
| No non-Latin script sources | Korean/Chinese/Taiwanese sources | Phase 32 (now) | Need Chinese country name mapping |

## Open Questions

1. **Korea API Key**
   - What we know: data.go.kr API exists with structured JSON data
   - What's unclear: Whether the project wants to register for an API key, or whether HTML scraping is preferred
   - Recommendation: Use HTML scraping for now to avoid API key management. Can upgrade to API later.

2. **Chinese Country Name Mapping**
   - What we know: `countries.ts` has English, Italian, Spanish, French, Portuguese names but NOT Chinese
   - What's unclear: Whether to add Chinese names to countries.ts or maintain a separate map in the fetcher
   - Recommendation: Create a local `CHINESE_NAMES` map in the fetcher file (similar to how France fetcher creates `frNameMap`). No need to modify the shared countries config.

3. **Italy JS-Rendered Content**
   - What we know: Page HTML is mostly CSS/JS framework code, content loaded dynamically
   - What's unclear: Whether the `/find-country/country/{ISO3}` endpoint returns useful HTML or is also SPA-rendered
   - Recommendation: Try fetching a sample country page. If empty, consider alternative approaches (PDF parsing would require a PDF library not currently in the project). Accept sparse results if needed.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `advisories-tier2a.ts`, `advisories-tier2b.ts`, `advisory-levels.ts`, `types.ts`, `advisories.ts`, `index.ts`, `engine.ts` -- established patterns
- Taiwan BOCA page (`boca.gov.tw/sp-trwa-list-1.html`) -- directly fetched and analyzed, 4-level system confirmed

### Secondary (MEDIUM confidence)
- Korea data.go.kr API documentation -- API endpoint and parameters confirmed via WebFetch
- Korea 0404.go.kr travel alert page -- 4-level system with Korean names confirmed via WebFetch
- China cs.mfa.gov.cn advisory page -- chronological advisory format and 3-level text system confirmed via WebFetch
- Spain exteriores.gob.es -- settingsDelegationCountries structure confirmed, no advisory levels confirmed
- Italy viaggiaresicuri.it URL patterns -- ISO3-based URLs confirmed via WebSearch results

### Tertiary (LOW confidence)
- India MEA structure -- primary URL returns 403, alternative URL unverified
- Italy page content -- could not verify actual HTML content due to JS rendering

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- uses existing cheerio + established fetcher pattern
- Architecture: HIGH -- directly follows tier2a/2b pattern
- Source-specific implementation: MEDIUM -- 4 of 6 sources verified, 2 have access issues
- Pitfalls: HIGH -- based on direct verification attempts

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (government sites rarely change structure)
