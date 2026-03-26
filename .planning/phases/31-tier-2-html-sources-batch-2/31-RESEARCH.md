# Phase 31: Tier 2 HTML Sources Batch 2 - Research

**Researched:** 2026-03-26
**Domain:** HTML scraping of 8 government travel advisory websites
**Confidence:** MEDIUM

## Summary

This phase adds 8 more government travel advisory fetchers (Tier 2b) following the exact pattern established in `advisories-tier2a.ts`. The research investigated the actual HTML structure of each source website to determine scraping feasibility, advisory level systems, and normalization strategies.

Key finding: These 8 sources are significantly more challenging than Tier 2a. Several sites (Belgium, Estonia, Denmark) require per-country page crawling since listing pages do not show advisory levels. Some sources (Argentina, Romania) use event-based alert systems rather than per-country advisory levels. Singapore categorizes advisories vs notices but does not use a numbered/colored level system. Serbia and Croatia have limited structured data. Denmark uses a color system (green/yellow/orange/red) but embeds it in per-country page text, not in CSS classes.

**Primary recommendation:** Create `advisories-tier2b.ts` following the tier2a pattern exactly. Expect lower country coverage than tier2a. Use text-pattern matching (not CSS-class-based) for most sources since advisory levels are embedded in prose rather than structured markup.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None explicitly locked -- all implementation choices at Claude's discretion.

### Claude's Discretion
- Create advisories-tier2b.ts following tier2a pattern
- Extend types/normalization/engine for 8 new sources
- Use cheerio (already installed in Phase 30)
- Handle 403s and page changes gracefully
- Total Tier 2 fetch time must stay under 10 minutes for CI

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HTML-09 | Pipeline fetches Belgium advisory levels from diplomatie.belgium.be daily | Belgium uses French-language per-country pages at `/fr/pays/{slug}` with text-based advisory descriptions. No structured level on listing page. |
| HTML-10 | Pipeline fetches Denmark advisory data from um.dk daily | Denmark uses color system (green/yellow/orange/red) on per-country pages at `/rejse-og-ophold/rejse-til-udlandet/rejsevejledninger/{country}`. Levels embedded in text ("frarades", "vær opmærksom"). Dropdown-based country selector on listing. |
| HTML-11 | Pipeline fetches Singapore advisory notices from MFA daily | Singapore MFA lists 186 countries at `/travelling-overseas/travel-advisories-notices-and-visa-information/`. Categories: "Travel page", "Travel page with travel advisory", "Travel page with travel notice". Per-country pages use text phrases like "defer all travel", "exercise caution". |
| HTML-12 | Pipeline fetches Romania advisory data from MAE daily | Romania MAE uses a 9-level alert system (1=low, 9=leave immediately). Site at mae.ro/en/travel-alerts. Currently returning 503 errors -- may need fallback strategy. |
| HTML-13 | Pipeline fetches Serbia advisory levels from MFA daily | Serbia MFA lists countries at `/en/citizens/travel-abroad/visas-and-states-travel-advisory/{country}`. Per-country pages use text descriptions ("extremely high level of threat"). No structured level system -- must infer from text. |
| HTML-14 | Pipeline fetches Estonia advisory data from kriis.ee daily | Estonia uses reisitargalt.vm.ee with per-country pages at `/sihtkoht/{estonian-slug}/`. Advisory levels in Estonian text ("vältida" = avoid, "ettevaatlik" = cautious). No color/number system. |
| HTML-15 | Pipeline fetches Croatia advisory data from MVEP daily | Croatia MVEP at mvep.gov.hr has a travel info page. Per-country content loads via JS/dynamic menu. HTML content is mostly JS date arrays. Very limited structured data. |
| HTML-16 | Pipeline fetches Argentina advisory alerts from Cancilleria daily | Argentina uses chronological alert feed at cancilleria.gob.ar/es/servicios/viajar-al-exterior/alertas. No per-country system -- event-based alerts mentioning country names. Spanish language. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| cheerio | (already installed) | HTML parsing | Already used in tier2a, proven pattern |
| node:fetch | built-in | HTTP requests | Already used in tier2a |

### Supporting
No additional libraries needed. All tools from tier2a apply.

## Architecture Patterns

