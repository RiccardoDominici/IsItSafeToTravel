# Phase 36: Documentation - Research

**Researched:** 2026-03-27
**Domain:** Frontend documentation pages, i18n, advisory data display
**Confidence:** HIGH

## Summary

Phase 36 requires three documentation updates: (1) updating the methodology page in all 5 languages to reflect the expanded 34+ advisory source set, (2) updating country detail pages to display advisory information from all new sources (currently only US/UK/CA/AU are shown), and (3) creating a new dedicated Sources page listing all government advisory sources.

The codebase uses Astro with a single `src/i18n/ui.ts` file containing all translation strings for 5 languages (en/it/es/fr/pt). Pages are duplicated per language directory with only the `lang` const changing. The methodology page already has a data sources table and indicator labels. The AdvisorySection component on country pages is hardcoded to only display 4 sources. The types already support all 37 advisory keys in `ScoredCountry.advisories`. No dedicated Sources page exists yet -- the footer has an unused `footer.sources` i18n key.

**Primary recommendation:** Update i18n strings first (single file, all 5 languages), then update components (AdvisorySection to iterate all advisory keys dynamically), then create Sources page, then update methodology content.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
None -- all implementation choices at Claude's discretion.

### Claude's Discretion
- Methodology page must be updated in all 5 languages (en, it, es, fr, pt -- NOTE: CONTEXT.md says "de" but actual site languages are en/it/es/fr/pt)
- Must explain how normalization works and how advisory consensus affects scoring
- Country detail pages should show which governments have issued advisories
- Sources page must list all 34+ sources with country of origin, data format, and update frequency
- Follow existing i18n patterns for translations

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOC-01 | Methodology page updated with all new sources in all 5 languages | i18n keys need adding for 33 new advisory indicator labels; methodology overview/tiered text needs updating from "7 sources" to "40+ sources"; data sources table needs new advisory rows |
| DOC-02 | Country detail pages show advisory info from new sources | AdvisorySection.astro hardcoded to us/uk/ca/au only; needs refactor to iterate all advisory keys dynamically; AdvisoryCard.astro sourceKey type needs expanding; i18n needs 33 new `country.advisory.*` labels |
| DOC-03 | Sources page lists all new government advisory sources | No sources page exists; need new pages in 5 language dirs; need new route in routes config; need new i18n keys; footer needs sources link added |
</phase_requirements>

## Architecture Patterns

### Existing i18n Pattern
All translations live in a single file: `src/i18n/ui.ts`. Each language block is a flat object with dot-notation keys. The `useTranslations(lang)` helper returns a `t()` function. Pages access translations via `t('key.name')`.

**Languages:** en (English), it (Italian), es (Spanish), fr (French), pt (Portuguese)

**CRITICAL CORRECTION:** The CONTEXT.md says "de" (German) but the actual site uses "pt" (Portuguese). The planner must use pt, not de.

### Existing Page Duplication Pattern
Each localized page is a separate `.astro` file under `src/pages/{lang}/...`. All share identical template structure; only `const lang: Lang = '{xx}'` changes. Example:
- `src/pages/en/methodology/index.astro`
- `src/pages/it/metodologia/index.astro`
- `src/pages/es/metodologia/index.astro`
- `src/pages/fr/methodologie/index.astro`
- `src/pages/pt/metodologia/index.astro`

### Existing Routes Pattern
Routes are defined in `src/i18n/ui.ts` at the bottom in `export const routes`. Each language maps route keys to localized slugs. A new `sources` route key is needed for the new page.

### Advisory Data Flow
1. Pipeline fetchers write `advisories-info.json` + tier-specific info files per date
2. Engine (`src/pipeline/scoring/engine.ts`) merges all tier info files into `advisoryInfoMap`
3. `ScoredCountry.advisories` object carries up to 37 advisory keys (us, uk, ca, au, de, nl, jp, sk, fr, nz, ie, fi, hk, br, at, ph, be, dk, sg, ro, rs, ee, hr, ar, it, es, kr, tw, cn, in, ch, se, no, pl, cz, hu, pt)
4. Frontend `AdvisorySection.astro` currently only checks us/uk/ca/au -- **this is the main gap for DOC-02**

### Current Methodology Page Structure
The methodology page has these sections (in order):
1. Overview (mentions "7 trusted public sources" -- needs updating)
2. Data Sources table (9 rows: wb, gpi, inform, us/uk/ca/au advisories, reliefweb, gdacs)
3. Scoring Formula
4. Baseline + Signal Architecture (mentions "signal sources" vaguely)
5. Data Freshness Decay
6. How INFORM Enriches Scoring
7. Global Peace Index
8. Category Weights table (auto-generated from weights.json)
9. Understanding Each Category (expandable per-pillar with source descriptions)
10. Limitations

### Advisory Source Complete List (37 government sources)
Organized by tier as configured in `source-tiers.json` and `weights.json`:

