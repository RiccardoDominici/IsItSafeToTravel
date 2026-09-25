import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { enforcePerSourceFloors } from './source-floor.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, getCountryByIso3, COUNTRIES } from '../config/countries.js';
import {
  normalizeChLevel,
  normalizeSeLevel,
  normalizeNoLevel,
  normalizeCzLevel,
  normalizeHuLevel,
  normalizePtLevel,
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
const CH_LEVEL_TEXT: Record<number, string> = {
  1: 'Grundsaetzliche Vorsicht',
  2: 'Erhoehte Vorsicht',
  3: 'Von nicht dringenden Reisen abgeraten',
  4: 'Von Reisen abgeraten',
};

const SE_LEVEL_TEXT: Record<number, string> = {
  1: 'Normal saekerhetsstandard',
  2: 'Iaktta stor foersiktighet',
  3: 'UD avraader resor',
  4: 'UD avraader alla resor',
};

const NO_LEVEL_TEXT: Record<number, string> = {
  1: 'Normal forsiktighet',
  2: 'Utvise forsiktighet',
  3: 'Fraraader reiser',
  4: 'Fraraader alle reiser',
};

// Wording matches the official Odyseusz risk-level labels verbatim (see
// PL_CODE_TO_LEVEL below) so the on-page text always agrees with the badge.
const PL_LEVEL_TEXT: Record<number, string> = {
  1: 'Zwykła ostrożność',
  2: 'Szczególna ostrożność',
  3: 'Unikaj podróży',
  4: 'Nie jedź',
};

const CZ_LEVEL_TEXT: Record<number, string> = {
  1: 'Běžná opatrnost',
  2: 'Zvýšená opatrnost',
  3: 'Cestujte jen v nezbytných případech',
  4: 'Nedoporučujeme cestovat',
};

// Wording matches KKM's own security-classification taxonomy terms verbatim
// (see HU_CLASSIFICATION_TO_LEVEL below) so the on-page text always agrees
// with the badge.
const HU_LEVEL_TEXT: Record<number, string> = {
  1: 'Biztonságos ország',
  2: 'Fokozott óvatossággal látogatható',
  3: 'Kiemelt biztonsági kockázat',
  4: 'Nem javasolt úti cél',
};

const PT_LEVEL_TEXT: Record<number, string> = {
  1: 'Precaução normal',
  2: 'Reforçar precauções',
  3: 'Evitar viagens não essenciais',
  4: 'Viagem desaconselhada',
};

interface FetcherResult {
  indicators: RawIndicator[];
  advisoryInfo: AdvisoryInfoMap;
}

/** Fetch a batch of items concurrently with worker queue pattern (used by PT,
 *  which crawls ~190 individual country pages and must stay polite). */
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

/** Simple async delay helper */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Fetch with one retry after a short backoff -- CZ's crawl chains two fetches
 *  per warned country (cestovani page, then its detail article), and a small
 *  fraction of requests fail transiently under the sustained ~200-request
 *  crawl even though the exact same URL succeeds fine in isolation (observed
 *  during verification: AFG/MEX/USA all came back clean on a fresh retry). A
 *  single retry recovers most of those without meaningfully slowing the run. */
async function fetchWithRetry(url: string, timeoutMs: number): Promise<Response> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: FETCH_HEADERS });
    if (r.ok) return r;
    throw new Error(`HTTP ${r.status}`);
  } catch {
    await delay(500);
    return fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: FETCH_HEADERS });
  }
}

/** Merge source advisory info into the combined map */
function mergeAdvisoryInfo(target: AdvisoryInfoMap, source: AdvisoryInfoMap): void {
  for (const [iso3, info] of Object.entries(source)) {
    if (!target[iso3]) target[iso3] = {};
    Object.assign(target[iso3], info);
  }
}

// =============================================================================
// Country name mappings for non-English sources
// =============================================================================

// German country names (Switzerland EDA uses German)
const GERMAN_NAMES: Record<string, string> = {
  'Vereinigte Staaten': 'United States',
  'Vereinigte Staaten von Amerika': 'United States',
  'Grossbritannien': 'United Kingdom',
  'Vereinigtes Koenigreich': 'United Kingdom',
  'Frankreich': 'France',
  'Deutschland': 'Germany',
  'Italien': 'Italy',
  'Spanien': 'Spain',
  'Russland': 'Russia',
  'Brasilien': 'Brazil',
  'Indien': 'India',
  'Suedkorea': 'South Korea',
  'Nordkorea': 'North Korea',
  'Suedafrika': 'South Africa',
  'Aegypten': 'Egypt',
  'Tuerkei': 'Turkey',
  'Griechenland': 'Greece',
  'Kroatien': 'Croatia',
  'Rumaenien': 'Romania',
  'Ungarn': 'Hungary',
  'Tschechien': 'Czech Republic',
  'Slowakei': 'Slovakia',
  'Oesterreich': 'Austria',
  'Belgien': 'Belgium',
  'Niederlande': 'Netherlands',
  'Daenemark': 'Denmark',
  'Schweden': 'Sweden',
  'Norwegen': 'Norway',
  'Finnland': 'Finland',
  'Neuseeland': 'New Zealand',
  'Mexiko': 'Mexico',
  'Kolumbien': 'Colombia',
  'Argentinien': 'Argentina',
  'Kamerun': 'Cameroon',
  'Elfenbeinkueste': "Cote d'Ivoire",
  'Marokko': 'Morocco',
  'Algerien': 'Algeria',
  'Tunesien': 'Tunisia',
  'Libyen': 'Libya',
  'Saudi-Arabien': 'Saudi Arabia',
  'Vereinigte Arabische Emirate': 'United Arab Emirates',
  'Philippinen': 'Philippines',
  'Kambodscha': 'Cambodia',
  'Georgien': 'Georgia',
  'Serbien': 'Serbia',
  'Weissrussland': 'Belarus',
  'Moldawien': 'Moldova',
  'Litauen': 'Lithuania',
  'Lettland': 'Latvia',
  'Estland': 'Estonia',
};

// Swedish country names
const SWEDISH_NAMES: Record<string, string> = {
  'Foerenade staterna': 'United States',
  'USA': 'United States',
  'Storbritannien': 'United Kingdom',
  'Frankrike': 'France',
  'Tyskland': 'Germany',
  'Italien': 'Italy',
  'Spanien': 'Spain',
  'Ryssland': 'Russia',
  'Brasilien': 'Brazil',
  'Indien': 'India',
  'Sydkorea': 'South Korea',
  'Nordkorea': 'North Korea',
  'Sydafrika': 'South Africa',
  'Egypten': 'Egypt',
  'Turkiet': 'Turkey',
  'Grekland': 'Greece',
  'Kroatien': 'Croatia',
  'Rumaenien': 'Romania',
  'Ungern': 'Hungary',
  'Tjeckien': 'Czech Republic',
  'Slovakien': 'Slovakia',
  'Oesterrike': 'Austria',
  'Belgien': 'Belgium',
  'Nederlaenderna': 'Netherlands',
  'Danmark': 'Denmark',
  'Norge': 'Norway',
  'Finland': 'Finland',
  'Nya Zeeland': 'New Zealand',
  'Mexiko': 'Mexico',
  'Colombia': 'Colombia',
  'Kina': 'China',
  'Japan': 'Japan',
  'Filippinerna': 'Philippines',
  'Kambodja': 'Cambodia',
  'Vitryssland': 'Belarus',
  'Saudiarabien': 'Saudi Arabia',
  'Foerenade Arabemiraten': 'United Arab Emirates',
  'Schweiz': 'Switzerland',
  'Polen': 'Poland',
  'Portugal': 'Portugal',
  'Marocko': 'Morocco',
  'Tunisien': 'Tunisia',
  'Libyen': 'Libya',
  'Ukraina': 'Ukraine',
};

