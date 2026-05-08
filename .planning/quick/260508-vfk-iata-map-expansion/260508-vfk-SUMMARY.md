---
quick_id: 260508-vfk
slug: iata-map-expansion
date: 2026-05-08
status: complete
commit: 0d041b2
---

# Summary — IATA destination map: 51 → 239 countries

## What changed

`src/lib/iata-cities.ts` — `IATA_BY_ISO3` expanded from 51 entries to 239,
plus matching `CITY_NAMES` records. Now ~96% of the 248 country pages on
the site auto-prefill the Aviasales destination field when the user clicks
"Cerca voli".

## Coverage by region (new entries, → main-city IATA)

- Europe: ALA, ALB, AND→BCN, BGR, BIH, BLR, CYP, EST, FRO, GGY, GIB, IMN,
  JEY, LIE→ZRH, LTU, LUX, LVA, MCO→NCE, MDA, MKD, MLT, MNE, RUS→MOW, SJM,
  SMR→RMI, SRB, SVK, SVN, UKR→IEV, VAT→ROM, XKX
- Americas: 36 entries from Caribbean (ABW, AIA, ATG, BES, BHS, BLM, BLZ, …)
  through Central/South America (BOL, CRI, CUB, DOM, ECU, …) to overseas
  territories (GLP, GUF, MTQ, PRI, …)
- Asia/Middle East: 30 entries — AFG→KBL, ARM, AZE, BGD, BHR, BRN, BTN, GEO,
  IRN, IRQ, JOR, KAZ, KGZ, KHM, KWT, LAO, LBN, LKA, MAC, MDV, MMR, MNG, NPL,
  OMN, PAK, PRK, QAT, SAU, SYR, TJK, TKM, TLS, UZB, YEM
- Africa: 47 entries — full continental coverage from Algeria to Zimbabwe
- Oceania: 21 entries — Fiji, French Polynesia, Cook Islands, Solomon, etc.

## Intentionally omitted (9, no civil aviation)

ATA Antarctica · ATF French Southern Territories · BVT Bouvet · IOT British
Indian Ocean (Diego Garcia is military-only) · PCN Pitcairn · PSE Palestine
(no own civil airport, ground crossings only) · SGS South Georgia · TKL
Tokelau · UMI US Minor Outlying

## Verification

- Cross-validation script confirmed: 0 IATA codes used without a CITY_NAMES
  entry, 0 orphaned CITY_NAMES, 239/248 site iso3 mapped
- 20 random newly-added codes spot-tested against
  `www.aviasales.com/search?destination_iata=XXX` — all 20 returned 200,
  no redirect, IATA preserved in final URL
- `npm run build` — 1892 pages, 2186/2186 SEO checks passed

## Trade-offs

- **English-only city names for the long tail.** The original 51 cities keep
  full 7-locale translations (Roma/Paris/Tokyo/etc.). The 188 new entries
  use English only — translating "Bujumbura" / "Funafuti" / "N'Djamena" into
  Italian / Chinese / German is noise more than value, and the IATA code in
  parentheses next to the name is what travelers key on.
- **Micronations route to nearest hub** (Andorra→Barcelona, Liechtenstein→
  Zurich, Monaco→Nice, San Marino→Rimini, Vatican→Rome) since they have no
  own airport. Booking flights to the actual neighboring city is what a
  user clicking "find flights to Andorra" would actually want.
