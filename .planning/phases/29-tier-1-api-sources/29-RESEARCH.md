# Phase 29: Tier 1 API Sources - Research

**Researched:** 2026-03-26
**Domain:** Government travel advisory APIs (Germany, Netherlands, Japan, Slovakia) + normalization module
**Confidence:** HIGH (3 APIs verified live, 1 problematic)

## Summary

Phase 29 requires building 4 new advisory fetchers and a shared normalization module. The Germany and Netherlands APIs are well-structured, publicly accessible REST/XML endpoints that provide clean data with ISO country codes. Japan MOFA's open data portal (ezairyu.mofa.go.jp) appears to be defunct, but the anzen.mofa.go.jp safety site has structured per-country HTML pages with clear danger level information that can be reliably scraped. Slovakia's open data portal has a critical problem: of 138 records, only 1 has a risk level populated -- the rest are empty. Slovakia should still be implemented but with appropriate handling for sparse data.

The existing advisory fetcher in `src/pipeline/fetchers/advisories.ts` establishes a clear pattern: each sub-fetcher returns `{ indicators: RawIndicator[], advisoryInfo: AdvisoryInfoMap }`, uses `getCountryByName()` for ISO3 mapping, writes raw data to `data/raw/{date}/`, and handles failures gracefully. New fetchers should follow this exact pattern. The normalization module should map all level systems to the unified 1-4 scale used throughout the scoring engine.

**Primary recommendation:** Create a new `src/pipeline/fetchers/advisories-tier1.ts` file with 4 sub-fetchers following the existing advisories.ts pattern, plus a shared `src/pipeline/normalize/advisory-levels.ts` module for level mapping. Register the new fetcher in `src/pipeline/fetchers/index.ts`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
No explicitly locked decisions. All implementation choices are at Claude's discretion per CONTEXT.md.

### Claude's Discretion
All implementation choices are at Claude's discretion -- infrastructure phase. Key constraints:
- Each fetcher must produce a parsed JSON file in data/raw/{date}/ following existing advisory fetcher patterns
- Shared normalization module must map: 3-level, 4-level, 5-level, 6-level, color-coded, and text-based systems to unified 1-4 scale
- Country names from each source must be mapped to ISO3 codes
- Each fetcher must handle API failures gracefully (log warning, continue pipeline)
- Follow existing fetcher patterns from src/pipeline/fetchers/advisories.ts

### Deferred Ideas (OUT OF SCOPE)
None -- infrastructure phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| API-01 | Pipeline fetches Germany advisory levels from Auswaertiges Amt REST API daily | Germany API verified live: REST JSON at auswaertiges-amt.de/opendata/travelwarning, 199 countries, no auth, ISO3 codes included, 4 boolean warning flags |
| API-02 | Pipeline fetches Netherlands advisory levels from nederlandwereldwijd.nl JSON API daily | Netherlands API verified live: XML at opendata.nederlandwereldwijd.nl, per-country endpoints with ISO3 codes, color-coded levels (groen/geel/oranje/rood), no auth |
| API-03 | Pipeline fetches Japan advisory levels from MOFA XML open data daily | Japan open data portal (ezairyu) appears defunct. Alternative: scrape per-country pages on anzen.mofa.go.jp using country ID list, 4 danger levels (1-4) |
| API-04 | Pipeline fetches Slovakia advisory data from MZV open data portal daily | Slovakia CKAN API verified: CSV/JSON at opendata.mzv.sk, 138 records but only 1 has risk level populated. Sparse but implementable |
| NORM-01 | All new sources normalize to unified 1-4 advisory level scale | Normalization mappings researched for all 4 systems. Module should support color-coded, boolean-flag, numeric, and text-based level systems |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js fetch | built-in | HTTP requests for all APIs | Already used in existing advisories.ts |
| xml2js or manual regex | N/A | Parse Netherlands XML responses | Netherlands API returns XML; simple regex parsing is sufficient given consistent structure |

