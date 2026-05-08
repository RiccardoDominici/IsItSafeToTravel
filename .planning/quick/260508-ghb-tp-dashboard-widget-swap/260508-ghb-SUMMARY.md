---
quick_id: 260508-ghb
slug: tp-dashboard-widget-swap
date: 2026-05-08
status: complete
commit: 6b2082d
---

# Summary — TravelDealsWidget swapped for official TP dashboard widget

## What changed

- `src/components/TravelDealsWidget.astro` — dropped the custom Aviasales-deep-link
  form (and all the locale-mapping + IATA-prefill logic). Replaced with the
  Travelpayouts dashboard widget script (`tpwidg.com/content?...&trs=526093&shmarker=725669&...`)
  injected via `<script is:inline async>` inside the existing rounded card wrapper
  so the visual style still matches the rest of the page. Component still accepts
  the old props (lang, destinationIata, …) for backward compat with the country
  and home pages, but they're now unused.
- `public/_headers` — extended CSP Report-Only to allow `tpwidg.com` and
  `tpwdt.com` across script/style/img/font/connect/frame directives.

## Why

The custom form pointed at `https://search.aviasales.com/flights/?destination_iata=…&locale=en`.
Verified live: that endpoint does a 302 geo-redirect to `aviasales.ru` (Russian
site) for EU traffic, **ignoring the `locale` URL param entirely**. So the
"prediligi inglese in dubbio" fallback (commit `90632fd`) wasn't actually
reaching Aviasales — Italian/Portuguese/Chinese users still landed on a Russian
results page.

The dashboard widget is fully server-rendered by Travelpayouts: locale, currency
and product are baked into the script URL, attribution is handled via the marker
in the URL itself, and there's no client-side redirect logic to break.

## Verified

- `npm run build` — 1892 pages built, 2186/2186 SEO checks passed
- Country pages (`/en/country/*`, `/it/paese/*`, `/de/land/*`, …) and home pages
  still render the widget container; the script tag is present in the HTML.

## Tradeoff

The dashboard widget params are fixed (`city_id=2`, `category=4`, `amount=3`,
`locale=en`), so the per-country destination prefill from the previous custom
form is gone — every page now shows the same widget content. User explicitly
asked for this widget ("facciamo così, correi che implementassi questo widget
che ho preso dalla dashboard"), so this is a deliberate simplification.
