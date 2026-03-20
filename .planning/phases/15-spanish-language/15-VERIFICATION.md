---
phase: 15-spanish-language
verified: 2026-03-20T12:00:00Z
status: human_needed
score: 9/9 must-haves verified
human_verification:
  - test: "Browse /es/ homepage"
    expected: "Spanish UI text: translated hero, navigation, global score banner in Spanish"
    why_human: "Cannot verify rendered HTML output or visual layout programmatically without a running build"
  - test: "Browse /es/pais/[any-slug] country detail page"
    expected: "Country name displays in Spanish, all labels translated (pillars: Conflicto, Criminalidad, Salud, Gobernanza, Medio Ambiente)"
    why_human: "Rendered output and dynamic chart content require visual inspection"
  - test: "Browse /es/comparar and search for a country"
    expected: "Country names appear in Spanish in search results; date formatting uses es-ES locale"
    why_human: "Client-side search behavior and locale-formatted dates need visual confirmation"
  - test: "Click language switcher on any /es/ page"
    expected: "Switcher shows English, Italiano, Espanol as options and navigates correctly between locales"
    why_human: "Navigation behavior requires browser interaction"
  - test: "View page source on /es/ homepage"
    expected: "hreflang tags reference all 3 locales: en, it, es"
    why_human: "Cannot run Astro build to inspect dist output without long build step"
---

# Phase 15: Spanish Language Verification Report

**Phase Goal:** Spanish-speaking travelers can use the full site in their language
**Verified:** 2026-03-20T12:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Spanish locale 'es' is recognized by Astro i18n and sitemap | VERIFIED | `astro.config.mjs` line 17: `es: 'es'` in sitemap locales; line 29: `'es'` in i18n locales array |
| 2 | All ~190 UI translation keys have Spanish values | VERIFIED | `npx tsx` confirmed: EN keys: 187, ES keys: 187, missing count: 0 |
| 3 | All 248 country names have a Spanish translation | VERIFIED | `grep -c "es:" src/pipeline/config/countries.ts` = 248 |
| 4 | SEO functions produce correct es-ES locale strings | VERIFIED | `src/lib/seo.ts` line 5: `localeMap: Record<Lang, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES' }`; pillarLabels.es present at line 11 |
| 5 | Language switcher includes Spanish option automatically | VERIFIED | `LanguageSwitcher.astro` iterates `Object.entries(languages)` from `src/i18n/ui.ts`; `languages.es = 'Espanol'` confirmed |
| 6 | User can browse all pages under /es/ with fully translated UI text | VERIFIED (code) | All 6 ES page files exist with `const lang: Lang = 'es'` and `useTranslations(lang)` — visual render needs human |
| 7 | All 248 country names display correctly in Spanish on detail pages | VERIFIED (code) | `src/pages/es/pais/[slug].astro` uses `country.name[lang]` (bracket notation) confirmed at line 47 |
| 8 | Spanish pages have correct hreflang tags | VERIFIED (code) | `Base.astro` calls `getAlternateLinks(currentPath)` which iterates `Object.keys(languages)` — es included automatically |
| 9 | No remaining 2-way locale ternaries in src/ | VERIFIED | `grep -rn "=== 'it' ? 'it-IT'"` returned no results; `comparar.astro` uses `localeMap` at line 588 |

