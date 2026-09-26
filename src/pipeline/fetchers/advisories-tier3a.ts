import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { enforcePerSourceFloors } from './source-floor.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, getCountryByIso3, COUNTRIES } from '../config/countries.js';
import {
  normalizeItLevel,
  normalizeEsLevel,
  normalizeKrLevel,
  normalizeCnLevel,
  normalizeInLevel,
} from '../normalize/advisory-levels.js';
import type { UnifiedLevel } from '../normalize/advisory-levels.js';
import * as cheerio from 'cheerio';
import { join } from 'node:path';

// --- Common fetch headers ---
const FETCH_HEADERS = {
  'User-Agent': 'IsItSafeToTravel/1.0 (safety research project)',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
};

// --- Level text maps ---
const IT_LEVEL_TEXT: Record<number, string> = {
  1: 'Nessuna controindicazione',
  2: 'Cautela',
  3: 'Sconsigliati i viaggi',
  4: 'Non recarsi',
};

const ES_LEVEL_TEXT: Record<number, string> = {
  1: 'Sin restricciones',
  2: 'Precaucion',
  3: 'Se desaconseja el viaje',
  4: 'Se desaconseja todo viaje',
};

const KR_LEVEL_TEXT: Record<number, string> = {
  1: '\uC5EC\uD589\uC720\uC758 (Travel Caution)',
  2: '\uC5EC\uD589\uC790\uC81C (Travel Restraint)',
  3: '\uCD9C\uAD6D\uAD8C\uACE0 (Departure Recommended)',
  4: '\uC5EC\uD589\uAE08\uC9C0 (Travel Prohibited)',
};

const TW_LEVEL_TEXT: Record<number, string> = {
  1: '\u7070\u8272\u63D0\u9192 (Gray Alert)',
  2: '\u9EC3\u8272\u6CE8\u610F (Yellow Caution)',
  3: '\u6A59\u8272\u907F\u514D\u524D\u5F80 (Orange Avoid Travel)',
  4: '\u7D05\u8272\u5118\u901F\u96E2\u5883 (Red Leave Immediately)',
};

const CN_LEVEL_TEXT: Record<number, string> = {
  1: 'No advisory',
  2: '\u6CE8\u610F\u5B89\u5168 (Exercise Caution)',
  3: '\u8C28\u614E\u524D\u5F80 (Proceed with Caution)',
  4: '\u6682\u52FF\u524D\u5F80 (Do Not Travel)',
};

const IN_LEVEL_TEXT: Record<number, string> = {
  1: 'No advisory',
  2: 'Exercise Caution',
  3: 'Avoid Travel',
  4: 'Do Not Travel',
};

interface FetcherResult {
  indicators: RawIndicator[];
  advisoryInfo: AdvisoryInfoMap;
}

/** Fetch a batch of items concurrently with worker queue pattern */
async function fetchBatch<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) await fn(item);
    }
  });
  await Promise.allSettled(workers);
}

/** Merge source advisory info into the combined map */
function mergeAdvisoryInfo(target: AdvisoryInfoMap, source: AdvisoryInfoMap): void {
  for (const [iso3, info] of Object.entries(source)) {
    if (!target[iso3]) target[iso3] = {};
    Object.assign(target[iso3], info);
  }
}

// =============================================================================
// Korean country name mapping (~50 major countries)
// =============================================================================
const KOREAN_NAMES: Record<string, string> = {
  '\uC77C\uBCF8': 'Japan',
  '\uC911\uAD6D': 'China',
  '\uBBF8\uAD6D': 'United States',
  '\uC601\uAD6D': 'United Kingdom',
  '\uD504\uB791\uC2A4': 'France',
  '\uB3C5\uC77C': 'Germany',
  '\uC774\uD0C8\uB9AC\uC544': 'Italy',
  '\uC2A4\uD398\uC778': 'Spain',
  '\uCE90\uB098\uB2E4': 'Canada',
  '\uD638\uC8FC': 'Australia',
  '\uB7EC\uC2DC\uC544': 'Russia',
  '\uBE0C\uB77C\uC9C8': 'Brazil',
  '\uC778\uB3C4': 'India',
  '\uD0DC\uAD6D': 'Thailand',
  '\uBCA0\uD2B8\uB0A8': 'Vietnam',
  '\uD544\uB9AC\uD540': 'Philippines',
  '\uC778\uB3C4\uB124\uC2DC\uC544': 'Indonesia',
  '\uB9D0\uB808\uC774\uC2DC\uC544': 'Malaysia',
  '\uC2F1\uAC00\uD3EC\uB974': 'Singapore',
  '\uBBF8\uC580\uB9C8': 'Myanmar',
  '\uCEA0\uBCF4\uB514\uC544': 'Cambodia',
  '\uB124\uD314': 'Nepal',
  '\uD30C\uD0A4\uC2A4\uD0C4': 'Pakistan',
  '\uC544\uD504\uAC00\uB2C8\uC2A4\uD0C4': 'Afghanistan',
  '\uC774\uB77C\uD06C': 'Iraq',
  '\uC774\uB780': 'Iran',
  '\uC2DC\uB9AC\uC544': 'Syria',
  '\uD130\uD0A4': 'Turkey',
  '\uC774\uC9D1\uD2B8': 'Egypt',
  '\uB0A8\uC544\uD504\uB9AC\uCE74\uACF5\uD654\uAD6D': 'South Africa',
  '\uB098\uC774\uC9C0\uB9AC\uC544': 'Nigeria',
  '\uCF69\uACE0\uBBFC\uC8FC\uACF5\uD654\uAD6D': 'Democratic Republic of the Congo',
  '\uCF69\uACE0\uACF5\uD654\uAD6D': 'Republic of the Congo',
  '\uC18C\uB9D0\uB9AC\uC544': 'Somalia',
  '\uC608\uBA58': 'Yemen',
  '\uB9AC\uBE44\uC544': 'Libya',
  '\uC218\uB2E8': 'Sudan',
  '\uBA55\uC2DC\uCF54': 'Mexico',
  '\uCF5C\uB86C\uBE44\uC544': 'Colombia',
  '\uBCA0\uB124\uC218\uC5D8\uB77C': 'Venezuela',
  '\uD398\uB8E8': 'Peru',
  '\uC544\uB974\uD5E8\uD2F0\uB098': 'Argentina',
  '\uCE60\uB808': 'Chile',
  '\uC6B0\uD06C\uB77C\uC774\uB098': 'Ukraine',
  '\uD3F4\uB780\uB4DC': 'Poland',
  '\uB124\uB35C\uB780\uB4DC': 'Netherlands',
  '\uBCA8\uAE30\uC5D0': 'Belgium',
  '\uC2A4\uC704\uC2A4': 'Switzerland',
  '\uC624\uC2A4\uD2B8\uB9AC\uC544': 'Austria',
  '\uADF8\uB9AC\uC2A4': 'Greece',
  '\uD3EC\uB974\uD22C\uAC08': 'Portugal',
  '\uC2A4\uC6E8\uB374': 'Sweden',
  '\uB178\uB974\uC6E8\uC774': 'Norway',
  '\uB374\uB9C8\uD06C': 'Denmark',
  '\uD540\uB780\uB4DC': 'Finland',
};

