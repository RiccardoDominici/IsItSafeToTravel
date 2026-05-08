---
quick_id: 260508-vfk
slug: iata-map-expansion
date: 2026-05-08
status: in-progress
---

# Expand iata-cities.ts to cover all 248 site countries

The TravelDealsWidget uses `getMainCityIata(iso3)` to prefill the destination
field. Currently only 51/248 countries are mapped — clicking the form on the
remaining 197 country pages opens Aviasales with no destination set.

## Tasks

1. Expand `IATA_BY_ISO3` in `src/lib/iata-cities.ts` from 51 to ~230 entries
   (one IATA city/airport code per country with civil aviation). Skip ~15
   uninhabited / no-airport places (Antarctica, Bouvet Island, Pitcairn,
   Tokelau, US minor outlying, Heard, Bv. South Georgia, etc.).
2. Add localized `CITY_NAMES` entries for the new IATA codes (en/it/es/fr/pt/zh/de
   per existing pattern).
3. Spot-check a sample of new codes against `www.aviasales.com/search?destination_iata=XXX`
   to confirm Aviasales recognizes them.
4. `npm run build` must pass with all SEO checks.
5. Commit + push.

## Acceptance

- ≥230 entries in IATA_BY_ISO3
- Each new entry also has a CITY_NAMES localized record (en mandatory, others
  best-effort)
- `getMainCityIata('USA')` still returns 'NYC', `getMainCityIata('AFG')` now
  returns 'KBL' (was null), etc.
- Build passes 2186/2186 SEO checks