### Supporting
No additional packages needed. The existing codebase utilities (`writeJson`, `readJson`, `getRawDir`, `findLatestCached`, `getCountryByName`, `getCountryByIso2`) cover all requirements.

## Architecture Patterns

### Recommended Project Structure
```
src/pipeline/
  fetchers/
    advisories.ts           # Existing US/UK/CA/AU fetchers (unchanged)
    advisories-tier1.ts     # NEW: DE/NL/JP/SK fetchers
    index.ts                # Updated to include new fetcher
  normalize/
    advisory-levels.ts      # NEW: Shared level normalization module
  config/
    sources.json            # Updated with new sources
    source-tiers.json       # Updated with new source tiers
    weights.json            # NOT updated this phase (Phase 34)
```

### Pattern 1: Fetcher Structure (from existing advisories.ts)
**What:** Each sub-fetcher function returns `{ indicators: RawIndicator[], advisoryInfo: AdvisoryInfoMap }` and writes raw data to disk.
**When to use:** Every new advisory fetcher.
**Example:**
```typescript
async function fetchDeAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const response = await fetch(DE_API_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const rawData = await response.json();
  writeJson(join(rawDir, 'advisories-de.json'), rawData);

  // Parse and map to indicators...
  return { indicators, advisoryInfo };
}
```

### Pattern 2: Main Fetcher Orchestration
**What:** Top-level export function catches each sub-fetcher independently, merges results, falls back to cache on total failure.
**When to use:** The main `fetchTier1Advisories()` export.
**Example:** Follow exact pattern of `fetchAdvisories()` in advisories.ts -- try/catch each source, collect errors, merge advisory info, write combined parsed file, fall back to cache if all fail.

### Pattern 3: AdvisoryInfoMap Extension
**What:** The `AdvisoryInfoMap` type needs extending to support new source keys.
**When to use:** When adding new advisory sources.
**Note:** The existing type is `Record<string, { us?, uk?, ca?, au? }>`. New sources need `de?`, `nl?`, `jp?`, `sk?` keys. The `ScoredCountry.advisories` type in `types.ts` also needs extending.

### Anti-Patterns to Avoid
- **Modifying existing advisories.ts:** Keep the existing 4 sources untouched. Create a new file for Tier 1 sources.
- **Blocking pipeline on single API failure:** Each sub-fetcher must be independently try/caught.
- **Using country names directly as keys:** Always map through `getCountryByName()` or `getCountryByIso2()` to get ISO3 codes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML parsing for Netherlands | Full XML parser | Simple regex on known XML structure | Response structure is fixed and simple; `<isocode>`, `<introduction>` with color text |
| Country name matching | Custom fuzzy match | Existing `getCountryByName()` from countries.ts | Already handles common variations, has name alias map |
| ISO code lookup | Manual mapping tables | `getCountryByIso2()` / `getCountryByIso3()` | Already in codebase with full coverage |
| HTTP with timeout | Custom timeout logic | `AbortSignal.timeout(30_000)` | Pattern already used throughout codebase |

## API Research Findings

### 1. Germany (Auswaertiges Amt) -- VERIFIED LIVE
**Confidence:** HIGH

**Endpoint:** `GET https://www.auswaertiges-amt.de/opendata/travelwarning`
- **Auth:** None required
- **Format:** JSON
- **Rate limiting:** Not documented; appears unlimited for reasonable use
- **Response structure:**
  ```json
  {
    "response": {
      "contentList": [226660, 226750, ...],
      "226660": {
        "countryCode": "KM",
        "iso3CountryCode": "COM",
        "countryName": "Komoren",
        "warning": false,
        "partialWarning": false,
        "situationWarning": false,
        "situationPartWarning": false,
        "lastModified": 1732098978,
        "effective": 1732098978,
        "title": "..."
      }
    }
  }
  ```