// =============================================================================
// Chinese country name mapping (~80 common countries)
// =============================================================================
const CHINESE_COUNTRY_NAMES: Record<string, string> = {
  '\u65E5\u672C': 'JPN',
  '\u7F8E\u56FD': 'USA',
  '\u82F1\u56FD': 'GBR',
  '\u6CD5\u56FD': 'FRA',
  '\u5FB7\u56FD': 'DEU',
  '\u610F\u5927\u5229': 'ITA',
  '\u897F\u73ED\u7259': 'ESP',
  '\u52A0\u62FF\u5927': 'CAN',
  '\u6FB3\u5927\u5229\u4E9A': 'AUS',
  '\u4FC4\u7F57\u65AF': 'RUS',
  '\u5DF4\u897F': 'BRA',
  '\u5370\u5EA6': 'IND',
  '\u97E9\u56FD': 'KOR',
  '\u6CF0\u56FD': 'THA',
  '\u8D8A\u5357': 'VNM',
  '\u83F2\u5F8B\u5BBE': 'PHL',
  '\u5370\u5EA6\u5C3C\u897F\u4E9A': 'IDN',
  '\u9A6C\u6765\u897F\u4E9A': 'MYS',
  '\u65B0\u52A0\u5761': 'SGP',
  '\u7F05\u7538': 'MMR',
  '\u67EC\u57D4\u5BE8': 'KHM',
  '\u8001\u631D': 'LAO',
  '\u5C3C\u6CCA\u5C14': 'NPL',
  '\u5DF4\u57FA\u65AF\u5766': 'PAK',
  '\u963F\u5BCC\u6C57': 'AFG',
  '\u4F0A\u62C9\u514B': 'IRQ',
  '\u4F0A\u6717': 'IRN',
  '\u53D9\u5229\u4E9A': 'SYR',
  '\u571F\u8033\u5176': 'TUR',
  '\u57C3\u53CA': 'EGY',
  '\u5357\u975E': 'ZAF',
  '\u5C3C\u65E5\u5229\u4E9A': 'NGA',
  '\u521A\u679C(\u91D1)': 'COD',
  '\u521A\u679C(\u5E03)': 'COG',
  '\u7D22\u9A6C\u91CC': 'SOM',
  '\u4E5F\u95E8': 'YEM',
  '\u5229\u6BD4\u4E9A': 'LBY',
  '\u82CF\u4E39': 'SDN',
  '\u58A8\u897F\u54E5': 'MEX',
  '\u54E5\u4F26\u6BD4\u4E9A': 'COL',
  '\u59D4\u5185\u745E\u62C9': 'VEN',
  '\u79D8\u9C81': 'PER',
  '\u963F\u6839\u5EF7': 'ARG',
  '\u667A\u5229': 'CHL',
  '\u4E4C\u514B\u5170': 'UKR',
  '\u6CE2\u5170': 'POL',
  '\u8377\u5170': 'NLD',
  '\u6BD4\u5229\u65F6': 'BEL',
  '\u745E\u58EB': 'CHE',
  '\u5965\u5730\u5229': 'AUT',
  '\u5E0C\u814A': 'GRC',
  '\u8461\u8404\u7259': 'PRT',
  '\u745E\u5178': 'SWE',
  '\u632A\u5A01': 'NOR',
  '\u4E39\u9EA6': 'DNK',
  '\u82AC\u5170': 'FIN',
  '\u65B0\u897F\u5170': 'NZL',
  '\u4EE5\u8272\u5217': 'ISR',
  '\u9ECE\u5DF4\u5AE9': 'LBN',
  '\u7EA6\u65E6': 'JOR',
  '\u6C99\u7279\u963F\u62C9\u4F2F': 'SAU',
  '\u963F\u8054\u914B': 'ARE',
  '\u5361\u5854\u5C14': 'QAT',
  '\u5384\u7ACB\u7279\u91CC\u4E9A': 'ERI',
  '\u57C3\u585E\u4FC4\u6BD4\u4E9A': 'ETH',
  '\u80AF\u5C3C\u4E9A': 'KEN',
  '\u5766\u6851\u5C3C\u4E9A': 'TZA',
  '\u5357\u82CF\u4E39': 'SSD',
  '\u4E2D\u975E': 'CAF',
  '\u9A6C\u91CC': 'MLI',
  '\u5E03\u57FA\u7EB3\u6CD5\u7D22': 'BFA',
  '\u5C3C\u65E5\u5C14': 'NER',
  '\u4E4D\u5F97': 'TCD',
  '\u5580\u9EA6\u9686': 'CMR',
  '\u53F0\u6E7E': 'TWN',
  '\u671D\u9C9C': 'PRK',
  '\u8499\u53E4': 'MNG',
  '\u5B5F\u52A0\u62C9\u56FD': 'BGD',
  '\u65AF\u91CC\u5170\u5361': 'LKA',
};

