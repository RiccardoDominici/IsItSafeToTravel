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
  1: 'Budte obezretni',
  2: 'Zvysena opatrnost',
  3: 'Zvazit nezbytnost cesty',
  4: 'Nedoporucujeme cestovat',
};

const HU_LEVEL_TEXT: Record<number, string> = {
  1: 'Legyen oevatos',
  2: 'Fokozott ovatossag',
  3: 'Fokozott eloreelatas',
  4: 'Ne utazzon!',
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

// Czech country names
const CZECH_NAMES: Record<string, string> = {
  'Spojene staty americke': 'United States',
  'Velka Britanie': 'United Kingdom',
  'Francie': 'France',
  'Nemecko': 'Germany',
  'Italie': 'Italy',
  'Spanelsko': 'Spain',
  'Rusko': 'Russia',
  'Brazilie': 'Brazil',
  'Indie': 'India',
  'Jizni Korea': 'South Korea',
  'Severni Korea': 'North Korea',
  'Jihoafricka republika': 'South Africa',
  'Turecko': 'Turkey',
  'Recko': 'Greece',
  'Chorvatsko': 'Croatia',
  'Rumunsko': 'Romania',
  'Madarsko': 'Hungary',
  'Slovensko': 'Slovakia',
  'Rakousko': 'Austria',
  'Belgie': 'Belgium',
  'Nizozemsko': 'Netherlands',
  'Dansko': 'Denmark',
  'Svedsko': 'Sweden',
  'Norsko': 'Norway',
  'Finsko': 'Finland',
  'Novy Zeland': 'New Zealand',
  'Mexiko': 'Mexico',
  'Cina': 'China',
  'Japonsko': 'Japan',
  'Filipiny': 'Philippines',
  'Belorusko': 'Belarus',
  'Svycarsko': 'Switzerland',
  'Polsko': 'Poland',
  'Portugalsko': 'Portugal',
  'Maroko': 'Morocco',
  'Ukrajina': 'Ukraine',
};

// Hungarian country names
const HUNGARIAN_NAMES: Record<string, string> = {
  'Egyesuelt Allamok': 'United States',
  'Egyesult Kiralysag': 'United Kingdom',
  'Nagy-Britannia': 'United Kingdom',
  'Franciaorszag': 'France',
  'Nemetorszag': 'Germany',
  'Olaszorszag': 'Italy',
  'Spanyolorszag': 'Spain',
  'Oroszorszag': 'Russia',
  'India': 'India',
  'Del-Korea': 'South Korea',
  'Eszak-Korea': 'North Korea',
  'Del-Afrika': 'South Africa',
  'Egyiptom': 'Egypt',
  'Toerokoeszag': 'Turkey',
  'Goerogoeszag': 'Greece',
  'Horvatorszag': 'Croatia',
  'Romania': 'Romania',
  'Csehorszag': 'Czech Republic',
  'Szlovakia': 'Slovakia',
  'Ausztria': 'Austria',
  'Hollandia': 'Netherlands',
  'Dania': 'Denmark',
  'Svedorszag': 'Sweden',
  'Norvegia': 'Norway',
  'Finnorszag': 'Finland',
  'Uj-Zeland': 'New Zealand',
  'Kina': 'China',
  'Fulop-szigetek': 'Philippines',
  'Feheroroszorszag': 'Belarus',
  'Szaud-Arabia': 'Saudi Arabia',
  'Svajc': 'Switzerland',
  'Lengyelorszag': 'Poland',
  'Portugalia': 'Portugal',
  'Ukrajna': 'Ukraine',
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
// Fragility: MEDIUM -- Czech text, government page
// Expected failure modes: Page redesign, Czech-only content
// =============================================================================

async function fetchCzAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(
      'https://www.mzv.cz/jnp/cz/cestujeme/aktualni_doporuceni_a_varovani/index.html',
      {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      },
    );

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3B] CZ: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse advisory entries
    $('a, li, h3, h4, td').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length < 3 || text.length > 50) return;

      const country = matchCountry(text, CZECH_NAMES);
      if (!country) return;
      if (indicators.find(i => i.countryIso3 === country.iso3)) return;

      const parentText = $(el).closest('li, div, section, tr, article, p').text();
      const level = normalizeCzLevel(parentText);

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
        url: 'https://www.mzv.cz/jnp/cz/cestujeme/aktualni_doporuceni_a_varovani/index.html',
      };
    });
  } catch {
    console.warn('[ADVISORIES-T3B] CZ: mzv.cz unavailable, returning empty result');
  }

  console.log(`  [CZ] Found ${indicators.length} countries`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 6: Hungary (KKM) -- CPLX-12
// Fragility: MEDIUM -- Hungarian text, government page
// Expected failure modes: Page redesign, Hungarian-only content
// =============================================================================

async function fetchHuAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(
      'https://konzuliszolgalat.kormany.hu/utazasi-tanacsok',
      {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      },
    );

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3B] HU: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse advisory entries from travel advice page
    $('a, li, h3, h4, td').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length < 3 || text.length > 50) return;

      const country = matchCountry(text, HUNGARIAN_NAMES);
      if (!country) return;
      if (indicators.find(i => i.countryIso3 === country.iso3)) return;

      const parentText = $(el).closest('li, div, section, tr, article, p').text();
      const level = normalizeHuLevel(parentText);

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
        url: 'https://konzuliszolgalat.kormany.hu/utazasi-tanacsok',
      };
    });
  } catch {
    console.warn('[ADVISORIES-T3B] HU: kormany.hu unavailable, returning empty result');
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
