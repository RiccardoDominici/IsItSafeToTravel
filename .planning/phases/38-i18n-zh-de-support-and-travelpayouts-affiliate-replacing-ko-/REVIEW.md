---
phase: 38-i18n-zh-de-support-and-travelpayouts-affiliate-replacing-ko-
reviewed: 2026-05-06T14:05:00Z
depth: deep
files_reviewed: 56
files_reviewed_list:
  - src/i18n/ui.ts
  - src/i18n/utils.ts
  - src/layouts/Base.astro
  - src/components/Footer.astro
  - src/config/affiliate.ts
  - src/lib/scores.ts
  - src/lib/seo.ts
  - src/components/Search.astro
  - src/components/country/AnswerFirstParagraph.astro
  - src/components/country/StatsSummary.astro
  - src/components/country/ScoreHero.astro
  - src/components/country/RelatedCountries.astro
  - src/components/country/TrendChart.astro
  - src/pipeline/config/countries.ts
  - astro.config.mjs
  - scripts/validate-seo.ts
  - functions/index.ts
  - src/pages/index.astro
  - src/pages/zh/index.astro
  - src/pages/zh/about/index.astro
  - src/pages/zh/compare.astro
  - src/pages/zh/countries-to-avoid/index.astro
  - src/pages/zh/country/[slug].astro
  - src/pages/zh/declining-safety/index.astro
  - src/pages/zh/embed-badge/index.astro
  - src/pages/zh/feedback/index.astro
  - src/pages/zh/global-safety.astro
  - src/pages/zh/improving-safety/index.astro
  - src/pages/zh/legal/index.astro
  - src/pages/zh/methodology/index.astro
  - src/pages/zh/most-dangerous-countries/index.astro
  - src/pages/zh/regions/africa/index.astro
  - src/pages/zh/regions/americas/index.astro
  - src/pages/zh/regions/asia/index.astro
  - src/pages/zh/regions/europe/index.astro
  - src/pages/zh/regions/middle-east/index.astro
  - src/pages/zh/regions/oceania/index.astro
  - src/pages/zh/safest-countries/index.astro
  - src/pages/zh/safest-for-families/index.astro
  - src/pages/zh/safest-for-solo-travelers/index.astro
  - src/pages/zh/sources/index.astro
  - src/pages/de/index.astro
  - src/pages/de/ueber-uns/index.astro
  - src/pages/de/vergleichen.astro
  - src/pages/de/laender-zu-meiden/index.astro
  - src/pages/de/land/[slug].astro
  - src/pages/de/sicherheit-verschlechtert-sich/index.astro
  - src/pages/de/einbettbares-abzeichen/index.astro
  - src/pages/de/feedback/index.astro
  - src/pages/de/globale-sicherheit.astro
  - src/pages/de/sicherheit-verbessert-sich/index.astro
  - src/pages/de/impressum/index.astro
  - src/pages/de/methodik/index.astro
  - src/pages/de/gefaehrlichste-laender/index.astro
  - src/pages/de/regionen/europa/index.astro
  - src/pages/de/regionen/afrika/index.astro
  - src/pages/de/regionen/amerika/index.astro
  - src/pages/de/regionen/asien/index.astro
  - src/pages/de/regionen/naher-osten/index.astro
  - src/pages/de/regionen/ozeanien/index.astro
  - src/pages/de/sicher-fuer-alleinreisende/index.astro
  - src/pages/de/sicher-fuer-familien/index.astro
  - src/pages/de/quellen/index.astro
  - src/pages/de/sicherste-laender/index.astro
findings:
  critical: 7
  high: 4
  medium: 5
  low: 3
  info: 2
  total: 21
status: findings
---

# Phase 38: Code Review Report

**Reviewed:** 2026-05-06T14:05:00Z
**Depth:** deep
**Files reviewed:** 56 source files (zh page tree, de page tree, affiliate config, i18n updates, SEO/scores helpers)
**Status:** findings (7 CRITICAL / 4 HIGH / 5 MEDIUM / 3 LOW / 2 INFO)