- **Country identification:** ISO2 (`countryCode`), ISO3 (`iso3CountryCode`), German name (`countryName`)
- **Advisory levels:** 4 boolean flags:
  - `warning` = full travel warning (Reisewarnung)
  - `partialWarning` = partial travel warning (Teilreisewarnung)
  - `situationWarning` = situation-specific warning
  - `situationPartWarning` = partial situation warning
- **Level distribution (verified):** 26 warning, 26 partialWarning, 0 situationWarning, 0 situationPartWarning, 147 none. Total: 199 countries.

**Normalization to 1-4 scale:**
| Flag | Level | Meaning |
|------|-------|---------|
| `warning: true` | 4 | Do not travel |
| `partialWarning: true` | 3 | Avoid travel to parts |
| `situationWarning: true` | 2 | Exercise increased caution |
| `situationPartWarning: true` | 2 | Caution in some areas |
| All false | 1 | Normal precautions |

When multiple flags are true, use the highest level.

### 2. Netherlands (nederlandwereldwijd.nl) -- VERIFIED LIVE
**Confidence:** HIGH

**Listing endpoint:** `GET https://opendata.nederlandwereldwijd.nl/v2/sources/nederlandwereldwijd/infotypes/traveladvice`
- Returns XML with max 25 documents (pagination appears non-functional)

**Per-country endpoint:** `GET https://opendata.nederlandwereldwijd.nl/v2/sources/nederlandwereldwijd/infotypes/countries/{iso3_lower}/traveladvice`
- Example: `.../countries/afg/traveladvice` for Afghanistan
- **Auth:** None required
- **Format:** XML
- **Rate limiting:** Not documented
- **Response structure (per document):**
  ```xml
  <document>
    <id>AFG</id>
    <isocode>AFG</isocode>
    <location>Afghanistan</location>
    <introduction><![CDATA[...kleurcode...rood...]]></introduction>
    <lastmodified>2026-03-19T08:41:21.339Z</lastmodified>
  </document>
  ```
- **Country identification:** ISO3 in `<isocode>` tag and `<id>` tag
- **Advisory levels:** Color codes embedded in Dutch text in `<introduction>`:
  - "groen" (green) = safe to travel
  - "geel" (yellow) = travel possible, special risks
  - "oranje" (orange) = travel only if necessary
  - "rood" (red) = do not travel
- **Regional variations:** Some countries have mixed colors for different regions (e.g., Pakistan: rood for western border, oranje for Sindh, geel for rest). Use the highest/worst color for the overall level.

**Strategy:** Since the listing endpoint only returns 25 items, iterate over all ISO3 codes from our `COUNTRIES` list and fetch per-country endpoints. This ensures full coverage. Use `getCountryByIso3()` to validate codes.

**Normalization to 1-4 scale:**
| Color | Dutch | Level |
|-------|-------|-------|
| Green | groen | 1 |
| Yellow | geel | 2 |
| Orange | oranje | 3 |
| Red | rood | 4 |

**Parsing approach:** Extract color from `<introduction>` CDATA using regex: `/kleurcode[^.]*?(groen|geel|oranje|rood)/i`. For multi-region entries, find all color mentions and use the highest.

### 3. Japan (MOFA) -- PARTIALLY VERIFIED
**Confidence:** MEDIUM

**Open data portal (ezairyu.mofa.go.jp):** Appears defunct. Country pages return 404. The page at `/html/opendata/index.html` exists but links to broken country pages.

**Alternative source (anzen.mofa.go.jp):** Active, has per-country danger info pages.
- **URL pattern:** `https://www.anzen.mofa.go.jp/info/pcinfectionspothazardinfo_{id}.html`
- **Country IDs:** Available in `/common/js/id-list.js` (ordered list of 3-digit IDs)
- **Country names:** Available in `/common/js/list.js` (ordered list of Japanese names, same order as IDs)
- **Auth:** None required
- **Format:** HTML (not XML/JSON)
- **Advisory levels:** 4 levels in text:
  - Level 1: "十分に注意してください" (Exercise sufficient caution)
  - Level 2: "不要不急の渡航は止めてください" (Avoid non-essential travel)
  - Level 3: "渡航は止めてください（渡航中止勧告）" (Do not travel - advisory)
  - Level 4: "退避してください（退避勧告）" (Evacuate - advisory)