**Score:** 9/9 truths verified (code-level); 5 items flagged for human visual confirmation

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `astro.config.mjs` | es locale in Astro i18n and sitemap config | VERIFIED | Contains `'es'` in locales array and `es: 'es'` in sitemap |
| `src/i18n/ui.ts` | Spanish translations, routes, and language label | VERIFIED | `languages.es = 'Espanol'`, 187 ES keys, `routes.es` with 6 slugs |
| `src/pipeline/types.ts` | CountryEntry.name with es field | VERIFIED | Lines 65 and 89: `name: { en: string; it: string; es: string }` |
| `src/pipeline/config/countries.ts` | 248 Spanish country names | VERIFIED | 248 `es:` entries confirmed by grep count |
| `src/lib/seo.ts` | Spanish meta descriptions and JSON-LD locale | VERIFIED | `es-ES` in localeMap; Spanish pillar labels and JSON-LD descriptions present |
| `src/layouts/Base.astro` | og:locale for Spanish | VERIFIED | Line 63: `{ en: 'en_US', it: 'it_IT', es: 'es_ES' }[lang]` |
| `src/pages/es/index.astro` | Spanish homepage | VERIFIED | Exists, `lang: Lang = 'es'`, `useTranslations(lang)` |
| `src/pages/es/pais/[slug].astro` | Spanish country detail pages | VERIFIED | Exists, `lang: Lang = 'es'`, `country.name[lang]` |
| `src/pages/es/comparar.astro` | Spanish comparison page | VERIFIED | Exists, `lang: Lang = 'es'`, localeMap for date formatting |
| `src/pages/es/seguridad-global.astro` | Spanish global safety page | VERIFIED | Exists, `lang: Lang = 'es'` |
| `src/pages/es/metodologia/index.astro` | Spanish methodology page | VERIFIED | Exists, `lang: Lang = 'es'` |
| `src/pages/es/terminos-legales/index.astro` | Spanish legal disclaimer page | VERIFIED | Exists, `lang: Lang = 'es'` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/i18n/ui.ts` | `src/i18n/utils.ts` | `languages` object drives `getLangFromUrl`, `useTranslations` | WIRED | `utils.ts` imports `languages` from `ui.ts`; `getLangFromUrl` checks `lang in languages` |
| `src/i18n/ui.ts` | `src/components/LanguageSwitcher.astro` | `languages` object iteration auto-includes es | WIRED | `LanguageSwitcher.astro` imports `languages` from `utils`; iterates with `Object.entries(languages)` |
| `src/pipeline/types.ts` | `src/pipeline/config/countries.ts` | `CountryEntry` type constrains name fields | WIRED | `CountryEntry.name` has `es: string`; all 248 entries in `countries.ts` have `es:` field |
| `src/pages/es/*.astro` | `src/i18n/ui.ts` | `useTranslations('es')` for all UI text | WIRED | All 6 ES pages import and call `useTranslations(lang)` with `lang = 'es'` |
| `src/pages/es/pais/[slug].astro` | `src/pipeline/config/countries.ts` | `country.name.es` for display names | WIRED | Uses `country.name[lang]` (bracket notation) — resolves to `.es` at runtime |
| `src/pages/es/comparar.astro` | `src/i18n/ui.ts` | Client-side locale detection handles 'es' | WIRED | `localeMap: Record<string, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES' }` at line 588 |
| `src/layouts/Base.astro` | `src/i18n/utils.ts` | `getAlternateLinks` auto-generates hreflang for all locales | WIRED | `getAlternateLinks` iterates `Object.keys(languages)` — 'es' included automatically |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| LANG-01 | 15-01, 15-02 | User can browse the full site in Spanish | SATISFIED | 6 pages under `/es/` with translated UI via `useTranslations('es')` |
| LANG-02 | 15-01, 15-02 | All 248 country names are available in Spanish | SATISFIED | 248 `es:` entries in `countries.ts`; `CountryEntry.name.es: string` type enforced; `country.name[lang]` used in pages |
| LANG-03 | 15-01 | Language switcher includes Spanish option | SATISFIED | `languages.es = 'Espanol'` in `ui.ts`; `LanguageSwitcher.astro` iterates `Object.entries(languages)` dynamically |

No orphaned requirements found. All 3 LANG IDs are claimed by plans and have implementation evidence.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/pages/es/comparar.astro` | 70, 73 | `<!-- Pillar Bars placeholder for Plan 02 -->` | Info | Pre-existing pattern — identical comments appear in `src/pages/it/confronta.astro` and `src/pages/en/compare.astro`. These are empty container divs populated by client-side JS, not missing functionality. |

No blockers or warnings found. The "placeholder" comments are inherited from EN/IT pages and refer to JS-rendered DOM containers, not absent features.

### Human Verification Required

These items cannot be verified programmatically without a running build or browser.

#### 1. Spanish homepage renders in Spanish

**Test:** Run `npx astro dev`, visit http://localhost:4321/es/
**Expected:** Hero text, navigation, and global score banner display in Spanish (e.g., "Es seguro tu destino?", "Inicio", "Seguridad Global")
**Why human:** Rendered HTML output requires a running Astro dev server or build

#### 2. Spanish country detail page displays Spanish name and labels

**Test:** Click any country on the map from /es/, or visit /es/pais/[any-slug] directly
**Expected:** Country name shows in Spanish (e.g., "Alemania" not "Germany"), pillar labels read "Conflicto", "Criminalidad", "Salud", "Gobernanza", "Medio Ambiente"
**Why human:** Dynamic page rendering requires browser

#### 3. Spanish compare page search shows Spanish country names

**Test:** Visit http://localhost:4321/es/comparar, type a country name in the search box
**Expected:** Search results list country names in Spanish; date formatting uses es-ES locale
**Why human:** Client-side Fuse.js search behavior needs interactive verification

#### 4. Language switcher shows all 3 locales

**Test:** On any page, open the language switcher
**Expected:** Dropdown or menu shows "English", "Italiano", "Espanol" as options; clicking "Espanol" navigates to the /es/ equivalent of the current page
**Why human:** Navigation behavior requires browser interaction

#### 5. hreflang tags include all 3 locales

**Test:** View page source on /es/ or /en/ — search for `hreflang`
**Expected:** Each page has `<link rel="alternate" hreflang="en" ...>`, `hreflang="it" ...`, `hreflang="es" ...>`
**Why human:** Requires Astro build output or dev server HTML inspection

### Gaps Summary

No gaps found. All code-level must-haves are satisfied:

- Astro i18n config recognizes 'es'
- 187/187 Spanish translation keys present (matches EN count exactly)
- 248/248 country names have Spanish translations
- `CountryEntry` and `ScoredCountry` types enforce `es: string`
- SEO layer uses `localeMap` with `es-ES` throughout
- `og:locale` handles `es_ES` in `Base.astro`
- All 6 Spanish pages exist and are properly typed
- Language switcher auto-includes Spanish via `languages` object iteration
- hreflang auto-generates for 'es' via `getAlternateLinks`
- Zero remaining 2-way locale ternaries in `src/`
- 3 documented commits verified in git log (`cdf528f`, `b3a2598`, `8185216`)

The phase goal is achieved at the code level. Human visual verification is recommended to confirm rendered output quality before marking the phase fully complete.

---

_Verified: 2026-03-20T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
