# Phase 33: Tier 3 Complex Sources Batch 2 - Research

**Researched:** 2026-03-27
**Domain:** European government advisory fetchers (7 countries)
**Confidence:** HIGH

## Summary

Phase 33 adds 7 more European advisory fetchers (Switzerland, Sweden, Norway, Poland, Czech Republic, Hungary, Portugal), completing the full 30+ source expansion. The existing codebase has a well-established pattern from 5 prior tiers (base, tier1, tier2a, tier2b, tier3a) that this phase replicates exactly.

The implementation is structurally identical to Phase 32 (tier3a): create `advisories-tier3b.ts` with 7 sub-fetchers, add 7 normalization functions, extend the `AdvisoryInfoMap` and `ScoredCountry.advisories` types with new country keys, register in the pipeline index and engine. All 7 sources are European government websites using text-based advisory systems in their respective languages.

**Primary recommendation:** Follow the tier3a pattern exactly -- create advisories-tier3b.ts with per-source sub-fetchers, each with graceful failure handling and text-based normalization. Two plans: (1) types/normalization/config, (2) fetcher/pipeline/engine.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices are at Claude's discretion.

### Claude's Discretion
- Create advisories-tier3b.ts following tier3a pattern
- Extend types/normalization/engine for 7 new sources
- Use cheerio for HTML parsing
- Text pattern matching in 7 different languages
- All sources will produce sparse results -- acceptable
- Total source count should reach 33+ after this phase

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CPLX-07 | Pipeline fetches Switzerland advisory data from EDA daily | Sub-fetcher for eda.admin.ch with German/French text normalization |
| CPLX-08 | Pipeline fetches Sweden advisory data from regeringen.se daily | Sub-fetcher for regeringen.se with Swedish text normalization |
| CPLX-09 | Pipeline fetches Norway advisory data from regjeringen.no daily | Sub-fetcher for regjeringen.no with Norwegian text normalization |
| CPLX-10 | Pipeline fetches Poland advisory data from MSZ daily | Sub-fetcher for gov.pl/msz with Polish text normalization |
| CPLX-11 | Pipeline fetches Czech Republic advisory data from MZV daily | Sub-fetcher for mzv.cz with Czech text normalization |
| CPLX-12 | Pipeline fetches Hungary advisory data from KKM daily | Sub-fetcher for konzuliszolgalat.kormany.hu with Hungarian text normalization |
| CPLX-13 | Pipeline fetches Portugal advisory data from MNE daily | Sub-fetcher for portaldascomunidades.mne.gov.pt with Portuguese text normalization |
</phase_requirements>

## Architecture Patterns

### Established Pattern: Tier Fetcher Module

The codebase uses a consistent pattern across all 5 existing advisory tiers. Phase 33 MUST follow this exactly.

#### File Structure
```
src/pipeline/
  fetchers/
    advisories-tier3b.ts      # NEW: 7 sub-fetchers
    advisories.ts              # MODIFY: extend AdvisoryInfoMap type
    index.ts                   # MODIFY: import/export/register tier3b
  normalize/
    advisory-levels.ts         # MODIFY: add 7 normalize functions
  scoring/
    engine.ts                  # MODIFY: load tier3b advisory info
  config/
    sources.json               # MODIFY: add advisories_tier3b entry
  types.ts                     # MODIFY: extend ScoredCountry.advisories
```

#### Sub-Fetcher Pattern (from tier3a.ts)
Each source gets a private async function:
```typescript
async function fetchChAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(URL, {
      signal: AbortSignal.timeout(30_000),
      headers: FETCH_HEADERS,
    });
    if (!response.ok) return { indicators, advisoryInfo };

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse country links/entries
    // For each country found:
    //   1. Match country via getCountryByName()
    //   2. Normalize level via normalizeXxLevel(text)
    //   3. Push to indicators array
    //   4. Set advisoryInfo[iso3].xx = { level, text, source, url, updatedAt }
  } catch {
    // Fail silently for individual source
  }

  return { indicators, advisoryInfo };
}
```

#### Main Export Pattern
```typescript
export async function fetchTier3bAdvisories(date: string): Promise<FetchResult> {
  // Orchestrates all 7 sub-fetchers with try/catch per source
  // Falls back to cached data if ALL fail
  // Writes advisories-tier3b-parsed.json and advisories-tier3b-info.json
}
```