**Parsing approach:**
1. Fetch id-list.js and list.js to build country ID -> name mapping
2. Map Japanese country names to ISO3 via `getCountryByName()` (will need Japanese name aliases)
3. For each country, fetch the hazard info page
4. Parse the "danger level" section: look for `kiken_levels` div, extract text like "レベル4" or "レベル１"
5. For countries with mixed regional levels, take the highest

**Key challenge:** Country names are in Japanese. Need to build a mapping from Japanese names to ISO3 codes. Options:
- Add Japanese country names to the existing `nameMap` in countries.ts
- Build a separate JP-name-to-ISO3 mapping table
- Use the ISO2/ISO3 from the id-list cross-referenced with known data

**Recommended approach:** Build a static mapping of MOFA country IDs to ISO3 codes. The id-list.js contains ~200 IDs. Cross-reference with the Japanese name list and our existing country data. This is a one-time mapping effort.

**Normalization:** Already 1-4 scale, maps directly.

### 4. Slovakia (MZV) -- VERIFIED BUT PROBLEMATIC
**Confidence:** LOW (data quality issue)

**CKAN API:** `GET https://opendata.mzv.sk/api/3/action/datastore_search?resource_id=d2b4a3bf-2606-4b28-a51a-277b0708c076&limit=200`
**CSV download:** `https://opendata.mzv.sk/dataset/.../download/recommendation.csv`

- **Auth:** None required
- **Format:** JSON (via CKAN API) or CSV
- **Rate limiting:** Not documented
- **Response structure (CKAN JSON):**
  ```json
  {
    "result": {
      "records": [{
        "Oficialny anglicky nazov": "Republic of Nicaragua",
        "Stupen rizika CO": "2. stupen - zvazit nevyhnutnost cestovania (...)",
        "Datum zmeny": "26.03.2024 15:03:38",
        "Kategoria (CO/ICV)": "Cestovne odporucanie, ...",
        "Text CO/ICV": "<p>...</p>"
      }],
      "total": 138
    }
  }
  ```
- **Country identification:** English name in `Oficialny anglicky nazov` field
- **Advisory levels:** `Stupen rizika CO` field with text values

**CRITICAL ISSUE:** Of 138 records, only 1 has a risk level populated ("2. stupen - zvazit nevyhnutnost cestovania"). The remaining 137 records have empty risk levels. The dataset appears to be a notifications/warnings feed rather than a comprehensive per-country risk assessment.

**Risk level system (from the 1 populated record):**
- "1. stupen" = Level 1 (exercise caution)
- "2. stupen - zvazit nevyhnutnost cestovania" = Level 2 (consider necessity of travel)
- Higher levels likely exist but are not present in current data

**Recommendation:** Implement the fetcher but treat empty risk levels as "no advisory" (level 1). Log a warning about sparse data. The fetcher infrastructure is still valuable for when Slovakia populates more data.

## Normalization Module Design

### Module: `src/pipeline/normalize/advisory-levels.ts`

