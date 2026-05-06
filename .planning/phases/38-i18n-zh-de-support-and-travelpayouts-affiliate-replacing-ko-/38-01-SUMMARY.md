---
phase: 38
plan: 01
subsystem: i18n
tags: [i18n, translations, zh, de, locales, foundation]
provides:
  - languages-map-includes-zh-and-de
  - ui.zh-block-455-keys
  - ui.de-block-455-keys
  - routes.zh-with-english-slugs
  - routes.de-with-german-slugs
  - publishedLanguages-gate-for-hreflang
requires:
  - existing-en-block-as-template
  - existing-routes-en-as-template
affects:
  - src/i18n/ui.ts
  - src/i18n/utils.ts (getAlternateLinks now uses publishedLanguages)
tech-stack:
  added: []
  patterns:
    - "publishedLanguages constant gates hreflang emission separately from Lang type"
key-files:
  created: []
  modified:
    - src/i18n/ui.ts (+916 lines)
    - src/i18n/utils.ts (+9 lines, -3 lines)
decisions:
  - "publishedLanguages = ['en','it','es','fr','pt'] introduced to keep hreflang sound until plan 02 builds /zh/ and /de/ pages"
  - "zh route slugs left in English (country, about, methodology) — CJK in URLs hurts SEO and Cloudflare routing; aligns with Astro routing best practice for international audiences"
  - "de route slugs use ASCII transliteration (ueber-uns, methodik, gefaehrlichste-laender) — keeps URLs hyphenated and crawler-friendly, no umlauts"
  - "Translations written in idiomatic Simplified Chinese (zh-CN) and standard High German (de-DE) with formal Sie register, matching tone of existing fr/pt blocks"
  - "Ko-fi keys (donate.kofi_*) kept in zh and de as instructed; plan 03 will swap them for Travelpayouts across all 7 blocks at once"
metrics:
  duration_seconds: 1940
  duration_minutes: 32.3
  task_count: 3
  file_count: 2
  completed: 2026-05-06
---

# Phase 38 Plan 01: Add zh and de translation blocks to i18n/ui.ts Summary

**One-liner:** Foundation for the multilingual rollout — 7 languages now type-recognised (`en`, `it`, `es`, `fr`, `pt`, `zh`, `de`), with full Simplified Chinese and standard High German translation blocks (455 keys each, 1:1 parity with `ui.en`) plus localised route slugs ready for plan 02's per-locale page tree.

## What Was Built

### 1. Extended `languages` map (src/i18n/ui.ts:1–9)

Added `zh: '中文'` and `de: 'Deutsch'`, taking the type union `Lang` from `'en' | 'it' | 'es' | 'fr' | 'pt'` to `'en' | 'it' | 'es' | 'fr' | 'pt' | 'zh' | 'de'`. The `useTranslations()`, `getLangFromUrl()`, `getRouteFromUrl()`, and `getLocalizedPath()` consumers in `src/i18n/utils.ts` automatically flow through because they're generic over the `Lang` type.

### 2. Full `ui.zh` block (455 translation keys)

Inserted between `ui.pt` and the closing `} as const;` of the `ui` object. Every key from `ui.en` (lines 13–475) has a corresponding idiomatic Simplified Chinese (zh-CN) translation. Placeholder tokens (`{name}`, `{score}`, `{date}`, `{percent}`, `{riskLevel}`, `{weakestPillar}`, `{weakestScore}`, `{strongestPillar}`, `{strongestScore}`, `{sourceCount}`, `{level}`, `{count}`, `{source}`, `{pillar}`, `{methodology_link}`, `{github_link}`, `{github_issues_link}`, `{feedback_link}`) are preserved verbatim. Diff against `ui.en` keys: zero missing, zero extra.

### 3. Full `ui.de` block (455 translation keys)

Inserted after `ui.zh`. Standard High German (de-DE) with formal "Sie" register matching the tone of the existing fr/pt blocks. Same 1:1 key parity with `ui.en`.

### 4. `routes.zh` and `routes.de` (24 entries each)