## Summary

Phase 38 succeeds at the **infrastructure level** — `src/i18n/ui.ts` correctly adds 7th-language `zh` and `de` blocks with the full 455-key set (no missing keys vs `en`), `routes.zh`/`routes.de` map all slugs, the page-tree directories match the route slugs, all 23 page templates exist for each new locale, FUNDING.yml is deleted, no `Ko-fi` references remain in `src/`, and the new Travelpayouts affiliate config (`src/config/affiliate.ts`) is XSS-safe (uses `encodeURIComponent`) and the Footer uses the correct `rel="noopener noreferrer sponsored"` and `target="_blank"`.

However, the **page-content level** is broken. The zh and de page templates were copy-pasted from the **English** counterparts and many of the localized differences applied to it/es/fr/pt were never reapplied. Concretely:

1. **Broken internal navigation**: ~7 hardcoded URL paths in `src/pages/de/*` use English route slugs (`/de/country/`, `/de/methodology/`, `/de/compare/`, `/de/sources/`) instead of the localized slugs that actually exist on disk (`/de/land/`, `/de/methodik/`, `/de/vergleichen/`, `/de/quellen/`). These produce **404s** in production.
2. **English text leaking onto German and Chinese pages**: page titles, breadcrumb dates, "Last update", "Reset", "Time range", "Italy vs France" example chips, and three full sentences on the about page render in English on `/de/` and `/zh/`.
3. **JSON-LD self-misidentification on every hub page**: 14 zh + 14 de hub pages hardcode `https://isitsafetotravel.org/en/...` URLs in their `ItemList` `url` and `ListItem.url` fields, telling Google these zh/de pages are duplicates of the English versions and sending search-bot traffic from `/zh/regions/europe/` to `/en/country/...`.
4. **`og:locale` meta tag broken on all zh/de pages** — the static map in `Base.astro` was not extended for zh/de, so `og:locale` is rendered with `undefined`.
5. **`localeMap` in 4 client-side scripts not extended for zh/de** — chart tooltip dates on `/de/globale-sicherheit/`, `/zh/global-safety/`, `/de/vergleichen/`, `/zh/compare/` and on country-page `TrendChart` for zh/de all fall back to `en-US` formatting.

The Travelpayouts changes are otherwise clean. Consequence: deploying as-is means the German page tree has ~half a dozen 404 internal links and English fallback strings throughout — the Chinese tree is less broken (zh slugs happen to coincide with English) but still has English UI text and broken JSON-LD.

The build/SEO validator passed (2186/2186) because it only checks hreflang link presence, not link target validity for hub pages, and does not detect untranslated body strings.

---

## Critical Issues

### CR-01: Five `/de/<english-slug>/` internal links are 404s

**Files:**
- `src/pages/de/land/[slug].astro:75`
- `src/pages/de/vergleichen.astro:37`
- `src/pages/de/quellen/index.astro:71`
- `src/pages/de/methodik/index.astro:104`
- `src/pages/de/globale-sicherheit.astro:87`

**Issue:** Each of these pages produces a link with the **English** route slug instead of the German one defined in `routes.de`. None of these target paths exist on disk (the actual pages live under `/de/land/`, `/de/vergleichen/`, `/de/quellen/`, `/de/methodik/`). Confirmed by listing `src/pages/de/`. Italian and French equivalents correctly use `${r.country}`, `${r.compare}`, `${r.sources}`, etc. — phase 38 copy-pasted the en source without applying the routes indirection.

Concrete broken targets:
| File | Generated URL | Actual page on disk |
|---|---|---|
| `de/land/[slug].astro:75` | `/de/country/<iso3>/` | `/de/land/<iso3>/` |
| `de/vergleichen.astro:37` | `/de/compare/` | `/de/vergleichen/` |
| `de/quellen/index.astro:71` | `/de/sources/` | `/de/quellen/` |
| `de/methodik/index.astro:104` | `/de/methodology/` | `/de/methodik/` |
| `de/globale-sicherheit.astro:87` | `/de/methodology/` | `/de/methodik/` |