### Recommended Project Structure
Follow tier2a exactly:
```
src/pipeline/
  fetchers/
    advisories-tier2b.ts      # NEW: 8 sub-fetchers + orchestrator
  normalize/
    advisory-levels.ts         # EXTEND: add normalization functions
  types.ts                     # EXTEND: add advisory keys to ScoredCountry
  fetchers/
    advisories.ts              # EXTEND: AdvisoryInfoMap type
    index.ts                   # EXTEND: import + wire tier2b
  scoring/
    engine.ts                  # EXTEND: indicator-to-source map
  config/
    sources.json               # EXTEND: add tier2b entry
```

### Pattern: Sub-fetcher Architecture (from tier2a)
**What:** Each source is an independent async function returning `FetcherResult`. The orchestrator (`fetchTier2bAdvisories`) calls each in try/catch blocks, merges results, falls back to cache if all fail.
**When to use:** Always -- this is the established pattern.
**Example:** See `fetchAtAdvisories()` in tier2a for the cleanest reference.

### Pattern: Text-Based Level Extraction
**What:** Most Tier 2b sources embed advisory levels in prose text rather than structured HTML. Use keyword matching on page text (lowercased) to infer levels.
**When to use:** Belgium, Denmark, Singapore, Serbia, Estonia, Croatia.
**Example:**
```typescript
function inferLevelFromText(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('do not travel') || lower.includes('leave immediately') || lower.includes('avoid all')) return 4;
  if (lower.includes('avoid') || lower.includes('defer') || lower.includes('non-essential')) return 3;
  if (lower.includes('caution') || lower.includes('increased') || lower.includes('high degree')) return 2;
  return 1;
}
```

### Pattern: Event-Based Alert Extraction (Argentina, Romania)
**What:** Some sources publish alerts as a chronological feed rather than per-country levels. Extract country names from alert titles/text and assign severity based on alert language.
**When to use:** Argentina (Cancilleria alerts), Romania (MAE alerts).
**Example:** See `fetchBrAdvisories()` in tier2a for the same pattern (Brazil).

### Anti-Patterns to Avoid
- **CSS-class-based level detection:** Most Tier 2b sources do NOT use CSS classes for advisory levels. Relying on classes will produce empty results.
- **Assuming English content:** Belgium (French), Denmark (Danish), Estonia (Estonian), Argentina (Spanish) require local-language text matching.
- **Crawling all ~200 country pages:** Would be too slow and rude. Use listing pages where possible, sample subsets for per-country crawling.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Country name matching | Custom fuzzy match | `getCountryByName()` from countries.ts | Already handles aliases, accents |
| Level normalization | Ad-hoc level mapping | `normalizeToUnified()` or dedicated functions | Consistent with existing pattern |
| Concurrent fetching | Manual Promise.all | `fetchBatch()` helper from tier2a | Already handles concurrency limits |
| Cache fallback | Custom file logic | `findLatestCached()` + `readJson()` | Proven pattern in tier2a |

## Common Pitfalls

### Pitfall 1: Sites Returning 403/503 for Bot-like Requests
**What goes wrong:** Government sites block requests without proper headers or with rapid-fire requests.
**Why it happens:** Anti-bot protection, WAF rules.
**How to avoid:** Use FETCH_HEADERS constant (already defined in tier2a with proper User-Agent). Add AbortSignal.timeout. Return empty results gracefully rather than throwing.
**Warning signs:** HTTP 403, 503, empty HTML response.

### Pitfall 2: Estonian/Danish Country Name Slugs
**What goes wrong:** Country slugs in Estonian (e.g., "prantsusmaa" for France) and Danish (e.g., "frankrig" for France) don't match English names.
**Why it happens:** Local-language URLs with local naming conventions.
**How to avoid:** For per-country crawling, build a reverse mapping from COUNTRIES list using the appropriate language name. For Estonia, use `country.name.en` to build slug attempts since the site may accept English slugs too.
**Warning signs:** All per-country requests returning 404.

### Pitfall 3: Romania MAE Site Instability
**What goes wrong:** mae.ro returned 503 during research. May be intermittently available.
**Why it happens:** Government site infrastructure limitations.
**How to avoid:** Multiple URL fallbacks, generous timeout, graceful empty return. Cache previous results.
**Warning signs:** Consistent 503 errors.