// Norwegian country names
const NORWEGIAN_NAMES: Record<string, string> = {
  'Storbritannia': 'United Kingdom',
  'Frankrike': 'France',
  'Tyskland': 'Germany',
  'Italia': 'Italy',
  'Spania': 'Spain',
  'Russland': 'Russia',
  'Brasil': 'Brazil',
  'Soer-Korea': 'South Korea',
  'Nord-Korea': 'North Korea',
  'Soer-Afrika': 'South Africa',
  'Egypt': 'Egypt',
  'Tyrkia': 'Turkey',
  'Hellas': 'Greece',
  'Kroatia': 'Croatia',
  'Romania': 'Romania',
  'Ungarn': 'Hungary',
  'Tsjekkia': 'Czech Republic',
  'Slovakia': 'Slovakia',
  'Oesterrike': 'Austria',
  'Belgia': 'Belgium',
  'Nederland': 'Netherlands',
  'Danmark': 'Denmark',
  'Sverige': 'Sweden',
  'Finland': 'Finland',
  'New Zealand': 'New Zealand',
  'Kina': 'China',
  'Filippinene': 'Philippines',
  'Kambodsja': 'Cambodia',
  'Hviterussland': 'Belarus',
  'Saudi-Arabia': 'Saudi Arabia',
  'Forente arabiske emirater': 'United Arab Emirates',
  'Sveits': 'Switzerland',
  'Polen': 'Poland',
  'Marokko': 'Morocco',
  'Tunisia': 'Tunisia',
  'Libya': 'Libya',
  'Ukraina': 'Ukraine',
  'Etiopia': 'Ethiopia',
  'Libanon': 'Lebanon',
};

/** Try to match a country name using a local name map + fallback to getCountryByName */
function matchCountry(name: string, localNames: Record<string, string>) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 60) return undefined;
  // Try local name map first
  const englishName = localNames[trimmed];
  if (englishName) return getCountryByName(englishName);
  // Fallback to direct matching (works for many European names similar to English)
  return getCountryByName(trimmed);
}

// =============================================================================
// Sub-fetcher 1: Switzerland (EDA) -- CPLX-07
// Fragility: MEDIUM -- English version available, structured listing
// Expected failure modes: Page redesign, URL changes
// =============================================================================