Inserted into the `routes` export. `routes.zh` slugs are intentionally English to maximise SEO clarity (CJK characters URL-encode to `%E4%B8%AD%E6%96%87`-style strings that hurt crawl quality). `routes.de` slugs use German with ASCII transliteration for umlauts (`land`, `ueber-uns`, `methodik`, `impressum`, `globale-sicherheit`, `vergleichen`, `spenden`, `quellen`, `sicherste-laender`, `gefaehrlichste-laender`, `regionen`, `sicher-fuer-alleinreisende`, `sicher-fuer-familien`, `laender-zu-meiden`, `sicherheit-verbessert-sich`, `sicherheit-verschlechtert-sich`, `einbettbares-abzeichen`, `europa`, `asien`, `afrika`, `amerika`, `ozeanien`, `naher-osten`, `feedback`).

### 5. `publishedLanguages` gate + hreflang fix

The `getAlternateLinks()` helper iterates over the `languages` map to emit hreflang tags. Adding zh/de to `languages` immediately caused every page to emit hreflang URLs to `/zh/` and `/de/` paths — but those page trees are created in plan 02. The post-build SEO validator (`scripts/validate-seo.ts`) failed on 130 broken hreflang links, breaking the auto-deploy pipeline.

Introduced `publishedLanguages = ['en','it','es','fr','pt'] as const` in `src/i18n/ui.ts` and updated `getAlternateLinks()` in `src/i18n/utils.ts` to iterate that constant instead. When plan 02 lands the /zh/ and /de/ page trees, it just appends those keys to `publishedLanguages` and hreflang flips on automatically.

## Sample Translations Table (5 most-used keys)

| Key | en | zh | de |
|-----|------|------|------|
| `nav.home` | Home | 首页 | Startseite |
| `nav.about` | About | 关于我们 | Über uns |
| `hero.title` | Is your destination safe? | 你的目的地安全吗？ | Ist Ihr Reiseziel sicher? |
| `country.pillar.conflict` | Conflict | 冲突 | Konflikt |
| `country.score_label` | Safety Score | 安全评分 | Sicherheitsbewertung |

## Intentional Non-Literal Translations

A handful of translations diverge from a strict word-for-word rendering for natural-language reasons:

- **`donate.thanks`** (zh): Uses 由衷感谢 ("from the depth of our hearts thank") rather than literal "from the bottom of our hearts" — the Chinese idiom preserves emotional weight without an awkward calque.
- **`country.out_of`** (zh): Translated as 满分 10 ("full mark 10") instead of literal "out of 10" — Chinese scoring vocabulary uses 满分 idiomatically.
- **`hub.region.europe.intro`** (de): Compresses "From the Nordic nations to the Mediterranean" to "Vom Norden bis zum Mittelmeer" — German naturally drops the "Nordic nations" qualifier when paired with "Mittelmeer".
- **`feedback.email_placeholder`** (zh): Uses `name@example.com` instead of `john@example.com` because `张三` (the standard placeholder name in zh) doesn't pinyin-match common email patterns; using the generic `name@` mirrors how Chinese UX writes example emails.
- **Route slugs (zh)**: Kept in English rather than transliterated to pinyin (`安全国家` would URL-encode to a 30+ character `%E5%AE%89%E5%85%A8...` string). English slugs preserve crawl-friendliness and are consistent with how international Chinese users actually search.

## File Line Count Delta

| File | Before | After | Δ |
|------|--------|-------|---|
| src/i18n/ui.ts | 2,454 | 3,429 | +975 |
| src/i18n/utils.ts | 60 | 66 | +6 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `publishedLanguages` gate to keep hreflang sound until plan 02**
- **Found during:** Final build verification (`npm run build`)
- **Issue:** Adding zh/de to the `languages` map caused `getAlternateLinks()` to emit hreflang tags pointing to non-existent `/zh/` and `/de/` pages. The post-build SEO validator (`scripts/validate-seo.ts`) flagged 130 broken hreflang links and exited with code 1, which would break the auto-deploy pipeline (per project memory `feedback_always_deploy.md`).
- **Fix:** Introduced `publishedLanguages = ['en','it','es','fr','pt'] as const` in `src/i18n/ui.ts` and updated `getAlternateLinks()` to iterate it instead of the full `languages` map. Plan 02 will append zh/de to `publishedLanguages` once the page trees exist.
- **Files modified:** src/i18n/ui.ts (+8 lines), src/i18n/utils.ts (+6 lines, -3 lines)
- **Commit:** 78ed1b7