### Pitfall 4: Argentina/Romania Event-Based Alerts Producing Sparse Data
**What goes wrong:** Event-based alert feeds only mention countries currently in crisis. Most countries have no entry, meaning advisory level defaults to 1.
**Why it happens:** These are alert systems, not advisory databases.
**How to avoid:** Accept sparse data -- only produce indicators for countries explicitly mentioned in alerts. Don't manufacture level-1 entries for unlisted countries.
**Warning signs:** Very low country count (5-20 countries instead of 100+).

### Pitfall 5: JS-Rendered Content
**What goes wrong:** Some pages load country lists via JavaScript, making cheerio parsing return empty results.
**Why it happens:** Modern government websites using SPAs or dynamic loading.
**How to avoid:** Check if cheerio parse returns meaningful data. If listing page is empty, fall back to per-country page crawling with a sample subset.
**Warning signs:** cheerio `$('a')` returns 0 elements or only navigation links.

### Pitfall 6: Singapore MFA Pagination
**What goes wrong:** Singapore lists 186 countries across multiple pages. Only first page is fetched.
**Why it happens:** Paginated results.
**How to avoid:** Check for pagination links and fetch subsequent pages, or build country URLs directly from COUNTRIES list using known pattern `/travelling-overseas/travel-advisories-notices-and-visa-information/{slug}/`.
**Warning signs:** Only getting ~20 countries instead of 186.

## Source-by-Source Analysis

### 1. Belgium (diplomatie.belgium.be) -- HTML-09
- **Listing page:** `/fr/pays` has alphabetical list of countries as links
- **Per-country URL:** `/fr/pays/{french-name-slug}` (e.g., `/fr/pays/afghanistan`)
- **Advisory level:** Text-based, in French. No structured color/number system visible
- **Strategy:** Fetch listing page to get country URLs, then batch-crawl per-country pages looking for French advisory text (e.g., "deconseille", "prudence", "risque")
- **Language:** French
- **Expected coverage:** MEDIUM (50-100 countries, depending on which have advisory sections)
- **Normalization:** New `normalizeBeLevel(text)` function matching French advisory phrases
- **Confidence:** LOW -- per-country pages didn't reveal structured advisory data in research

### 2. Denmark (um.dk) -- HTML-10
- **Listing page:** `/rejse-og-ophold/rejse-til-udlandet/rejsevejledninger` has dropdown country selector
- **Per-country URL:** `/rejse-og-ophold/rejse-til-udlandet/rejsevejledninger/{danish-name}` (e.g., `/rejsevejledninger/ukraine`)
- **Advisory level:** Text-based in Danish. Uses color categories: green, yellow, orange, red
  - "frarades alle rejser" (advise against all travel) = red = level 4
  - "frarades" (advise against non-essential) = orange = level 3
  - "skaerpet opmærksomhed" / "vær opmærksom" (be cautious) = yellow = level 2
  - No advisory or "normal" = green = level 1
  - Also: "meget hoj sikkerhedsrisiko" (very high security risk)
- **Strategy:** Build Danish country name slugs from COUNTRIES, batch-crawl per-country pages
- **Language:** Danish
- **Expected coverage:** MEDIUM -- Denmark only publishes advisories for "risky" countries. Many countries return "Vi har ingen rejsevejledning" (we have no advisory) which = level 1
- **Normalization:** New `normalizeDkLevel(text)` function matching Danish advisory phrases
- **Confidence:** MEDIUM

### 3. Singapore (MFA) -- HTML-11
- **Listing page:** `/travelling-overseas/travel-advisories-notices-and-visa-information/` with 186 entries, paginated
- **Per-country URL:** `/travelling-overseas/travel-advisories-notices-and-visa-information/{slug}/`
- **Advisory level:** Categories on listing: "Travel page with travel advisory" (28 countries), "Travel page with travel notice" (18 countries), "Travel page" (140 countries). Per-country pages use text like "defer all travel", "exercise caution"
- **Strategy:** Use category from listing page as initial signal. For "advisory" and "notice" tagged countries, fetch per-country page to determine exact level from text
- **Language:** English
- **Expected coverage:** HIGH (186 countries listed)
- **Normalization:** New `normalizeSgLevel(text)` function. Category-based: advisory=3, notice=2, plain=1. Then refine from per-country text
- **Confidence:** MEDIUM