#### Type Extension Points (4 files)
1. **advisories.ts** -- Add `ch?, se?, no?, pl?, cz?, hu?, pt?` to `AdvisoryInfoMap`
2. **types.ts** -- Add same keys to `ScoredCountry.advisories`
3. **engine.ts** -- Add `tier3bSource` variable, include in `anyAdvisorySource`, add tier3b info loading block
4. **engine.ts** -- Add `tier3b` keys to the local `AdvisoryInfoMap` type alias (line ~431)

#### Normalization Function Pattern
```typescript
export function normalizeChLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('keyword_level_4')) return 4;
  if (lower.includes('keyword_level_3')) return 3;
  if (lower.includes('keyword_level_2')) return 2;
  return 1; // default: normal precautions
}
```

### Integration Constants

| Key | Format | Example |
|-----|--------|---------|
| Advisory info key | 2-letter country code | `ch`, `se`, `no`, `pl`, `cz`, `hu`, `pt` |
| Indicator name | `advisory_level_{cc}` | `advisory_level_ch` |
| Source name | `advisories_{cc}` | `advisories_ch` |
| Level text map | `Record<number, string>` | Native language descriptions per level |
| File outputs | `advisories-tier3b-parsed.json`, `advisories-tier3b-info.json` | In `data/raw/{date}/` |

### Source URLs and Language Details