**Fix:** Replace every hardcoded slug with the routes lookup, mirroring the it/fr pages. Example for `de/land/[slug].astro:75`:
```astro
import { routes } from '../../../i18n/ui';
const r = routes[lang];
// ...
{ label: getLocalizedCountryName(country, lang), href: `/${lang}/${r.country}/${country.iso3.toLowerCase()}/` },
```

### CR-02: German country detail page renders English title and "Last update:" text

**File:** `src/pages/de/land/[slug].astro:70` and `:79`

**Issue:**
- Line 70 hardcodes `title={`Is ${getLocalizedCountryName(country, lang)} Safe? ${country.score.toFixed(1)}/10 Safety Score (2026)`}` — every German country page has an English `<title>` and `og:title`.
- Line 79 hardcodes the visible body text `Last update:` and `toLocaleDateString('en-US', ...)` — German users see English label and English-formatted date.

The Italian page (`it/paese/[slug].astro:72`) and French page (`fr/pays/[slug].astro:72`) have correctly localized equivalents. Same regression in `src/pages/zh/country/[slug].astro:70` and `:79`.

**Fix:** Either add new translation keys (e.g. `country.page_title`, `country.last_update_label`) or follow the it/fr pattern of inlining the locale-specific string:
```astro
<Base lang={lang} title={`${getLocalizedCountryName(country, lang)} Sicher Reisen? Sicherheits-Score ${country.score.toFixed(1)}/10 (2026)`} ... >
  ...
  Letzte Aktualisierung: {new Date().toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
```
Apply equivalent fix in `src/pages/zh/country/[slug].astro`.

### CR-03: `pages/de/index.astro` Europe tile links to a 404

**File:** `src/pages/de/index.astro:50`

**Issue:**
```astro
{ key: 'hub.region.europe.title', route: `${routes[lang]['regions']}/europe` },
```
This produces `/de/regionen/europe/`, which does not exist. The actual page is `/de/regionen/europa/` (`routes.de['europe'] === 'europa'`). The `it`, `es`, `pt` homepages correctly use `europa`; the `de` homepage was copied from `en`/`fr` (which use `europe`) without adjusting. The other 5 region tiles on this page coincidentally work because their German slug also happens to equal the English one, except none of them do — `asia→asien`, `africa→afrika`, etc. Wait: this homepage only links to the Europe tile (the others are not in the static array), so the immediate impact is the Europe tile is a 404. *(See CR-04 for a related but separate problem with the other regions if they are added later.)*

**Fix:**
```astro
{ key: 'hub.region.europe.title', route: `${routes[lang]['regions']}/${routes[lang]['europe']}` },
```

### CR-04: `og:locale` meta tag is broken on every `/zh/` and `/de/` page

**File:** `src/layouts/Base.astro:67`

**Issue:**
```astro
<meta property="og:locale" content={{ en: 'en_US', it: 'it_IT', es: 'es_ES', fr: 'fr_FR', pt: 'pt_BR' }[lang]} />
```
The map literal does not include `zh` or `de`. For zh/de pages the lookup returns `undefined`, so Astro renders `<meta property="og:locale" content="">` (or `content="undefined"`). Every Open Graph consumer (Facebook, LinkedIn, WhatsApp, Slack previews) for the entire zh and de site loses its locale signal.

**Fix:**
```astro
<meta property="og:locale" content={{
  en: 'en_US',
  it: 'it_IT',
  es: 'es_ES',
  fr: 'fr_FR',
  pt: 'pt_BR',
  zh: 'zh_CN',
  de: 'de_DE',
}[lang]} />
```

### CR-05: All zh/de hub pages declare themselves as `/en/` in JSON-LD

