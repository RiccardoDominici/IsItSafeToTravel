---
quick_id: 260507-vux
slug: travelpayouts-flight-widget
date: 2026-05-07
status: in-progress
---

# Travel Deals Widget — make Travelpayouts affiliate visible

Build a custom flight search widget powered by Aviasales deep links, embed it on country detail pages and home page, and add localized strings for all 7 locales.

## Tasks

1. **Create `src/lib/iata-cities.ts`** — `getMainCityIata(iso3): string | null` mapping for ~50 most-trafficked countries
2. **Create `src/components/TravelDealsWidget.astro`** — styled flight search form with Aviasales deep-link submit
3. **Add 8 translation keys** to all 7 locales in `src/i18n/ui.ts` (en, it, es, fr, pt, zh, de)
4. **Embed in country detail pages** (per-locale `src/pages/*/country/[slug].astro` and `src/pages/de/land/[slug].astro` and `src/pages/zh/country/[slug].astro`) below ScoreHero
5. **Embed on home pages** (per-locale `src/pages/*/index.astro` and `src/pages/zh/index.astro` and `src/pages/de/index.astro`) below the world map
6. **Build + push** — `npm run build` must pass with no SEO regressions, then push to origin master

## Acceptance criteria

- Widget renders on country detail (e.g. `/en/country/jpn/`, `/it/country/jpn/`) with destination pre-filled "Tokyo" (TYO)
- Widget renders on home page with empty destination (user picks)
- Form submit opens `https://search.aviasales.com/flights/?destination_iata=XXX&depart_date=YYYY-MM-DD&adults=1&marker=526093&locale=LANG` in new tab with `rel="noopener noreferrer sponsored" target="_blank"`
- All 8 translation keys present in all 7 language blocks (no fallback to en for visible widget text)
- `npm run build` exit 0, all SEO checks pass
- Pushed to origin/master