| Country | MFA | URL Pattern | Language | Key Advisory Phrases |
|---------|-----|-------------|----------|---------------------|
| Switzerland | EDA | eda.admin.ch/eda/en/fdfa/representations-and-travel-advice.html | German/English | "Von Reisen wird abgeraten" (advise against), English version available |
| Sweden | UD | regeringen.se/uds-reseinformation/ | Swedish | "UD avraader" (advises against), "avraader alla resor" (advises against all travel) |
| Norway | UD | regjeringen.no/no/tema/reiseinformasjon/ | Norwegian | "fraraader reiser" (advises against travel), "fraraader alle reiser" (advises against all travel) |
| Poland | MSZ | gov.pl/web/dyplomacja/informacje-dla-podrozujacych | Polish | "nie planuj podrozy" (don't plan travel), "zachowaj szczegolna ostroznosc" (exercise special caution) |
| Czech Republic | MZV | mzv.cz/jnp/cz/cestujeme/ | Czech | "nedoporucujeme cestovat" (do not recommend travel), "zvysena opatrnost" (increased caution) |
| Hungary | KKM | konzuliszolgalat.kormany.hu | Hungarian | "Ne utazzon!" (Do not travel!), "Fokozott ovatossag" (Increased caution) |
| Portugal | MNE | portaldascomunidades.mne.gov.pt | Portuguese | "Desaconselhada" (advised against), "Condicionada" (conditional) |

### Normalization Text Patterns (7 languages)

**Switzerland (German/English):**
- Level 4: "Von Reisen wird abgeraten" / "Do not travel" / "Grundsaetzlich abgeraten"
- Level 3: "Von nicht dringenden Reisen wird abgeraten" / "Avoid non-essential travel"
- Level 2: "Erhoehte Vorsicht" / "Exercise increased caution"
- Level 1: default

**Sweden (Swedish):**
- Level 4: "avraader alla resor" / "alla resor avraads"
- Level 3: "avraader resor" / "UD avraader"
- Level 2: "iaktta stor forsiktighet" / "skaerpt uppmaning"
- Level 1: default

**Norway (Norwegian):**
- Level 4: "fraraader alle reiser" / "ikke reis"
- Level 3: "fraraader reiser" / "fraraader ikke-noedvendige reiser"
- Level 2: "utvise forsiktighet" / "oekt aktsomhet"
- Level 1: default

**Poland (Polish):**
- Level 4: "nie planuj podrozy" / "zakaz wjazdu"
- Level 3: "odradza sie podrozowanie" / "odradza podroze"
- Level 2: "zachowaj szczegolna ostroznosc" / "zachowaj ostroznosc"
- Level 1: default

**Czech Republic (Czech):**
- Level 4: "nedoporucujeme cestovat" / "necestujte"
- Level 3: "zvazit nezbytnost cesty" / "doporucujeme se vyhnout"
- Level 2: "zvysena opatrnost" / "dbejte zvysene opatrnosti"
- Level 1: default

**Hungary (Hungarian):**
- Level 4: "Ne utazzon" / "utazas nem javasolt"
- Level 3: "fokozott elore-latas" / "kiemelt figyelemmel"
- Level 2: "fokozott ovatossag" / "utazas elott tajekodjon"
- Level 1: default

**Portugal (Portuguese):**
- Level 4: "Desaconselhada" / "Nao viaje" / "Evite todas as viagens"
- Level 3: "Condicionada" / "Evite viagens nao essenciais"
- Level 2: "Recomenda precaucao" / "Cuidados especiais"
- Level 1: default

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML parsing | Custom regex parsing | cheerio | Already used across all tiers |
| Country name matching | Custom name->ISO3 maps | getCountryByName() from countries.ts | Existing shared utility handles 200+ name variants |
| Level normalization | Inline if/else chains | Dedicated normalize functions in advisory-levels.ts | Consistent with existing pattern, testable |
| Concurrent fetching | Custom Promise.all | fetchBatch() helper from tier3a | Already exists with worker queue pattern |
| Cached data fallback | Custom file reading | findLatestCached() + readJson() from fs utils | Standard pattern across all fetchers |

## Common Pitfalls

### Pitfall 1: Character Encoding in Scandinavian/Central European Languages
**What goes wrong:** Norwegian/Swedish/Czech/Hungarian/Polish text contains special characters (aa, oe, uu, sz, cz, etc.) that may not match when using .toLowerCase()
**Why it happens:** Source HTML may use different unicode representations
**How to avoid:** Match against ASCII-folded versions too (e.g., both "fraraader" and "frar\u00e5der" for Norwegian). Include variants with and without diacritics in the normalization functions.
**Warning signs:** All countries from a source return level 1

### Pitfall 2: JS-Rendered Pages Return Empty Content
**What goes wrong:** Some government sites are SPAs that return minimal HTML without JavaScript execution
**Why it happens:** Server returns a shell page; content is loaded via JS
**How to avoid:** Check for minimal HTML content (< 5000 chars with div#root or similar), log warning, gracefully return empty. This is the existing tier3a pattern for Italy.
**Warning signs:** Response is valid HTML but very small, or body text is < 100 chars

### Pitfall 3: Country Name Matching Failures
**What goes wrong:** getCountryByName() returns null for names in non-English languages
**Why it happens:** The shared countries.ts only has English name variants
**How to avoid:** Create local country name mapping tables in the fetcher file (like KOREAN_NAMES in tier3a) for the relevant language. Some sources may have English pages available.
**Warning signs:** Zero countries matched despite successful HTML fetch

### Pitfall 4: Source URL Changes
**What goes wrong:** Government website URLs change without notice
**Why it happens:** Government site redesigns, CMS migrations
**How to avoid:** Use the most stable URL path available. Include the 302 redirect handling (Switzerland EDA returns 302). Use generous timeout (30s).
**Warning signs:** HTTP 404 or 301 permanent redirect

### Pitfall 5: Duplicate Advisory Info Keys
**What goes wrong:** Using 'no' as advisory key for Norway conflicts with nothing currently but is a reserved word in some contexts
**Why it happens:** 2-letter country codes can overlap with language keywords
**How to avoid:** This is fine in TypeScript as object property -- just ensure it's consistently quoted if needed. The existing pattern uses unquoted keys.

## Code Examples

### Fetcher Registration in index.ts (pattern from tier3a)
```typescript
// Add import
import { fetchTier3bAdvisories } from './advisories-tier3b.js';

// Add export
export { fetchTier3bAdvisories } from './advisories-tier3b.js';

// Add to fetchAllSources Promise.allSettled array
fetchTier3bAdvisories(date),

// Add to sourceNames array
'advisories_tier3b'
```

### Engine Integration (pattern from tier3a block)
```typescript
// Add tier3b source variable (~line 443)
const tier3bSource = rawDataBySource.get('advisories_tier3b');

// Include in anyAdvisorySource
const anyAdvisorySource = advisoriesSource || tier1Source || tier2aSource || tier2bSource || tier3aSource || tier3bSource;

// Add tier3b info loading block (~after line 502)
const tier3bInfoPath = join(process.cwd(), 'data', 'raw', dataDate, 'advisories-tier3b-info.json');
const tier3bInfo = readJson<AdvisoryInfoMap>(tier3bInfoPath);
if (tier3bInfo) {
  for (const [iso3, info] of Object.entries(tier3bInfo)) {
    if (!advisoryInfoMap[iso3]) advisoryInfoMap[iso3] = {};
    Object.assign(advisoryInfoMap[iso3], info);
  }
  console.log(`  Merged tier-3b advisory info`);
}
```

### Type Extension (add to both advisories.ts and types.ts)
```typescript
// Tier 3b
ch?: AdvisoryInfo;
se?: AdvisoryInfo;
no?: AdvisoryInfo;
pl?: AdvisoryInfo;
cz?: AdvisoryInfo;
hu?: AdvisoryInfo;
pt?: AdvisoryInfo;
```

### Level Text Maps (per source)
```typescript
const CH_LEVEL_TEXT: Record<number, string> = {
  1: 'Grundsaetzliche Vorsicht (Normal Precautions)',
  2: 'Erhoehte Vorsicht (Increased Caution)',
  3: 'Von nicht dringenden Reisen abgeraten (Avoid Non-essential Travel)',
  4: 'Von Reisen abgeraten (Do Not Travel)',
};
```

## Source Count Arithmetic

| Tier | Sources | Count |
|------|---------|-------|
| Base (Five Eyes) | US, UK, CA, AU | 4 |
| Tier 1 (API) | DE, NL, JP, SK | 4 |
| Tier 2a (HTML) | FR, NZ, IE, FI, HK, BR, AT, PH | 8 |
| Tier 2b (HTML) | BE, DK, SG, RO, RS, EE, HR, AR | 8 |
| Tier 3a (Complex) | IT, ES, KR, TW, CN, IN | 6 |
| **Tier 3b (Complex)** | **CH, SE, NO, PL, CZ, HU, PT** | **7** |
| **Total after Phase 33** | | **37** |

The success criterion says "34+" which is met. The CONTEXT.md says "33+" which is also met.

## Open Questions

1. **Source accessibility at runtime**
   - What we know: Switzerland (302 redirect, reachable) and Sweden (200, reachable) respond quickly
   - What's unclear: Whether all 7 sources will be reachable in CI (GitHub Actions)
   - Recommendation: All sub-fetchers have independent try/catch; sparse results are acceptable per CONTEXT.md

2. **English page availability**
   - What we know: Switzerland EDA has English pages; most other sources are native-language only
   - What's unclear: Whether to fetch English or native language pages for each source
   - Recommendation: Prefer English pages where available (Switzerland, possibly Norway/Sweden). Use native language normalization for others. The normalization functions handle both.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `src/pipeline/fetchers/advisories-tier3a.ts` (970 lines, complete pattern reference)
- Existing codebase: `src/pipeline/normalize/advisory-levels.ts` (293 lines, all normalization functions)
- Existing codebase: `src/pipeline/fetchers/index.ts` (pipeline registration pattern)
- Existing codebase: `src/pipeline/scoring/engine.ts` (advisory info loading pattern)
- Existing codebase: `src/pipeline/fetchers/advisories.ts` (AdvisoryInfoMap type definition)
- Existing codebase: `src/pipeline/types.ts` (ScoredCountry.advisories type)

### Secondary (MEDIUM confidence)
- Switzerland EDA: HTTP 302 reachable (verified 2026-03-27)
- Sweden regeringen.se: HTTP 200 reachable (verified 2026-03-27)
- Advisory text patterns: Based on common European MFA advisory terminology (LOW-MEDIUM confidence, needs runtime validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Identical to tier3a, all libraries already in use
- Architecture: HIGH - Exact replication of established 5-tier pattern
- Pitfalls: MEDIUM - Language-specific text matching is inherently fragile
- Source URLs: MEDIUM - Only 2 of 7 verified; others assumed from standard government URL patterns

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable infrastructure pattern, unlikely to change)
