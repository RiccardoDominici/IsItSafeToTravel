import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { enforcePerSourceFloors } from './source-floor.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, getCountryByIso3, COUNTRIES } from '../config/countries.js';
import {
  normalizeItLevel,
  normalizeEsLevel,
  normalizeKrLevel,
  normalizeTwLevel,
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
// Sub-fetcher 4: Taiwan (BOCA) -- CPLX-04
// Fragility: LOW -- structured HTML with clear levels
// Expected failure modes: Page structure changes, new color levels
// =============================================================================

async function fetchTwAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(
      'https://www.boca.gov.tw/sp-trwa-list-1.html',
      {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      },
    );

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3A] TW: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Tables have countries grouped by region with level text/colors
    $('tr, li, div.country-item, a').each((_, el) => {
      const text = $(el).text().trim();
      if (!text || text.length < 3) return;

      // Look for color/level indicators in the element or its context
      const fullText = text;
      const parentText = $(el).closest('tr, div, section').text().trim();
      const combinedText = fullText + ' ' + parentText;

      // Try to determine the level from color keywords
      let level: UnifiedLevel | null = null;
      if (combinedText.includes('\u7D05\u8272') || combinedText.includes('red')) {
        level = 4;
      } else if (combinedText.includes('\u6A59\u8272') || combinedText.includes('orange')) {
        level = 3;
      } else if (combinedText.includes('\u9EC3\u8272') || combinedText.includes('yellow')) {
        level = 2;
      } else if (combinedText.includes('\u7070\u8272') || combinedText.includes('gray') || combinedText.includes('grey')) {
        level = 1;
      }

      if (level === null) return;

      // Try to extract country name (may have both Chinese and English names)
      // Split by common separators and try each token
      const tokens = text.split(/[,\s\u3001\uFF0C\u00B7]+/).filter(t => t.length >= 2);
      for (const token of tokens) {
        const country = getCountryByName(token.trim());
        if (!country) continue;

        // Avoid duplicates
        if (indicators.find(i => i.countryIso3 === country.iso3)) continue;

        const normalizedLevel = normalizeTwLevel(combinedText);

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_tw',
          value: normalizedLevel,
          year: currentYear,
          source: 'advisories_tw',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].tw = {
          level: normalizedLevel,
          text: TW_LEVEL_TEXT[normalizedLevel] || `Level ${normalizedLevel}`,
          source: 'Taiwan BOCA',
          url: 'https://www.boca.gov.tw/sp-trwa-list-1.html',
        };
      }
    });
  } catch {
    console.warn('[ADVISORIES-T3A] TW: BOCA page unavailable, returning empty result');
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
// Fragility: HIGH -- 403 errors likely
// Expected failure modes: WAF blocking, both URLs may return 403
// Why sparse results are acceptable: India issues few advisories and site blocks bots
// =============================================================================

async function fetchInAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const urls = [
    'https://www.mea.gov.in/travel-advisory.htm',
    'https://www.mea.gov.in/travel-advisories.htm',
  ];

  const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  let html = '';

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: browserHeaders,
      });

      if (response.ok) {
        html = await response.text();
        break;
      }
    } catch {
      // Try next URL
    }
  }

  if (!html) {
    console.warn('[ADVISORIES-T3A] IN: All URLs returned 403 or failed, returning empty result');
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

      // Avoid duplicates, keep highest level
      const existing = indicators.find(i => i.countryIso3 === country.iso3);
      const level = normalizeInLevel(text);

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
        url: 'https://www.mea.gov.in/travel-advisory.htm',
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
