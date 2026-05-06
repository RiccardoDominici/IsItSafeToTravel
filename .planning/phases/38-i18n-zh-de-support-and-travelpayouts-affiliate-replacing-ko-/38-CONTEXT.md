---
phase: 38
phase_name: i18n zh+de support and Travelpayouts affiliate replacing Ko-fi
gathered: 2026-05-06
status: ready-for-planning
mode: auto-generated
---

# Phase 38: i18n zh+de support and Travelpayouts affiliate replacing Ko-fi - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous run — no questions per user instruction "non chiedere niente")

<domain>
## Phase Boundary

Two independent deliverables in one phase:

1. **Add Chinese (zh) and German (de) language support** — extend the multilingual site (currently en/it/es/fr/pt = 5 languages) to 7 languages. Translate all UI strings, route segments, and per-locale page exports. Generate localized routes for `/zh/` and `/de/` so all existing pages render in the new languages.
2. **Replace Ko-fi donation widget with Travelpayouts affiliate CTA** — remove the floating Ko-fi chat widget (currently in `src/layouts/Base.astro` lines 119–127), the `/donate` Ko-fi pages, and all `donate.kofi_*` strings, then add a Travelpayouts-based monetization element (affiliate link / banner / widget snippet) that fits the site's neutral, trustworthy tone.

Both items are user-stated TODOs queued since 2026-05-03 (per project memory).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion (autonomous mode — no user questions per instruction)

All implementation choices are at Claude's discretion. Use ROADMAP phase goal, codebase conventions, and the following sensible defaults:

**i18n zh+de:**
- Extend `src/i18n/ui.ts` `languages` map with `zh: '中文'` and `de: 'Deutsch'`.
- Add full `zh:` and `de:` translation blocks (mirror the en block as the source of truth — all keys present, no missing keys).
- Translate route segments in `routes` object for `zh` and `de` (e.g., methodology, sources, legal, donate, compare, etc.). Use natural localizations matching existing pattern.
- Create `src/pages/zh/` and `src/pages/de/` directory trees mirroring existing locale dirs (en, it, es, fr, pt). Each page should follow the existing per-locale page structure (Astro page exports per language).
- Country names for zh and de should fall back to the en country names if no translation file exists; if `src/data/country-names-{lang}.json` files exist for other locales, generate equivalent files for zh and de.
- Update `<html lang>`, hreflang alternate links, and sitemap generation to include zh and de.
- Update country detail pages, methodology, about, sources, legal, and any per-locale routing logic.

**Travelpayouts replacement:**
- Remove Ko-fi floating widget script and `kofiWidgetOverlay` invocation from `src/layouts/Base.astro`.
- Remove all `donate.kofi_*` translation keys (en, it, es, fr, pt) and add equivalent `donate.travelpayouts_*` keys.
- Replace the `/donate` page (per locale) with a "Support / Travel Deals" page that uses Travelpayouts. Since the user has not provided a specific affiliate marker/partner ID, use a documented placeholder constant (e.g., `TRAVELPAYOUTS_MARKER` in a config file) the user can fill in later. Default link target: Travelpayouts white-label search page or a generic affiliate URL pattern (`https://tp.media/r?marker={MARKER}&...`) so swapping in the real ID is one-line.
- Replace the floating Ko-fi widget with either: (a) a small inline footer CTA "Find safe flights & hotels" linking to the affiliate, OR (b) a sitewide subtle Travelpayouts widget script. Choose option (a) — less intrusive, brand-consistent, no third-party heavy script.
- Update the `nav.donate` translation key (or rename to `nav.deals`) to match the new CTA wording.
- Update FUNDING.yml — remove ko_fi entry if it points to ko-fi.

**Marker placeholder:** Use `TRAVELPAYOUTS_MARKER = '000000'` as default with a clear `// TODO: replace with real Travelpayouts marker` comment. The user will provide the real marker when ready.

</decisions>

<code_context>
## Existing Code Insights

- **`src/i18n/ui.ts`** (2454 lines) — flat object literal with one block per language. Keys at lines: en (13), it (476), es (937), fr (1398), pt (1859). The `routes` export starts at line 2323 with same per-language structure. New language blocks must be inserted following the existing pattern. Each block has ~460 keys.
- **`src/i18n/utils.ts`** — `getLangFromUrl`, `useTranslations(lang)`, `getRouteFromUrl`, `getLocalizedPath`, `getAlternateLinks`. Already generic over `Lang` type, so adding zh/de to `languages` map flows through automatically.
- **`src/layouts/Base.astro` lines 119–127** — Ko-fi widget script + `kofiWidgetOverlay.draw('isitsafetotravel', ...)`. Remove these lines.
- **`src/pages/`** — per-locale directories `en/`, `es/`, `fr/`, `it/`, `pt/`, plus root `index.astro`, `404.astro`, `compare.astro`, `global-safety.astro`. Each locale dir has same page set (about, country, methodology, sources, legal, donate, etc.). Phase 38 must create matching `zh/` and `de/` dirs.
- **`astro.config.mjs`** — has sitemap integration and hreflang generation logic. Needs update to include zh and de.
- Phases 15 (Spanish) and prior i18n work establish the pattern: full translation block + per-locale page tree + routes mapping + hreflang.

</code_context>

<specifics>
## Specific Ideas

1. **Translations for zh/de**: Use natural, professional translations. For zh use Simplified Chinese (zh-CN) — most common audience. For de use standard High German (de-DE).
2. **Travelpayouts CTA placement**: Single inline link/banner in footer + a dedicated `/deals` page per locale (renamed from `/donate`). Keep the change minimally intrusive.
3. **Backwards compatibility**: Ko-fi donation pages should redirect or be deleted cleanly — no orphan routes. Update sitemap to drop ko-fi-only paths.
4. **Test coverage**: Add a simple test verifying `languages` includes zh and de, and that `useTranslations('zh')` and `useTranslations('de')` return non-fallback strings for at least the core nav keys.

</specifics>

<deferred>
## Deferred Ideas

- Specific Travelpayouts affiliate marker/partner ID — user will provide later. Code uses a documented placeholder.
- Per-country deal recommendations (e.g., "Find flights to Italy") — out of scope for this phase. Focus on sitewide CTA only.
- Additional languages beyond zh and de — out of scope.
- Revising the donations / about page tone now that monetization shifts from "donate" to "affiliate" — minimal copy adjustments only.

</deferred>
