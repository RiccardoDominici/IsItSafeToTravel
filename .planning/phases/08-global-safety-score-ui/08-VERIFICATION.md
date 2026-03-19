---
phase: 08-global-safety-score-ui
verified: 2026-03-19T20:30:00Z
status: passed
score: 7/7 must-haves verified
re_verification: false
---

# Phase 8: Global Safety Score UI — Verification Report

**Phase Goal:** Users can see and explore a global safety benchmark that contextualizes individual country scores
**Verified:** 2026-03-19T20:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees a global safety score banner on the homepage displaying the current world safety benchmark | VERIFIED | `GlobalScoreBanner.astro` renders conditional `<a>` with `globalScore.toFixed(1)` and `scoreToColor` badge; integrated in both `en/index.astro` and `it/index.astro` at line 26 |
| 2 | User can click the global score banner to navigate to the global safety page | VERIFIED | Banner is an `<a>` element. `href` computed as `/${lang}/${routes[lang]['global-safety']}` producing `/en/global-safety` and `/it/sicurezza-globale`. Routes defined in `ui.ts` lines 277/284 |
| 3 | Banner displays on both EN and IT homepages with correct translations | VERIFIED | Both `src/pages/en/index.astro` and `src/pages/it/index.astro` import and render `<GlobalScoreBanner lang={lang} />`. Translation keys `global.score_label` present in both `en` and `it` objects in `ui.ts` |
| 4 | User can navigate to a dedicated global safety page at /en/global-safety and /it/sicurezza-globale | VERIFIED | `src/pages/en/global-safety.astro` (182 lines) and `src/pages/it/sicurezza-globale.astro` (182 lines) exist, both with `export const prerender = true` |
| 5 | Global safety page displays a historical trend chart showing the global score over time | VERIFIED | Both pages use `loadGlobalHistory()`, `scaleTime()`, `scaleLinear()`, and D3 `line()` to produce a build-time SVG. Falls back gracefully to `global.trend_accumulating` message when `globalHistory.length < 2` |
| 6 | Global safety page includes an explanation of how the global score is calculated | VERIFIED | Both pages render a Methodology section using `t('global.methodology_title')`, `t('global.methodology_text')`, and `t('global.methodology_link')` with a link to `/${lang}/methodology/` |
| 7 | Page has proper SEO with JSON-LD structured data | VERIFIED | `buildGlobalSafetyJsonLd` in `src/lib/seo.ts` (lines 103–134) produces `@graph` with `WebPage` + `AggregateRating` (ratingValue, bestRating: 10, worstRating: 1, ratingCount: 248). Both pages call it and pass result to `<Base jsonLd={jsonLd}>` |

