import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, getCountryByIso3, COUNTRIES } from '../config/countries.js';
import {
  normalizeFrColor,
  normalizeHkAlert,
  normalizeIeRating,
  normalizeFiLevel,
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
const FR_LEVEL_TEXT: Record<number, string> = {
  1: 'Vigilance normale',
  2: 'Vigilance renforcee',
  3: 'Deconseille sauf raison',
  4: 'Formellement deconseille',
};

const NZ_LEVEL_TEXT: Record<number, string> = {
  1: 'Exercise normal precautions',
  2: 'Exercise increased caution',
  3: 'Avoid non-essential travel',
  4: 'Do not travel',
};

const IE_LEVEL_TEXT: Record<number, string> = {
  1: 'Normal Precautions',
  2: 'Exercise Caution',
  3: 'Avoid Non-Essential Travel',
  4: 'Do Not Travel',
};

const FI_LEVEL_TEXT: Record<number, string> = {
  1: 'Noudata tavanomaista varovaisuutta',
  2: 'Noudata erityista varovaisuutta',
  3: 'Valta tarpeetonta matkustamista',
  4: 'Valta kaikkea matkustamista',
};

const HK_LEVEL_TEXT: Record<number, string> = {
  1: 'No alert',
  2: 'Amber (signs of threat)',
  3: 'Red (significant threat)',
  4: 'Black (severe threat)',
};

const BR_LEVEL_TEXT: Record<number, string> = {
  1: 'No specific advisory',
};

const AT_LEVEL_TEXT: Record<number, string> = {
  1: 'Sichere Lage',
  2: 'Sicherheitsrisiko',
  3: 'Hohes Sicherheitsrisiko',
  4: 'Reisewarnung',
};

const PH_LEVEL_TEXT: Record<number, string> = {
  1: 'Alert Level 1',
  2: 'Alert Level 2',
  3: 'Alert Level 3',
  4: 'Alert Level 4',
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
// Sub-fetcher 1: Austria (BMEIA) -- HTML-07 -- HIGHEST CONFIDENCE
// =============================================================================

async function fetchAtAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const response = await fetch('https://www.bmeia.gv.at/reise-services/reisewarnungen', {
    signal: AbortSignal.timeout(30_000),
    headers: FETCH_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const match = html.match(/bmeiaCountrySecurityInfos\s*=\s*(\{[\s\S]*?\});/);
  if (!match) throw new Error('bmeiaCountrySecurityInfos not found in page');

  const data = JSON.parse(match[1]) as Record<string, {
    security: number;
    securityPartial: number;
    link?: string;
    title?: string;
  }>;

  for (const [iso2, entry] of Object.entries(data)) {
    const country = getCountryByIso2(iso2.toUpperCase());
    if (!country) continue;

    const level = Math.min(4, Math.max(1, Math.max(entry.security, entry.securityPartial || 0))) as UnifiedLevel;

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_at',
      value: level,
      year: currentYear,
      source: 'advisories_at',
      fetchedAt,
    });

    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].at = {
      level,
      text: AT_LEVEL_TEXT[level] || `Level ${level}`,
      source: 'Austrian Federal Ministry',
      url: `https://www.bmeia.gv.at${entry.link || '/reise-services/reisewarnungen'}`,
      updatedAt: fetchedAt,
    };
  }

  console.log(`[ADVISORIES-T2A] AT: ${indicators.length} countries from BMEIA JS object`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 2: France (diplomatie.gouv.fr) -- HTML-01
// =============================================================================

async function fetchFrAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Build French name -> CountryEntry map
  const frNameMap = new Map<string, typeof COUNTRIES[number]>();
  for (const country of COUNTRIES) {
    frNameMap.set(country.name.fr.toLowerCase(), country);
    // Also add without accents for fuzzy matching
    frNameMap.set(country.name.fr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), country);
  }

  // Fetch RSS feed to get country list and URLs
  const rssResponse = await fetch('https://www.diplomatie.gouv.fr/spip.php?page=backend_fcv', {
    signal: AbortSignal.timeout(30_000),
    headers: FETCH_HEADERS,
  });

  if (!rssResponse.ok) {
    throw new Error(`RSS HTTP ${rssResponse.status}: ${rssResponse.statusText}`);
  }

  const rssXml = await rssResponse.text();
  const $ = cheerio.load(rssXml, { xmlMode: true });

  // Extract country entries from RSS items
  const countryEntries: { name: string; url: string; country: typeof COUNTRIES[number] }[] = [];

  $('item').each((_, item) => {
    const title = $(item).find('title').text().trim();
    const link = $(item).find('link').text().trim();
    if (!title || !link) return;

    const nameLower = title.toLowerCase();
    const nameNormalized = nameLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const country = frNameMap.get(nameLower) || frNameMap.get(nameNormalized);
    if (country) {
      countryEntries.push({ name: title, url: link, country });
    }
  });

  // Batch-crawl per-country pages to extract advisory color/level
  await fetchBatch(
    countryEntries,
    async (entry) => {
      try {
        const pageResponse = await fetch(entry.url, {
          signal: AbortSignal.timeout(15_000),
          headers: FETCH_HEADERS,
        });
        if (!pageResponse.ok) return;

        const pageHtml = await pageResponse.text();
        const pageLower = pageHtml.toLowerCase();

        // Look for color keywords in advisory text
        let level: UnifiedLevel;
        if (pageLower.includes('formellement déconseillé') || pageLower.includes('formellement deconseille') || pageLower.includes('rouge')) {
          level = normalizeFrColor('rouge');
        } else if (pageLower.includes('déconseillé sauf') || pageLower.includes('deconseille sauf') || pageLower.includes('orange')) {
          level = normalizeFrColor('orange');
        } else if (pageLower.includes('vigilance renforcée') || pageLower.includes('vigilance renforcee') || pageLower.includes('jaune')) {
          level = normalizeFrColor('jaune');
        } else if (pageLower.includes('vigilance normale') || pageLower.includes('vert')) {
          level = normalizeFrColor('vert');
        } else {
          // Try CSS classes or image references
          const page$ = cheerio.load(pageHtml);
          const imgSrcs = page$('img').map((_, el) => page$(el).attr('src') || '').get().join(' ').toLowerCase();
          if (imgSrcs.includes('rouge') || imgSrcs.includes('red')) {
            level = 4;
          } else if (imgSrcs.includes('orange')) {
            level = 3;
          } else if (imgSrcs.includes('jaune') || imgSrcs.includes('yellow')) {
            level = 2;
          } else {
            level = 1;
          }
        }

        indicators.push({
          countryIso3: entry.country.iso3,
          indicatorName: 'advisory_level_fr',
          value: level,
          year: currentYear,
          source: 'advisories_fr',
          fetchedAt,
        });

        if (!advisoryInfo[entry.country.iso3]) advisoryInfo[entry.country.iso3] = {};
        advisoryInfo[entry.country.iso3].fr = {
          level,
          text: FR_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'French Ministry of Foreign Affairs',
          url: entry.url,
          updatedAt: fetchedAt,
        };
      } catch {
        // Individual country page failed, skip silently
      }
    },
    5, // Concurrency 5 for politeness
  );

  console.log(`[ADVISORIES-T2A] FR: ${indicators.length} countries from diplomatie.gouv.fr`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 3: Hong Kong (Security Bureau OTA) -- HTML-05
// =============================================================================

async function fetchHkAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const response = await fetch('https://www.sb.gov.hk/eng/ota/', {
    signal: AbortSignal.timeout(30_000),
    headers: FETCH_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Check for blanket alert
  const pageText = $('body').text().toLowerCase();
  let blanketLevel: UnifiedLevel | null = null;

  if (pageText.includes('black outbound travel alert') && pageText.includes('all overseas')) {
    blanketLevel = 4;
  } else if (pageText.includes('red outbound travel alert') && pageText.includes('all overseas')) {
    blanketLevel = 3;
  } else if (pageText.includes('amber outbound travel alert') && pageText.includes('all overseas')) {
    blanketLevel = 2;
  }

  // Find all country links
  const countryLinks: { name: string; url: string }[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.includes('/eng/ota/note-') || href.includes('/eng/ota/info-')) {
      const name = $(el).text().trim();
      if (name && name.length > 1 && name.length < 60) {
        countryLinks.push({
          name,
          url: href.startsWith('http') ? href : `https://www.sb.gov.hk${href.startsWith('/') ? '' : '/eng/ota/'}${href}`,
        });
      }
    }
  });

  if (blanketLevel) {
    // Apply blanket alert to all listed countries
    for (const link of countryLinks) {
      const country = getCountryByName(link.name);
      if (!country) continue;

      indicators.push({
        countryIso3: country.iso3,
        indicatorName: 'advisory_level_hk',
        value: blanketLevel,
        year: currentYear,
        source: 'advisories_hk',
        fetchedAt,
      });

      if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
      advisoryInfo[country.iso3].hk = {
        level: blanketLevel,
        text: HK_LEVEL_TEXT[blanketLevel] || `Level ${blanketLevel}`,
        source: 'Hong Kong Security Bureau',
        url: 'https://www.sb.gov.hk/eng/ota/',
        updatedAt: fetchedAt,
      };
    }

    if (indicators.length > 0) {
      console.log(`[ADVISORIES-T2A] HK: Blanket ${HK_LEVEL_TEXT[blanketLevel]} for ${indicators.length} countries`);
    }
  } else {
    // Check CSS classes for alert levels on the main page
    const yellowAlerts = new Set<string>();
    const redAlerts = new Set<string>();

    $('.yellowAlert a, .amberAlert a').each((_, el) => {
      const name = $(el).text().trim();
      if (name) yellowAlerts.add(name);
    });

    $('.redAlert a').each((_, el) => {
      const name = $(el).text().trim();
      if (name) redAlerts.add(name);
    });

    for (const link of countryLinks) {
      const country = getCountryByName(link.name);
      if (!country) continue;

      let level: UnifiedLevel = 1;
      if (redAlerts.has(link.name)) {
        level = normalizeHkAlert('red');
      } else if (yellowAlerts.has(link.name)) {
        level = normalizeHkAlert('amber');
      }

      indicators.push({
        countryIso3: country.iso3,
        indicatorName: 'advisory_level_hk',
        value: level,
        year: currentYear,
        source: 'advisories_hk',
        fetchedAt,
      });

      if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
      advisoryInfo[country.iso3].hk = {
        level,
        text: HK_LEVEL_TEXT[level] || `Level ${level}`,
        source: 'Hong Kong Security Bureau',
        url: 'https://www.sb.gov.hk/eng/ota/',
        updatedAt: fetchedAt,
      };
    }
  }

  console.log(`[ADVISORIES-T2A] HK: ${indicators.length} countries from OTA`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 4: New Zealand (SafeTravel.govt.nz) -- HTML-02
// =============================================================================

async function fetchNzAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // First try the destinations listing page
  let gotListingData = false;
  try {
    const response = await fetch('https://www.safetravel.govt.nz/destinations', {
      signal: AbortSignal.timeout(30_000),
      headers: FETCH_HEADERS,
    });

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);

      // Look for country entries with advisory levels
      $('a[href*="/destinations/"]').each((_, el) => {
        const text = $(el).text().trim();
        const parentText = $(el).parent().text().trim().toLowerCase();
        const country = getCountryByName(text);
        if (!country) return;

        let level: UnifiedLevel = 1;
        if (parentText.includes('do not travel')) {
          level = 4;
        } else if (parentText.includes('avoid non-essential') || parentText.includes('avoid unnecessary')) {
          level = 3;
        } else if (parentText.includes('increased caution') || parentText.includes('high degree')) {
          level = 2;
        }

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_nz',
          value: level,
          year: currentYear,
          source: 'advisories_nz',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].nz = {
          level,
          text: NZ_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'New Zealand SafeTravel',
          url: `https://www.safetravel.govt.nz/destinations/${text.toLowerCase().replace(/\s+/g, '-')}`,
          updatedAt: fetchedAt,
        };
      });

      if (indicators.length > 5) {
        gotListingData = true;
      }
    }
  } catch {
    // Listing page failed, will try per-country pages
  }

  // If listing page was empty (JS-rendered), try per-country pages
  if (!gotListingData) {
    const countrySlugEntries = COUNTRIES.map(c => ({
      country: c,
      slug: c.name.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    }));

    // Only sample a subset to avoid hammering the server
    const sampleEntries = countrySlugEntries.slice(0, 50);

    await fetchBatch(
      sampleEntries,
      async (entry) => {
        try {
          const url = `https://www.safetravel.govt.nz/destinations/${entry.slug}`;
          const r = await fetch(url, {
            signal: AbortSignal.timeout(15_000),
            headers: FETCH_HEADERS,
          });

          if (!r.ok) return;

          const html = await r.text();
          const pageLower = html.toLowerCase();

          // Look for level text
          let level: UnifiedLevel = 1;
          if (pageLower.includes('do not travel')) {
            level = 4;
          } else if (pageLower.includes('avoid non-essential travel') || pageLower.includes('avoid unnecessary travel')) {
            level = 3;
          } else if (pageLower.includes('exercise increased caution') || pageLower.includes('increased caution')) {
            level = 2;
          } else if (pageLower.includes('exercise normal precautions') || pageLower.includes('normal precautions')) {
            level = 1;
          } else {
            return; // Could not determine level, skip
          }

          indicators.push({
            countryIso3: entry.country.iso3,
            indicatorName: 'advisory_level_nz',
            value: level,
            year: currentYear,
            source: 'advisories_nz',
            fetchedAt,
          });

          if (!advisoryInfo[entry.country.iso3]) advisoryInfo[entry.country.iso3] = {};
          advisoryInfo[entry.country.iso3].nz = {
            level,
            text: NZ_LEVEL_TEXT[level] || `Level ${level}`,
            source: 'New Zealand SafeTravel',
            url: `https://www.safetravel.govt.nz/destinations/${entry.slug}`,
            updatedAt: fetchedAt,
          };
        } catch {
          // Individual country page failed, skip silently
        }
      },
      5,
    );

    if (indicators.length === 0) {
      console.warn('[ADVISORIES-T2A] NZ: SafeTravel appears to be JS-rendered, returning empty result');
    }
  }

  console.log(`[ADVISORIES-T2A] NZ: ${indicators.length} countries from SafeTravel`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 5: Ireland (DFA) -- HTML-03
// =============================================================================

async function fetchIeAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Try primary URL first, then fallback
  const urls = [
    'https://www.ireland.ie/en/dfa/overseas-travel/',
    'https://www.dfa.ie/travel/travel-advice/',
  ];

  let html = '';
  let baseUrl = urls[0];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      });

      if (response.ok) {
        html = await response.text();
        baseUrl = url;
        break;
      }
    } catch {
      // Try next URL
    }
  }

  if (!html) {
    console.warn('[ADVISORIES-T2A] IE: All URLs returned 403 or failed, returning empty result');
    return { indicators, advisoryInfo };
  }

  const $ = cheerio.load(html);

  // Try to extract country links and advisory levels from listing page
  $('a[href*="advice"], a[href*="travel"]').each((_, el) => {
    const text = $(el).text().trim();
    const parentText = $(el).closest('li, div, tr').text().trim().toLowerCase();
    const country = getCountryByName(text);
    if (!country) return;

    const level = normalizeIeRating(parentText);

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_ie',
      value: level,
      year: currentYear,
      source: 'advisories_ie',
      fetchedAt,
    });

    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].ie = {
      level,
      text: IE_LEVEL_TEXT[level] || `Level ${level}`,
      source: 'Irish Department of Foreign Affairs',
      url: baseUrl,
      updatedAt: fetchedAt,
    };
  });

  // If listing page did not yield good data, try per-country pages
  if (indicators.length < 5) {
    indicators.length = 0; // Reset any partial data

    const countrySlugEntries = COUNTRIES.map(c => ({
      country: c,
      slug: c.name.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    }));

    await fetchBatch(
      countrySlugEntries,
      async (entry) => {
        try {
          const url = `${baseUrl.includes('ireland.ie') ? 'https://www.ireland.ie/en/dfa/overseas-travel/advice' : 'https://www.dfa.ie/travel/travel-advice'}/${entry.slug}/`;
          const r = await fetch(url, {
            signal: AbortSignal.timeout(15_000),
            headers: FETCH_HEADERS,
          });

          if (!r.ok) return;

          const pageHtml = await r.text();
          const pageLower = pageHtml.toLowerCase();

          const level = normalizeIeRating(pageLower);

          indicators.push({
            countryIso3: entry.country.iso3,
            indicatorName: 'advisory_level_ie',
            value: level,
            year: currentYear,
            source: 'advisories_ie',
            fetchedAt,
          });

          if (!advisoryInfo[entry.country.iso3]) advisoryInfo[entry.country.iso3] = {};
          advisoryInfo[entry.country.iso3].ie = {
            level,
            text: IE_LEVEL_TEXT[level] || `Level ${level}`,
            source: 'Irish Department of Foreign Affairs',
            url,
            updatedAt: fetchedAt,
          };
        } catch {
          // Individual country page failed, skip silently
        }
      },
      3,
    );
  }

  console.log(`[ADVISORIES-T2A] IE: ${indicators.length} countries from DFA`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 6: Finland (um.fi) -- HTML-04
// =============================================================================

async function fetchFiAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Try primary URL, then fallback
  const urls = [
    'https://um.fi/matkustustiedote',
    'https://finlandabroad.fi/web/travel-advice',
  ];

  let html = '';
  let baseUrl = urls[0];

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
      });

      if (response.ok) {
        html = await response.text();
        baseUrl = url;
        break;
      }
    } catch {
      // Try next URL
    }
  }

  if (!html) {
    console.warn('[ADVISORIES-T2A] FI: All URLs returned 403 or failed, returning empty result');
    return { indicators, advisoryInfo };
  }

  const $ = cheerio.load(html);

  // Try to extract country advisory info from listing
  $('a').each((_, el) => {
    const text = $(el).text().trim();
    const parentText = $(el).closest('li, div, tr, td').text().trim();
    const country = getCountryByName(text);
    if (!country) return;

    const level = normalizeFiLevel(parentText);

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_fi',
      value: level,
      year: currentYear,
      source: 'advisories_fi',
      fetchedAt,
    });

    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].fi = {
      level,
      text: FI_LEVEL_TEXT[level] || `Level ${level}`,
      source: 'Finnish Ministry of Foreign Affairs',
      url: baseUrl,
      updatedAt: fetchedAt,
    };
  });

  console.log(`[ADVISORIES-T2A] FI: ${indicators.length} countries from um.fi`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 7: Brazil (Itamaraty) -- HTML-06
// =============================================================================

async function fetchBrAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  console.log('[ADVISORIES-T2A] BR: Brazil has no structured level system, returning sparse data');

  try {
    const response = await fetch('https://www.gov.br/mre/pt-br/assuntos/portal-consular/alertas-e-avisos', {
      signal: AbortSignal.timeout(30_000),
      headers: FETCH_HEADERS,
    });

    if (!response.ok) {
      console.warn(`[ADVISORIES-T2A] BR: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Look for crisis alert articles mentioning specific countries
    $('a, h2, h3, .tileItem').each((_, el) => {
      const text = $(el).text().trim();
      const textLower = text.toLowerCase();

      // Look for crisis indicators
      let level: UnifiedLevel | null = null;
      if (textLower.includes('emergencia') || textLower.includes('evacuacao') || textLower.includes('não viaje') || textLower.includes('nao viaje')) {
        level = 4;
      } else if (textLower.includes('crise') || textLower.includes('alerta') || textLower.includes('conflito')) {
        level = 3;
      }

      if (!level) return;

      // Try to extract country name from the text
      for (const country of COUNTRIES) {
        const ptName = country.name.pt?.toLowerCase();
        const enName = country.name.en.toLowerCase();

        if (ptName && textLower.includes(ptName) || textLower.includes(enName)) {
          // Avoid duplicate entries
          const existing = indicators.find(i => i.countryIso3 === country.iso3);
          if (existing) {
            if (level > existing.value) existing.value = level;
            return;
          }

          indicators.push({
            countryIso3: country.iso3,
            indicatorName: 'advisory_level_br',
            value: level,
            year: currentYear,
            source: 'advisories_br',
            fetchedAt,
          });

          if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
          advisoryInfo[country.iso3].br = {
            level,
            text: BR_LEVEL_TEXT[level] || `Crisis alert level ${level}`,
            source: 'Brazilian Ministry of Foreign Affairs',
            url: 'https://www.gov.br/mre/pt-br/assuntos/portal-consular/alertas-e-avisos',
            updatedAt: fetchedAt,
          };
        }
      }
    });
  } catch {
    console.warn('[ADVISORIES-T2A] BR: Portal consular unavailable, returning empty result');
  }

  console.log(`[ADVISORIES-T2A] BR: ${indicators.length} countries with crisis alerts`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 8: Philippines (DFA) -- HTML-08
// =============================================================================

async function fetchPhAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const urls = [
    'https://dfa.gov.ph/travel-advisories',
    'https://dfa.gov.ph/index.php/travel-advisories',
  ];

  let html = '';

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: FETCH_HEADERS,
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
    console.warn('[ADVISORIES-T2A] PH: All URLs returned 403 or failed, returning empty result');
    return { indicators, advisoryInfo };
  }

  const $ = cheerio.load(html);

  // Look for alert level mentions in article titles/content
  $('a, h2, h3, h4, .article-title, .list-title').each((_, el) => {
    const text = $(el).text().trim();
    const textLower = text.toLowerCase();

    // Look for "Alert Level N" pattern
    const levelMatch = textLower.match(/alert\s*level\s*(\d)/i);
    if (!levelMatch) return;

    const rawLevel = parseInt(levelMatch[1], 10);
    if (rawLevel < 1 || rawLevel > 4) return;
    const level = rawLevel as UnifiedLevel;

    // Try to extract country name from the text
    for (const country of COUNTRIES) {
      if (textLower.includes(country.name.en.toLowerCase())) {
        // Avoid duplicate entries, keep highest level
        const existing = indicators.find(i => i.countryIso3 === country.iso3);
        if (existing) {
          if (level > existing.value) existing.value = level;
          return;
        }

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_ph',
          value: level,
          year: currentYear,
          source: 'advisories_ph',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].ph = {
          level,
          text: PH_LEVEL_TEXT[level] || `Alert Level ${level}`,
          source: 'Philippine Department of Foreign Affairs',
          url: 'https://dfa.gov.ph/travel-advisories',
          updatedAt: fetchedAt,
        };
        break; // Found the country, stop checking
      }
    }
  });

  console.log(`[ADVISORIES-T2A] PH: ${indicators.length} countries with alert levels`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Main orchestrator
// =============================================================================

/**
 * Fetch Tier 2a advisory sources: Austria, France, Hong Kong, New Zealand,
 * Ireland, Finland, Brazil, Philippines.
 * Each sub-fetcher runs independently in try/catch blocks.
 * Falls back to cached data if ALL sub-fetchers fail.
 */
export async function fetchTier2aAdvisories(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const currentYear = new Date().getFullYear();

  const allIndicators: RawIndicator[] = [];
  const combinedAdvisoryInfo: AdvisoryInfoMap = {};
  const errors: string[] = [];

  // Fetch Austria advisories
  try {
    console.log('[ADVISORIES-T2A] Fetching Austria (BMEIA) advisories...');
    const result = await fetchAtAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2A] AT: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2A] AT fetch failed: ${msg}`);
    errors.push(`AT: ${msg}`);
  }

  // Fetch France advisories
  try {
    console.log('[ADVISORIES-T2A] Fetching France (MEAE) advisories...');
    const result = await fetchFrAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2A] FR: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2A] FR fetch failed: ${msg}`);
    errors.push(`FR: ${msg}`);
  }

  // Fetch Hong Kong advisories
  try {
    console.log('[ADVISORIES-T2A] Fetching Hong Kong (OTA) advisories...');
    const result = await fetchHkAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2A] HK: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2A] HK fetch failed: ${msg}`);
    errors.push(`HK: ${msg}`);
  }

  // Fetch New Zealand advisories
  try {
    console.log('[ADVISORIES-T2A] Fetching New Zealand (SafeTravel) advisories...');
    const result = await fetchNzAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2A] NZ: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2A] NZ fetch failed: ${msg}`);
    errors.push(`NZ: ${msg}`);
  }

  // Fetch Ireland advisories
  try {
    console.log('[ADVISORIES-T2A] Fetching Ireland (DFA) advisories...');
    const result = await fetchIeAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2A] IE: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2A] IE fetch failed: ${msg}`);
    errors.push(`IE: ${msg}`);
  }

  // Fetch Finland advisories
  try {
    console.log('[ADVISORIES-T2A] Fetching Finland (UM) advisories...');
    const result = await fetchFiAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2A] FI: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2A] FI fetch failed: ${msg}`);
    errors.push(`FI: ${msg}`);
  }

  // Fetch Brazil advisories
  try {
    console.log('[ADVISORIES-T2A] Fetching Brazil (Itamaraty) advisories...');
    const result = await fetchBrAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2A] BR: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2A] BR fetch failed: ${msg}`);
    errors.push(`BR: ${msg}`);
  }

  // Fetch Philippines advisories
  try {
    console.log('[ADVISORIES-T2A] Fetching Philippines (DFA) advisories...');
    const result = await fetchPhAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2A] PH: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2A] PH fetch failed: ${msg}`);
    errors.push(`PH: ${msg}`);
  }

  // If all failed, try cached data
  if (allIndicators.length === 0) {
    const cached = findLatestCached('advisories-tier2a-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[ADVISORIES-T2A] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'advisories-tier2a-parsed.json'), cachedData);
        const cachedInfoPath = cached.replace(
          'advisories-tier2a-parsed.json',
          'advisories-tier2a-info.json',
        );
        const cachedInfo = readJson<AdvisoryInfoMap>(cachedInfoPath);
        if (cachedInfo) {
          writeJson(join(rawDir, 'advisories-tier2a-info.json'), cachedInfo);
        }
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'advisories_tier2a',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Errors: ${errors.join('; ')}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'advisories_tier2a',
      success: false,
      countriesFound: 0,
      error: errors.join('; '),
      fetchedAt,
    };
  }

  // Save combined parsed data
  const sourceData: RawSourceData = {
    source: 'advisories_tier2a',
    fetchedAt,
    indicators: allIndicators,
  };
  writeJson(join(rawDir, 'advisories-tier2a-parsed.json'), sourceData);

  // Save advisory info side-channel
  writeJson(join(rawDir, 'advisories-tier2a-info.json'), combinedAdvisoryInfo);

  const totalCountries = new Set(allIndicators.map((i) => i.countryIso3)).size;
  console.log(
    `[ADVISORIES-T2A] Successfully processed ${totalCountries} countries total (${allIndicators.length} indicators)`,
  );

  return {
    source: 'advisories_tier2a',
    success: true,
    countriesFound: totalCountries,
    error: errors.length > 0 ? `Partial: ${errors.join('; ')}` : undefined,
    fetchedAt,
  };
}
