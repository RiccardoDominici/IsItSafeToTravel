---
phase: quick-260323-mcr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pipeline/types.ts
  - src/pipeline/fetchers/advisories.ts
  - src/pipeline/scoring/normalize.ts
  - src/pipeline/scoring/engine.ts
  - src/pipeline/config/weights.json
  - src/pipeline/config/source-tiers.json
  - src/components/country/AdvisorySection.astro
  - src/components/country/AdvisoryCard.astro
  - src/i18n/ui.ts
autonomous: true
requirements: [GOV-ADV-CA-AU, ADV-INFO-POPULATE, ADV-FRONTEND]

must_haves:
  truths:
    - "scores.json advisories object contains us, uk, ca, au entries with level/text/url/updatedAt for countries that have data"
    - "Canada and Australia advisory levels (1-4) are included in crime pillar scoring"
    - "Country page shows 4 advisory cards (US, UK, CA, AU) when all data is available"
  artifacts:
    - path: "src/pipeline/fetchers/advisories.ts"
      provides: "CA + AU fetchers, AdvisoryInfo extraction for all 4 sources"
      contains: "fetchCaAdvisories"
    - path: "src/pipeline/types.ts"
      provides: "Extended advisories type with ca/au"
      contains: "ca?: AdvisoryInfo"
    - path: "src/pipeline/scoring/engine.ts"
      provides: "Advisory info population from raw indicators"
      contains: "advisory_level_ca"
    - path: "src/components/country/AdvisorySection.astro"
      provides: "Renders all 4 advisory cards"
      contains: "advisories.ca"
  key_links:
    - from: "src/pipeline/fetchers/advisories.ts"
      to: "advisories-parsed.json"
      via: "RawIndicator[] with advisory_level_ca and advisory_level_au"
      pattern: "advisory_level_ca|advisory_level_au"
    - from: "src/pipeline/scoring/engine.ts"
      to: "ScoredCountry.advisories"
      via: "extractAdvisoryInfo builds AdvisoryInfo from raw indicators"
      pattern: "advisories.*ca.*uk.*us.*au"
---

<objective>
Add Canada and Australia government travel advisory sources, populate AdvisoryInfo for all 4 sources (US, UK, CA, AU) in the scoring pipeline, and update the frontend to display all 4 advisory cards.

Purpose: Currently advisories only exist as numeric indicators (1-4 levels) in the scoring pipeline. The AdvisoryInfo objects (with text, url, level, updatedAt) are never populated — `computeAllScores` passes `{}` as advisories. This plan fixes that gap AND adds two new government sources.

Output: Working pipeline that fetches 4 advisory sources, populates structured AdvisoryInfo objects in scores.json, and renders them on country pages.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/pipeline/types.ts
@src/pipeline/fetchers/advisories.ts
@src/pipeline/scoring/engine.ts
@src/pipeline/scoring/normalize.ts
@src/pipeline/config/weights.json
@src/pipeline/config/source-tiers.json
@src/components/country/AdvisorySection.astro
@src/components/country/AdvisoryCard.astro
@src/i18n/ui.ts
@src/pipeline/run.ts
@src/pipeline/fetchers/index.ts

<interfaces>
<!-- Key types the executor needs -->

From src/pipeline/types.ts:
```typescript
export interface AdvisoryInfo {
  level: number | string;
  text: string;
  source: string;
  url: string;
  updatedAt: string;
}

export interface ScoredCountry {
  // ...
  advisories: {
    us?: AdvisoryInfo;
    uk?: AdvisoryInfo;
  };
  // ...
}

export interface RawIndicator {
  countryIso3: string;
  indicatorName: string;
  value: number;
  year: number;
  source: string;
  fetchedAt?: string;
  dataDate?: string;
}
```

From src/pipeline/scoring/engine.ts (line 36):
```typescript
export function computeCountryScore(
  iso3: string,
  allIndicators: RawIndicator[],
  weightsConfig: WeightsConfig,
  countryEntry: CountryEntry,
  advisories: { us?: AdvisoryInfo; uk?: AdvisoryInfo },
  sources: SourceMeta[],
  sourcesConfig?: SourcesConfig,
): ScoredCountry
```