**Files (28 total — every zh and de hub page):**
- `src/pages/zh/regions/{africa,americas,asia,europe,middle-east,oceania}/index.astro` (all hardcode `https://isitsafetotravel.org/en/regions/<slug>/`)
- `src/pages/zh/{safest-countries,most-dangerous-countries,countries-to-avoid,improving-safety,declining-safety,safest-for-families,safest-for-solo-travelers}/index.astro`
- `src/pages/de/regionen/{afrika,amerika,asien,europa,naher-osten,ozeanien}/index.astro`
- `src/pages/de/{sicherste-laender,gefaehrlichste-laender,laender-zu-meiden,sicherheit-verbessert-sich,sicherheit-verschlechtert-sich,sicher-fuer-familien,sicher-fuer-alleinreisende}/index.astro`

**Issue:** Each file declares `const canonicalUrl = 'https://isitsafetotravel.org/en/<slug>/'` (line 16) and uses it in the JSON-LD `url` field, then iterates `ranked.map((c, i) => ({ ..., url: `https://isitsafetotravel.org/en/country/${c.iso3.toLowerCase()}/` }))` (line ~29) for every `ListItem`.

Effects:
1. Search engines see the zh/de `ItemList` JSON-LD declaring itself as the en URL → potential merging/de-ranking of the localized version.
2. Every "View item" link from search-result rich-snippets points to `/en/country/<iso3>/` instead of `/zh/country/...` or `/de/land/...`, defeating the whole purpose of localizing these hub pages.
3. The `/en/` country URL is at least always valid for zh (since `routes.zh.country === 'country'`), but for de the structured data points to an English URL even though the de page tree exists.

This is a copy-paste from `src/pages/en/regions/europe/index.astro:16` that should have been adjusted. The `it`, `es`, `fr`, `pt` equivalents do **not** declare a hardcoded canonical (they let `<link rel=canonical>` derive from `Astro.url` in `Base.astro` and either omit `url` from JSON-LD or compute it from `lang`).

**Fix:** For every affected file, replace the constant and the `ListItem` URL builder. Example for `src/pages/zh/regions/europe/index.astro`:
```astro
import { routes } from '../../../../i18n/ui';
const r = routes[lang];
const canonicalUrl = `https://isitsafetotravel.org/${lang}/${r.regions}/${r.europe}/`;
// ...
itemListElement: ranked.map((c, i) => ({
  '@type': 'ListItem',
  position: i + 1,
  name: getLocalizedCountryName(c, lang),
  url: `https://isitsafetotravel.org/${lang}/${r.country}/${c.iso3.toLowerCase()}/`,
}))
```
Apply the same substitution to all 28 files (with the right route key per page).

### CR-06: Hardcoded English body sentences on `de/ueber-uns` and `zh/about`

**Files:**
- `src/pages/de/ueber-uns/index.astro:49,56,63`
- `src/pages/zh/about/index.astro:49,56,63`

**Issue:** Three full sentences are hardcoded in English on the German and Chinese about pages, even though the translation keys `about.sources_text`, `about.opensource_text`, `about.contact_text` are correctly defined for both `de` (lines 3139–3142 in ui.ts) and `zh` (lines 2682–2687). The it/fr/es/pt about pages correctly use `t('about.sources_text').split('{methodology_link}')[0]` etc.

Concrete examples:
- de/zh line 49: `We aggregate data from 9+ public sources updated daily. See our <a ...>...</a> for full details on how scores are calculated.`
- de/zh line 56: `This project is fully open source. View the source code, report issues, or contribute on <a ...>GitHub</a>.`
- de/zh line 63: `For questions, feedback, or data inquiries, reach out via <a ...>...</a>.`

**Fix:** Mirror the it pattern. Example for `de/ueber-uns/index.astro:49`:
```astro
{t('about.sources_text').split('{methodology_link}')[0]}<a href={`/${lang}/${r.methodology}/`} ...>{t('about.methodology_link_text')}</a>{t('about.sources_text').split('{methodology_link}')[1]}
```
Repeat for lines 56 and 63 with the corresponding `about.opensource_text` / `about.contact_text` keys, and apply the same fix to `zh/about/index.astro`.

### CR-07: Embed-badge initial render hardcodes `/en/` URLs on zh and de pages

**Files:**
- `src/pages/zh/embed-badge/index.astro:72,88`
- *(de equivalent in `src/pages/de/einbettbares-abzeichen/index.astro:72,88` — the file does the same pattern as zh)*

**Issue:** The initial server-rendered HTML/Markdown embed snippet in the textarea hardcodes `https://isitsafetotravel.org/en/country/${countries[0]?.iso3.toLowerCase()}/` (line 72 HTML, line 88 Markdown). The script handler at line 112–113 correctly uses the page's `lang` once the user changes the dropdown — but if a German or Chinese user copies the snippet without interacting first, they get an English country link in the embed code they put on their site.