### 4. Romania (MAE) -- HTML-12
- **Listing page:** `mae.ro/en/travel-alerts` -- currently returning 503
- **Advisory level:** 9-level system (1=low, 9=leave immediately). Text-based alerts
- **Strategy:** Event-based alert extraction similar to Brazil pattern. Parse alert titles/text for country names and severity. Map 9-level to unified 1-4 (1-2->1, 3-4->2, 5-6->3, 7-9->4)
- **Language:** English (en version available) and Romanian
- **Expected coverage:** LOW (sparse, event-based alerts only)
- **Normalization:** New `normalizeRoLevel(level9: number)` mapping 9-scale to 4-scale
- **Confidence:** LOW -- site instability, 503 errors during research

### 5. Serbia (MFA) -- HTML-13
- **Listing page:** `/en/citizens/travel-abroad/visas-and-states-travel-advisory` has grid of country cards
- **Per-country URL:** `/en/citizens/travel-abroad/visas-and-states-travel-advisory/{slug}` (e.g., `/afghanistan`)
- **Advisory level:** Text-based on per-country pages. No color/number system. Uses phrases like "extremely high level of threat"
- **Strategy:** Fetch listing page to get country links, batch-crawl per-country pages, extract level from security text
- **Language:** English
- **Expected coverage:** HIGH (comprehensive country list)
- **Normalization:** New `normalizeRsLevel(text)` function matching English text patterns
- **Confidence:** MEDIUM

### 6. Estonia (vm.ee / reisitargalt.vm.ee) -- HTML-14
- **Listing page:** `reisitargalt.vm.ee` has alphabetical country links in Estonian
- **Per-country URL:** `reisitargalt.vm.ee/sihtkoht/{estonian-slug}/`
- **Advisory level:** Text-based in Estonian. "vältida" (avoid), "ettevaatlik" (cautious)
- **Strategy:** Fetch listing to get country URLs, batch-crawl per-country pages
- **Language:** Estonian
- **Expected coverage:** HIGH (200+ countries listed)
- **Normalization:** New `normalizeEeLevel(text)` function matching Estonian advisory phrases
- **Confidence:** MEDIUM -- slugs are in Estonian, need to map from listing page

### 7. Croatia (MVEP) -- HTML-15
- **Listing page:** `mvep.gov.hr` travel warnings page loads content via JS/dynamic menu
- **Advisory level:** General text-based warnings, no structured per-country system visible
- **Strategy:** Try to fetch the page content. If JS-rendered, fall back to attempting per-country URLs. If neither works, return sparse crisis-only data similar to Brazil
- **Language:** English available but limited
- **Expected coverage:** LOW -- Croatia MVEP has limited structured advisory data
- **Normalization:** Generic text-pattern matching
- **Confidence:** LOW -- JS-rendered content, limited structured data

### 8. Argentina (Cancilleria) -- HTML-16
- **Listing page:** `cancilleria.gob.ar/es/servicios/viajar-al-exterior/alertas`
- **Per-alert URL:** `/es/servicios/alertas/{alert-slug}`
- **Advisory level:** Chronological alert feed. No per-country system. Spanish language alerts mentioning country names
- **Strategy:** Identical to Brazil pattern -- parse alert list for country mentions and severity keywords
- **Language:** Spanish
- **Expected coverage:** LOW (event-based, only crisis countries mentioned)
- **Normalization:** New `normalizeArAlert(text)` function matching Spanish alert phrases ("no viaje", "evite", "precaucion")
- **Confidence:** MEDIUM -- page structure is clear even if coverage is sparse

## Code Examples

### AdvisoryInfoMap Extension (advisories.ts)
```typescript
export type AdvisoryInfoMap = Record<string, {
  // ... existing keys ...
  // Tier 2b
  be?: AdvisoryInfo;
  dk?: AdvisoryInfo;
  sg?: AdvisoryInfo;
  ro?: AdvisoryInfo;
  rs?: AdvisoryInfo;
  ee?: AdvisoryInfo;
  hr?: AdvisoryInfo;
  ar?: AdvisoryInfo;
}>;
```

### ScoredCountry advisories Extension (types.ts)
```typescript
advisories: {
  // ... existing keys ...
  // Tier 2b
  be?: AdvisoryInfo;
  dk?: AdvisoryInfo;
  sg?: AdvisoryInfo;
  ro?: AdvisoryInfo;
  rs?: AdvisoryInfo;
  ee?: AdvisoryInfo;
  hr?: AdvisoryInfo;
  ar?: AdvisoryInfo;
};
```

