import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, getCountryByIso3, COUNTRIES } from '../config/countries.js';
import {
  normalizeBeLevel,
  normalizeDkLevel,
  normalizeSgLevel,
  normalizeRoLevel,
  normalizeRsLevel,
  normalizeEeLevel,
  normalizeHrLevel,
  normalizeArAlert,
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
const BE_LEVEL_TEXT: Record<number, string> = {
  1: 'Pas de restrictions',
  2: 'Prudence recommandee',
  3: 'Voyage deconseille',
  4: 'Ne pas voyager',
};

const DK_LEVEL_TEXT: Record<number, string> = {
  1: 'Normale forholdsregler',
  2: 'Skaerpet opmaerksomhed',
  3: 'Fraraades',
  4: 'Fraraades alle rejser',
};

const SG_LEVEL_TEXT: Record<number, string> = {
  1: 'Exercise normal precautions',
  2: 'Travel notice',
  3: 'Travel advisory',
  4: 'Do not travel',
};

const RO_LEVEL_TEXT: Record<number, string> = {
  1: 'Low risk (1-2)',
  2: 'Moderate risk (3-4)',
  3: 'High risk (5-6)',
  4: 'Extreme risk (7-9)',
};

const RS_LEVEL_TEXT: Record<number, string> = {
  1: 'Normal precautions',
  2: 'Increased caution',
  3: 'Avoid non-essential travel',
  4: 'Do not travel',
};

const EE_LEVEL_TEXT: Record<number, string> = {
  1: 'Tavapärased ettevaatusabinõud',
  2: 'Ole ettevaatlik',
  3: 'Väldi reisimist',
  4: 'Mitte reisida',
};

const HR_LEVEL_TEXT: Record<number, string> = {
  1: 'Normal precautions',
  2: 'Increased caution',
  3: 'Avoid non-essential travel',
  4: 'Do not travel',
};

const AR_LEVEL_TEXT: Record<number, string> = {
  1: 'Sin alerta especifica',
  2: 'Precaucion',
  3: 'Evite viajar',
  4: 'No viaje',
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
// Sub-fetcher 1: Belgium (diplomatie.belgium.be) -- HTML-09
// =============================================================================

async function fetchBeAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Build French name -> CountryEntry map for matching
  const frNameMap = new Map<string, typeof COUNTRIES[number]>();
  for (const country of COUNTRIES) {
    frNameMap.set(country.name.fr.toLowerCase(), country);
    frNameMap.set(country.name.fr.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), country);
  }

  const response = await fetch('https://diplomatie.belgium.be/fr/pays', {
    signal: AbortSignal.timeout(30_000),
    headers: FETCH_HEADERS,
  });

  if (!response.ok) {
    console.warn(`[ADVISORIES-T2B] BE: HTTP ${response.status}, returning empty`);
    return { indicators, advisoryInfo };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract country links from listing page
  const countryEntries: { name: string; url: string; country: typeof COUNTRIES[number] }[] = [];

  $('a[href*="/fr/pays/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (!text || text.length < 2) return;

    const nameLower = text.toLowerCase();
    const nameNormalized = nameLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const country = frNameMap.get(nameLower) || frNameMap.get(nameNormalized);
    if (country) {
      const fullUrl = href.startsWith('http') ? href : `https://diplomatie.belgium.be${href}`;
      countryEntries.push({ name: text, url: fullUrl, country });
    }
  });

  if (countryEntries.length === 0) {
    console.warn('[ADVISORIES-T2B] BE: No country links found on listing page');
    return { indicators, advisoryInfo };
  }

  // Batch-crawl per-country pages
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
        const level = normalizeBeLevel(pageHtml);

        indicators.push({
          countryIso3: entry.country.iso3,
          indicatorName: 'advisory_level_be',
          value: level,
          year: currentYear,
          source: 'advisories_be',
          fetchedAt,
        });

        if (!advisoryInfo[entry.country.iso3]) advisoryInfo[entry.country.iso3] = {};
        advisoryInfo[entry.country.iso3].be = {
          level,
          text: BE_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Belgian Federal Foreign Affairs',
          url: entry.url,
          updatedAt: fetchedAt,
        };
      } catch {
        // Individual country page failed, skip silently
      }
    },
    3,
  );

  console.log(`[ADVISORIES-T2B] BE: ${indicators.length} countries from diplomatie.belgium.be`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 2: Denmark (um.dk) -- HTML-10
// =============================================================================

async function fetchDkAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Build slug attempts from COUNTRIES using English name lowercased, hyphenated
  const countrySlugEntries = COUNTRIES.map(c => ({
    country: c,
    slug: c.name.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
  }));

  // Sample first 80 countries to avoid excessive requests
  const sampleEntries = countrySlugEntries.slice(0, 80);

  await fetchBatch(
    sampleEntries,
    async (entry) => {
      try {
        const url = `https://um.dk/rejse-og-ophold/rejse-til-udlandet/rejsevejledninger/${entry.slug}`;
        const r = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: FETCH_HEADERS,
        });

        if (!r.ok) return;

        const html = await r.text();
        const level = normalizeDkLevel(html);

        // Skip if we get the "no advisory" page (level 1 with very short content)
        indicators.push({
          countryIso3: entry.country.iso3,
          indicatorName: 'advisory_level_dk',
          value: level,
          year: currentYear,
          source: 'advisories_dk',
          fetchedAt,
        });

        if (!advisoryInfo[entry.country.iso3]) advisoryInfo[entry.country.iso3] = {};
        advisoryInfo[entry.country.iso3].dk = {
          level,
          text: DK_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Danish Ministry of Foreign Affairs',
          url,
          updatedAt: fetchedAt,
        };
      } catch {
        // Individual country page failed, skip silently
      }
    },
    3,
  );

  console.log(`[ADVISORIES-T2B] DK: ${indicators.length} countries from um.dk`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 3: Singapore (MFA) -- HTML-11
// =============================================================================

async function fetchSgAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const baseUrl = 'https://www.mfa.gov.sg/Overseas-Singaporeans/Travelling-Overseas/travel-advisories-notices-and-visa-information';

  const response = await fetch(baseUrl, {
    signal: AbortSignal.timeout(30_000),
    headers: FETCH_HEADERS,
  });

  if (!response.ok) {
    console.warn(`[ADVISORIES-T2B] SG: HTTP ${response.status}, returning empty`);
    return { indicators, advisoryInfo };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Parse listing page for country entries with category text
  $('a, tr, li, div').each((_, el) => {
    const text = $(el).text().trim();
    if (!text || text.length > 500) return;

    const textLower = text.toLowerCase();

    // Look for country-related entries with travel advisory/notice markers
    let category = '';
    if (textLower.includes('travel advisory') || textLower.includes('travel page with travel advisory')) {
      category = 'advisory';
    } else if (textLower.includes('travel notice') || textLower.includes('travel page with travel notice')) {
      category = 'notice';
    }

    // Try to extract a country name from the text (first line or link text)
    const firstLine = text.split('\n')[0].trim();
    const country = getCountryByName(firstLine);
    if (!country) return;

    // Avoid duplicates
    const existing = indicators.find(i => i.countryIso3 === country.iso3);
    if (existing) return;

    let level: UnifiedLevel;
    if (category === 'advisory') {
      level = 3;
    } else if (category === 'notice') {
      level = 2;
    } else {
      level = 1;
    }

    indicators.push({
      countryIso3: country.iso3,
      indicatorName: 'advisory_level_sg',
      value: level,
      year: currentYear,
      source: 'advisories_sg',
      fetchedAt,
    });

    if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
    advisoryInfo[country.iso3].sg = {
      level,
      text: SG_LEVEL_TEXT[level] || `Level ${level}`,
      source: 'Singapore Ministry of Foreign Affairs',
      url: baseUrl,
      updatedAt: fetchedAt,
    };
  });

  // Check for pagination -- fetch additional pages if present
  const nextPages: string[] = [];
  $('a[href*="page"], a.pagination-next, a[href*="Page"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !nextPages.includes(href)) {
      const fullUrl = href.startsWith('http') ? href : `https://www.mfa.gov.sg${href}`;
      nextPages.push(fullUrl);
    }
  });

  // Fetch up to 10 additional pages
  for (const pageUrl of nextPages.slice(0, 10)) {
    try {
      const pageResp = await fetch(pageUrl, {
        signal: AbortSignal.timeout(15_000),
        headers: FETCH_HEADERS,
      });
      if (!pageResp.ok) continue;

      const pageHtml = await pageResp.text();
      const page$ = cheerio.load(pageHtml);

      page$('a, tr, li, div').each((_, el) => {
        const text = page$(el).text().trim();
        if (!text || text.length > 500) return;

        const textLower = text.toLowerCase();
        let category = '';
        if (textLower.includes('travel advisory')) category = 'advisory';
        else if (textLower.includes('travel notice')) category = 'notice';

        const firstLine = text.split('\n')[0].trim();
        const country = getCountryByName(firstLine);
        if (!country) return;

        const existing = indicators.find(i => i.countryIso3 === country.iso3);
        if (existing) return;

        let level: UnifiedLevel;
        if (category === 'advisory') level = 3;
        else if (category === 'notice') level = 2;
        else level = 1;

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_sg',
          value: level,
          year: currentYear,
          source: 'advisories_sg',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].sg = {
          level,
          text: SG_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Singapore Ministry of Foreign Affairs',
          url: baseUrl,
          updatedAt: fetchedAt,
        };
      });
    } catch {
      // Pagination page failed, skip
    }
  }

  console.log(`[ADVISORIES-T2B] SG: ${indicators.length} countries from MFA`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 4: Romania (MAE) -- HTML-12
// =============================================================================

async function fetchRoAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Site returned 503 in research -- try multiple URLs, handle gracefully
  const urls = [
    'https://mae.ro/en/travel-alerts',
    'https://www.mae.ro/en/travel-alerts',
    'https://mae.ro/travel-alerts',
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
    console.warn('[ADVISORIES-T2B] RO: All URLs returned 503 or failed, returning empty result');
    return { indicators, advisoryInfo };
  }

  const $ = cheerio.load(html);

  // Parse alert entries for country mentions and severity
  // Event-based: only produce entries for countries explicitly mentioned
  $('a, h2, h3, h4, .alert, .article, .field-content, li').each((_, el) => {
    const text = $(el).text().trim();
    if (!text || text.length > 1000) return;

    const textLower = text.toLowerCase();

    // Try to find a numeric level (Romania uses 1-9 scale)
    const levelMatch = textLower.match(/(?:level|nivel|alert[aă]?)\s*(\d)/i);
    let level: UnifiedLevel | null = null;

    if (levelMatch) {
      const numLevel = parseInt(levelMatch[1], 10);
      level = normalizeRoLevel(numLevel);
    } else {
      // Infer from text keywords
      if (textLower.includes('leave') || textLower.includes('evacuate') || textLower.includes('do not travel')) {
        level = 4;
      } else if (textLower.includes('avoid') || textLower.includes('high risk') || textLower.includes('danger')) {
        level = 3;
      } else if (textLower.includes('caution') || textLower.includes('warning') || textLower.includes('attention')) {
        level = 2;
      }
    }

    if (!level) return;

    // Try to extract country name from the text
    for (const country of COUNTRIES) {
      const enName = country.name.en.toLowerCase();
      if (textLower.includes(enName) && enName.length > 3) {
        const existing = indicators.find(i => i.countryIso3 === country.iso3);
        if (existing) {
          if (level > existing.value) existing.value = level;
          return;
        }

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_ro',
          value: level,
          year: currentYear,
          source: 'advisories_ro',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].ro = {
          level,
          text: RO_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Romanian Ministry of Foreign Affairs',
          url: baseUrl,
          updatedAt: fetchedAt,
        };
      }
    }
  });

  console.log(`[ADVISORIES-T2B] RO: ${indicators.length} countries from MAE`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 5: Serbia (MFA) -- HTML-13
// =============================================================================

async function fetchRsAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const baseUrl = 'https://www.mfa.gov.rs/en/citizens/travel-abroad/visas-and-states-travel-advisory';

  const response = await fetch(baseUrl, {
    signal: AbortSignal.timeout(30_000),
    headers: FETCH_HEADERS,
  });

  if (!response.ok) {
    console.warn(`[ADVISORIES-T2B] RS: HTTP ${response.status}, returning empty`);
    return { indicators, advisoryInfo };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Extract country links from listing page
  const countryEntries: { name: string; url: string; country: typeof COUNTRIES[number] }[] = [];

  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (!text || text.length < 2 || text.length > 100) return;

    const country = getCountryByName(text);
    if (!country) return;

    const fullUrl = href.startsWith('http') ? href : `https://www.mfa.gov.rs${href}`;
    // Avoid duplicates
    if (!countryEntries.find(e => e.country.iso3 === country.iso3)) {
      countryEntries.push({ name: text, url: fullUrl, country });
    }
  });

  if (countryEntries.length === 0) {
    console.warn('[ADVISORIES-T2B] RS: No country links found on listing page');
    return { indicators, advisoryInfo };
  }

  // Batch-crawl per-country pages
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
        const level = normalizeRsLevel(pageHtml);

        indicators.push({
          countryIso3: entry.country.iso3,
          indicatorName: 'advisory_level_rs',
          value: level,
          year: currentYear,
          source: 'advisories_rs',
          fetchedAt,
        });

        if (!advisoryInfo[entry.country.iso3]) advisoryInfo[entry.country.iso3] = {};
        advisoryInfo[entry.country.iso3].rs = {
          level,
          text: RS_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Serbian Ministry of Foreign Affairs',
          url: entry.url,
          updatedAt: fetchedAt,
        };
      } catch {
        // Individual country page failed, skip silently
      }
    },
    3,
  );

  console.log(`[ADVISORIES-T2B] RS: ${indicators.length} countries from MFA`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 6: Estonia (reisitargalt.vm.ee) -- HTML-14
// =============================================================================

async function fetchEeAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const listingUrl = 'https://reisitargalt.vm.ee/';

  const response = await fetch(listingUrl, {
    signal: AbortSignal.timeout(30_000),
    headers: FETCH_HEADERS,
  });

  if (!response.ok) {
    console.warn(`[ADVISORIES-T2B] EE: HTTP ${response.status}, returning empty`);
    return { indicators, advisoryInfo };
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Parse alphabetical country links dynamically (do NOT hardcode slugs)
  const countryEntries: { slug: string; url: string; country: typeof COUNTRIES[number] }[] = [];

  $('a[href*="/sihtkoht/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    if (!text || text.length < 2) return;

    // Try to match country by link text (Estonian or English name)
    const country = getCountryByName(text);
    if (!country) return;

    const slugMatch = href.match(/\/sihtkoht\/([^/]+)/);
    if (!slugMatch) return;

    const slug = slugMatch[1];
    const fullUrl = href.startsWith('http') ? href : `https://reisitargalt.vm.ee${href}`;

    if (!countryEntries.find(e => e.country.iso3 === country.iso3)) {
      countryEntries.push({ slug, url: fullUrl, country });
    }
  });

  if (countryEntries.length === 0) {
    console.warn('[ADVISORIES-T2B] EE: No country links found, trying English name slugs');

    // Fallback: build slugs from English names and try a sample
    const fallbackEntries = COUNTRIES.slice(0, 50).map(c => ({
      slug: c.name.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      url: `https://reisitargalt.vm.ee/sihtkoht/${c.name.en.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}/`,
      country: c,
    }));

    await fetchBatch(
      fallbackEntries,
      async (entry) => {
        try {
          const r = await fetch(entry.url, {
            signal: AbortSignal.timeout(15_000),
            headers: FETCH_HEADERS,
          });
          if (!r.ok) return;

          const pageHtml = await r.text();
          const level = normalizeEeLevel(pageHtml);

          indicators.push({
            countryIso3: entry.country.iso3,
            indicatorName: 'advisory_level_ee',
            value: level,
            year: currentYear,
            source: 'advisories_ee',
            fetchedAt,
          });

          if (!advisoryInfo[entry.country.iso3]) advisoryInfo[entry.country.iso3] = {};
          advisoryInfo[entry.country.iso3].ee = {
            level,
            text: EE_LEVEL_TEXT[level] || `Level ${level}`,
            source: 'Estonian Ministry of Foreign Affairs',
            url: entry.url,
            updatedAt: fetchedAt,
          };
        } catch {
          // Skip silently
        }
      },
      3,
    );

    console.log(`[ADVISORIES-T2B] EE: ${indicators.length} countries (fallback slugs)`);
    return { indicators, advisoryInfo };
  }

  // Batch-crawl per-country pages from listing
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
        const level = normalizeEeLevel(pageHtml);

        indicators.push({
          countryIso3: entry.country.iso3,
          indicatorName: 'advisory_level_ee',
          value: level,
          year: currentYear,
          source: 'advisories_ee',
          fetchedAt,
        });

        if (!advisoryInfo[entry.country.iso3]) advisoryInfo[entry.country.iso3] = {};
        advisoryInfo[entry.country.iso3].ee = {
          level,
          text: EE_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Estonian Ministry of Foreign Affairs',
          url: entry.url,
          updatedAt: fetchedAt,
        };
      } catch {
        // Individual country page failed, skip silently
      }
    },
    3,
  );

  console.log(`[ADVISORIES-T2B] EE: ${indicators.length} countries from reisitargalt.vm.ee`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 7: Croatia (MVEP) -- HTML-15
// =============================================================================

async function fetchHrAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const url = 'https://mvep.gov.hr/services-for-citizens/travelling-abroad/travel-warnings/22718';

  let html = '';
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: FETCH_HEADERS,
    });

    if (!response.ok) {
      console.warn(`[ADVISORIES-T2B] HR: HTTP ${response.status}, returning empty`);
      return { indicators, advisoryInfo };
    }

    html = await response.text();
  } catch {
    console.warn('[ADVISORIES-T2B] HR: Fetch failed, returning empty');
    return { indicators, advisoryInfo };
  }

  const $ = cheerio.load(html);

  // Check if page is JS-heavy with minimal content
  if ($('a').length < 10) {
    console.warn('[ADVISORIES-T2B] HR: Page appears JS-rendered (few links), returning empty');
    return { indicators, advisoryInfo };
  }

  // Parse for country mentions and advisory text
  $('a, h2, h3, h4, p, li, .content, .article').each((_, el) => {
    const text = $(el).text().trim();
    if (!text || text.length > 1000) return;

    const textLower = text.toLowerCase();

    // Look for warning-level keywords
    let level: UnifiedLevel | null = null;
    if (textLower.includes('do not travel') || textLower.includes('ne putujte') || textLower.includes('leave')) {
      level = 4;
    } else if (textLower.includes('avoid') || textLower.includes('reconsider') || textLower.includes('izbjegavajte')) {
      level = 3;
    } else if (textLower.includes('caution') || textLower.includes('oprez') || textLower.includes('warning')) {
      level = 2;
    }

    if (!level) return;

    // Try to extract country name
    for (const country of COUNTRIES) {
      const enName = country.name.en.toLowerCase();
      if (textLower.includes(enName) && enName.length > 3) {
        const existing = indicators.find(i => i.countryIso3 === country.iso3);
        if (existing) {
          if (level > existing.value) existing.value = level;
          return;
        }

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_hr',
          value: level,
          year: currentYear,
          source: 'advisories_hr',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].hr = {
          level,
          text: HR_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Croatian Ministry of Foreign Affairs',
          url,
          updatedAt: fetchedAt,
        };
      }
    }
  });

  console.log(`[ADVISORIES-T2B] HR: ${indicators.length} countries from MVEP`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 8: Argentina (Cancilleria) -- HTML-16
// =============================================================================

async function fetchArAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const baseUrl = 'https://www.cancilleria.gob.ar/es/servicios/viajar-al-exterior/alertas';

  let html = '';
  try {
    const response = await fetch(baseUrl, {
      signal: AbortSignal.timeout(30_000),
      headers: FETCH_HEADERS,
    });

    if (!response.ok) {
      console.warn(`[ADVISORIES-T2B] AR: HTTP ${response.status}, returning empty`);
      return { indicators, advisoryInfo };
    }

    html = await response.text();
  } catch {
    console.warn('[ADVISORIES-T2B] AR: Fetch failed, returning empty');
    return { indicators, advisoryInfo };
  }

  const $ = cheerio.load(html);

  // Build Spanish name map for matching
  const esNameMap = new Map<string, typeof COUNTRIES[number]>();
  for (const country of COUNTRIES) {
    if (country.name.es) {
      esNameMap.set(country.name.es.toLowerCase(), country);
      esNameMap.set(country.name.es.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''), country);
    }
    // Also try English names
    esNameMap.set(country.name.en.toLowerCase(), country);
  }

  // Parse alert list items for country mentions (Spanish text)
  $('a, h2, h3, h4, .alert, .field-content, li, .views-row, .node-title').each((_, el) => {
    const text = $(el).text().trim();
    if (!text || text.length > 1000) return;

    const textLower = text.toLowerCase();
    const textNormalized = textLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const level = normalizeArAlert(text);
    if (level <= 1) return; // Only produce entries for countries with active alerts

    // Try to find country names in the text
    for (const [name, country] of esNameMap) {
      if (name.length > 3 && (textLower.includes(name) || textNormalized.includes(name))) {
        const existing = indicators.find(i => i.countryIso3 === country.iso3);
        if (existing) {
          if (level > existing.value) existing.value = level;
          return;
        }

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_ar',
          value: level,
          year: currentYear,
          source: 'advisories_ar',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].ar = {
          level,
          text: AR_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Argentine Ministry of Foreign Affairs',
          url: baseUrl,
          updatedAt: fetchedAt,
        };
        break; // Found the country, stop checking
      }
    }
  });

  console.log(`[ADVISORIES-T2B] AR: ${indicators.length} countries with alerts from Cancilleria`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Main orchestrator
// =============================================================================

/**
 * Fetch Tier 2b advisory sources: Belgium, Denmark, Singapore, Romania,
 * Serbia, Estonia, Croatia, Argentina.
 * Each sub-fetcher runs independently in try/catch blocks.
 * Falls back to cached data if ALL sub-fetchers fail.
 */
export async function fetchTier2bAdvisories(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const currentYear = new Date().getFullYear();

  const allIndicators: RawIndicator[] = [];
  const combinedAdvisoryInfo: AdvisoryInfoMap = {};
  const errors: string[] = [];

  // Fetch Belgium advisories
  try {
    console.log('[ADVISORIES-T2B] Fetching Belgium (diplomatie.belgium.be) advisories...');
    const result = await fetchBeAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2B] BE: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2B] BE fetch failed: ${msg}`);
    errors.push(`BE: ${msg}`);
  }

  // Fetch Denmark advisories
  try {
    console.log('[ADVISORIES-T2B] Fetching Denmark (um.dk) advisories...');
    const result = await fetchDkAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2B] DK: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2B] DK fetch failed: ${msg}`);
    errors.push(`DK: ${msg}`);
  }

  // Fetch Singapore advisories
  try {
    console.log('[ADVISORIES-T2B] Fetching Singapore (MFA) advisories...');
    const result = await fetchSgAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2B] SG: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2B] SG fetch failed: ${msg}`);
    errors.push(`SG: ${msg}`);
  }

  // Fetch Romania advisories
  try {
    console.log('[ADVISORIES-T2B] Fetching Romania (MAE) advisories...');
    const result = await fetchRoAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2B] RO: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2B] RO fetch failed: ${msg}`);
    errors.push(`RO: ${msg}`);
  }

  // Fetch Serbia advisories
  try {
    console.log('[ADVISORIES-T2B] Fetching Serbia (MFA) advisories...');
    const result = await fetchRsAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2B] RS: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2B] RS fetch failed: ${msg}`);
    errors.push(`RS: ${msg}`);
  }

  // Fetch Estonia advisories
  try {
    console.log('[ADVISORIES-T2B] Fetching Estonia (reisitargalt.vm.ee) advisories...');
    const result = await fetchEeAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2B] EE: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2B] EE fetch failed: ${msg}`);
    errors.push(`EE: ${msg}`);
  }

  // Fetch Croatia advisories
  try {
    console.log('[ADVISORIES-T2B] Fetching Croatia (MVEP) advisories...');
    const result = await fetchHrAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2B] HR: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2B] HR fetch failed: ${msg}`);
    errors.push(`HR: ${msg}`);
  }

  // Fetch Argentina advisories
  try {
    console.log('[ADVISORIES-T2B] Fetching Argentina (Cancilleria) advisories...');
    const result = await fetchArAdvisories(rawDir, fetchedAt, currentYear);
    allIndicators.push(...result.indicators);
    mergeAdvisoryInfo(combinedAdvisoryInfo, result.advisoryInfo);
    const count = new Set(result.indicators.map((i) => i.countryIso3)).size;
    console.log(`[ADVISORIES-T2B] AR: ${count} countries`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.warn(`[ADVISORIES-T2B] AR fetch failed: ${msg}`);
    errors.push(`AR: ${msg}`);
  }

  // If all failed, try cached data
  if (allIndicators.length === 0) {
    const cached = findLatestCached('advisories-tier2b-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[ADVISORIES-T2B] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'advisories-tier2b-parsed.json'), cachedData);
        const cachedInfoPath = cached.replace(
          'advisories-tier2b-parsed.json',
          'advisories-tier2b-info.json',
        );
        const cachedInfo = readJson<AdvisoryInfoMap>(cachedInfoPath);
        if (cachedInfo) {
          writeJson(join(rawDir, 'advisories-tier2b-info.json'), cachedInfo);
        }
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'advisories_tier2b',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Errors: ${errors.join('; ')}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'advisories_tier2b',
      success: false,
      countriesFound: 0,
      error: errors.join('; '),
      fetchedAt,
    };
  }

  // Save combined parsed data
  const sourceData: RawSourceData = {
    source: 'advisories_tier2b',
    fetchedAt,
    indicators: allIndicators,
  };
  writeJson(join(rawDir, 'advisories-tier2b-parsed.json'), sourceData);

  // Save advisory info side-channel
  writeJson(join(rawDir, 'advisories-tier2b-info.json'), combinedAdvisoryInfo);

  const totalCountries = new Set(allIndicators.map((i) => i.countryIso3)).size;
  console.log(
    `[ADVISORIES-T2B] Successfully processed ${totalCountries} countries total (${allIndicators.length} indicators)`,
  );

  return {
    source: 'advisories_tier2b',
    success: true,
    countriesFound: totalCountries,
    error: errors.length > 0 ? `Partial: ${errors.join('; ')}` : undefined,
    fetchedAt,
  };
}
