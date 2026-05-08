---
quick_id: 260508-jq3
slug: personalized-form-plus-kofi
date: 2026-05-08
status: complete
commit: 8df3e89
---

# Summary — per-country form + Ko-fi restore

## What changed

- `src/components/TravelDealsWidget.astro` — back to per-country custom form
  with destination_iata prefilled from iata-cities.ts (Canada → YTO, Japan →
  TYO, etc.). Action points at `https://www.aviasales.com/search` (verified
  to keep `.com` and respect `locale=en`), NOT `search.aviasales.com/flights/`
  (the original geo-redirect bug). Locale fallback for it/pt/zh → en.
- `src/layouts/Base.astro` — restored Ko-fi floating-chat overlay script
  exactly as commit `1f8dd0a` removed it (`storage.ko-fi.com/cdn/scripts/
  overlay-widget.js` + `kofiWidgetOverlay.draw('isitsafetotravel', …)`).
  Reuses existing `t('nav.donate')` for the button label across all 7
  locales.
- `public/_headers` — pruned the dead TP-widget CSP entries (tpwidg.com,
  tpwdt.com, *.klook.com, clarity.ms, sentry.avs.io) and added
  `ko-fi.com` / `storage.ko-fi.com` for the donation widget plus
  `www.aviasales.com` in `form-action` for the search form submit.

## Why three paths converged here

User's original conditional was: "if you can personalize the TP widget per
country, keep it + add Ko-fi; otherwise revert to a search button + add Ko-fi."

The TP dashboard widget (Klook tours, category=4) had two structural
problems:

1. ~30% of users with ad blockers see it as a blank thin strip — Klook,
   Microsoft Clarity, and Sentry are heavily blocked and the widget's JS
   crashes when its payload doesn't arrive.
2. Even with personalization (iso3 → klook city_id mapping), the ad-blocker
   problem doesn't go away.

The custom per-country form is a third option that wins on every axis:
personalized like option A, ad-blocker-proof like option B, no JS-from-third-
parties, no iframes. The geo-redirect bug that originally pushed us toward
the dashboard widget turned out to be specific to one Aviasales endpoint
(`search.aviasales.com/flights/`) — `www.aviasales.com/search` doesn't have
it.

## Verified

- `npm run build` — 1892 pages built, 2186/2186 SEO checks passed
- Earlier python live-fetch test confirmed `www.aviasales.com/search?…&locale=en`
  serves `<html lang=en>` regardless of Accept-Language header
- Country pages still pass `destinationIata` and `destinationCityName` (the
  props were always there — just ignored while the dashboard widget was in)

## Acceptance check (after CF deploy)

- All 7 country pages render the form with "Find safe flights to X · City (IATA)"
- Click → opens Aviasales in English with destination prefilled, no .ru redirect
- Ko-fi floating chat appears bottom-right with localized "Support Us" / "Sostienici" / etc.