### Engine indicator-to-source Map Extension (engine.ts)
```typescript
advisory_level_be: 'advisories_be',
advisory_level_dk: 'advisories_dk',
advisory_level_sg: 'advisories_sg',
advisory_level_ro: 'advisories_ro',
advisory_level_rs: 'advisories_rs',
advisory_level_ee: 'advisories_ee',
advisory_level_hr: 'advisories_hr',
advisory_level_ar: 'advisories_ar',
```

### Denmark Normalization Example
```typescript
export function normalizeDkLevel(text: string): UnifiedLevel {
  const lower = text.toLowerCase();
  if (lower.includes('fraråder alle rejser') || lower.includes('fraraader alle rejser')) return 4;
  if (lower.includes('fraråder') || lower.includes('fraraader') || lower.includes('frarådes')) return 3;
  if (lower.includes('skærpet') || lower.includes('opmærksom') || lower.includes('vær forsigtig') || lower.includes('høj risiko')) return 2;
  return 1;
}
```

### Singapore Category-Based Level
```typescript
export function normalizeSgCategory(category: string, pageText?: string): UnifiedLevel {
  const catLower = category.toLowerCase();
  if (catLower.includes('advisory')) {
    // Refine from page text if available
    if (pageText) {
      const textLower = pageText.toLowerCase();
      if (textLower.includes('leave') || textLower.includes('do not travel')) return 4;
      if (textLower.includes('defer all') || textLower.includes('avoid')) return 3;
    }
    return 3; // Default for advisory category
  }
  if (catLower.includes('notice')) return 2;
  return 1;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CSS-class level detection | Text-pattern matching | Tier 2b sources | Most Tier 2b sources use prose text, not structured CSS |
| Full country list on index | Per-country page crawling | Tier 2b sources | Listing pages often don't show levels |
| English-only matching | Multi-language text matching | Tier 2b sources | Danish, Estonian, French, Spanish keywords needed |

## Open Questions

1. **Belgium advisory structure**
   - What we know: Per-country pages exist at `/fr/pays/{slug}` with advisory sections
   - What's unclear: Whether advisory sections contain parseable severity text or are purely descriptive prose
   - Recommendation: Implement with French text matching, accept potentially low accuracy. Refine after first live run.

2. **Romania MAE availability**
   - What we know: Site returned 503 during research. Has 9-level system.
   - What's unclear: Whether 503 is temporary or chronic
   - Recommendation: Implement with generous retry/fallback. If site is consistently down, accept empty results.

3. **Croatia MVEP data extraction**
   - What we know: Page content is primarily JS date arrays, not advisory data
   - What's unclear: Whether there's a hidden API or data endpoint
   - Recommendation: Try basic scraping, but accept this may be the weakest source. Consider marking as experimental.

4. **Estonia slug mapping**
   - What we know: Country page URLs use Estonian-language slugs
   - What's unclear: Complete slug mapping for all 200+ countries
   - Recommendation: Parse the listing page to extract country links and slugs dynamically rather than hardcoding.

## Sources

### Primary (HIGH confidence)
- Tier2a source code (`advisories-tier2a.ts`) -- established pattern to follow
- `types.ts`, `advisory-levels.ts`, `advisories.ts`, `engine.ts` -- integration points
- `index.ts` -- orchestration pattern

### Secondary (MEDIUM confidence)
- Live website fetches of 8 source sites (performed 2026-03-26)
- um.dk Denmark advisory FAQ -- confirmed green/yellow/orange/red color system
- Singapore MFA listing page -- confirmed 186 countries, category system
- Serbia MFA listing page -- confirmed per-country card grid
- Estonia reisitargalt.vm.ee -- confirmed alphabetical country listing
- Argentina Cancilleria alerts -- confirmed chronological alert feed

### Tertiary (LOW confidence)
- Romania MAE 9-level system -- from web search results, site was 503 during research
- Belgium advisory structure -- could not access per-country advisory content
- Croatia MVEP structure -- could not extract advisory data from JS-heavy page

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - follows established tier2a pattern exactly
- Architecture: HIGH - identical architecture to tier2a
- Source website structures: MEDIUM - some sites were inaccessible or JS-rendered
- Normalization accuracy: MEDIUM - text pattern matching is inherently fuzzy
- Expected coverage per source: LOW-MEDIUM - several sources will produce sparse data

**Research date:** 2026-03-26
**Valid until:** 2026-04-10 (government websites may change structure at any time)