| Key | Country | Weight | Tier |
|-----|---------|--------|------|
| us | United States | 2.6% | Base |
| uk | United Kingdom | 2.5% | Base |
| ca | Canada | 2.5% | Base |
| au | Australia | 2.5% | Base |
| de | Germany | 1.8% | Tier 1 |
| nl | Netherlands | 1.8% | Tier 1 |
| jp | Japan | 1.8% | Tier 1 |
| sk | Slovakia | 1.8% | Tier 1 |
| fr | France | 1.0% | Tier 2a |
| nz | New Zealand | 1.0% | Tier 2a |
| ie | Ireland | 1.0% | Tier 2a |
| fi | Finland | 1.0% | Tier 2a |
| hk | Hong Kong | 1.0% | Tier 2a |
| br | Brazil | 1.0% | Tier 2a |
| at | Austria | 1.0% | Tier 2a |
| ph | Philippines | 1.0% | Tier 2a |
| be | Belgium | 0.7% | Tier 2b |
| dk | Denmark | 0.7% | Tier 2b |
| sg | Singapore | 0.7% | Tier 2b |
| ro | Romania | 0.7% | Tier 2b |
| rs | Serbia | 0.7% | Tier 2b |
| ee | Estonia | 0.7% | Tier 2b |
| hr | Croatia | 0.7% | Tier 2b |
| ar | Argentina | 0.7% | Tier 2b |
| it | Italy | 0.5% | Tier 3a |
| es | Spain | 0.5% | Tier 3a |
| kr | South Korea | 0.5% | Tier 3a |
| tw | Taiwan | 0.5% | Tier 3a |
| cn | China | 0.5% | Tier 3a |
| in | India | 0.5% | Tier 3a |
| ch | Switzerland | 0.3% | Tier 3b |
| se | Sweden | 0.3% | Tier 3b |
| no | Norway | 0.3% | Tier 3b |
| pl | Poland | 0.3% | Tier 3b |
| cz | Czech Republic | 0.3% | Tier 3b |
| hu | Hungary | 0.3% | Tier 3b |
| pt | Portugal | 0.3% | Tier 3b |

### Anti-Patterns to Avoid
- **Hardcoding advisory keys in components:** The current AdvisorySection checks `advisories.us`, `.uk`, `.ca`, `.au` individually. With 37 sources, iterate dynamically over all keys.
- **Duplicating source metadata in i18n:** The sources.json config already has metadata. The Sources page can reference this data or a consolidated advisory source list rather than duplicating everything in i18n strings.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Advisory source metadata | Hardcode 37 source names/URLs in each language | Data-driven approach: define advisory source metadata once in a TypeScript/JSON config, use i18n only for translated display names | Reduces maintenance burden when sources change |
| Advisory card color mapping | Per-source color functions | All new sources use unified 1-4 scale, so a single numeric-to-color function works for all | Current AdvisoryCard already handles 1-4 numeric + UK text; new sources all use numeric |

## Common Pitfalls

### Pitfall 1: Stale Source Count in Prose Text
**What goes wrong:** Multiple i18n strings reference "7 trusted public sources" or "9+ sources" -- easy to update one and miss others.
**Why it happens:** Source counts are embedded in long prose paragraphs across 5 languages.
**How to avoid:** Search all languages for "7 " and "9" in methodology strings. Key strings to update: `methodology.overview_text`, `methodology.tiered_text`, and the about page sources section.
**Warning signs:** Page shows "7 sources" while the table lists 40+.

### Pitfall 2: AdvisoryCard sourceKey Type Restriction
**What goes wrong:** `AdvisoryCard.astro` currently types `sourceKey` as `'us' | 'uk' | 'ca' | 'au'` and has source-specific color logic for UK text-based levels.
**Why it happens:** Originally only 4 advisory sources existed.
**How to avoid:** Expand the type to accept all 37 keys. Since all new sources normalize to numeric 1-4 scale, the color function needs only the numeric path (1=green, 2=yellow, 3=orange, 4=red). UK remains the only text-based exception.

### Pitfall 3: Missing Indicator Labels in Weights Table
**What goes wrong:** The methodology page auto-generates a weights table from `weights.json`. Each indicator uses `t('methodology.indicator.{indicator}')` for display. The 33 new advisory indicators (advisory_level_de through advisory_level_pt) have NO i18n keys yet.
**Why it happens:** Previous phases added the weights config but not the i18n labels.
**How to avoid:** Add all 33 new `methodology.indicator.advisory_level_*` keys to all 5 languages.

### Pitfall 4: Methodology Pillar Descriptions Are Stale
**What goes wrong:** The Conflict pillar's sources description (`methodology.pillar.conflict.sources`) likely still lists only 4 advisory sources.
**Why it happens:** The expandable pillar detail cards list which sources feed each pillar.
**How to avoid:** Update `methodology.pillar.conflict.sources` in all 5 languages to mention 37 government advisory sources.