async function fetchChAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(
      'https://www.eda.admin.ch/eda/en/fdfa/representations-and-travel-advice.html',
      {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      },
    );

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3B] CH: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse country links from travel advice listing
    $('a[href*="travel-advice"], a[href*="reisehinweise"], a[href*="representations"]').each((_, el) => {
      const text = $(el).text().trim();
      const country = matchCountry(text, GERMAN_NAMES);
      if (!country) return;
      if (indicators.find(i => i.countryIso3 === country.iso3)) return;

      // Extract advisory level from parent context
      const parentText = $(el).closest('li, div, tr, td, article').text();
      const level = normalizeChLevel(parentText);
      if (level === null) return; // no recognizable level in this context — don't guess

      indicators.push({
        countryIso3: country.iso3,
        indicatorName: 'advisory_level_ch',
        value: level,
        year: currentYear,
        source: 'advisories_ch',
        fetchedAt,
      });

      if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
      advisoryInfo[country.iso3].ch = {
        level,
        text: CH_LEVEL_TEXT[level] || `Level ${level}`,
        source: 'Switzerland EDA',
        url: 'https://www.eda.admin.ch/eda/en/fdfa/representations-and-travel-advice.html',
      };
    });

    // Also try generic country-name links
    if (indicators.length < 5) {
      $('a').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length < 3 || text.length > 40) return;
        const country = matchCountry(text, GERMAN_NAMES);
        if (!country) return;
        if (indicators.find(i => i.countryIso3 === country.iso3)) return;

        const parentText = $(el).closest('li, div, tr, td, p').text();
        const level = normalizeChLevel(parentText);
        if (level === null) return; // no recognizable level in this context — don't guess

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_ch',
          value: level,
          year: currentYear,
          source: 'advisories_ch',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].ch = {
          level,
          text: CH_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Switzerland EDA',
          url: 'https://www.eda.admin.ch/eda/en/fdfa/representations-and-travel-advice.html',
        };
      });
    }
  } catch {
    console.warn('[ADVISORIES-T3B] CH: EDA page unavailable, returning empty result');
  }

  console.log(`  [CH] Found ${indicators.length} countries`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 2: Sweden (UD) -- CPLX-08
// Fragility: MEDIUM -- Swedish text, structured page
// Expected failure modes: Page redesign, content in Swedish only
// =============================================================================

async function fetchSeAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(
      'https://www.regeringen.se/uds-reseinformation/ud-avraader/',
      {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      },
    );

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3B] SE: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse country entries from travel information page
    $('a, li, h3, h4').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length < 3 || text.length > 50) return;

      const country = matchCountry(text, SWEDISH_NAMES);
      if (!country) return;
      if (indicators.find(i => i.countryIso3 === country.iso3)) return;

      const parentText = $(el).closest('li, div, section, article, p').text();
      const level = normalizeSeLevel(parentText);

      indicators.push({
        countryIso3: country.iso3,
        indicatorName: 'advisory_level_se',
        value: level,
        year: currentYear,
        source: 'advisories_se',
        fetchedAt,
      });

      if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
      advisoryInfo[country.iso3].se = {
        level,
        text: SE_LEVEL_TEXT[level] || `Level ${level}`,
        source: 'Sweden UD',
        url: 'https://www.regeringen.se/uds-reseinformation/ud-avraader/',
      };
    });
  } catch {
    console.warn('[ADVISORIES-T3B] SE: regeringen.se unavailable, returning empty result');
  }

  console.log(`  [SE] Found ${indicators.length} countries`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 3: Norway (UD) -- CPLX-09
// Fragility: MEDIUM -- Norwegian text, government page
// Expected failure modes: Page redesign, Norwegian-only content
// =============================================================================

async function fetchNoAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(
      'https://www.regjeringen.no/no/tema/utenrikssaker/reiseinformasjon/reiseraad/id2413163/',
      {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      },
    );

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3B] NO: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse advisory entries from travel advice page
    $('a, li, h3, h4, td').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length < 3 || text.length > 50) return;

      const country = matchCountry(text, NORWEGIAN_NAMES);
      if (!country) return;
      if (indicators.find(i => i.countryIso3 === country.iso3)) return;

      const parentText = $(el).closest('li, div, section, tr, article, p').text();
      const level = normalizeNoLevel(parentText);

      indicators.push({
        countryIso3: country.iso3,
        indicatorName: 'advisory_level_no',
        value: level,
        year: currentYear,
        source: 'advisories_no',
        fetchedAt,
      });

      if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
      advisoryInfo[country.iso3].no = {
        level,
        text: NO_LEVEL_TEXT[level] || `Level ${level}`,
        source: 'Norway UD',
        url: 'https://www.regjeringen.no/no/tema/utenrikssaker/reiseinformasjon/reiseraad/id2413163/',
      };
    });
  } catch {
    console.warn('[ADVISORIES-T3B] NO: regjeringen.no unavailable, returning empty result');
  }

  console.log(`  [NO] Found ${indicators.length} countries`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 4: Poland (MSZ, "Odyseusz" portal) -- CPLX-10
// Fragility: LOW -- structured JSON API, ISO2-keyed
// Repaired 2026-09-25: the old gov.pl HTML page now 302-redirects to
// odyseusz.gov.pl, MSZ's new travel-safety portal -- an Angular SPA with no
// server-rendered markup, so cheerio always saw an empty shell (silent
// 0-country collapse, caught only by the per-source floor restoring
// April-2026 cache day after day). The SPA itself calls a JSON API for its
// country list; that's what we call directly now, no HTML parsing needed.
// =============================================================================

const PL_API_URL = 'https://odyseusz.gov.pl/api/v1/informacje/profile-panstw';

// Odyseusz risk-level codes -> unified 1-4 scale. `bazowyKodPoziomuZagrozenia`
// is the COUNTRY-WIDE baseline MSZ itself computes, kept separate from any
// `SZCZEGOLOWY_DLA_REGIONU` (region-only) entries in the per-country detail
// endpoint -- so a Sinai- or southern-Thailand-style regional warning can
// never leak into the national level here; verified against MEX/EGY/THA,
// which all carry region-level 3/4 sub-entries under a baseline of 1/2.
const PL_CODE_TO_LEVEL: Record<string, UnifiedLevel> = {
  ZACHOWAJ_ZWYKLA_OSTROZNOSC: 1,
  ZACHOWAJ_SZCZEGOLNA_OSTROZNOSC: 2,
  MSZ_ODRADZA_PODROZE_KTORE_NIE_SA_KONIECZNE: 3,
  MSZ_ODRADZA_WSZELKIE_PODROZE: 4,
};

interface OdyseuszCountryProfile {
  kodIso: string;
  nazwa: string;
  bazowyKodPoziomuZagrozenia?: string | null;
  dataZatwierdzenia?: string | null;
}

async function fetchPlAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(PL_API_URL, {
      signal: AbortSignal.timeout(30_000),
      headers: { ...FETCH_HEADERS, Accept: 'application/json' },
    });

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3B] PL: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const profiles = (await response.json()) as OdyseuszCountryProfile[];
    writeJson(join(rawDir, 'advisories-pl-raw.json'), profiles);

    for (const profile of profiles) {
      const country = getCountryByIso2(profile.kodIso);
      if (!country) continue;

      // Rule: never fall back to level 1 -- an unrecognised/future risk code
      // must drop the country rather than guess its severity.
      const code = profile.bazowyKodPoziomuZagrozenia;
      const level = code ? PL_CODE_TO_LEVEL[code] : undefined;
      if (!level) {
        if (code) {
          console.warn(`[ADVISORIES-T3B] PL: unrecognised risk code "${code}" for ${profile.kodIso}, skipping`);
        }
        continue;
      }

      indicators.push({
        countryIso3: country.iso3,
        indicatorName: 'advisory_level_pl',
        value: level,
        year: currentYear,
        source: 'advisories_pl',
        fetchedAt,
      });

      if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
      advisoryInfo[country.iso3].pl = {
        level,
        text: PL_LEVEL_TEXT[level] || `Level ${level}`,
        source: 'Poland MSZ (Odyseusz)',
        url: `https://odyseusz.gov.pl/${profile.kodIso}`,
        // dataZatwierdzenia ("date approved") is a bare YYYY-MM-DD date --
        // the API exposes no time-of-day, so this is midnight UTC.
        updatedAt: profile.dataZatwierdzenia
          ? new Date(profile.dataZatwierdzenia).toISOString()
          : undefined,
      };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ADVISORIES-T3B] PL: odyseusz.gov.pl unavailable (${msg}), returning empty result`);
  }

  console.log(`  [PL] Found ${indicators.length} countries`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 5: Czech Republic (MZV) -- CPLX-11
// Fragility: MEDIUM -- Czech narrative text, one page per country
// Repaired 2026-09-25: www.mzv.cz 302-redirects to mzv.gov.cz (a domain
// migration, same class of break as PL/PT). The old target URL,
// ".../cestujeme/aktualni_doporuceni_a_varovani/", is a curated NEWS FEED of
// only the countries with a recent warning article -- not comprehensive, so
// (per rule 1) its silence can't be read as "safe". The comprehensive
// resource is the "encyklopedie_statu" (country encyclopedia): 8 region
// hubs -> one "cestovani" (travel) page per country. Each cestovani page
// either has an "Aktuální doporučení a varování" (current recommendations
// and warnings) block linking to a free-text warning article, or it
// doesn't -- exactly the same structural signal PT's "Avisos" section gives,
// and the site's own markup (a dedicated #varovani container) already keeps
// this cleanly separate from the page's other topic sections (customs,
// documents, visas, health), so there's no PT-style cross-contamination risk
// to guard against here.
// =============================================================================

const CZ_BASE_URL = 'https://mzv.gov.cz';
const CZ_REGIONS = [
  'afrika', 'asie', 'australie_a_oceanie', 'blizky_vychod',
  'evropa', 'jizni_amerika', 'severni_amerika', 'stredni_amerika',
] as const;

interface CzCountryLink {
  name: string; // Czech display name, straight from the region hub's link text
  url: string;
}

// COUNTRIES' `.en` names, keyed accent-folded, as a first-pass fallback --
// covers Czech names close to their international form (e.g. "Argentina",
// "Kanada").
const czEnFallbackMap = new Map<string, (typeof COUNTRIES)[number]>();
for (const country of COUNTRIES) {
  czEnFallbackMap.set(stripDiacritics(country.name.en).toLowerCase(), country);
}

// Most Czech country names have no resemblance to English at all (Slavic
// exonyms, e.g. "Německo" for Germany, "Řecko" for Greece) -- built by
// fetching all 8 region hubs and mapping every one of the resulting 199
// names to an ISO3 during the 2026-09-25 repair (not a guess: every entry
// was cross-checked against the region it came from, which disambiguates
// e.g. "Kongo (Brazzaville)" vs "Kongo (Kinshasa)").
const CZ_NAME_OVERRIDES: Record<string, string> = {
  'alzirsko': 'DZA', 'cad': 'TCD', 'dzibutsko': 'DJI', 'etiopie': 'ETH',
  'gambie': 'GMB', 'jihoafricka republika': 'ZAF', 'jihosudanska republika': 'SSD',
  'kamerun': 'CMR', 'kapverdy': 'CPV', 'kena': 'KEN', 'komory': 'COM',
  'kongo (brazzaville)': 'COG', 'kongo (kinshasa)': 'COD', 'liberie': 'LBR',
  'libye': 'LBY', 'madagaskar': 'MDG', 'maroko': 'MAR', 'mauricius': 'MUS',
  'mauritanie': 'MRT', 'mosambik': 'MOZ', 'namibie': 'NAM', 'nigerie': 'NGA',
  'pobrezi slonoviny': 'CIV', 'rovnikova guinea': 'GNQ', 'seychely': 'SYC',
  'somalsko': 'SOM', 'stredoafricka republika': 'CAF',
  'svaty tomas a princuv ostrov': 'STP', 'svazijsko': 'SWZ', 'tanzanie': 'TZA',
  'tunisko': 'TUN', 'zambie': 'ZMB',
  'armenie': 'ARM', 'azerbajdzan': 'AZE', 'banglades': 'BGD', 'brunej': 'BRN',
  'cina': 'CHN', 'filipiny': 'PHL', 'gruzie': 'GEO', 'hongkong': 'HKG',
  'indie': 'IND', 'indonesie': 'IDN', 'japonsko': 'JPN', 'kambodza': 'KHM',
  'kazachstan': 'KAZ', 'korejska lidove demokraticka republika': 'PRK',
  'korejska republika': 'KOR', 'malajsie': 'MYS', 'maledivy': 'MDV',
  'mongolsko': 'MNG', 'singapur': 'SGP', 'tadzikistan': 'TJK', 'thajsko': 'THA',
  'tchaj-wan': 'TWN', 'vychodni timor': 'TLS',
  'australie': 'AUS', 'cookovy ostrovy': 'COK', 'fidzi': 'FJI',
  'marshallovy ostrovy': 'MHL', 'mikronesie': 'FSM', 'novy zeland': 'NZL',
  'papua nova guinea': 'PNG', 'salomounovy ostrovy': 'SLB',
  'bahrajn': 'BHR', 'irak': 'IRQ', 'izrael': 'ISR', 'jemen': 'YEM',
  'jordansko': 'JOR', 'katar': 'QAT', 'kuvajt': 'KWT', 'libanon': 'LBN',
  'palestina': 'PSE', 'saudska arabie': 'SAU', 'spojene arabske emiraty': 'ARE',
  'syrie': 'SYR',
  'albanie': 'ALB', 'belgie': 'BEL', 'belorusko': 'BLR',
  'bosna a hercegovina': 'BIH', 'bulharsko': 'BGR', 'cerna hora': 'MNE',
  'dansko': 'DNK', 'estonsko': 'EST', 'finsko': 'FIN', 'francie': 'FRA',
  'chorvatsko': 'HRV', 'irsko': 'IRL', 'island': 'ISL', 'italie': 'ITA',
  'kypr': 'CYP', 'lichtenstejnsko': 'LIE', 'litva': 'LTU', 'lotyssko': 'LVA',
  'lucembursko': 'LUX', 'madarsko': 'HUN', 'moldavsko': 'MDA', 'monako': 'MCO',
  'nemecko': 'DEU', 'nizozemsko': 'NLD', 'norsko': 'NOR', 'polsko': 'POL',
  'portugalsko': 'PRT', 'rakousko': 'AUT', 'rumunsko': 'ROU', 'rusko': 'RUS',
  'recko': 'GRC', 'severni makedonie': 'MKD', 'slovensko': 'SVK',
  'slovinsko': 'SVN', 'srbsko': 'SRB', 'svaty stolec': 'VAT',
  'spanelsko': 'ESP', 'svedsko': 'SWE', 'svycarsko': 'CHE', 'turecko': 'TUR',
  'ukrajina': 'UKR', 'velka britanie': 'GBR',
  'bolivie': 'BOL', 'brazilie': 'BRA', 'ekvador': 'ECU', 'kolumbie': 'COL',
  'surinam': 'SUR',
  'kanada': 'CAN', 'mexiko': 'MEX', 'usa': 'USA',
  'antigua a barbuda': 'ATG', 'bahamy': 'BHS', 'dominika': 'DMA',
  'dominikanska republika': 'DOM', 'jamajka': 'JAM', 'kostarika': 'CRI',
  'kuba': 'CUB', 'nikaragua': 'NIC', 'salvador': 'SLV', 'svata lucie': 'LCA',
  'svaty krystof a nevis': 'KNA', 'svaty vincent a grenadiny': 'VCT',
  'trinidad a tobago': 'TTO',
};

function resolveCzCountry(name: string): (typeof COUNTRIES)[number] | undefined {
  const key = stripDiacritics(name).toLowerCase().trim();
  const overrideIso3 = CZ_NAME_OVERRIDES[key];
  if (overrideIso3) return getCountryByIso3(overrideIso3);
  return czEnFallbackMap.get(key);
}

/** Parse MZV's "Aktualizováno: DD.MM.YYYY / HH:MM" into an ISO date, if present. */
function parseCzUpdatedAt(text: string): string | undefined {
  const m = text.match(/aktualizov[aá]no:\s*(\d{2})\.(\d{2})\.(\d{4})/i);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const parsed = new Date(`${yyyy}-${mm}-${dd}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