**Fix:** Replace `/en/country/` with `/${lang}/${r.country}/` in lines 72 and 88 of both files (the zh file already imports `r` at line ~13 — same for de).
```astro
>{`<a href="https://isitsafetotravel.org/${lang}/${r.country}/${countries[0]?.iso3.toLowerCase()}/"><img ...></a>`}</textarea>
```

---

## High

### HI-01: Hardcoded English UI strings on de/zh `compare` and `global-safety` pages

**Files:**
- `src/pages/de/vergleichen.astro:307-308,429,438,443`
- `src/pages/zh/compare.astro:307-308,429,438,443`
- `src/pages/de/globale-sicherheit.astro:61,68`
- `src/pages/zh/global-safety.astro:61,68`

**Issue:** Several English strings are hardcoded in the client-side script and inline JSX:
- `Italy vs France` and `Japan vs Australia` example buttons (`compare.astro` line 307-308) — German/Chinese users see English suggestion chips.
- `Historical data is still accumulating. Check back soon.` (compare.astro line 429) — falls back to English even though `compare.history_accumulating` could be added.
- `Reset` button text (compare.astro line 438; global-safety line 68) — English on German/Chinese pages.
- `aria-label="Time range"` (compare.astro line 443; global-safety line 61) — accessibility label is English.

These also exist in pre-existing it/es/fr/pt pages, but those locales' speakers don't notice as much. Phase 38 reproduced the bug because the implementation copy-pasted from en. Recommendation: extract to translation keys (e.g. `compare.example_btn_1`, `compare.history_accumulating`, `chart.reset`, `chart.time_range_label`) once and reuse across all 7 locales.

**Fix:** Add new keys to `src/i18n/ui.ts` and replace hardcoded literals with `t()` calls or `data-` attributes for the script-side strings (the same data-attribute pattern already used for `data-no-results`, `data-search`, etc. in `Search.astro`).

### HI-02: `localeMap` in 4 page scripts and 1 shared component lacks `zh` and `de`

**Files:**
- `src/pages/de/globale-sicherheit.astro:400`
- `src/pages/zh/global-safety.astro:400`
- `src/pages/de/vergleichen.astro:723`
- `src/pages/zh/compare.astro:723`
- `src/components/country/TrendChart.astro:545` (shared component used by all country pages)

**Issue:** Each script declares:
```ts
const localeMap: Record<string, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR' };
const dateStr = d.toLocaleDateString(localeMap[lang] || 'en-US', { ... });
```
For `lang === 'zh'` or `lang === 'de'`, the lookup misses and the formatter falls back to `'en-US'`. Chart tooltip dates on the German global-safety page, German compare page, Chinese global-safety, Chinese compare, and country detail trend chart for zh/de all render English-formatted dates (e.g. `Mar 27, 2026`). The TrendChart issue particularly affects every country detail page (~480 pages).

The same `localeMap` already exists fully populated in `src/lib/seo.ts:6` and `src/components/country/AnswerFirstParagraph.astro:15` — these were correctly updated. The four scripts above were missed.

