---
quick_id: 260507-vux
slug: travelpayouts-flight-widget
date: 2026-05-07
status: complete
---

# Travel Deals Widget — Summary

Built a custom Aviasales-powered flight search widget and embedded it on every
home page and country detail page (7 locales), replacing the previously
invisible footer-only Travelpayouts CTA with a high-intent monetization
surface above the fold on country pages.

## What was built

1. **`src/lib/iata-cities.ts`** — `getMainCityIata(iso3)` and
   `getMainCityName(iso3, lang)` mapping for 50 most-trafficked countries
   covering the seven UI locales (en/it/es/fr/pt/zh/de) with English fallback.
2. **`src/components/TravelDealsWidget.astro`** — a styled card containing a
   plain HTML GET form that submits directly to
   `https://search.aviasales.com/flights/` with hidden inputs for `marker`
   (526093, imported from `src/config/affiliate.ts`), `locale`, and `adults=1`,
   plus visible inputs for destination, depart date (default = today + 30
   days), and optional return date. Country mode shows pre-filled destination
   and `"Find safe flights to {country}"` heading; home mode shows free-text
   destination and a generic CTA. Zero JavaScript — browser builds the URL
   from form fields. `target="_blank"` + `rel="noopener noreferrer sponsored"`.
3. **`src/i18n/ui.ts`** — added 8 new `deals.widget.*` keys to all 7 locale
   blocks, totalling 56 new translation lines.
4. **Country detail pages (7 locales)** — embedded below `<ScoreHero>` on
   `en/country`, `it/paese`, `es/pais`, `fr/pays`, `pt/pais`, `zh/country`,
   `de/land`.
5. **Home pages (7 locales)** — embedded in its own `<section>` directly
   below `<SafetyMap>` on all 7 home indexes.

## Commits

| # | Commit  | Title |
|---|---------|-------|
| 1 | 467eecf | feat(quick): add IATA city mapping for travel deals widget |
| 2 | a0a9c47 | feat(quick): add TravelDealsWidget component with Aviasales deep-link |
| 3 | 4d70d92 | feat(quick): add deals.widget.* i18n keys for 7 locales |
| 4 | 27dc2d9 | feat(quick): embed TravelDealsWidget on country pages and home |

## Files changed

**Created:**
- `src/lib/iata-cities.ts`
- `src/components/TravelDealsWidget.astro`

**Modified:**
- `src/i18n/ui.ts` (+56 lines, 8 keys × 7 locales)
- 7 home pages: `src/pages/{en,it,es,fr,pt,zh,de}/index.astro`
- 7 country pages: `src/pages/en/country/[slug].astro`,
  `src/pages/it/paese/[slug].astro`, `src/pages/es/pais/[slug].astro`,
  `src/pages/fr/pays/[slug].astro`, `src/pages/pt/pais/[slug].astro`,
  `src/pages/zh/country/[slug].astro`, `src/pages/de/land/[slug].astro`

## Acceptance criteria

- [x] Widget renders on country detail pages (e.g. `/en/country/jpn/`,
      `/de/land/jpn/`) with destination pre-filled "Tokyo" (TYO) — verified
      in dist HTML.
- [x] Widget renders on home pages with empty destination free-text input.
- [x] Form submits to `https://search.aviasales.com/flights/` with marker
      `526093`, locale, destination_iata, depart_date, adults=1 — all hidden
      inputs present in built HTML.
- [x] `target="_blank"` and `rel="noopener noreferrer sponsored"` set.
- [x] All 8 translation keys present in all 7 language blocks (`grep -c
      "deals.widget.title" src/i18n/ui.ts` → 7).
- [x] `npm run build` exit 0, **2186/2186 SEO checks passed**.

## Decisions

- **Plain GET form, no JS.** Aviasales accepts the search params via standard
  query string, so a native `<form method="GET">` is enough — no client-side
  JavaScript needed, no bundle weight, no CSP/hydration concerns. The
  browser builds `?marker=526093&locale=…&destination_iata=…` automatically.
- **Free-text IATA fallback for un-mapped countries.** The 50-country IATA
  map covers the most-trafficked destinations; for the long tail (~190
  countries) the widget gracefully falls back to a 3-letter IATA text input.
  A future iteration can swap this for an autocomplete using
  Aviasales' `/places.json` endpoint.
- **Marker imported, not hardcoded.** Reuses `TRAVELPAYOUTS_MARKER` from
  `src/config/affiliate.ts` (526093) so a future marker change updates
  every surface in one place.
- **Locale codes:** `en` → `en-us`, `zh` → `zh-cn`, all others pass through
  as-is — matches Aviasales' published locale parameter values.

## Deviations from plan

None — plan executed exactly as written. The visible passenger field stayed
as a static "1 adult" label per the plan's MVP simplicity guidance.

## Self-Check: PASSED

- [x] `src/lib/iata-cities.ts` exists
- [x] `src/components/TravelDealsWidget.astro` exists
- [x] `src/i18n/ui.ts` has 7 occurrences of `deals.widget.title`
- [x] All 4 commits present in git log
- [x] `npm run build` succeeded, 2186/2186 SEO checks passed
- [x] Built HTML on `/en/country/jpn/`, `/en/`, `/de/land/jpn/` contains the
      Aviasales form action and marker