// =============================================================================
// Sub-fetcher 1: Italy (Viaggiare Sicuri) -- CPLX-01
// Fragility: MEDIUM -- structured JSON API behind an Angular SPA; stable shape,
//   but Farnesina could rename fields without notice.
// Repaired 2026-09-25: the previous version scraped server-rendered HTML, which
//   for an Angular SPA is just an empty <div id="root"> -- it silently read menu
//   chrome instead of country content (e.g. Afghanistan came back as level 1).
//   The app itself loads country data from a JSON API, found by inspecting its
//   compiled bundle (`CountryService`: countryListUrl="storage/get",
//   schedePaeseUrl="schede_paese", getSchedaPaese(t) => `/schede_paese/${t}.json`).
//   Fetching that JSON directly gives the exact same data the SPA renders, with
//   no markup noise -- see normalizeItLevel() for how the level is read from it.
// =============================================================================

interface ViaggiareSicuriSheet {
  infoSicurezza?: {
    nodi?: Record<string, { contenuto?: string } | undefined>;
  };
}

/** Strip HTML tags/entities from a Viaggiare Sicuri dossier fragment (cheerio handles entity decoding
 *  correctly, e.g. &nbsp;, which a hand-rolled regex would not). */
function stripAdvisoryHtml(html: string | undefined): string {
  if (!html) return '';
  return cheerio.load(`<div>${html}</div>`)('div').text();
}

async function fetchItAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Farnesina's own country list is the source of truth for which ISO3 codes it
  // actually publishes a dossier for (~223 of our 248 -- micro-territories and a
  // few disputed areas are absent). Fetching it first avoids ~25 guaranteed 404s
  // per run and lets us log real coverage against Farnesina's own total.
  let publishedIso3: Set<string>;
  try {
    const listResponse = await fetch('https://www.viaggiaresicuri.it/schede_paese/lista_nazioni.json', {
      signal: AbortSignal.timeout(15_000),
      headers: FETCH_HEADERS,
    });
    if (!listResponse.ok) throw new Error(`HTTP ${listResponse.status}`);
    const list = (await listResponse.json()) as Array<{ 'Codice-3'?: string }>;
    publishedIso3 = new Set(list.map((c) => c['Codice-3']).filter((x): x is string => !!x));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3A] IT: country list unavailable (${msg}), returning empty result`);
    return { indicators, advisoryInfo };
  }

  const targetCountries = COUNTRIES.filter((c) => publishedIso3.has(c.iso3));

  await fetchBatch(
    targetCountries,
    async (country) => {
      try {
        const url = `https://www.viaggiaresicuri.it/schede_paese/${country.iso3}.json`;
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: FETCH_HEADERS,
        });
        if (!response.ok) return;

        const sheet = (await response.json()) as ViaggiareSicuriSheet;
        const nodi = sheet.infoSicurezza?.nodi;
        if (!nodi) return; // no security section published for this country

        const generalText = stripAdvisoryHtml(nodi['Indicazioni-generali']?.contenuto);
        const areaText = stripAdvisoryHtml(nodi['Aree-di-particolare-cautela']?.contenuto);

        const level = normalizeItLevel(generalText, areaText);
        if (level === null) return; // stub/empty dossier -- don't guess a level

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_it',
          value: level,
          year: currentYear,
          source: 'advisories_it',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].it = {
          level,
          text: IT_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Italy Viaggiare Sicuri',
          url: `https://www.viaggiaresicuri.it/find-country/country/${country.iso3}`,
        };
      } catch {
        // Individual country page failed, skip silently
      }
    },
    3,
  );

  console.log(
    `[ADVISORIES-T3A] IT: ${indicators.length} countries from Viaggiare Sicuri ` +
    `(${targetCountries.length} published by Farnesina)`,
  );
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 2: Spain (Exteriores) -- CPLX-02
// Fragility: MEDIUM -- server-rendered SharePoint pages, but two-step (index
//   page for the country->URL map, then one detail page per country).
// Repaired 2026-09-25: the previous version only matched `<a>` tags containing
//   "recomendaciones", then read the *closest ancestor's* text as the level
//   signal -- almost always the wrong container, since the index page's per-
//   country modal is mostly fixed legal boilerplate ("La presente recomendacion
//   carece de efecto vinculante...", identical for all 197 countries) and only
//   the single most severe country of the moment gets a banner sentence there
//   at all (currently Ucrania). Every other country's real, current assessment
//   is a "Notas importantes" banner on that country's OWN detail page
//   (`Detalle-recomendaciones-de-viaje.aspx?trc=<pais>`), found by fetching one
//   by hand (Afghanistan) and reading past the same boilerplate. See
//   normalizeEsLevel() for how the level is read from that banner.
// =============================================================================

const ES_INDEX_URL = 'https://www.exteriores.gob.es/es/ServiciosAlCiudadano/Paginas/Recomendaciones-de-viaje.aspx';

/** Spain's own Spanish country names occasionally diverge from `COUNTRIES[].name.es` (a different transliteration,
 *  or a bare/qualified form) -- accent-folding closes most of the gap; this closes the rest. Keys are
 *  accent-folded + lowercased site names, values are `COUNTRIES[].name.es` (also accent-folded) to key off. */
const ES_NAME_ALIASES: Record<string, string> = {
  'bahrein': 'barein', // site "Bahréin" vs our "Barein"
  'republica del congo': 'congo', // site disambiguates DRC vs RoC; ours only has "Congo" (RoC)
  'guinea-bissau': 'guinea-bisau', // one 's' in ours
  'kazajstan': 'kazajistan', // extra 'i' in ours
  'corea': 'corea del sur', // bare "Corea" on this site always means South Korea (North has its own entry)
  'malawi': 'malaui', // Spanish transliteration in ours
  'arabia saudi': 'arabia saudita',
  'santa sede': 'ciudad del vaticano', // Holy See's diplomatic name vs our "Vatican City"
  'puerto rico (eeuu)': 'puerto rico',
};

function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/** Retry with growing backoff on HTTP 429/503 -- exteriores.gob.es rate-limits aggressively under
 *  sustained concurrent load (measured on a full 197-country run: a single 2s retry still left 1-in-4
 *  requests 429'd, including some severe-advisory countries like Ucrania/Siria -- three attempts closed
 *  that gap without raising concurrency, i.e. without hitting the site any harder per unit time). 503 is
 *  retried too: the 2026-09-25 production run got "ES: HTTP 503" from the GitHub-hosted runner on the
 *  very first (uncontended) request to the index page -- this site sits behind an Azure Application
 *  Gateway, which uses 503 the same way others use 429 when it's rate-limiting or warming up. */
