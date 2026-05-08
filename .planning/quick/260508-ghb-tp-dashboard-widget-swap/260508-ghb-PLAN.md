---
quick_id: 260508-ghb
slug: tp-dashboard-widget-swap
date: 2026-05-08
status: in-progress
---

# Swap TravelDealsWidget for official Travelpayouts dashboard widget

The custom Aviasales-deep-link widget is broken: `search.aviasales.com/flights/`
geo-redirects EU users to `aviasales.ru` (Russian site) ignoring the `locale` URL
param. Replace the entire form with the dashboard-provided Travelpayouts widget
script which renders its own UI and handles attribution server-side.

## Snippet from TP dashboard

```html
<script async src="https://tpwidg.com/content?currency=USD&trs=526093&shmarker=725669&locale=en&city_id=2&category=4&amount=3&powered_by=true&campaign_id=137&promo_id=4497" charset="utf-8"></script>
```

## Tasks

1. Rewrite `src/components/TravelDealsWidget.astro` — drop the custom form,
   keep the bordered card wrapper for visual consistency, inject the TP script
   tag inside it. Drop unused props (destinationIata/destinationCityName/etc.)
   since the widget is fixed by dashboard params.
2. Update `public/_headers` — add `tpwidg.com` to `script-src`, `connect-src`,
   `img-src`, and `frame-src` (CSP Report-Only).
3. `npm run build` must pass with all SEO checks.
4. Commit + push (auto-deploy).

## Acceptance

- All 7 country pages and 7 home pages still render the widget container
- The TP script is injected on every page where the widget appears
- CSP no longer flags `tpwidg.com` as a violation
- `npm run build` exit 0