**Fix:** Add `zh: 'zh-CN', de: 'de-DE'` to each `localeMap` literal. Better: extract a single shared `BCP47_LOCALES` constant from `src/i18n/ui.ts` (or a new `src/i18n/locales.ts`) and import it everywhere, so the next language addition is a one-line change.

### HI-03: Affiliate marker is the placeholder `'000000'` in production

**File:** `src/config/affiliate.ts:15`

**Issue:**
```ts
export const TRAVELPAYOUTS_MARKER = '000000';
```
The Footer renders an affiliate URL `https://tp.media/r?marker=000000&u=https%3A%2F%2Fsearch.travelpayouts.com%2F` for every visitor on every page. With production traffic now flowing, every click is being sent to Travelpayouts with `marker=000000` — Travelpayouts will either reject these as invalid, attribute them to no partner, or (in the worst case) attribute them to a default account that is not yours. Until the real marker is filled in, the affiliate revenue is zero and the user experience suffers (confusing redirect target).

The TODO comment on line 14 documents the placeholder — this is intentional per the phase plan — but flagging because the change has shipped and is now generating production traffic (per `STATE.md` and recent commits).

**Fix:** Either (a) fill in the real Travelpayouts marker before the next deploy, or (b) until then, hide the Footer affiliate CTA when `TRAVELPAYOUTS_MARKER === '000000'`:
```astro
---
import { TRAVELPAYOUTS_MARKER, buildAffiliateUrl } from '../config/affiliate';
const showAffiliate = TRAVELPAYOUTS_MARKER !== '000000';
const affiliateUrl = showAffiliate ? buildAffiliateUrl() : null;
---
{showAffiliate && (
  <a href={affiliateUrl} target="_blank" rel="noopener noreferrer sponsored" ...>{t('donate.travelpayouts_btn' as any)}</a>
)}
```

### HI-04: Country names on `/zh/` and `/de/` pages are all English

**Files (data layer):** `src/pipeline/config/countries.ts:4-...` (every entry has `name: { en, it, es, fr, pt }` — no `zh` or `de` key)
**Files (consumer):** `src/lib/scores.ts:153-158` (`getLocalizedCountryName` falls back to `country.name.en` when `zh`/`de` is missing)

**Issue:** Although `routes.zh` and `routes.de` add localized URLs and the `ui.zh`/`ui.de` translation blocks are complete, every country name on every zh/de page (homepage list, country detail H1, breadcrumbs, search results, related countries, compare chips) renders in English because the `COUNTRIES` array does not have zh or de translations. So a Chinese visitor on `/zh/country/cn/` sees `<h1>China</h1>` (English) instead of `中国`. The helper's JSDoc explicitly documents this as a known limitation.

This is *by design* per the phase plan ("Country names for zh and de should fall back to the en country names if no translation file exists"), but the i18n outcome is materially poor — it undermines a primary value of the localization (German users see Chinese country names in English on the German Chinese country page). Worth flagging because the phase summary marks i18n as "complete".

**Fix:** Either (a) add `zh` and `de` keys to the 248 entries in `src/pipeline/config/countries.ts`, or (b) introduce a dedicated `src/data/country-names-zh.json` / `src/data/country-names-de.json` lookup that the helper reads when `lang === 'zh' | 'de'` and the snapshot lacks the key. Option (a) is mechanical (translate 248 short names) and matches the existing 5-language pattern.

---

## Medium

### ME-01: zh and de homepages omit the other 5 region tiles

**Files:** `src/pages/zh/index.astro:48-53`, `src/pages/de/index.astro:48-53`

**Issue:** The "Popular Rankings" array on the homepages includes only one region tile (Europe). The en homepage (line 50) and the it/es/fr/pt homepages have the same single-region pattern, so this is consistent with the rest of the codebase — but it is also a missed opportunity to surface the zh/de region pages in their respective homepages now that the trees exist. Mentioning here because the phase delivered 6 region pages per locale that are otherwise discoverable only via direct URL or footer-derived links.