async function fetchWithRetry(url: string): Promise<Response | null> {
  for (const delayMs of [0, 2000, 5000]) {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: FETCH_HEADERS });
      if (response.status === 429 || response.status === 503) continue;
      return response;
    } catch {
      // network error -- fall through to retry (or give up after the loop)
    }
  }
  return null;
}

async function fetchEsAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Build a Spanish-name lookup once: accent-folded `COUNTRIES[].name.es`, plus the small alias
  // table above for the handful of countries where the site's own wording diverges from ours.
  const esNameMap = new Map<string, typeof COUNTRIES[number]>();
  for (const country of COUNTRIES) {
    esNameMap.set(foldAccents(country.name.es), country);
  }

  const countryLinks: { name: string; url: string }[] = [];
  try {
    const response = await fetchWithRetry(ES_INDEX_URL);
    if (!response?.ok) {
      console.warn(`[ADVISORIES-T3A] ES: index page HTTP ${response?.status ?? 'error'}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Each country has a "modal-flagCountry" block with its display name (h2) and a link to its
    // own detail page, which is the actual source of truth for its current recommendation.
    $('.modal-flagCountry').each((_, el) => {
      const name = $(el).find('h2').first().text().trim();
      const href = $(el).find('a[href*="Detalle-recomendaciones"]').first().attr('href');
      if (name && href) {
        countryLinks.push({ name, url: new URL(href, ES_INDEX_URL).href });
      }
    });
  } catch {
    console.warn('[ADVISORIES-T3A] ES: index page unavailable, returning empty result');
    return { indicators, advisoryInfo };
  }

  if (countryLinks.length === 0) {
    console.warn('[ADVISORIES-T3A] ES: no country links found on index page (page shape changed?)');
    return { indicators, advisoryInfo };
  }

  await fetchBatch(
    countryLinks,
    async (entry) => {
      try {
        const key = foldAccents(entry.name);
        const country = esNameMap.get(key) ?? esNameMap.get(foldAccents(ES_NAME_ALIASES[key] ?? ''));
        if (!country) return; // not one of our 248 (e.g. Puerto Rico's own listing, disputed territories)

        const response = await fetchWithRetry(entry.url);
        if (!response?.ok) return;

        const html = await response.text();
        const $ = cheerio.load(html);
        $('script, style, noscript').remove();
        const text = $('body').text().replace(/\s+/g, ' ').trim();

        // "Notas importantes" is the section heading right before the current banner; the next
        // standard section on every country page is "Documentacion y visados". Between them is
        // exactly the country's own current assessment (falls back to a fixed window if the next
        // heading isn't found, so a template tweak degrades gracefully instead of grabbing nothing).
        const startIdx = text.indexOf('Notas importantes');
        if (startIdx < 0) return;
        const endIdx = text.indexOf('Documentación y visados', startIdx);
        const notas = endIdx > startIdx
          ? text.slice(startIdx + 'Notas importantes'.length, endIdx)
          : text.slice(startIdx + 'Notas importantes'.length, startIdx + 'Notas importantes'.length + 1500);

        const level = normalizeEsLevel(notas);
        if (level === null) return; // no "Notas importantes" content -- don't guess a level

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_es',
          value: level,
          year: currentYear,
          source: 'advisories_es',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].es = {
          level,
          text: ES_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Spain Exteriores',
          url: entry.url,
        };
      } catch {
        // Individual country page failed, skip silently
      }
    },
    3,
  );

  console.log(`[ADVISORIES-T3A] ES: ${indicators.length} countries from Exteriores (${countryLinks.length} listed)`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 3: South Korea (0404.go.kr) -- CPLX-03
// Fragility: MEDIUM -- HTML scraping of structured page
// Expected failure modes: Korean-only content, page structure changes
// Why sparse results are acceptable: Korean country names may not all match
// =============================================================================

async function fetchKrAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(
      'https://www.0404.go.kr/travelAlert/apntStatus/stepTravelAlert',
      {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      },
    );

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3A] KR: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Korean page has tabs/sections for each level (1-4)
    // Look for country entries with level indicators
    $('li, td, div.country, span.country, a').each((_, el) => {
      const text = $(el).text().trim();
      if (!text || text.length < 2 || text.length > 30) return;

      // Try to match as Korean country name first
      let countryName = KOREAN_NAMES[text];
      let country = countryName ? getCountryByName(countryName) : getCountryByName(text);
      if (!country) return;

      // Avoid duplicates
      if (indicators.find(i => i.countryIso3 === country!.iso3)) return;

      // Try to determine level from parent/context
      const parentText = $(el).closest('div, section, table, ul').text().toLowerCase();
      let level: UnifiedLevel = 1;

      // Check for Korean level keywords in context
      if (parentText.includes('\uC5EC\uD589\uAE08\uC9C0') || parentText.includes('level 4') || parentText.includes('4\uB2E8\uACC4')) {
        level = 4;
      } else if (parentText.includes('\uCD9C\uAD6D\uAD8C\uACE0') || parentText.includes('level 3') || parentText.includes('3\uB2E8\uACC4')) {
        level = 3;
      } else if (parentText.includes('\uC5EC\uD589\uC790\uC81C') || parentText.includes('level 2') || parentText.includes('2\uB2E8\uACC4')) {
        level = 2;
      } else if (parentText.includes('\uC5EC\uD589\uC720\uC758') || parentText.includes('level 1') || parentText.includes('1\uB2E8\uACC4')) {
        level = 1;
      }

      level = normalizeKrLevel(level);

      indicators.push({
        countryIso3: country.iso3,
        indicatorName: 'advisory_level_kr',
        value: level,
        year: currentYear,
        source: 'advisories_kr',
        fetchedAt,
      });

      if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
      advisoryInfo[country.iso3].kr = {
        level,
        text: KR_LEVEL_TEXT[level] || `Level ${level}`,
        source: 'South Korea MOFA',
        url: 'https://www.0404.go.kr/travelAlert/apntStatus/stepTravelAlert',
      };
    });
  } catch {
    console.warn('[ADVISORIES-T3A] KR: 0404.go.kr unavailable, returning empty result');
  }

  console.log(`[ADVISORIES-T3A] KR: ${indicators.length} countries from MOFA`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 4: Taiwan (BOCA) -- repair 2026-09-26 (PARSER-REGIONAL-BRIEF)
// =============================================================================
//
// Source semantics: BOCA's list page (sp-trwa-list-1.html) is a real server-rendered
// `<table>`, one `<tr>` per PUBLISHED ALERT -- NOT one row per country. Most countries have
// exactly one row (their whole-country color), but some have SEVERAL: one "bare" row (the
// `td[data-title="\u570B\u5BB6\u5730\u5340"]` text is just the country's own name, e.g. "\u5580\u9EA5\u9686") stating the
// OVERALL colour, plus additional rows scoped to a NAMED sub-region (a dash after the
// country name, a list of provinces, a border description, "\u534A\u5CF6" (peninsula), etc.) whose
// colour can be WORSE. The OLD parser combined every `tr`/`li`/`a` element's own text with
// its closest ancestor's text and grepped for "\u7D05\u8272"/"red" ANYWHERE in that blob, then
// name-matched arbitrary whitespace-split tokens -- so a country whose OWN overall colour
// is yellow/orange still got promoted to Red the moment ANY row mentioning it also
// mentioned a worse regional colour, and (independently) an unrelated country name that
// happened to appear inside another country's parent element could be mismatched entirely.
//
// Verified live 2026-09-26 against all 220 ISO3-mappable rows: Israel's OWN "\u4EE5\u8272\u5217 Israel"
// row is Yellow (Level 2) -- ONLY a separate "\u4EE5\u8272\u5217\uFF0D\u9ECE\u5DF4\u5AE9\u908A\u754C\u5730\u5340" (Israel-Lebanon
// BORDER AREA) row is Red; same pattern for T\u00FCrkiye (Yellow overall, Red only within 10km of
// the Syria border), Egypt (Orange overall, Red only in Sinai/the Libya-Sudan border),
// Mozambique (Yellow overall, Red only in Cabo Delgado province), Cambodia/Jordan/Tanzania/
// Tunisia (Orange overall, Red only in named border provinces). Myanmar goes one step
// further: its bare row is Orange, but a THIRD row explicitly states "\u7DEC\u7538\u4EF0\u5149\u7701...\u5948\u6BD4\u90FD
// ...\u4EE5\u53CA\u5176\u5B83\u5217\u793A\u7B2C\u4E09\u7D1A...\u53CA\u7B2C\u56DB\u7D1A...\u4EE5\u5916\u5730\u5340" ("Yangon Region, Naypyidaw, AND OTHER AREAS
// NOT LISTED as Level 3 or Level 4") at Level 2 -- an explicit catch-all naming the CAPITAL,
// exactly like the JP/NZ repairs' doctrine: an explicit "the rest of the country" statement
// beats the bare row whenever both exist.
//
// Fix: parseTwListingRows reads the table structurally (cheerio, not string concatenation +
// substring search) into one row per (country id, region text, colour). resolveTwCountryLevel
// then picks, per country id: (1) a row whose region text is an explicit catch-all ("\u4EE5\u5916
// \u5730\u5340"/"\u5176\u4ED6\u5730\u5340"/"\u5176\u9918\u5730\u5340"), highest priority; else (2) the first row whose region text
// does NOT look sub-national (see isTwRegionalText) -- verified BOTH signals agree in 24/25
// multi-row countries found live, and the one exception (Myanmar) is resolved by (1) instead.
// A country with ONLY sub-national rows and no catch-all (Palestine: only "West Bank"/"Gaza
// Strip", BOCA never publishes a unified bare entry for it at all) uses their level when it
// agrees across all of them, and is skipped -- never guessed -- if it does not (has not
// happened live, but the code must not silently invent an answer if it ever does).
const TW_ADVICE_LEVEL_MAP: Record<string, UnifiedLevel> = {
  red: 4,
  orange: 3,
  yellow: 2,
  gray: 1,
  grey: 1,
};

/**
 * BOCA's own `id` attribute (e.g. "Cameroon", "Cote_d'Ivoire", "Democratic_Republic_of_the_
 * Congo") normalizes to our COUNTRIES config's `name.en` for all but a small set of BOCA's
 * own typos ("Argentine", "Naoero", "Italia"), formal/alternate names ("The_Gambia",
 * "Republic_of_the_Congo", "Kingdom_of_Eswatini"), and different conventions ("T\u00FCrkiye" vs
 * our "Turkey", "Korea" meaning South Korea specifically since North Korea has its own
 * separate id) -- found by running EVERY id in the live 2026-09-26 listing through
 * getCountryByName and manually resolving the misses. Four ids (Bermuda, Saba, Saint
 * Eustatius, Somaliland) are genuinely outside our 248-country scope, same as NZ's Bermuda
 * gap -- not aliased, left to fall through to "unmatched" and get skipped.
 */
const TW_NAME_ALIASES: Record<string, string> = {
  argentine: 'Argentina',
  bosnia: 'Bosnia and Herzegovina',
  cape_verde: 'Cabo Verde',
  dominican: 'Dominican Republic',
  holy_see: 'Vatican City',
  italia: 'Italy',
  kingdom_of_eswatini: 'Eswatini',
  korea: 'South Korea',
  lao: 'Laos',
  naoero: 'Nauru',
  republic_of_the_congo: 'Congo',
  saint_christopher_and_nevis: 'Saint Kitts and Nevis',
  the_commonwealth_of_puerto_rico: 'Puerto Rico',
  the_czech_republic: 'Czech Republic',
  the_gambia: 'Gambia',
  the_slovak_republic: 'Slovakia',
  't\u00FCrkiye': 'Turkey',
  united_states_of_america: 'United States',
  'virgin_islands_(british)': 'British Virgin Islands',
  'virgin_islands_(u.s.)': 'US Virgin Islands',
};

function resolveTwCountry(id: string) {
  const alias = TW_NAME_ALIASES[id.toLowerCase()];
  if (alias) return getCountryByName(alias);
  return getCountryByName(id.replace(/_/g, ' '));
}

export interface TwListingRow {
  id: string;
  region: string;
  level: UnifiedLevel | null;
  href: string;
}

/** Parse BOCA's list page into one row per published alert (see the section doc comment
 * for why this is NOT one row per country). Returns rows with `level: null` for any colour
 * class this file doesn't recognize -- callers must skip those, never guess. */
export function parseTwListingRows(html: string): TwListingRow[] {
  const $ = cheerio.load(html);
  const rows: TwListingRow[] = [];
  $('tr').each((_, tr) => {
    const $tr = $(tr);
    const link = $tr.find('td[data-title="\u570B\u5BB6"] a');
    const id = link.attr('id');
    if (!id) return; // header row or a row missing the expected structure
    const href = link.attr('href') ?? '';
    const region = $tr.find('td[data-title="\u570B\u5BB6\u5730\u5340"]').text().trim();
    const colorClass = $tr.find('td[data-title="\u6700\u65B0\u8B66\u793A\u5206\u7D1A"] span.square').attr('class') ?? '';
    const colorMatch = /(\w+)block/.exec(colorClass);
    const level = colorMatch ? (TW_ADVICE_LEVEL_MAP[colorMatch[1]] ?? null) : null;
    rows.push({ id, region, level, href });
  });
  return rows;
}

const TW_CATCHALL_RE = /(?:\u4EE5\u5916|\u5176\u4ED6|\u5176\u5B83|\u5176\u9918).{0,4}\u5730\u5340/;
const TW_DASH_RE = /[-\u2010-\u2015\uFF0D]/;

/** Does `region` name a SUB-national area rather than the whole country? Heuristics found by
 * reading every multi-row country live 2026-09-26 (see the section doc comment): a dash
 * after the country name (Cameroon's "\u5580\u9EA5\u9686 - \u5317\u90E8\u6975\u5317\u7701..."), 2+ named provinces/states
 * (Tanzania's 5-province border list), "\u534A\u5CF6" peninsula (Egypt's Sinai), "\u908A\u5883"/"\u908A\u754C" border
 * wording (Jordan's "\u8207\u6558\u5229\u4E9E\u53CA\u4F0A\u62C9\u514B\u908A\u5883"), or a comma-separated enumeration (Cambodia's 6
 * named provinces). Not exhaustive by design -- position (the bare/overall row is always
 * listed FIRST, verified in 24/25 multi-row countries) is the primary signal in
 * resolveTwCountryLevel; this only needs to catch the common cases well enough that the
 * first non-regional-looking row is usually also the semantically correct one. */
function isTwRegionalText(region: string): boolean {
  if (TW_DASH_RE.test(region)) return true;
  if ((region.match(/\u7701/g) ?? []).length >= 2) return true;
  if ((region.match(/\u5DDE/g) ?? []).length >= 2) return true;
  if (region.includes('\u534A\u5CF6')) return true;
  if (region.includes('\u908A\u5883') || region.includes('\u908A\u754C')) return true;
  if (region.includes('\u3001')) return true;
  return false;
}

/**
 * Resolve one country id's overall level from all of its published rows (see the section
 * doc comment for the full doctrine). Returns null if every row is sub-national, none is an
 * explicit catch-all, AND they disagree on level -- never guessed (has not happened live).
 */
export function resolveTwCountryLevel(rows: TwListingRow[]): UnifiedLevel | null {
  const withLevel = rows.filter((r): r is TwListingRow & { level: UnifiedLevel } => r.level !== null);
  if (withLevel.length === 0) return null;

  const catchall = withLevel.find((r) => TW_CATCHALL_RE.test(r.region));
  if (catchall) return catchall.level;

  const bare = withLevel.find((r) => !isTwRegionalText(r.region));
  if (bare) return bare.level;

  const levels = new Set(withLevel.map((r) => r.level));
  return levels.size === 1 ? withLevel[0].level : null;
}

async function fetchTwAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const response = await fetch('https://www.boca.gov.tw/sp-trwa-list-1.html', {
    signal: AbortSignal.timeout(30_000),
    headers: FETCH_HEADERS,
  });
  if (!response.ok) {
    throw new Error(`sp-trwa-list-1: HTTP ${response.status}`);
  }

  const html = await response.text();
  const rows = parseTwListingRows(html);
  writeJson(join(rawDir, 'advisories-tw-listing.json'), {
    fetchedAt,
    totalRows: rows.length,
    rows,
  });

  const byId = new Map<string, TwListingRow[]>();
  for (const row of rows) {
    const group = byId.get(row.id);
    if (group) group.push(row);
    else byId.set(row.id, [row]);
  }

  const unmatchedCountries: string[] = [];
  const unresolved: string[] = [];

  for (const [id, group] of byId) {
    const country = resolveTwCountry(id);
    if (!country) {
      unmatchedCountries.push(id);
      continue;
    }

    const level = resolveTwCountryLevel(group);
    if (level === null) {
      unresolved.push(`${country.iso3} (${id}): ${group.map((r) => `${r.region}=${r.level}`).join(', ')}`);
      continue; // never guess \u2014 emit nothing for this country
    }

    // The bare/overall row's own URL when we found one (matches what the level itself came
    // from); otherwise the first row's, so the link at least points at a real BOCA page for
    // this country instead of always the generic list page.
    const overallRow = group.find((r) => TW_CATCHALL_RE.test(r.region) || !isTwRegionalText(r.region)) ?? group[0];

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_tw',
      value: level,
      year: currentYear,
      source: 'advisories_tw',
      fetchedAt,
    });

    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].tw = {
      level,
      text: TW_LEVEL_TEXT[level] || `Level ${level}`,
      source: 'Taiwan BOCA',
      url: overallRow.href ? `https://www.boca.gov.tw${overallRow.href}` : 'https://www.boca.gov.tw/sp-trwa-list-1.html',
    };
  }

  if (unmatchedCountries.length > 0) {
    console.warn(
      `[ADVISORIES-T3A] TW: ${unmatchedCountries.length} listing ids did not match a known country (skipped): ${unmatchedCountries.join(', ')}`,
    );
  }
  if (unresolved.length > 0) {
    console.warn(
      `[ADVISORIES-T3A] TW: ${unresolved.length} countries had only conflicting sub-national rows and no catch-all \u2014 skipped, never guessed: ${unresolved.join('; ')}`,
    );
  }

  console.log(`[ADVISORIES-T3A] TW: ${indicators.length} countries from BOCA`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 5: China (cs.mfa.gov.cn) -- CPLX-05
// Fragility: HIGH -- ad-hoc alerts, Chinese text, needs country name extraction
// Expected failure modes: Encoding issues, advisory format changes
// Why sparse results are acceptable: Only countries with active advisories appear
// =============================================================================

async function fetchCnAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};
  const LANDING_URL = 'https://cs.mfa.gov.cn/gyls/lsgz/lsyj/';

  try {
    const response = await fetch(
      LANDING_URL,
      {
        signal: AbortSignal.timeout(30_000),
        headers: {
          ...FETCH_HEADERS,
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      },
    );

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3A] CN: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Advisory list items with format [YYYY-MM-DD] Title text
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 180);

    // Track which countries we've seen (keep most recent) along with per-advisory href.
    const countryLevels = new Map<
      string,
      { level: UnifiedLevel; date: string; url: string }
    >();

    // Each advisory is rendered as <li class="pt1"><span>[YYYY-MM-DD]</span><p><a href="...">title</a></p></li>.
    // We iterate those entries directly so we can capture the per-advisory deep link.
    $('li.pt1').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      if (!text || text.length < 5) return;

      const anchor = $el.find('a[href]').first();
      const rawHref = anchor.attr('href')?.trim() || '';
      const linkText = anchor.attr('title')?.trim() || anchor.text().trim();
      // Prefer the anchor title/text for country matching; fall back to the full <li> text.
      const matchText = linkText || text;

      // Try to extract date from the surrounding <span>[YYYY-MM-DD]</span> (or the text).
      const dateMatch = text.match(/(\d{4})[.-](\d{2})[.-](\d{2})/);
      if (dateMatch) {
        const advisoryDate = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
        if (advisoryDate < cutoffDate) return; // Skip old advisories
      }

      // Resolve the per-advisory URL to an absolute string; fall back to the landing page.
      let absUrl = LANDING_URL;
      if (rawHref) {
        try {
          absUrl = new URL(rawHref, LANDING_URL).href;
        } catch {
          absUrl = LANDING_URL;
        }
      }

      // Extract Chinese country name from advisory title.
      for (const [cnName, iso3] of Object.entries(CHINESE_COUNTRY_NAMES)) {
        if (!matchText.includes(cnName)) continue;

        const level = normalizeCnLevel(matchText);
        if (level === 1) continue; // Skip "no advisory" level, not meaningful from alert text

        // Only keep most recent advisory per country.
        const existing = countryLevels.get(iso3);
        const dateStr = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : '';
        if (existing && existing.date > dateStr) continue;

        countryLevels.set(iso3, { level, date: dateStr, url: absUrl });
        break;
      }
    });

    // Convert to indicators
    for (const [iso3, { level, url }] of countryLevels) {
      const country = getCountryByIso3(iso3);
      if (!country) continue;

      indicators.push({
        countryIso3: iso3,
        indicatorName: 'advisory_level_cn',
        value: level,
        year: currentYear,
        source: 'advisories_cn',
        fetchedAt,
      });

      if (!advisoryInfo[iso3]) advisoryInfo[iso3] = {};
      advisoryInfo[iso3].cn = {
        level,
        text: CN_LEVEL_TEXT[level] || `Level ${level}`,
        source: 'China MFA',
        url: url || LANDING_URL,
      };
    }
  } catch {
    console.warn('[ADVISORIES-T3A] CN: MFA page unavailable, returning empty result');
  }

  console.log(`[ADVISORIES-T3A] CN: ${indicators.length} countries from MFA`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 6: India (MEA) -- CPLX-06
// Fragility: HIGH -- blocked from GitHub-hosted runner IPs (403), not a UA issue
// Expected failure modes: mea.gov.in 403s every request from CI's datacenter IPs
// Why sparse results are acceptable: India issues few advisories and CI can't reach this site at all
// Policy checked 2026-09-25: this sub-fetcher used to send a spoofed Chrome User-Agent, which the
//   project does not allow (identify honestly, never impersonate a browser to dodge bot filters --
//   same rule the repaired IT/ES sub-fetchers above already followed with their own honest UA).
//   Replaced with an honest, self-identifying bot UA and re-tested both MEA URLs: identical response
//   with the honest UA and the old spoofed one (same 200s, same content, from a residential dev IP)
//   -- the spoofing was never actually doing anything. CI's own "All URLs returned 403" (this
//   morning's production log, with the OLD spoofed UA already in place) is IP-based blocking, which
//   no User-Agent string fixes. Per project rule, left emitting nothing rather than chase a fix that
//   would only work from a residential IP.
//   While re-testing found a second, independent bug: 'travel-advisory.htm' (singular) 302-redirects
//   to '/error.htm', which itself answers HTTP 200 -- the old `if (response.ok) break` accepted that
//   error page as success and never tried 'travel-advisories.htm' (plural), which is the real,
//   content-ful page. Fixed by trying the known-good URL first and rejecting any response that
//   redirected to the error page. Doesn't change CI's outcome (still IP-blocked), but stops a future
//   residential/proxied run from silently parsing an error page as "zero advisories".
// =============================================================================

async function fetchInAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // 'travel-advisories.htm' (plural) is the real page; 'travel-advisory.htm' (singular) 302s to a
  // soft-error page that still answers 200 -- tried second, and rejected below if it's the one that
  // actually responds.
  const urls = [
    'https://www.mea.gov.in/travel-advisories.htm',
    'https://www.mea.gov.in/travel-advisory.htm',
  ];

  const honestHeaders = {
    'User-Agent': 'Mozilla/5.0 (compatible; IsItSafeToTravelBot/1.0; +https://isitsafetotravel.org)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  let html = '';
  let sourceUrl = urls[0];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: honestHeaders,
      });

      // A redirect to the site's own soft-error page still answers 200 -- don't treat it as content.
      if (response.ok && !response.url.includes('/error.htm')) {
        html = await response.text();
        sourceUrl = response.url; // record where the content actually came from, not just which URL was tried
        break;
      }
    } catch {
      // Try next URL
    }
  }

  if (!html) {
    console.warn('[ADVISORIES-T3A] IN: All URLs returned 403, an error page, or failed, returning empty result');
    return { indicators, advisoryInfo };
  }

  const $ = cheerio.load(html);

  // Look for advisory titles with country names
  $('a, h2, h3, h4, .list-title, td, li').each((_, el) => {
    const text = $(el).text().trim();
    if (!text || text.length < 5) return;

    const textLower = text.toLowerCase();

    // Look for advisory-related content
    if (!textLower.includes('travel') && !textLower.includes('advisory') && !textLower.includes('caution') && !textLower.includes('avoid')) {
      return;
    }

    // Try to extract country names
    for (const country of COUNTRIES) {
      if (!textLower.includes(country.name.en.toLowerCase())) continue;

      const level = normalizeInLevel(text);
      if (level === null) continue; // matched nav-menu noise, not a real advisory keyword -- don't guess

      // Avoid duplicates, keep highest level
      const existing = indicators.find(i => i.countryIso3 === country.iso3);
      if (existing) {
        if (level > existing.value) existing.value = level;
        continue;
      }

      indicators.push({
        countryIso3: country.iso3,
        indicatorName: 'advisory_level_in',
        value: level,
        year: currentYear,
        source: 'advisories_in',
        fetchedAt,
      });

      if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
      advisoryInfo[country.iso3].in = {
        level,
        text: IN_LEVEL_TEXT[level] || `Level ${level}`,
        source: 'India MEA',
        url: sourceUrl, // the page this was actually parsed from, not a hardcoded (possibly dead) URL
      };
      break;
    }
  });

  console.log(`[ADVISORIES-T3A] IN: ${indicators.length} countries from MEA`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Main orchestrator
// =============================================================================

/**
 * Fetch Tier 3a advisory sources: Italy, Spain, South Korea, Taiwan, China, India.
 * Each sub-fetcher runs independently in try/catch blocks.
 * Falls back to cached data if ALL sub-fetchers fail.
 */
export async function fetchTier3aAdvisories(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const currentYear = new Date().getFullYear();

  const allIndicators: RawIndicator[] = [];
  const combinedAdvisoryInfo: AdvisoryInfoMap = {};
  const errors: string[] = [];

  // Fetch Italy advisories
  try {
    console.log('[ADVISORIES-T3A] Fetching Italy (Viaggiare Sicuri) advisories...');
    const result = await fetchItAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3A] IT: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3A] IT fetch failed: ${msg}`);
    errors.push(`IT: ${msg}`);
  }

  // Fetch Spain advisories
  try {
    console.log('[ADVISORIES-T3A] Fetching Spain (Exteriores) advisories...');
    const result = await fetchEsAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3A] ES: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3A] ES fetch failed: ${msg}`);
    errors.push(`ES: ${msg}`);
  }

  // Fetch South Korea advisories
  try {
    console.log('[ADVISORIES-T3A] Fetching South Korea (MOFA) advisories...');
    const result = await fetchKrAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3A] KR: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3A] KR fetch failed: ${msg}`);
    errors.push(`KR: ${msg}`);
  }

  // Fetch Taiwan advisories
  try {
    console.log('[ADVISORIES-T3A] Fetching Taiwan (BOCA) advisories...');
    const result = await fetchTwAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3A] TW: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3A] TW fetch failed: ${msg}`);
    errors.push(`TW: ${msg}`);
  }

  // Fetch China advisories
  try {
    console.log('[ADVISORIES-T3A] Fetching China (MFA) advisories...');
    const result = await fetchCnAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3A] CN: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3A] CN fetch failed: ${msg}`);
    errors.push(`CN: ${msg}`);
  }

  // Fetch India advisories
  try {
    console.log('[ADVISORIES-T3A] Fetching India (MEA) advisories...');
    const result = await fetchInAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3A] IN: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3A] IN fetch failed: ${msg}`);
    errors.push(`IN: ${msg}`);
  }

  // If all failed, try cached data
  if (allIndicators.length === 0) {
    const cached = findLatestCached('advisories-tier3a-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[ADVISORIES-T3A] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'advisories-tier3a-parsed.json'), cachedData);
        const cachedInfoPath = cached.replace(
          'advisories-tier3a-parsed.json',
          'advisories-tier3a-info.json',
        );
        const cachedInfo = readJson<AdvisoryInfoMap>(cachedInfoPath);
        if (cachedInfo) {
          writeJson(join(rawDir, 'advisories-tier3a-info.json'), cachedInfo);
        }
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'advisories_tier3a',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Errors: ${errors.join('; ')}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'advisories_tier3a',
      success: false,
      countriesFound: 0,
      error: errors.join('; '),
      fetchedAt,
    };
  }

  // Per-source floor check: a single issuer's site redesign must not
  // silently drop its column (restores from the last healthy cache).
  enforcePerSourceFloors({
    logPrefix: '[ADVISORIES-T3A]',
    infoFile: 'advisories-tier3a-info.json',
    // Full issuer list from this tier's sub-fetchers — a zero-row collapse
    // must be caught too, not skipped because nothing was fetched.
    expectedIssuers: [
      'cn',
      'es',
      'in',
      'it',
      'kr',
      'tw',
    ],
    // Measured minimums — small issuers must not false-positive daily.
    floors: { cn: 4, es: 2, in: 1, kr: 0 }, // 0 = never produced data yet: monitor silently
    indicators: allIndicators,
    advisoryInfo: combinedAdvisoryInfo,
    errors,
    runDate: date,
  });

  // Save combined parsed data
  const sourceData: RawSourceData = {
    source: 'advisories_tier3a',
    fetchedAt,
    indicators: allIndicators,
  };
  writeJson(join(rawDir, 'advisories-tier3a-parsed.json'), sourceData);

  // Save advisory info side-channel
  writeJson(join(rawDir, 'advisories-tier3a-info.json'), combinedAdvisoryInfo);

  const totalCountries = new Set(allIndicators.map((i) => i.countryIso3)).size;
  console.log(
    `[ADVISORIES-T3A] Successfully processed ${totalCountries} countries total (${allIndicators.length} indicators)`,
  );

  return {
    source: 'advisories_tier3a',
    success: true,
    countriesFound: totalCountries,
    error: errors.length > 0 ? `Partial: ${errors.join('; ')}` : undefined,
    fetchedAt,
  };
}