```typescript
/** Unified advisory level (1-4 scale used throughout scoring) */
export type UnifiedLevel = 1 | 2 | 3 | 4;

/** Map Germany boolean flags to unified level */
export function normalizeDeLevel(flags: {
  warning: boolean;
  partialWarning: boolean;
  situationWarning: boolean;
  situationPartWarning: boolean;
}): UnifiedLevel {
  if (flags.warning) return 4;
  if (flags.partialWarning) return 3;
  if (flags.situationWarning || flags.situationPartWarning) return 2;
  return 1;
}

/** Map Netherlands color code to unified level */
export function normalizeNlColor(color: string): UnifiedLevel {
  const lower = color.toLowerCase();
  if (lower === 'rood' || lower === 'red') return 4;
  if (lower === 'oranje' || lower === 'orange') return 3;
  if (lower === 'geel' || lower === 'yellow') return 2;
  return 1; // groen/green or unknown
}

/** Map Japan level (already 1-4) */
export function normalizeJpLevel(level: number): UnifiedLevel {
  return Math.min(4, Math.max(1, level)) as UnifiedLevel;
}

/** Map Slovakia risk degree text to unified level */
export function normalizeSkLevel(text: string): UnifiedLevel {
  if (!text || text.trim() === '') return 1; // No advisory
  const match = text.match(/(\d)\.\s*stupen/i);
  if (match) return Math.min(4, Math.max(1, parseInt(match[1]))) as UnifiedLevel;
  return 1;
}

/** Generic: map any N-level system to 1-4 */
export function normalizeToUnified(
  value: number,
  sourceMin: number,
  sourceMax: number,
): UnifiedLevel {
  const normalized = (value - sourceMin) / (sourceMax - sourceMin);
  const level = Math.round(normalized * 3) + 1;
  return Math.min(4, Math.max(1, level)) as UnifiedLevel;
}
```

This module should also support future systems (Tier 2/3):
- 3-level systems (map 1->1, 2->2, 3->4)
- 5-level systems (map 1->1, 2->1, 3->2, 4->3, 5->4)
- 6-level systems (map 1->1, 2->1, 3->2, 4->2, 5->3, 6->4)

## Common Pitfalls

### Pitfall 1: Netherlands API Returns XML, Not JSON
**What goes wrong:** The URL path suggests JSON but response is XML.
**Why it happens:** The API name says "JSON API" but the v2 endpoint returns XML.
**How to avoid:** Parse as XML/text, use regex to extract color codes.
**Warning signs:** JSON.parse() failures.

### Pitfall 2: Japan MOFA Country ID Mapping
**What goes wrong:** Cannot map Japanese country names to ISO3 codes.
**Why it happens:** The `list.js` file contains Japanese names that don't match English names in our country database.
**How to avoid:** Build a static mapping table of MOFA ID -> ISO3. Cross-reference programmatically where possible, manually verify the rest.
**Warning signs:** Low country match rate (<80%).

### Pitfall 3: Slovakia Sparse Data
**What goes wrong:** Fetcher "succeeds" but produces almost no useful indicators.
**Why it happens:** Only 1/138 records has a risk level.
**How to avoid:** Log the number of countries with actual risk data vs total records. Don't count empty-level records as "countries found."
**Warning signs:** countriesFound = 0 or 1 in FetchResult.

### Pitfall 4: Netherlands Regional Color Variations
**What goes wrong:** A country like Pakistan has rood/oranje/geel for different regions. Simple color extraction picks the wrong one.
**Why it happens:** The introduction text mentions multiple colors for different areas.
**How to avoid:** Find ALL color mentions in the introduction, use the highest (worst) level for the overall country assessment.
**Warning signs:** Countries with known high risk showing as "green."

### Pitfall 5: Germany Country Names in German
**What goes wrong:** `getCountryByName("Komoren")` returns undefined.
**Why it happens:** Germany API returns country names in German ("Komoren" vs "Comoros").
**How to avoid:** Use the `iso3CountryCode` field directly with `getCountryByIso3()`. The Germany API conveniently provides ISO3 codes.
**Warning signs:** Low country match rate.

### Pitfall 6: Types Need Extending
**What goes wrong:** TypeScript errors when adding `de`, `nl`, `jp`, `sk` to advisory info.
**Why it happens:** `AdvisoryInfoMap` and `ScoredCountry.advisories` have hardcoded `us? | uk? | ca? | au?` keys.
**How to avoid:** Update the types in `types.ts` to include new source keys. Consider making it `Record<string, AdvisoryInfo>` instead of explicit optional keys.
**Warning signs:** TypeScript compilation errors.

