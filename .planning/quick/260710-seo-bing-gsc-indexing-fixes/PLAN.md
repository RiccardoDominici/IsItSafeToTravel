---
quick_id: 260710-seo
slug: bing-gsc-indexing-fixes
date: 2026-07-10
status: done
---

# Fix Bing Webmaster Tools + GSC indexing recommendations

Bing Recommendations e GSC Coverage (screenshot 2026-07-10) segnalano 5 problemi:

| # | Problema | Fonte | Entità |
|---|---|---|---|
| 1 | Meta description troppo corte | Bing | 219 pagine (hub/regioni tutte le lingue, /zh/, country zh) |
| 2 | IndexNow in batch mode | Bing | tutta la sitemap (~1900 URL) inviata in un colpo a ogni deploy |
| 3 | 404 con `{search_term_string}` + slug regione inglesi sotto parent localizzati | GSC | 22 pagine |
| 4 | Pagina con reindirizzamento (URL senza trailing slash, root, www) | GSC | 245 pagine |
| 5 | Scansionata ma non indicizzata (zh/de nuove, map-data.json, /it/fonti/) | GSC | 205 pagine |

## Diagnosi (confermata da investigazione)

- `src/lib/seo.ts:400-407` — `SearchAction` con `urlTemplate .../{search_term_string}/` punta a un
  endpoint di ricerca inesistente → Google lo crawla letteralmente → 404. Il sitelinks search box
  è stato deprecato da Google (ott 2024): la SearchAction non dà alcun beneficio → rimuovere.
- `src/i18n/ui.ts` — le chiavi `hub.*.description` (+ methodology/compare/regions) sono ~50–90
  caratteri; Bing vuole 150–160. Le pagine zh sono conteggiate in caratteri → i template zh vanno
  allungati (~60–80 caratteri cinesi).
- `.github/workflows/seo-indexnow.yml` — invia TUTTI gli URL della sitemap in un batch unico da
  10.000 dopo ogni deploy → Bing lo classifica "batch mode". Passare a submission dei soli URL
  cambiati, in chunk piccoli (streaming).
- 404 regione: slug inglesi (`middle-east`, `europe`, `oceania`, `methodology`) sotto parent
  localizzati (`/fr/regions/`, `/es/regiones/`, `/de/regionen/`, `/pt/`) → aggiungere 301 in
  `public/_redirects` verso gli slug localizzati.
- `map-data.json` crawled-not-indexed → `X-Robots-Tag: noindex` in `public/_headers` (non blocca
  il fetch client-side né l'API).
- 205 crawled-not-indexed: in gran parte pagine zh/de (locale nuove ~fine maggio) in attesa
  di indicizzazione + varianti senza slash/www → attese fisiologiche, monitorare.

## Tasks

1. ✅ Rimossa `potentialAction`/SearchAction da `buildHomepageJsonLd` (`src/lib/seo.ts`) — `validate-seo.ts` non la asserisce (verificato).
2. ✅ Riscritte 148 meta description in `src/i18n/ui.ts` (21 chiavi × 7 locali + `site.description` zh) a 150–160 char (zh 101–109); + 7 description hardcoded in `RegionsIndex.astro`; + template country zh in `seo.ts` (74–84 → ~105–115 char resi).
3. ✅ `public/_redirects`: +132 righe 301 (slug inglesi → localizzati, tutte le destinazioni verificate contro `src/pages`).
4. ✅ `public/_headers`: `X-Robots-Tag: noindex` per `/map-data.json` E `/scores.json` (fetch non bloccato; verificato che nessun rich result dipende dal file raw).
5. ✅ Riscritto `seo-indexnow.yml`: hash-diff streaming (manifest sha256 via actions/cache immutable-key+restore-keys), solo URL cambiati, chunk ≤500 con sleep 5s, delezioni annunciate, retry idempotente, `submit_all` manuale, `npx astro build` (no OG ~400s), rimosso ping Google (endpoint morto: 404 verificato, spento gen 2024).
6. ✅ Bonus prevenzione: sweep sito-intero in `validate-seo.ts` (`validateAllHreflangTargets`) — ogni hreflang di ogni pagina deve puntare a un file in dist (previene la classe di bug di aprile).
7. ✅ Bonus: eliminato URL template letterale `[iso3]` da `generate-llms-full.ts` (stessa classe di `{search_term_string}`), llms rigenerati.
8. ✅ Sitemap zh + index re-inviate a Google via API (accelera ricrawl stragglers zh).
9. ✅ Build + `validate:seo` 2214/2214 pass + `npm test` 131/131 pass.
10. ✅ 5 commit atomici (a3a5c924…2803421e) + push d80c5f80 (auto-deploy).
11. ✅ Memoria progetto aggiornata (project_google_indexing).

## Diagnosi GSC live (API, 2026-07-10, 38 URL ispezionati)

- **245 "pagina con reindirizzamento"**: varianti senza slash/http/www che fanno 301→canonico —
  memoria storica di emissioni pre-aprile-2026 (SafetyMap senza trailing slash, fixato in a9af8348).
  Il build attuale non emette alcun URL non canonico (verificato). **Nessuna azione, sane.**
- **205 "crawled not indexed"**: residuo dell'ondata di crawl del lancio zh/de (~fine maggio).
  de = 13/13 indicizzate (2ª lingua per impressioni); zh ≈ 80–85% indicizzata, ~40–55 stragglers
  con last-crawl 7–22 maggio mai ri-crawlate. Zero segnali di duplicazione/qualità (canonical
  match, INDEXING_ALLOWED ovunque). 4 degli URL di esempio GSC risultano GIÀ indicizzati → il
  report è in ritardo. **Trend sano, monitorare ad agosto; sotto 150 atteso.**
- Ranking resta il collo di bottiglia (1.533 impressioni/4 click/28gg, pos. media 57), non
  l'indicizzazione — coerente con l'audit 2026-06-23.

## Azioni manuali per l'utente (UI-only, l'API non può)

- GSC → "Convalida correzione" sui 404 (dopo il deploy).
- GSC → Request indexing manuale per ~10 pagine zh di alto valore ancora ferme (sau, sdn, zaf…)
  e per /it/fonti/.
- Bing WMT: il flag IndexNow si aggiornerà dopo qualche run del nuovo workflow.

## Backlog (non bloccante)

- 35 pagine statiche (7 lingue × home/methodology/sources/legal/global-safety) usano
  `new Date()` in frontmatter → HTML cambia ogni build → si ri-inviano a IndexNow ogni giorno.
  Fix pulito: passare a `buildLastmodMap().snapshotDate` (src/lib/lastmod.ts).

## Esito atteso / verifica

- Bing Recommendations: meta description e IndexNow risolti al prossimo re-scan.
- GSC: i 404 `{search_term_string}` spariscono dopo la rimozione dello schema; i 404 regione
  diventano 301; "Convalida correzione" avviabile in GSC.
- Le 245 pagine-con-redirect e le 205 crawled-not-indexed sono in gran parte fisiologiche
  (varianti non canoniche + locale nuove) — nessuna azione distruttiva, solo monitoraggio.