From src/pipeline/scoring/engine.ts (line 327):
```typescript
// Currently passes empty {} — this is what we need to fix
const scored = computeCountryScore(iso3, allIndicators, weightsConfig, entry, {}, sources, sourcesConfig);
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add CA/AU fetchers, produce AdvisoryInfo alongside indicators, wire through pipeline</name>
  <files>
    src/pipeline/types.ts
    src/pipeline/fetchers/advisories.ts
    src/pipeline/scoring/normalize.ts
    src/pipeline/scoring/engine.ts
    src/pipeline/config/weights.json
    src/pipeline/config/source-tiers.json
  </files>
  <action>
    **1. Update types (src/pipeline/types.ts):**
    - Extend `ScoredCountry.advisories` to: `{ us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo }`

    **2. Update fetcher (src/pipeline/fetchers/advisories.ts):**

    The fetcher currently returns only `RawIndicator[]` (numeric levels). It needs to ALSO produce structured `AdvisoryInfo` objects. Strategy: store advisory info as a side-channel JSON file alongside the parsed indicators.

    - Create a new type `AdvisoryData` at the top: `{ indicators: RawIndicator[]; advisoryInfo: Record<string, { us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo }> }` where keys are iso3 codes.
    - Modify `fetchUsAdvisories` to ALSO return AdvisoryInfo per country: capture the date from the regex match (DD/MM/YYYY), map the level to text ("Exercise Normal Precautions", "Exercise Increased Caution", "Reconsider Travel", "Do Not Travel"), set url to `https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html`, set source to "US State Department".
    - Modify `fetchUkAdvisories` to ALSO return AdvisoryInfo per country: use the child's `description` as text, set url to `https://www.gov.uk/foreign-travel-advice/{slug}` (slug from `childObj.base_path`), set source to "UK FCDO", set level to the description text (e.g., "Advise against all but essential travel"), updatedAt from `childObj.public_updated_at` or fetchedAt.
    - Add `fetchCaAdvisories(rawDir, fetchedAt, currentYear)`:
      - Fetch `https://travel.gc.ca/destinations` — this is an HTML page listing countries with advisory levels
      - Parse HTML: look for country links with advisory level text. Canada uses: "Exercise normal security precautions" (1), "Exercise a high degree of caution" (2), "Avoid non-essential travel" (3), "Avoid all travel" (4)
      - For each country found via `getCountryByName`, produce a RawIndicator with `indicatorName: 'advisory_level_ca'`, `source: 'advisories_ca'`
      - Also produce AdvisoryInfo: level=numeric, text=the advisory text, source="Government of Canada", url=`https://travel.gc.ca/destinations/{country-slug}`
      - If the HTML page is hard to parse reliably, use a simpler approach: fetch the sitemap or known country URLs. A pragmatic fallback: if parsing fails, log warning and return empty (don't crash pipeline).
    - Add `fetchAuAdvisories(rawDir, fetchedAt, currentYear)`:
      - Try Smartraveller API first: `https://www.smartraveller.gov.au/api/smartraveller/destinations` (JSON endpoint)
      - If that fails or doesn't exist, try scraping `https://www.smartraveller.gov.au/destinations`
      - Australia uses: "Exercise normal safety precautions" (1), "Exercise a high degree of caution" (2), "Reconsider your need to travel" (3), "Do not travel" (4)
      - Produce RawIndicator with `indicatorName: 'advisory_level_au'`, `source: 'advisories_au'`
      - Also produce AdvisoryInfo: level=numeric, text=advisory text, source="Australian Government", url=`https://www.smartraveller.gov.au/destinations/{country}`
      - Same pragmatic fallback: if parsing fails, log and return empty.
    - Update `fetchAdvisories` main function:
      - Call all 4 fetchers (US, UK, CA, AU) in the same try/catch pattern
      - After collecting all indicators, also save the combined advisoryInfo map to `advisories-info.json` in rawDir: `writeJson(join(rawDir, 'advisories-info.json'), combinedAdvisoryInfoMap)`
      - The advisoryInfo map is keyed by iso3, with `{ us?, uk?, ca?, au? }` per country

    **3. Update normalize.ts:**
    - Add to INDICATOR_RANGES:
      ```
      advisory_level_ca: { min: 1, max: 4, inverse: true },
      advisory_level_au: { min: 1, max: 4, inverse: true },
      ```

    **4. Update weights.json:**
    - Add `advisory_level_ca` and `advisory_level_au` to the crime pillar indicators array
    - The crime pillar currently has no indicatorWeights (uses equal averaging), so just adding to the indicators array is sufficient. Do NOT add indicatorWeights to crime pillar — keep equal averaging for simplicity.
    - Bump version to "5.4.0"

    **5. Update source-tiers.json:**
    - The existing `"advisories"` source entry covers all advisory fetchers since they all write to `advisories-parsed.json` with source names like `advisories_us`, `advisories_uk`, `advisories_ca`, `advisories_au`
    - Add entries for `advisories_ca` and `advisories_au` with same tier config as existing advisories: `{ "tier": "signal", "maxAgeDays": 30, "decayHalfLifeDays": 7 }`
    - Also add `advisories_us` and `advisories_uk` entries if they don't exist (the current config only has `"advisories"` as a single key — but the RawIndicator.source field uses `advisories_us` and `advisories_uk`)

    **6. Update engine.ts (src/pipeline/scoring/engine.ts):**
    - In `computeAllScores` (around line 320-327): Instead of passing `{}` as advisories, load the `advisories-info.json` file from rawDir and look up each country's advisory info.
    - Add a helper at module level: `function loadAdvisoryInfo(rawDataBySource: Map<string, RawSourceData>): Record<string, { us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo }>` that reads `advisories-info.json` from the raw directory (derive the path from the advisories source data fetchedAt or from a fixed location).
    - Alternative simpler approach: Since `computeAllScores` already has access to `allIndicators`, build advisory info directly from the indicators. For each country, find its `advisory_level_us/uk/ca/au` indicators and construct AdvisoryInfo objects with: level=indicator value, text=level description string, source=source name, url=source URL, updatedAt=fetchedAt. This avoids the side-channel file entirely.
    - **Preferred approach: Use the side-channel file** (`advisories-info.json`) because it carries richer data (actual advisory text, per-country URLs) that can't be reconstructed from just the numeric level.
    - Update `computeCountryScore` signature to accept the extended advisories type: `advisories: { us?: AdvisoryInfo; uk?: AdvisoryInfo; ca?: AdvisoryInfo; au?: AdvisoryInfo }`
    - In the `computeAllScores` loop, look up the iso3 in the loaded advisory info map and pass it to `computeCountryScore`
    - Update SOURCE_CATALOG `advisories` entry description to: `'Travel advisories from US State Department, UK FCDO, Government of Canada, and Australian Government'`
  </action>
  <verify>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - TypeScript compiles without errors
    - types.ts has ca/au in ScoredCountry.advisories
    - advisories.ts has fetchCaAdvisories and fetchAuAdvisories functions
    - normalize.ts has advisory_level_ca and advisory_level_au ranges
    - weights.json crime pillar includes all 4 advisory indicators
    - engine.ts loads advisory info and passes it to computeCountryScore instead of {}
  </done>
</task>

<task type="auto">
  <name>Task 2: Update frontend components and i18n for 4 advisory sources</name>
  <files>
    src/components/country/AdvisorySection.astro
    src/components/country/AdvisoryCard.astro
    src/i18n/ui.ts
  </files>
  <action>
    **1. Update AdvisoryCard.astro:**
    - The current `getAdvisoryColor` function only handles 'us' and 'uk' source types. Since CA and AU both use the same 1-4 numeric scale as US, update the logic:
      - Change the `sourceType` detection to handle all 4 sources. Instead of the current string-includes check, accept a `sourceKey` prop directly: `sourceKey: 'us' | 'uk' | 'ca' | 'au'`
      - Update `getAdvisoryColor`: for 'us', 'ca', 'au' — all use numeric 1-4 with same colors (green/yellow/orange/red). For 'uk' — keep text-based level matching.
      - Remove the fragile `sourceName.includes('us')` detection; use the explicit `sourceKey` prop instead.

    **2. Update AdvisorySection.astro:**
    - Add checks for `advisories.ca` and `advisories.au`
    - Update `hasAny` to: `hasUs || hasUk || hasCa || hasAu`
    - Add AdvisoryCard instances for CA and AU in the grid
    - Pass `sourceKey` prop to each AdvisoryCard: `sourceKey="us"`, `sourceKey="uk"`, `sourceKey="ca"`, `sourceKey="au"`
    - The grid should use `md:grid-cols-2` which already works well for 4 cards (2x2 on desktop)

    **3. Update i18n (src/i18n/ui.ts):**
    - Add keys in all 5 languages (en, it, es, fr, pt):
      - `'country.advisory.ca'`: EN="Government of Canada", IT="Governo del Canada", ES="Gobierno de Canada", FR="Gouvernement du Canada", PT="Governo do Canada"
      - `'country.advisory.au'`: EN="Australian Government", IT="Governo Australiano", ES="Gobierno de Australia", FR="Gouvernement Australien", PT="Governo da Australia"
    - Insert each new key right after the existing `country.advisory.uk` line in each language block
  </action>
  <verify>
    <automated>cd /Users/riccardo/Developer/VibeCoding/Isitsafetotravel && npx astro check 2>&1 | tail -20</automated>
  </verify>
  <done>
    - AdvisorySection.astro renders cards for us, uk, ca, au when data exists
    - AdvisoryCard.astro accepts sourceKey prop and colors CA/AU cards same as US (numeric 1-4)
    - All 5 languages have country.advisory.ca and country.advisory.au keys
    - `astro check` passes or shows only pre-existing warnings
  </done>
</task>

</tasks>

<verification>
1. TypeScript compiles: `npx tsc --noEmit`
2. Astro builds: `npx astro build` (full site build)
3. Spot-check scores.json after a pipeline run would show advisory info, but a full pipeline run is not required for this plan (it hits live APIs)
</verification>

<success_criteria>
- Pipeline types extended with ca/au advisory sources
- Fetcher has CA and AU advisory functions (even if real API parsing needs tuning after first live run)
- Advisory info is populated from fetcher output through to scores.json (no more empty {} advisories)
- Frontend displays up to 4 advisory cards per country
- i18n complete for all 5 languages
- Project builds without errors
</success_criteria>

<output>
After completion, create `.planning/quick/260323-mcr-add-government-advisories-section-with-c/260323-mcr-SUMMARY.md`
</output>