**Fix (optional):** Add the other 5 regions to the array. Each tile must use `${routes[lang]['regions']}/${routes[lang]['<region-key>']}` to keep the URL valid (cf. CR-03).

### ME-02: Compare page Breadcrumb on de/zh hardcodes English slug

**Files:**
- `src/pages/de/vergleichen.astro:37`
- `src/pages/zh/compare.astro:37`

**Issue:** `{ label: t('nav.compare'), href: `/${lang}/compare/` }`. For de this is `/de/compare/` (404 — actual page is `/de/vergleichen/`). For zh this works only because `routes.zh.compare === 'compare'`.

This is technically already covered under CR-01 for de (the broken-link hit list), but called out explicitly here because the zh case is a latent bug — if zh slugs are ever localized, this breaks silently.

**Fix:** `href: `/${lang}/${routes[lang].compare}/`` and import `routes` (already imported in zh/de country detail pages).

### ME-03: `legacy `donate` route slug and `donate.*` translation keys are dead code

**Files:**
- `src/i18n/ui.ts:3254` (`donate: 'donate'` in routes.en) and equivalents in routes.it/es/fr/pt/zh/de (lines 3280, 3306, 3332, 3358, 3384, 3410)
- `src/i18n/ui.ts:367` (`'nav.donate': 'Support Us'`) and equivalents in 6 other locales
- `src/i18n/ui.ts:356-366` (`donate.title`, `donate.description`, `donate.heading`, `donate.intro`, `donate.github_*`, `donate.thanks`) and equivalents in 6 other locales

**Issue:** Phase 38 deleted the `/donate/` page tree but left the route slug `donate: 'donate'` (or `dona`/`spenden`/etc.) in `routes` and kept all `donate.*` translation keys. The only `donate.*` key still consumed anywhere is `donate.travelpayouts_btn` (Footer.astro line 81). The unused keys total ~63 strings × 7 locales = ~440 dead translation entries. `nav.donate` is also unused.

**Fix:** Remove from each locale block: `donate.title`, `donate.description`, `donate.heading`, `donate.intro`, `donate.github_title`, `donate.github_desc`, `donate.github_btn`, `donate.thanks`, `donate.travelpayouts_title`, `donate.travelpayouts_desc`, `nav.donate`. Keep only `donate.travelpayouts_btn` (or rename to `nav.deals` / `cta.travelpayouts`). Remove `donate` from each `routes[lang]` map.

### ME-04: `Search.astro` injects country `name` via `innerHTML` without escaping

**File:** `src/components/Search.astro:142`

**Issue:**
```ts
listbox.innerHTML = items.map((item, i) => `... <span>${item.name}</span> ...`).join('');
```
`item.name` is the country name from `getLocalizedCountryName(c, lang)`, sourced from the trusted `COUNTRIES` config or snapshot. No special characters are currently used. Phase 38 changed this line from `c.name[lang]` to `getLocalizedCountryName(c, lang)` (functionally equivalent), so this is a **pre-existing latent bug**, not a phase 38 regression. Flagging because:
1. Adding zh/de country names later (per HI-04) opens a path for an upstream content provider to introduce HTML-special characters that break the search dropdown rendering or, worst case, allow XSS if an attacker controls the data feed.
2. The same pattern exists in `vergleichen.astro:194` and `compare.astro:194` and similar.

**Fix:** Use `textContent` for the name span, or escape with a small helper:
```ts
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// ...
`<span>${esc(item.name)}</span>`
```

### ME-05: `ScoreHero.astro` `Intl.DateTimeFormat(lang, ...)` may produce inconsistent zh formatting

**File:** `src/components/country/ScoreHero.astro:57`

**Issue:**
```ts
const formattedDate = new Intl.DateTimeFormat(lang, { ... }).format(new Date(country.lastUpdated));
```
Passing `'zh'` to `Intl.DateTimeFormat` resolves to the runtime's default Chinese variant (typically `zh-Hans` on most browsers, but `zh-Hant` is possible). The rest of the codebase (e.g. `localeMap` in `lib/seo.ts`) uses `'zh-CN'` (Simplified). On a country detail page, this can produce an inconsistent date format vs. the JSON-LD `inLanguage` field. Same minor concern for `de` (resolves to `de-DE` typically). Pre-existing pattern (en/it/etc. used `lang` directly), but exposed by zh/de.