### Pitfall 5: Country Page Advisory Grid Layout
**What goes wrong:** Showing 37 advisory cards in a 2-column grid creates a very long page.
**Why it happens:** Most countries will have advisory data from many sources.
**How to avoid:** Show only the 4 major advisories (US/UK/CA/AU) expanded by default, then use an expandable "Show all X advisories" section for the remaining sources. Or group by level.

## Code Examples

### Current Advisory Iteration (to be replaced)
```astro
// src/components/country/AdvisorySection.astro - CURRENT (hardcoded)
const hasUs = !!advisories.us;
const hasUk = !!advisories.uk;
const hasCa = !!advisories.ca;
const hasAu = !!advisories.au;
```

### Recommended Dynamic Advisory Iteration
```typescript
// Define all advisory keys with their i18n label keys
const ADVISORY_KEYS = [
  'us', 'uk', 'ca', 'au', 'de', 'nl', 'jp', 'sk',
  'fr', 'nz', 'ie', 'fi', 'hk', 'br', 'at', 'ph',
  'be', 'dk', 'sg', 'ro', 'rs', 'ee', 'hr', 'ar',
  'it', 'es', 'kr', 'tw', 'cn', 'in',
  'ch', 'se', 'no', 'pl', 'cz', 'hu', 'pt'
] as const;

// Filter to only advisories that exist for this country
const activeAdvisories = ADVISORY_KEYS
  .filter(key => advisories[key])
  .map(key => ({ key, advisory: advisories[key]! }));
```

### Route Addition Pattern
```typescript
// In src/i18n/ui.ts routes object, add for each language:
en: { ..., sources: 'sources' },
it: { ..., sources: 'fonti' },
es: { ..., sources: 'fuentes' },
fr: { ..., sources: 'sources' },
pt: { ..., sources: 'fontes' },
```

### Sources Page File Locations
```
src/pages/en/sources/index.astro
src/pages/it/fonti/index.astro
src/pages/es/fuentes/index.astro
src/pages/fr/sources/index.astro
src/pages/pt/fontes/index.astro
```

## i18n Keys Inventory -- What Needs Adding

### New Advisory Display Names (country pages) -- 33 per language x 5 languages = 165 keys
Keys needed: `country.advisory.{de|nl|jp|sk|fr|nz|ie|fi|hk|br|at|ph|be|dk|sg|ro|rs|ee|hr|ar|it|es|kr|tw|cn|in|ch|se|no|pl|cz|hu|pt}`

### New Methodology Indicator Labels -- 33 per language x 5 languages = 165 keys
Keys needed: `methodology.indicator.advisory_level_{de|nl|jp|sk|fr|nz|ie|fi|hk|br|at|ph|be|dk|sg|ro|rs|ee|hr|ar|it|es|kr|tw|cn|in|ch|se|no|pl|cz|hu|pt}`

### New Sources Page Keys -- ~10 per language x 5 languages = 50 keys
Keys needed: `sources.title`, `sources.description`, `sources.heading`, `sources.table.*`, `sources.advisory_section_title`, etc.

### Updated Existing Keys -- ~5 per language x 5 languages = 25 keys
Keys to update: `methodology.overview_text` (source count), `methodology.tiered_text` (signal source list), `methodology.pillar.conflict.sources` (advisory list)

### Total i18n Changes: ~400+ key additions/modifications in src/i18n/ui.ts

## Key Files to Modify

| File | Change Type | Scope |
|------|-------------|-------|
| `src/i18n/ui.ts` | Add ~400 keys, update ~25 keys | All 5 language blocks + routes |
| `src/components/country/AdvisorySection.astro` | Refactor to dynamic iteration | Single component |
| `src/components/country/AdvisoryCard.astro` | Expand sourceKey type, simplify color logic | Single component |
| `src/pages/en/methodology/index.astro` | Update dataSources array to include all advisory sources | Template change |
| `src/pages/{it,es,fr,pt}/metodologia/index.astro` | Same dataSources update | 4 files, same change |
| `src/components/Footer.astro` | Add sources link | Single component |
| `src/pages/{lang}/sources/index.astro` | NEW -- create 5 files | New pages |

## Sources

### Primary (HIGH confidence)
- Direct codebase analysis of all files listed above
- `src/pipeline/config/weights.json` -- definitive list of 37 advisory indicators
- `src/pipeline/config/source-tiers.json` -- tier configuration and decay parameters
- `src/pipeline/types.ts` -- ScoredCountry.advisories type with all 37 keys
- `src/i18n/ui.ts` -- complete i18n structure, current keys, routes config

## Metadata

**Confidence breakdown:**
- Architecture: HIGH -- direct codebase analysis, patterns are clear and consistent
- i18n requirements: HIGH -- exact key gaps identified by comparing weights.json indicators vs existing i18n keys
- Pitfalls: HIGH -- identified from actual code review (hardcoded types, stale counts, missing keys)

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable codebase patterns)