**Score: 7/7 truths verified**

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/GlobalScoreBanner.astro` | Clickable global score banner component (min 20 lines) | VERIFIED | 39 lines. Substantive: loads snapshot, extracts globalScore, uses scoreToColor, renders conditional `<a>` with correct href |
| `src/i18n/ui.ts` | Translation keys for global score features (contains `global.score_label`) | VERIFIED | 11 EN + 11 IT `global.*` keys added (lines 127–137, 256–266). Route slugs `global-safety: 'global-safety'` (EN) and `global-safety: 'sicurezza-globale'` (IT) added |
| `src/pages/en/global-safety.astro` | English global safety page (min 40 lines) | VERIFIED | 182 lines. Substantive: score hero, D3 chart, methodology section, JSON-LD |
| `src/pages/it/sicurezza-globale.astro` | Italian global safety page (min 40 lines) | VERIFIED | 182 lines. Identical structure with `lang: Lang = 'it'` |
| `src/lib/seo.ts` | JSON-LD builder for global safety page (contains `buildGlobalSafetyJsonLd`) | VERIFIED | Function at lines 103–134; exports `buildGlobalSafetyJsonLd(globalScore, canonicalUrl, lang)` with WebPage + AggregateRating |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/pages/en/index.astro` | `src/components/GlobalScoreBanner.astro` | Astro component import | WIRED | Line 5: `import GlobalScoreBanner from '../../components/GlobalScoreBanner.astro'`; used at line 26: `<GlobalScoreBanner lang={lang} />` |
| `src/pages/it/index.astro` | `src/components/GlobalScoreBanner.astro` | Astro component import | WIRED | Line 5: same import; used at line 26: `<GlobalScoreBanner lang={lang} />` |
| `src/components/GlobalScoreBanner.astro` | `src/lib/scores.ts` | `loadLatestSnapshot` for globalScore | WIRED | Line 5: `import { loadLatestSnapshot } from '../lib/scores'`; called at line 15; result used at lines 16–18 |
| `src/components/GlobalScoreBanner.astro` | `/en/global-safety` (route) | anchor href | WIRED | `href = /${lang}/${routes[lang]['global-safety']}` at line 18; routes object maps to `global-safety` (EN) / `sicurezza-globale` (IT) |
| `src/pages/en/global-safety.astro` | `src/lib/scores.ts` | `loadLatestSnapshot` and `loadGlobalHistory` | WIRED | Line 6: `import { loadLatestSnapshot, loadGlobalHistory } from '../../lib/scores'`; both called at lines 14 and 17; results used throughout chart computation |
| `src/pages/en/global-safety.astro` | `src/lib/seo.ts` | `buildGlobalSafetyJsonLd` | WIRED | Line 7: `import { buildGlobalSafetyJsonLd } from '../../lib/seo'`; called at line 20; result passed as `jsonLd` prop to `<Base>` |
| `src/pages/en/global-safety.astro` | `d3` | build-time SVG line chart | WIRED | Line 9: `import { scaleLinear, scaleTime, line, timeFormat } from 'd3'`; all four used inside the `if (showChart)` block to generate pathD, axis ticks, and endpoint dot |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| GLOB-01 | 08-01 | User sees a global safety score banner on the homepage (clickable) | SATISFIED | `GlobalScoreBanner.astro` renders a clickable `<a>` banner on both homepages; score badge uses `scoreToColor`; conditional render guards against missing data |
| GLOB-02 | 08-01, 08-02 | User can click the global score banner to navigate to a dedicated global safety page | SATISFIED | Banner `href` computes to `/en/global-safety` / `/it/sicurezza-globale`; target pages exist at exactly those paths with `prerender = true` |
| GLOB-03 | 08-02 | Global safety page shows a historical trend chart of the global score over time | SATISFIED | Both page files use `loadGlobalHistory()` + D3 `scaleTime` + `line` to render a full-size SVG chart with labeled X/Y axes at build time; graceful fallback for insufficient data |
| GLOB-04 | 08-02 | Global safety page includes an explanation of how the global score is calculated | SATISFIED | Methodology section in both pages renders `global.methodology_title`, `global.methodology_text`, and a link to `/${lang}/methodology/` |

No orphaned requirements found. All four GLOB-0x IDs claimed in plan frontmatter are accounted for and satisfied.

---

## Anti-Patterns Found

No blocker or warning anti-patterns detected.

- No `TODO`, `FIXME`, or placeholder comments in any phase-8 files
- No stub implementations (`return null`, `return {}`, empty handlers)
- No console.log-only implementations
- Conditional render in `GlobalScoreBanner.astro` (`snapshot && globalScore > 0`) is correct defensive guarding, not a stub

---

## Human Verification Required

### 1. Banner renders on live homepage (data-dependent)

**Test:** Load `/en/` and `/it/` in a browser when a data snapshot with `globalScore > 0` exists
**Expected:** Compact horizontal banner appears between the tagline and the map, showing a colored score badge, "Global Safety Score" label, and a chevron arrow
**Why human:** The banner has a conditional render guard — it only appears when `snapshot != null && globalScore > 0`. If the pipeline has not yet produced a snapshot, the banner is intentionally hidden and cannot be verified programmatically

### 2. Banner click navigates correctly

**Test:** Click the banner on `/en/` — should navigate to `/en/global-safety/`; click on `/it/` — should navigate to `/it/sicurezza-globale/`
**Expected:** Correct URL-per-language navigation
**Why human:** Static analysis confirms the href is computed correctly; runtime navigation behavior requires a browser

### 3. Trend chart vs. accumulating message

**Test:** On `/en/global-safety`, observe whether the D3 SVG chart or the "Trend data accumulating" fallback paragraph is shown
**Expected:** If `globalHistory.length >= 2`, the SVG chart with labeled X (dates) and Y (scores 2/4/6/8/10) axes renders; otherwise the italic fallback message appears
**Why human:** Which branch renders depends on the actual data on disk — cannot be determined without inspecting `public/data/history-index.json`

---

## Gaps Summary

No gaps. All seven observable truths are verified, all five artifacts pass existence + substance + wiring checks, all four key links (Plan 01) and three key links (Plan 02) are wired end-to-end, and all four requirement IDs (GLOB-01 through GLOB-04) are satisfied with direct codebase evidence.

The phase goal — users can see and explore a global safety benchmark that contextualizes individual country scores — is fully achieved. The only outstanding items are human browser checks that depend on live data availability, not on code correctness.

---

_Verified: 2026-03-19T20:30:00Z_
_Verifier: Claude (gsd-verifier)_