**2. [Out of scope — flagged for plan 02] TypeScript errors in downstream consumers**
- 44 new TS errors appeared in components and pages where `Record<Lang, X>` literals are hardcoded with only en/it/es/fr/pt entries (e.g. `src/components/country/AnswerFirstParagraph.astro`, `src/components/country/StatsSummary.astro`, `src/components/country/RelatedCountries.astro`, `src/components/Search.astro`, `src/components/country/ScoreHero.astro`, `src/lib/seo.ts`, plus `astro.config.mjs` hreflang map). These are *not* runtime errors — the production build succeeds (1352 pages built, 1354/1354 SEO checks pass) — they are TypeScript exhaustiveness errors that surface only via `npx astro check`.
- Per the plan's `files_modified: src/i18n/ui.ts` scope and CONTEXT.md ("Create `src/pages/zh/` and `src/pages/de/` directory trees"), these are explicitly partitioned to plan 02. NOT auto-fixed in this plan to respect SCOPE BOUNDARY.
- **Action:** Plan 02 should add `zh:` and `de:` entries to every per-locale Record literal in components and update `astro.config.mjs` hreflang generation.

## Verification Results

```
=== UI keys ===
ZH unique keys: 455 (matches en exactly)
DE unique keys: 455 (matches en exactly)
Diff vs en: zero missing, zero extra

=== Routes ===
routes.zh: 24 entries (matches routes.en)
routes.de: 24 entries (matches routes.en)

=== Build ===
npm run build: EXIT 0
1352 pages built in 290s
1354/1354 SEO checks PASSED

=== Locked translations present ===
'nav.home': '首页'              OK
'hero.title': '你的目的地安全吗？'  OK
'country.pillar.conflict': '冲突' OK
'nav.home': 'Startseite'         OK
'hero.title': 'Ist Ihr Reiseziel sicher?' OK
'country.pillar.conflict': 'Konflikt' OK
country: 'land'                   OK
about: 'ueber-uns'                OK
methodology: 'methodik'           OK
compare: 'vergleichen'            OK
regions: 'regionen'               OK
```

## Commits

- `76655fc` feat(38-01): add Chinese (zh-CN) translation block to i18n/ui.ts
- `7fd9190` feat(38-01): add German (de-DE) translation block to i18n/ui.ts
- `78ed1b7` feat(38-01): add zh+de routes and gate hreflang to published locales

## Self-Check: PASSED

- [x] `src/i18n/ui.ts` modified — confirmed via `grep -q "zh: '中文'"` and `grep -q "de: 'Deutsch'"`
- [x] `src/i18n/utils.ts` modified — confirmed via `grep -q "publishedLanguages"`
- [x] Commit `76655fc` exists — confirmed via `git log`
- [x] Commit `7fd9190` exists — confirmed via `git log`
- [x] Commit `78ed1b7` exists — confirmed via `git log`
- [x] Production build succeeds (`npm run build` exit 0)
- [x] All 1354 post-build SEO checks pass

## Notes for Plan 02

When plan 02 builds the `/zh/` and `/de/` page trees, append `'zh', 'de'` to the `publishedLanguages` array in `src/i18n/ui.ts` to enable hreflang emission for the new locales. Update the per-locale `Record<Lang, X>` literals listed under "Deviations from Plan #2" with zh and de entries to clear the cascading TS errors. Also update `scripts/validate-seo.ts` `LANGUAGES` constant to include `'zh', 'de'` so the validator checks the new trees.
