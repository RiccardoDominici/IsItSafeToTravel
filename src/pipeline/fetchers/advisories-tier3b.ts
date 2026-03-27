import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName } from '../config/countries.js';
import {
  normalizeChLevel,
  normalizeSeLevel,
  normalizeNoLevel,
  normalizePlLevel,
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

const PL_LEVEL_TEXT: Record<number, string> = {
  1: 'Zachowaj czujnosc',
  2: 'Zachowaj szczegolna ostroznosc',
  3: 'Odradza sie podrozowanie',
  4: 'Nie planuj podrozy',
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
  1: 'Precaucao normal',
  2: 'Recomenda precaucao',
  3: 'Condicionada',
  4: 'Desaconselhada',
};

interface FetcherResult {
  indicators: RawIndicator[];
  advisoryInfo: AdvisoryInfoMap;
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

// Polish country names
const POLISH_NAMES: Record<string, string> = {
  'Stany Zjednoczone': 'United States',
  'Wielka Brytania': 'United Kingdom',
  'Francja': 'France',
  'Niemcy': 'Germany',
  'Wlochy': 'Italy',
  'Hiszpania': 'Spain',
  'Rosja': 'Russia',
  'Brazylia': 'Brazil',
  'Indie': 'India',
  'Korea Poludniowa': 'South Korea',
  'Korea Polnocna': 'North Korea',
  'Republika Poludniowej Afryki': 'South Africa',
  'Egipt': 'Egypt',
  'Turcja': 'Turkey',
  'Grecja': 'Greece',
  'Chorwacja': 'Croatia',
  'Rumunia': 'Romania',
  'Wegry': 'Hungary',
  'Czechy': 'Czech Republic',
  'Slowacja': 'Slovakia',
  'Austria': 'Austria',
  'Belgia': 'Belgium',
  'Holandia': 'Netherlands',
  'Dania': 'Denmark',
  'Szwecja': 'Sweden',
  'Norwegia': 'Norway',
  'Finlandia': 'Finland',
  'Nowa Zelandia': 'New Zealand',
  'Meksyk': 'Mexico',
  'Kolumbia': 'Colombia',
  'Chiny': 'China',
  'Japonia': 'Japan',
  'Filipiny': 'Philippines',
  'Kambodza': 'Cambodia',
  'Bialorus': 'Belarus',
  'Arabia Saudyjska': 'Saudi Arabia',
  'Zjednoczone Emiraty Arabskie': 'United Arab Emirates',
  'Szwajcaria': 'Switzerland',
  'Portugalia': 'Portugal',
  'Maroko': 'Morocco',
  'Tunezja': 'Tunisia',
  'Libia': 'Libya',
  'Ukraina': 'Ukraine',
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

// Portuguese country names
const PORTUGUESE_NAMES: Record<string, string> = {
  'Estados Unidos': 'United States',
  'Reino Unido': 'United Kingdom',
  'Franca': 'France',
  'Alemanha': 'Germany',
  'Italia': 'Italy',
  'Espanha': 'Spain',
  'Russia': 'Russia',
  'India': 'India',
  'Coreia do Sul': 'South Korea',
  'Coreia do Norte': 'North Korea',
  'Africa do Sul': 'South Africa',
  'Egito': 'Egypt',
  'Turquia': 'Turkey',
  'Grecia': 'Greece',
  'Croacia': 'Croatia',
  'Romenia': 'Romania',
  'Hungria': 'Hungary',
  'Republica Checa': 'Czech Republic',
  'Eslovaquia': 'Slovakia',
  'Austria': 'Austria',
  'Belgica': 'Belgium',
  'Holanda': 'Netherlands',
  'Paises Baixos': 'Netherlands',
  'Dinamarca': 'Denmark',
  'Suecia': 'Sweden',
  'Noruega': 'Norway',
  'Finlandia': 'Finland',
  'Nova Zelandia': 'New Zealand',
  'Mexico': 'Mexico',
  'China': 'China',
  'Japao': 'Japan',
  'Filipinas': 'Philippines',
  'Bielorrussia': 'Belarus',
  'Arabia Saudita': 'Saudi Arabia',
  'Emirados Arabes Unidos': 'United Arab Emirates',
  'Suica': 'Switzerland',
  'Polonia': 'Poland',
  'Marrocos': 'Morocco',
  'Tunisia': 'Tunisia',
  'Libia': 'Libya',
  'Ucrania': 'Ukraine',
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
        updatedAt: fetchedAt,
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
          updatedAt: fetchedAt,
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
        updatedAt: fetchedAt,
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
        updatedAt: fetchedAt,
      };
    });
  } catch {
    console.warn('[ADVISORIES-T3B] NO: regjeringen.no unavailable, returning empty result');
  }

  console.log(`  [NO] Found ${indicators.length} countries`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 4: Poland (MSZ) -- CPLX-10
// Fragility: MEDIUM -- Polish text, government page
// Expected failure modes: Page redesign, Polish-only content
// =============================================================================

async function fetchPlAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(
      'https://www.gov.pl/web/dyplomacja/informacje-dla-podrozujacych',
      {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      },
    );

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3B] PL: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse country advisories from travel information page
    $('a, li, h3, h4, td').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length < 3 || text.length > 50) return;

      const country = matchCountry(text, POLISH_NAMES);
      if (!country) return;
      if (indicators.find(i => i.countryIso3 === country.iso3)) return;

      const parentText = $(el).closest('li, div, section, tr, article, p').text();
      const level = normalizePlLevel(parentText);

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
        source: 'Poland MSZ',
        url: 'https://www.gov.pl/web/dyplomacja/informacje-dla-podrozujacych',
        updatedAt: fetchedAt,
      };
    });
  } catch {
    console.warn('[ADVISORIES-T3B] PL: gov.pl unavailable, returning empty result');
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
        updatedAt: fetchedAt,
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
        updatedAt: fetchedAt,
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
// Fragility: MEDIUM -- Portuguese text, government page
// Expected failure modes: Page redesign, Portuguese-only content
// =============================================================================

async function fetchPtAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const response = await fetch(
      'https://portaldascomunidades.mne.gov.pt/pt/vai-viajar/conselhos-aos-viajantes',
      {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      },
    );

    if (!response.ok) {
      console.warn(`[ADVISORIES-T3B] PT: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse advisory entries
    $('a, li, h3, h4, td').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length < 3 || text.length > 50) return;

      const country = matchCountry(text, PORTUGUESE_NAMES);
      if (!country) return;
      if (indicators.find(i => i.countryIso3 === country.iso3)) return;

      const parentText = $(el).closest('li, div, section, tr, article, p').text();
      const level = normalizePtLevel(parentText);

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
        url: 'https://portaldascomunidades.mne.gov.pt/pt/vai-viajar/conselhos-aos-viajantes',
        updatedAt: fetchedAt,
      };
    });
  } catch {
    console.warn('[ADVISORIES-T3B] PT: portaldascomunidades.mne.gov.pt unavailable, returning empty result');
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