## Code Examples

### Germany API Fetch
```typescript
// Source: Verified live at https://www.auswaertiges-amt.de/opendata/travelwarning
const response = await fetch('https://www.auswaertiges-amt.de/opendata/travelwarning', {
  signal: AbortSignal.timeout(30_000),
  headers: { 'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)' },
});
const data = await response.json();
const r = data.response;
const contentList: number[] = r.contentList;

for (const id of contentList) {
  const entry = r[String(id)];
  const iso3 = entry.iso3CountryCode; // e.g., "COM"
  const country = getCountryByIso3(iso3);
  if (!country) continue;

  const level = normalizeDeLevel({
    warning: entry.warning,
    partialWarning: entry.partialWarning,
    situationWarning: entry.situationWarning,
    situationPartWarning: entry.situationPartWarning,
  });

  indicators.push({
    countryIso3: country.iso3,
    indicatorName: 'advisory_level_de',
    value: level,
    year: currentYear,
    source: 'advisories_de',
  });
}
```

### Netherlands Per-Country Fetch
```typescript
// Source: Verified live at opendata.nederlandwereldwijd.nl
// Iterate all countries from our list
for (const country of COUNTRIES) {
  const url = `https://opendata.nederlandwereldwijd.nl/v2/sources/nederlandwereldwijd/infotypes/countries/${country.iso3.toLowerCase()}/traveladvice`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!r.ok) continue;
    const xml = await r.text();
    // Extract color from introduction CDATA
    const colorMatch = xml.match(/kleurcode[^.]*?(rood|oranje|geel|groen)/i);
    const level = colorMatch ? normalizeNlColor(colorMatch[1]) : 1;
    // ...
  } catch { /* skip */ }
}
```

### Japan MOFA Scraping
```typescript
// Source: Verified at https://www.anzen.mofa.go.jp
// Step 1: Fetch ID list and country name list
const idListJs = await fetch('https://www.anzen.mofa.go.jp/common/js/id-list.js').then(r => r.text());
const ids = idListJs.match(/["'](\d{3})["']/g)?.map(s => s.replace(/["']/g, ''));

// Step 2: For each country ID, fetch danger page
const url = `https://www.anzen.mofa.go.jp/info/pcinfectionspothazardinfo_${id}.html`;
const html = await fetch(url).then(r => r.text());

// Step 3: Extract danger level
const levelMatch = html.match(/kiken_levels[\s\S]*?レベル\s*([１-４1-4])/);
// Convert fullwidth digits: １->1, ２->2, ３->3, ４->4
```

### Slovakia CKAN API Fetch
```typescript
// Source: Verified at https://opendata.mzv.sk
const url = 'https://opendata.mzv.sk/api/3/action/datastore_search?resource_id=d2b4a3bf-2606-4b28-a51a-277b0708c076&limit=500';
const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
const data = await response.json();
const records = data.result.records;