**Fix:** Pass the BCP-47 form via a shared map:
```ts
import { BCP47 } from '../../i18n/locales';  // new file
const formattedDate = new Intl.DateTimeFormat(BCP47[lang], { ... }).format(new Date(country.lastUpdated));
```

---

## Low

### LO-01: `routes.zh` is identical to `routes.en`, undermining localized URLs

**File:** `src/i18n/ui.ts:3377-3402`

**Issue:** Every entry in `routes.zh` is the English string. The phase plan stated "Translate route segments in `routes` object for `zh` and `de` (e.g., methodology, sources, legal, donate, compare, etc.). Use natural localizations matching existing pattern." This was done for `de` (`land`, `methodik`, `vergleichen`, etc.) but skipped for `zh`. As a result, Chinese visitors see English URLs (`/zh/methodology/`, `/zh/safest-countries/`), losing localization SEO benefit. Probably an intentional choice given Chinese URL practice (transliterated pinyin would be unusual), but flagging because it's inconsistent with the phase plan and creates dead-weight indirection (`routes.zh.country` always equals `'country'`).

**Fix:** Either document the decision in a comment in `ui.ts`, or replace with pinyin slugs (e.g. `country: 'guojia'`, `methodology: 'fangfa'`).

### LO-02: TrendChart `localeMap` truncation is in shared component used by all locales

**File:** `src/components/country/TrendChart.astro:545` (already in HI-02 — restated as low-pri standalone observation that the type annotation is `Record<string, string>` not `Record<Lang, string>`)

**Issue:** Because the type is `Record<string, string>`, TypeScript does not warn when `zh`/`de` are missing — the compiler accepts the truncated literal. Tightening to `Record<Lang, string>` would have caught HI-02 at build time.

**Fix:**
```ts
import type { Lang } from '../../i18n/ui';
const localeMap: Record<Lang, string> = { en: 'en-US', it: 'it-IT', es: 'es-ES', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN', de: 'de-DE' };
```

### LO-03: `Footer.astro` uses `t('...' as any)` for keys that exist in every locale

**File:** `src/components/Footer.astro:31,37,43,81`

**Issue:** `t('hub.safest_countries.title' as any)`, `t('hub.dangerous_countries.title' as any)`, `t('badge.title' as any)`, `t('donate.travelpayouts_btn' as any)`. All four keys are present in the `en` block (and in zh/de/es/etc.), so the `as any` cast is a workaround for a stale type signature in `useTranslations`. The cast hides any future typo or missing key. Pattern is widespread elsewhere in the codebase, but worth noting.

**Fix:** Update `useTranslations` return type to accept all keys present in any locale block (e.g. `keyof (typeof ui)[typeof defaultLang]` already does this — `en` is the source of truth).

---

## Info

### IN-01: TODO marker is intentional and clearly documented

**File:** `src/config/affiliate.ts:14`

**Note:** `// TODO: replace with real Travelpayouts marker (6-digit string from dashboard)` is the only TODO in the new code. It is documented in the file's JSDoc and in the phase plan. No action needed beyond filling in the marker (HI-03).

### IN-02: Sitemap chunking and i18n config correctly include zh/de

**File:** `astro.config.mjs:88-122`

**Note:** The sitemap `i18n.locales` map adds `zh` and `de`, the per-locale chunk filters include both, and the `i18n.locales` Astro config (line 132) includes both. The `validate-seo.ts` `LANGUAGES` constant (line 14) and `COUNTRY_SEGMENT` (line 17–25) include both new locales with the correct slug (`country` for zh, `land` for de). No issues found in build configuration.

---

_Reviewed: 2026-05-06T14:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