async function fetchCzAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    // Step 1: discover every country's "cestovani" page from the 8 region
    // hubs -- structural links, resilient to prose changes.
    const links: CzCountryLink[] = [];
    for (const region of CZ_REGIONS) {
      const hubUrl = `${CZ_BASE_URL}/jnp/cz/encyklopedie_statu/${region}/index.html`;
      try {
        const response = await fetchWithRetry(hubUrl, 30_000);
        if (!response.ok) {
          console.warn(`[ADVISORIES-T3B] CZ: hub ${region} HTTP ${response.status}, skipping region`);
          continue;
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        $(`a[href*="/encyklopedie_statu/${region}/"]`).each((_, el) => {
          const href = $(el).attr('href');
          const name = $(el).text().trim();
          // Every hub also links to itself (no /cestovani/ segment) -- skip that one.
          if (!href || !name || !href.includes('/cestovani/')) return;
          const url = href.startsWith('http') ? href : `${CZ_BASE_URL}${href}`;
          if (!links.find((l) => l.url === url)) links.push({ name, url });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[ADVISORIES-T3B] CZ: hub ${region} unavailable (${msg}), skipping region`);
      }
      await delay(300); // polite gap between the 8 hub requests
    }

    if (links.length === 0) {
      console.warn('[ADVISORIES-T3B] CZ: no country links found on any hub page');
      return { indicators, advisoryInfo };
    }

    // Step 2: crawl each country's cestovani page, <=3 concurrent (rule 4).
    await fetchBatch(
      links,
      async (link) => {
        try {
          const country = resolveCzCountry(link.name);
          if (!country) return;

          const response = await fetchWithRetry(link.url, 15_000);
          if (!response.ok) return;

          const html = await response.text();
          const $ = cheerio.load(html);
          const warningLinks = $('#varovani .article_list_varovani a')
            .map((_, el) => $(el).attr('href'))
            .get()
            .filter((href): href is string => Boolean(href));

          if (warningLinks.length === 0) {
            // No "Aktuální doporučení a varování" section at all -- MZV's own
            // comprehensive-per-country baseline, not a skip (see header comment).
            indicators.push({
              countryIso3: country.iso3,
              indicatorName: 'advisory_level_cz',
              value: 1,
              year: currentYear,
              source: 'advisories_cz',
              fetchedAt,
            });
            if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
            advisoryInfo[country.iso3].cz = {
              level: 1,
              text: CZ_LEVEL_TEXT[1],
              source: 'Czech Republic MZV',
              url: link.url,
            };
            return;
          }

          // Almost always one warning article; fetch each and classify the
          // combined text together (a handful of pages, e.g. Israel's, list
          // more than one related warning).
          const articleTexts: string[] = [];
          let updatedAt: string | undefined;
          for (const href of warningLinks) {
            const articleUrl = href.startsWith('http') ? href : `${CZ_BASE_URL}${href}`;
            const artResponse = await fetchWithRetry(articleUrl, 15_000);
            if (!artResponse.ok) continue;
            const artHtml = await artResponse.text();
            const $art = cheerio.load(artHtml);
            const artText = $art('article.article').first().text().replace(/\s+/g, ' ').trim();
            if (artText) {
              articleTexts.push(artText);
              updatedAt ??= parseCzUpdatedAt(artText);
            }
          }

          const combinedText = articleTexts.join(' ');
          const level = normalizeCzLevel(combinedText);
          if (level === null) return; // no classifiable content -- never guess

          indicators.push({
            countryIso3: country.iso3,
            indicatorName: 'advisory_level_cz',
            value: level,
            year: currentYear,
            source: 'advisories_cz',
            fetchedAt,
          });

          if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
          advisoryInfo[country.iso3].cz = {
            level,
            text: CZ_LEVEL_TEXT[level] || `Level ${level}`,
            source: 'Czech Republic MZV',
            url: link.url,
            updatedAt,
          };
        } catch {
          // Individual country page failed, skip silently -- one bad page
          // must not abort the whole crawl.
        }
      },
      3,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ADVISORIES-T3B] CZ: mzv.gov.cz unavailable (${msg}), returning empty result`);
  }

  console.log(`  [CZ] Found ${indicators.length} countries`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 6: Hungary (KKM, "Konzinfo" portal) -- CPLX-12
// Fragility: LOW -- explicit structured classification field, ISO3-mappable
// Repaired 2026-09-25: konzuliszolgalat.kormany.hu 301-redirects to
// konzinfo.mfa.gov.hu, KKM's new consular-information portal (a domain
// migration, same class of break as PL/PT/CZ). The old URL's page had no
// per-country content at all -- just a search widget -- which is why the
// fetch previously threw outright (network exception, not even an HTTP
// error). The new portal's "utazasi-tanacsok-orszagonkent" (travel advice
// by country) hub is a server-rendered Drupal page listing all 199
// countries as `<a class="dropdown-item use-ajax">` entries; each one's
// `href` embeds a Drupal node ID (route_params[node]=NN) that resolves
// directly at /node/NN -- no need to follow the AJAX indirection the site's
// own JS uses. Each node page carries an explicit
// "field--name-field-security-classification" taxonomy field (one of four
// fixed terms, see normalizeHuLevel) instead of free narrative text, so
// unlike PT/CZ this needs no sentence-level scoping or regional-warning
// guard -- KKM already collapses each country to a single classification.
// =============================================================================

const HU_BASE_URL = 'https://konzinfo.mfa.gov.hu';
const HU_HUB_URL = `${HU_BASE_URL}/utazas/utazasi-tanacsok-orszagonkent`;

interface HuCountryLink {
  name: string; // Hungarian display name, from the hub's aria-label
  nodeId: string;
}

// COUNTRIES' `.en` names, keyed accent-folded -- first-pass fallback for
// Hungarian names close to their international form (e.g. "Kanada").
const huEnFallbackMap = new Map<string, (typeof COUNTRIES)[number]>();
for (const country of COUNTRIES) {
  huEnFallbackMap.set(stripDiacritics(country.name.en).toLowerCase(), country);
}

// Most Hungarian country names are Magyar exonyms with no resemblance to
// English (e.g. "Németország" for Germany, "Görögország" for Greece) --
// built by fetching the hub page and mapping every one of the 199 names to
// an ISO3 during the 2026-09-25 repair. A few entries are composite/
// ambiguous territories with no single-country mapping (France's and the
// UK's overseas territories, the Dutch Caribbean islands) and are
// deliberately left out -- skipped, never guessed.
const HU_NAME_OVERRIDES: Record<string, string> = {
  'afganisztan': 'AFG', 'amerikai egyesult allamok': 'USA', 'antigua es barbuda': 'ATG',
  'ausztralia': 'AUS', 'ausztria': 'AUT', 'azerbajdzsan': 'AZE', 'bahama-szigetek': 'BHS',
  'bahrein': 'BHR', 'banglades': 'BGD', 'belarusz koztarsasag (feheroroszorszag)': 'BLR',
  'bissau-guinea': 'GNB', 'bosznia-hercegovina': 'BIH', 'brazilia': 'BRA', 'ciprus': 'CYP',
  'comore-szigeteki unio': 'COM', 'cook-szigetek': 'COK', 'csad': 'TCD', 'csehorszag': 'CZE',
  'dania': 'DNK', 'del-afrikai koztarsasag': 'ZAF', 'del-szudan': 'SSD',
  'dominikai kozosseg': 'DMA', 'dominikai koztarsasag': 'DOM', 'dzsibuti': 'DJI',
  'egyenlitoi-guinea': 'GNQ', 'egyesult arab emirsegek': 'ARE', 'egyiptom': 'EGY',
  'elefantcsontpart': 'CIV', 'etiopia': 'ETH', 'eszak-macedonia': 'MKD', 'esztorszag': 'EST',
  'fidzsi-szigetek': 'FJI', 'finnorszag': 'FIN', 'franciaorszag': 'FRA',
  'fulop-szigetek': 'PHL', 'georgia (gruzia)': 'GEO', 'gorogorszag': 'GRC',
  'hollandia': 'NLD', 'horvatorszag': 'HRV', 'indonezia': 'IDN', 'irak': 'IRQ',
  'izland': 'ISL', 'izrael': 'ISR', 'irorszag': 'IRL', 'jemen': 'YEM', 'jordania': 'JOR',
  'kambodzsa': 'KHM', 'kamerun': 'CMR', 'kanada': 'CAN', 'katar': 'QAT',
  'kazahsztan': 'KAZ', 'kelet-timor': 'TLS', 'kirgizisztan': 'KGZ',
  'kiribati (gilbert-, phoenix es line-szigetek)': 'KIR', 'kina': 'CHN', 'kolumbia': 'COL',
  'kongoi demokratikus koztarsasag': 'COD', 'kongoi koztarsasag (kongo)': 'COG',
  'koreai koztarsasag, (del-korea)': 'KOR', 'koreai nepi demokratikus koztarsasag (eszak-korea)': 'PRK',
  'koszovo': 'XKX', 'kozep-afrika': 'CAF', 'kuba': 'CUB', 'kuvait': 'KWT', 'laosz': 'LAO',
  'lengyelorszag': 'POL', 'lettorszag': 'LVA', 'libanon': 'LBN', 'litvania': 'LTU',
  'libia allam': 'LBY', 'luxemburg': 'LUX', 'madagaszkar': 'MDG', 'malajzia': 'MYS',
  'maldiv-szigetek': 'MDV', 'marokko': 'MAR', 'marshall-szigetek': 'MHL', 'mexiko': 'MEX',
  'mianmar': 'MMR', 'mikronezia': 'FSM', 'mozambik': 'MOZ',
  'nagy-britannia es eszak-irorszag egyesult kiralysaga': 'GBR', 'nemetorszag': 'DEU',
  'norvegia': 'NOR', 'olaszorszag': 'ITA', 'oroszorszag': 'RUS', 'ormenyorszag': 'ARM',
  'pakisztan': 'PAK', 'palesztina': 'PSE', 'papua uj-guinea': 'PNG', 'portugalia': 'PRT',
  'ruanda': 'RWA', 'saint kitts es nevis': 'KNA', 'saint vincent es a grenadine-szigetek': 'VCT',
  'salamon-szigetek': 'SLB', 'sao tome es principe': 'STP', 'seychelle-szigetek': 'SYC',
  'spanyolorszag': 'ESP', 'svajc': 'CHE', 'svedorszag': 'SWE', 'szamoai fuggetlen allam': 'WSM',
  'szaud-arabia': 'SAU', 'szenegal': 'SEN', 'szerbia': 'SRB', 'szingapur': 'SGP',
  'sziria': 'SYR', 'szlovakia': 'SVK', 'szlovenia': 'SVN', 'szomalia': 'SOM',
  'szudan': 'SDN', 'szvazifold': 'SWZ', 'tajvan': 'TWN',
  'tadzsikisztan': 'TJK', 'thaifold': 'THA', 'torokorszag': 'TUR',
  'trinidad es tobago': 'TTO', 'tunezia': 'TUN', 'turkmenisztan': 'TKM', 'ukrajna': 'UKR',
  'uj-zeland': 'NZL', 'uzbegisztan': 'UZB', 'zold-foki koztarsasag': 'CPV',
};

function resolveHuCountry(name: string): (typeof COUNTRIES)[number] | undefined {
  const key = stripDiacritics(name).toLowerCase().trim();
  const overrideIso3 = HU_NAME_OVERRIDES[key];
  if (overrideIso3) return getCountryByIso3(overrideIso3);
  return huEnFallbackMap.get(key);
}

/** Parse KKM's "Biztonsági besorolás utolsó módosítása: YYYY.MM.DD." into an ISO date, if present. */
function parseHuUpdatedAt(text: string): string | undefined {
  const m = text.match(/(\d{4})\.(\d{2})\.(\d{2})\.?/);
  if (!m) return undefined;
  const [, yyyy, mm, dd] = m;
  const parsed = new Date(`${yyyy}-${mm}-${dd}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

async function fetchHuAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    // Step 1: discover every country + Drupal node ID from the hub page.
    const hubResponse = await fetchWithRetry(HU_HUB_URL, 30_000);
    if (!hubResponse.ok) {
      console.warn(`[ADVISORIES-T3B] HU: hub HTTP ${hubResponse.status}, no data available`);
      return { indicators, advisoryInfo };
    }
    const hubHtml = await hubResponse.text();
    const $hub = cheerio.load(hubHtml);
    const links: HuCountryLink[] = [];
    $hub('a.dropdown-item.use-ajax').each((_, el) => {
      const href = $hub(el).attr('href') ?? '';
      const name = $hub(el).attr('aria-label')?.trim();
      const nodeMatch = href.match(/route_params(?:%5B|\[)node(?:%5D|\])=(\d+)/);
      if (!name || !nodeMatch) return;
      links.push({ name, nodeId: nodeMatch[1] });
    });

    if (links.length === 0) {
      console.warn('[ADVISORIES-T3B] HU: no country entries found on hub page');
      return { indicators, advisoryInfo };
    }

    // Step 2: fetch each country's node page, <=3 concurrent (rule 4).
    await fetchBatch(
      links,
      async (link) => {
        try {
          const country = resolveHuCountry(link.name);
          if (!country) return;

          const response = await fetchWithRetry(`${HU_BASE_URL}/node/${link.nodeId}`, 15_000);
          if (!response.ok) return;

          const html = await response.text();
          const $ = cheerio.load(html);
          const classification = $('.field--name-field-security-classification .field--name-name')
            .first()
            .text()
            .trim();
          const level = normalizeHuLevel(classification);
          if (level === null) return; // no recognised classification -- never guess

          const lastModText = $('.field--name-field-sec-rating-last-modfied').first().text();

          indicators.push({
            countryIso3: country.iso3,
            indicatorName: 'advisory_level_hu',
            value: level,
            year: currentYear,
            source: 'advisories_hu',
            fetchedAt,
          });

          if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
          advisoryInfo[country.iso3].hu = {
            level,
            text: HU_LEVEL_TEXT[level] || `Level ${level}`,
            source: 'Hungary KKM',
            url: `${HU_BASE_URL}/node/${link.nodeId}`,
            updatedAt: parseHuUpdatedAt(lastModText),
          };
        } catch {
          // Individual country page failed, skip silently -- one bad page
          // must not abort the whole crawl.
        }
      },
      3,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ADVISORIES-T3B] HU: konzinfo.mfa.gov.hu unavailable (${msg}), returning empty result`);
  }

  console.log(`  [HU] Found ${indicators.length} countries`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 7: Portugal (MNE) -- CPLX-13
// Fragility: MEDIUM -- Portuguese narrative text, one page per country
// Repaired 2026-09-25: the old single-page scrape read the top
// "conselhos-aos-viajantes" listing, which only carries a nav menu (country
// links to the CONSULAR directory, unrelated "rede-consular" URLs) -- no
// advisory text lives there at all, so normalizePtLevel's old text search
// silently fell through to its level-1 default for nearly every match. The
// real per-country pages, e.g. .../conselhos-aos-viajantes/africa/egipto,
// are separate, server-rendered (no JS needed, confirmed by diffing fetched
// HTML against the rendered DOM), and carry free-form advisory prose with an
// explicit "Última atualização: DD/MM/YYYY" date. Every country's URL and
// Portuguese display name come from the five regional hub pages
// (africa/america/asia/europa/oceania), which link to them structurally --
// far more durable than guessing slugs.
//
// KNOWN RISK: the old code's CI failure was "HTTP 403, no data available"
// from GitHub-hosted runners specifically (gh run view 36128588016), while
// this same URL returns 200 consistently from a residential IP regardless
// of User-Agent (tested with the pipeline's own UA, no UA, and a generic
// python-requests UA -- all 200 locally). That rules out UA sniffing, which
// points to an IP/ASN-level block on MNE's side. This is a traditional
// server-rendered Joomla site with no client-side API to call instead (no
// XHR traffic at all -- verified with a network capture), so there is no
// alternative endpoint per rule 5 of the repair brief. Ships anyway because
// (a) it cannot be verified from here whether GitHub Actions IPs are still
// blocked without triggering a real workflow run, which is out of scope for
// this repair, and (b) if it IS still blocked, enforcePerSourceFloors keeps
// serving the last good cache with a loud CI error either way -- no silent
// regression risk. Orchestrator: check the next real pipeline run's
// "[ADVISORIES-T3B] PT:" log line to confirm reachability.
// =============================================================================

const PT_BASE_URL = 'https://portaldascomunidades.mne.gov.pt';
const PT_REGIONS = ['africa', 'america', 'asia', 'europa', 'oceania'] as const;

interface PtCountryLink {
  name: string; // Portuguese display name, straight from the hub page's link text
  url: string;
}

/** Parse MNE's "Última atualização: DD/MM/YYYY" into an ISO date, if present. */
function parsePtUpdatedAt(text: string): string | undefined {
  const m = text.match(/[uú]ltima atualiza[cç][aã]o:\s*(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!m) return undefined;
  const [, dd, mm, yyyy] = m;
  const parsed = new Date(`${yyyy}-${mm}-${dd}`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

const PT_AVISOS_START = /^avisos?\b/i;
const PT_SECTION_END = /^(app registo viajante|informa[cç][aã]o geral|contactos)/i;

/**
 * Extract just the "Avisos" (warnings) section of a country page, not the
 * whole `.com-content-article__body`. The full body also contains an
 * encyclopedic "Informação geral" section (climate, customs/drug-law notes,
 * neighbouring-country context, ...) that reuses the same "desaconselh*"
 * vocabulary for unrelated topics -- e.g. Mexico's page calls psychotropic
 * substances "fortemente desaconselhada" and separately describes a
 * Guatemala border problem as "desaconselhável", neither of which is about
 * whether to travel to Mexico. Scoping to the Avisos section (bounded by the
 * "APP REGISTO VIAJANTE" boilerplate that follows it on every page) avoids
 * that cross-contamination; a page with no Avisos heading at all (common for
 * very safe countries, e.g. Italy/USA) legitimately returns "".
 */
function extractPtAvisosText($: cheerio.CheerioAPI): string {
  const body = $('.com-content-article__body');
  const parts: string[] = [];
  let collecting = false;
  for (const el of body.children().toArray()) {
    const text = $(el).text().trim();
    if (!text) continue;
    if (!collecting) {
      if (PT_AVISOS_START.test(text)) collecting = true;
      continue;
    }
    if (PT_SECTION_END.test(text)) break;
    parts.push(text);
  }
  if (parts.length > 0) return parts.join(' ').replace(/\s+/g, ' ').trim();

  // Fallback for pages where MNE bundles the disclaimer and the Avisos
  // heading into one DOM node instead of separate paragraphs (seen on e.g.
  // Russia's page) -- same idea, applied to the flattened text. The negative
  // lookbehind keeps "pré-aviso" (advance notice, e.g. about transport
  // strikes -- unrelated prose that happens to contain the substring) from
  // being misread as the section heading.
  const fullText = body.text().replace(/\s+/g, ' ').trim();
  const m = fullText.match(/(?<!-)\bavisos?\b/i);
  if (!m || m.index === undefined) return '';
  const rest = fullText.slice(m.index + m[0].length);
  const endMatch = rest.match(/app registo viajante|informa[cç][aã]o geral/i);
  return (endMatch && endMatch.index !== undefined ? rest.slice(0, endMatch.index) : rest).trim();
}

function stripDiacritics(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// COUNTRIES' own `.pt` names, keyed accent-folded -- built once so every one
// of MNE's 200 country pages can resolve without a hand-typed name map.
const ptNameMap = new Map<string, (typeof COUNTRIES)[number]>();
for (const country of COUNTRIES) {
  ptNameMap.set(stripDiacritics(country.name.pt).toLowerCase(), country);
}

// MNE (European Portuguese) occasionally diverges from this codebase's more
// Brazilian-leaning `name.pt` strings -- e.g. "Burkina Faso" vs our
// "Burquina Faso", "Chéquia" vs "República Tcheca", "Grenada" vs "Granada".
// Built by diffing all 200 links from the five hub pages against
// COUNTRIES during the 2026-09-25 repair; every key below is a real,
// verified miss, not a guess. "Israel e Territórios Palestinianos
// Ocupados" is MNE's own single combined page for both, so it fans out to
// both ISO3s. Bermuda has no entry: it's a UK territory outside our
// 248-country list (same gap PL's Odyseusz fetcher hit).
const PT_NAME_OVERRIDES: Record<string, string[]> = {
  'burkina faso': ['BFA'],
  'djibouti': ['DJI'],
  'egipto': ['EGY'],
  'guine bissau': ['GNB'],
  'guine conacry': ['GIN'],
  'mauricias (ilhas)': ['MUS'],
  'republica centro africana': ['CAF'],
  'republica do congo': ['COG'],
  'seychelles': ['SYC'],
  'estados unidos da america': ['USA'],
  'grenada': ['GRD'],
  'bahrain': ['BHR'],
  'irao': ['IRN'],
  'israel e territorios palestinianos ocupados': ['ISR', 'PSE'],
  'koweit': ['KWT'],
  'myanmar': ['MMR'],
  'oma (sultanato)': ['OMN'],
  'qatar': ['QAT'],
  'timor leste': ['TLS'],
  'turquemenistao': ['TKM'],
  'vietname': ['VNM'],
  'bosnia-herzegovina': ['BIH'],
  'chequia': ['CZE'],
  'moldova': ['MDA'],
  'sao marino': ['SMR'],
  'vaticano': ['VAT'],
  'cook (ilhas)': ['COK'],
  'marshall (ilhas)': ['MHL'],
  'papua nova guine': ['PNG'],
  'salomao (ilhas)': ['SLB'],
  'samoa (estado independente)': ['WSM'],
};

/** Resolve MNE's Portuguese country-page name to our CountryEntry list --
 *  usually one entry, two for MNE's combined Israel/Palestine page, zero
 *  for territories we don't track (e.g. Bermuda). */
function resolvePtCountries(name: string): (typeof COUNTRIES)[number][] {
  const key = stripDiacritics(name).toLowerCase().trim();
  const overrideIsos = PT_NAME_OVERRIDES[key];
  if (overrideIsos) {
    return overrideIsos
      .map((iso3) => getCountryByIso3(iso3))
      .filter((c): c is (typeof COUNTRIES)[number] => Boolean(c));
  }
  const direct = ptNameMap.get(key);
  return direct ? [direct] : [];
}

async function fetchPtAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    // Step 1: discover every country page from the five regional hub pages --
    // structural links (href + anchor text), not narrative text, so this
    // half is resilient to prose/wording changes.
    const links: PtCountryLink[] = [];
    for (const region of PT_REGIONS) {
      const hubUrl = `${PT_BASE_URL}/pt/vai-viajar/conselhos-aos-viajantes/${region}`;
      try {
        const response = await fetch(hubUrl, { signal: AbortSignal.timeout(30_000), headers: FETCH_HEADERS });
        if (!response.ok) {
          console.warn(`[ADVISORIES-T3B] PT: hub ${region} HTTP ${response.status}, skipping region`);
          continue;
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        $(`a[href*="/vai-viajar/conselhos-aos-viajantes/${region}/"]`).each((_, el) => {
          const href = $(el).attr('href');
          const name = $(el).text().trim();
          if (!href || !name) return;
          const url = href.startsWith('http') ? href : `${PT_BASE_URL}${href}`;
          if (!links.find((l) => l.url === url)) links.push({ name, url });
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[ADVISORIES-T3B] PT: hub ${region} unavailable (${msg}), skipping region`);
      }
      await delay(300); // polite gap between the 5 hub requests
    }

    if (links.length === 0) {
      console.warn('[ADVISORIES-T3B] PT: no country links found on any hub page');
      return { indicators, advisoryInfo };
    }

    // Step 2: crawl each country page, <=3 concurrent (rule 4).
    await fetchBatch(
      links,
      async (link) => {
        try {
          const countries = resolvePtCountries(link.name);
          if (countries.length === 0) return;

          const response = await fetch(link.url, { signal: AbortSignal.timeout(15_000), headers: FETCH_HEADERS });
          if (!response.ok) return;

          const html = await response.text();
          const $ = cheerio.load(html);
          const bodyText = $('.com-content-article__body').text().replace(/\s+/g, ' ').trim();
          if (bodyText.length < 20) return; // page loaded but carries no content -- never guess

          const avisosText = extractPtAvisosText($);
          // No Avisos section at all is itself MNE's comprehensive-per-country
          // "nothing to flag" baseline (confirmed on ITA/USA, which have full
          // pages but skip straight to the boilerplate app-promo section) --
          // level 1, not a skip.
          const level = avisosText ? normalizePtLevel(avisosText) : 1;
          if (level === null) return; // Avisos section present but unreadable -- never guess

          const updatedAt = parsePtUpdatedAt(bodyText);
          // Almost always one country; two only for MNE's combined
          // Israel/Palestine page, which applies the same text to both.
          for (const country of countries) {
            indicators.push({
              countryIso3: country.iso3,
              indicatorName: 'advisory_level_pt',
              value: level,
              year: currentYear,
              source: 'advisories_pt',
              fetchedAt,
            });

            if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
            advisoryInfo[country.iso3].pt = {
              level,
              text: PT_LEVEL_TEXT[level] || `Level ${level}`,
              source: 'Portugal MNE',
              url: link.url,
              updatedAt,
            };
          }
        } catch {
          // Individual country page failed, skip silently -- one bad page
          // must not abort the whole crawl.
        }
      },
      3,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[ADVISORIES-T3B] PT: portaldascomunidades.mne.gov.pt unavailable (${msg}), returning empty result`);
  }

  console.log(`  [PT] Found ${indicators.length} countries`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Main export: orchestrates all 7 sub-fetchers
// =============================================================================

export async function fetchTier3bAdvisories(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const currentYear = new Date().getFullYear();

  const allIndicators: RawIndicator[] = [];
  const combinedAdvisoryInfo: AdvisoryInfoMap = {};
  const errors: string[] = [];

  // Fetch Switzerland advisories
  try {
    console.log('[ADVISORIES-T3B] Fetching Switzerland (EDA) advisories...');
    const result = await fetchChAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3B] CH: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3B] CH fetch failed: ${msg}`);
    errors.push(`CH: ${msg}`);
  }

  // Fetch Sweden advisories
  try {
    console.log('[ADVISORIES-T3B] Fetching Sweden (UD) advisories...');
    const result = await fetchSeAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3B] SE: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3B] SE fetch failed: ${msg}`);
    errors.push(`SE: ${msg}`);
  }

  // Fetch Norway advisories
  try {
    console.log('[ADVISORIES-T3B] Fetching Norway (UD) advisories...');
    const result = await fetchNoAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3B] NO: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3B] NO fetch failed: ${msg}`);
    errors.push(`NO: ${msg}`);
  }

  // Fetch Poland advisories
  try {
    console.log('[ADVISORIES-T3B] Fetching Poland (MSZ) advisories...');
    const result = await fetchPlAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3B] PL: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3B] PL fetch failed: ${msg}`);
    errors.push(`PL: ${msg}`);
  }

  // Fetch Czech Republic advisories
  try {
    console.log('[ADVISORIES-T3B] Fetching Czech Republic (MZV) advisories...');
    const result = await fetchCzAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3B] CZ: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3B] CZ fetch failed: ${msg}`);
    errors.push(`CZ: ${msg}`);
  }

  // Fetch Hungary advisories
  try {
    console.log('[ADVISORIES-T3B] Fetching Hungary (KKM) advisories...');
    const result = await fetchHuAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3B] HU: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3B] HU fetch failed: ${msg}`);
    errors.push(`HU: ${msg}`);
  }

  // Fetch Portugal advisories
  try {
    console.log('[ADVISORIES-T3B] Fetching Portugal (MNE) advisories...');
    const result = await fetchPtAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T3B] PT: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T3B] PT fetch failed: ${msg}`);
    errors.push(`PT: ${msg}`);
  }

  // If all failed, try cached data
  if (allIndicators.length === 0) {
    const cached = findLatestCached('advisories-tier3b-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[ADVISORIES-T3B] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'advisories-tier3b-parsed.json'), cachedData);
        const cachedInfoPath = cached.replace(
          'advisories-tier3b-parsed.json',
          'advisories-tier3b-info.json',
        );
        const cachedInfo = readJson<AdvisoryInfoMap>(cachedInfoPath);
        if (cachedInfo) {
          writeJson(join(rawDir, 'advisories-tier3b-info.json'), cachedInfo);
        }
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'advisories_tier3b',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Errors: ${errors.join('; ')}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'advisories_tier3b',
      success: false,
      countriesFound: 0,
      error: errors.join('; '),
      fetchedAt,
    };
  }

  // Per-source floor check: a single issuer's site redesign must not
  // silently drop its column (restores from the last healthy cache).
  enforcePerSourceFloors({
    logPrefix: '[ADVISORIES-T3B]',
    infoFile: 'advisories-tier3b-info.json',
    // Full issuer list from this tier's sub-fetchers — a zero-row collapse
    // must be caught too, not skipped because nothing was fetched.
    expectedIssuers: [
      'ch',
      'cz',
      'hu',
      'no',
      'pl',
      'pt',
      'se',
    ],
    // Measured minimums — small issuers must not false-positive daily.
    floors: { ch: 8, cz: 0, hu: 0, se: 0, no: 0 }, // 0 = never produced data yet: monitor silently
    indicators: allIndicators,
    advisoryInfo: combinedAdvisoryInfo,
    errors,
    runDate: date,
  });

  // Save combined parsed data
  const sourceData: RawSourceData = {
    source: 'advisories_tier3b',
    fetchedAt,
    indicators: allIndicators,
  };
  writeJson(join(rawDir, 'advisories-tier3b-parsed.json'), sourceData);

  // Save advisory info side-channel
  writeJson(join(rawDir, 'advisories-tier3b-info.json'), combinedAdvisoryInfo);

  const totalCountries = new Set(allIndicators.map((i) => i.countryIso3)).size;
  console.log(
    `[ADVISORIES-T3B] Successfully processed ${totalCountries} countries total (${allIndicators.length} indicators)`,
  );

  return {
    source: 'advisories_tier3b',
    success: true,
    countriesFound: totalCountries,
    error: errors.length > 0 ? `Partial: ${errors.join('; ')}` : undefined,
    fetchedAt,
  };
}