for (const record of records) {
  const englishName = record['Oficialny anglicky nazov'];
  const riskText = record['Stupen rizika CO'] || '';
  const country = getCountryByName(englishName);
  if (!country) continue;

  const level = normalizeSkLevel(riskText);
  // Only produce an indicator if there's actual risk data
  if (riskText.trim()) {
    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_sk',
      value: level,
      year: currentYear,
      source: 'advisories_sk',
    });
  }
}
```

## Integration Points

### Files to Modify

1. **`src/pipeline/types.ts`** -- Extend `AdvisoryInfoMap` and `ScoredCountry.advisories` with `de?`, `nl?`, `jp?`, `sk?` keys
2. **`src/pipeline/fetchers/index.ts`** -- Import and call `fetchTier1Advisories()` in `fetchAllSources()`
3. **`src/pipeline/config/sources.json`** -- Add entries for the 4 new advisory sources
4. **`src/pipeline/config/source-tiers.json`** -- Add signal tier entries for `advisories_de`, `advisories_nl`, `advisories_jp`, `advisories_sk`
5. **`src/pipeline/scoring/normalize.ts`** -- Add normalization ranges for new `advisory_level_de/nl/jp/sk` indicators

### Files to Create

1. **`src/pipeline/fetchers/advisories-tier1.ts`** -- 4 sub-fetchers + orchestrator
2. **`src/pipeline/normalize/advisory-levels.ts`** -- Shared normalization module

### Files NOT to Modify (out of scope for Phase 29)

- `src/pipeline/config/weights.json` -- Weight updates are Phase 34 (NORM-02)
- `src/pipeline/scoring/engine.ts` -- No changes needed; it already reads from weights.json dynamically

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Japan MOFA open data at ezairyu.mofa.go.jp | Site appears defunct; use anzen.mofa.go.jp scraping | Unknown (site returns 404 for country pages) | Must scrape HTML instead of fetching structured XML |
| Netherlands API returns JSON | API returns XML despite documentation suggestions | Current | Must parse XML, not JSON |

## Open Questions

1. **Japan MOFA Country ID Mapping**
   - What we know: id-list.js has ~200 IDs, list.js has Japanese names in same order
   - What's unclear: Whether ezairyu.mofa.go.jp open data will come back online; exact mapping of all IDs to ISO3
   - Recommendation: Build static mapping table. If ezairyu comes back, switch to structured data later. For now, scrape anzen.mofa.go.jp.

2. **Slovakia Data Quality**
   - What we know: 137/138 records have empty risk levels
   - What's unclear: Whether this is a temporary data issue or the dataset design (notifications-only, not per-country ratings)
   - Recommendation: Implement the fetcher, skip records with empty levels, log a warning. The infrastructure is ready for when data improves.

3. **Netherlands Pagination**
   - What we know: Listing endpoint returns max 25 items, pagination params appear non-functional
   - What's unclear: Whether there's an undocumented pagination mechanism
   - Recommendation: Use per-country endpoints instead of listing. Iterate through COUNTRIES list, fetch each one.

## Sources

### Primary (HIGH confidence)
- Germany API: Live response from `https://www.auswaertiges-amt.de/opendata/travelwarning` -- structure verified
- Germany OpenAPI spec: `https://travelwarning.api.bund.dev/openapi.yaml` -- 6 endpoints documented
- Netherlands API: Live responses from `https://opendata.nederlandwereldwijd.nl/v2/sources/nederlandwereldwijd/infotypes/traveladvice` and per-country endpoints
- Slovakia CKAN API: Live response from `https://opendata.mzv.sk/api/3/action/datastore_search` -- field structure and data verified
- Existing codebase: `src/pipeline/fetchers/advisories.ts`, `src/pipeline/types.ts`, `src/pipeline/scoring/normalize.ts`

### Secondary (MEDIUM confidence)
- Japan MOFA danger levels: `https://www.anzen.mofa.go.jp/info/pcinfectionspothazardinfo_041.html` -- page structure verified
- Japan MOFA JS files: `/common/js/id-list.js` and `/common/js/list.js` -- country ID mapping source

### Tertiary (LOW confidence)
- Japan MOFA open data portal status at ezairyu.mofa.go.jp -- may be temporarily down vs permanently defunct
- Slovakia risk level completeness -- may improve over time

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies needed, follows existing patterns
- Architecture: HIGH -- clear pattern from existing advisories.ts
- Germany API: HIGH -- verified live with full response structure
- Netherlands API: HIGH -- verified live, per-country endpoint confirmed
- Japan MOFA: MEDIUM -- scraping approach verified but open data portal status uncertain
- Slovakia: LOW -- API works but data is nearly empty
- Pitfalls: HIGH -- identified from live API testing

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (APIs are government-run, change slowly)
