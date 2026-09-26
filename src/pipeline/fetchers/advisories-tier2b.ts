import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { enforcePerSourceFloors } from './source-floor.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, getCountryByIso3, COUNTRIES } from '../config/countries.js';
import {
  normalizeBeLevel,
  normalizeDkTier,
  normalizeSgLevel,
  normalizeRoLevel,
  normalizeRsLevel,
  extractRsSecuritySection,
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

// The country-index page (fetched below to discover the 177 per-country URLs) links each
// country to its own "voyager-en-X" hub, which in turn links to a dedicated "Sécurité
// générale" article -- THAT article carries the actual advisory prose. The site restructured
// its content this way at some point before 2026-08; the fetcher used to run normalizeBeLevel
// directly on the country-index shell (no advisory text there at all), which is why it always
// found 0 countries and the per-source floor kept restoring a stale 2026-06-09 cache.
const BE_ARTICLE_SELECTOR = 'article.node--type-country-detailed';
const BE_BLOCK_SELECTOR = `${BE_ARTICLE_SELECTOR} p, ${BE_ARTICLE_SELECTOR} li, ${BE_ARTICLE_SELECTOR} h2, ${BE_ARTICLE_SELECTOR} h3, ${BE_ARTICLE_SELECTOR} h4`;

/** Find the "Sécurité générale" sub-page link on a Belgian MFA country hub page. */
function findBeSecurityLink($: cheerio.CheerioAPI): string | null {
  let href: string | null = null;
  $('a').each((_, el) => {
    if (href) return;
    const text = $(el).text().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (text.startsWith('securite generale')) href = $(el).attr('href') || null;
  });
  return href;
}

/** Extract the security article's block elements, one per array entry, for normalizeBeLevel. */
function extractBeArticleBlocks($: cheerio.CheerioAPI): string[] {
  const blocks: string[] = [];
  $(BE_BLOCK_SELECTOR).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text) blocks.push(text);
  });
  return blocks;
}

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

  // Batch-crawl per-country pages. Two hops per country: the hub page (to find the security
  // article's URL -- it isn't a predictable slug, the "en/au/aux/à" preposition depends on
  // French grammatical gender) and the security article itself (the actual advisory text).
  await fetchBatch(
    countryEntries,
    async (entry) => {
      try {
        const hubResponse = await fetch(entry.url, {
          signal: AbortSignal.timeout(15_000),
          headers: FETCH_HEADERS,
        });
        if (!hubResponse.ok) return;

        const hubHtml = await hubResponse.text();
        const hub$ = cheerio.load(hubHtml);
        const secHref = findBeSecurityLink(hub$);
        if (!secHref) return; // page structure changed again -- skip rather than guess

        const secUrl = secHref.startsWith('http') ? secHref : `https://diplomatie.belgium.be${secHref}`;
        const secResponse = await fetch(secUrl, {
          signal: AbortSignal.timeout(15_000),
          headers: FETCH_HEADERS,
        });
        if (!secResponse.ok) return;

        const secHtml = await secResponse.text();
        const sec$ = cheerio.load(secHtml);
        const blocks = extractBeArticleBlocks(sec$);
        const level = normalizeBeLevel(blocks.join('\n'), entry.country.name.fr);
        if (level === null) return; // no advisory evidence in the fetched article — don't publish a made-up level

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
          url: secUrl,
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

/**
 * Reads um.dk's travel-guide accordion structure to determine one
 * country-level advisory level.
 *
 * Each severity tier the page currently shows is one
 * `<li class="... travel-guide-accordion__item--MODIFIER">` (modifier:
 * minimal < low < medium < high — see normalizeDkTier), whose
 * `.travel-guide-accordion__subtitle` names the scope ("Hele landet" = whole
 * country, or a named region/border area). Multiple tiers can coexist: a
 * mild whole-country baseline plus a severe border-zone carve-out (e.g.
 * Thailand: "opmaerksom" for "Hele landet, undtagen ..." PLUS "high" for a
 * 20km strip on the Cambodian border). We take the tier explicitly scoped to
 * the whole country; if none is (Pakistan/Nigeria only box named provinces,
 * never "Hele landet"), we report 2 ("increased caution") rather than
 * inheriting a named region's severity — mirroring how normalizeDeLevel
 * already downgrades Germany's region-only "Teilreisewarnung" instead of
 * letting a hotspot inflate the whole country's value.
 */
export function extractDkLevel($: ReturnType<typeof cheerio.load>): UnifiedLevel | null {
  const tiers: { modifier: 'minimal' | 'low' | 'medium' | 'high'; wholeCountry: boolean }[] = [];
  $('li.accordion-item').each((_, el) => {
    const cls = $(el).attr('class') || '';
    const m = /travel-guide-accordion__item--(minimal|low|medium|high)/.exec(cls);
    if (!m) return;
    const subtitle = $(el).find('.travel-guide-accordion__subtitle').first().text();
    tiers.push({
      modifier: m[1] as 'minimal' | 'low' | 'medium' | 'high',
      wholeCountry: subtitle.includes('Hele landet'),
    });
  });

  if (tiers.length === 0) {
    // A real, dated guidance page (caller already excluded the "no guidance
    // published" case) with literally no advisory box: DK's own baseline.
    // Every sampled country WITH a guidance page carried at least one tier
    // live (2026-09-25) — this is a defensive fallback, not an observed case.
    return 1;
  }

  const wholeCountryTier = tiers.find((t) => t.wholeCountry);
  return wholeCountryTier ? normalizeDkTier(wholeCountryTier.modifier) : 2;
}

async function fetchDkAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  // Build slug attempts from COUNTRIES using English name lowercased, hyphenated.
  // um.dk's own slugs are DANISH ("frankrig", "tyskland"), not English, so
  // this only resolves countries whose Danish and English names coincide
  // (true for most non-European names, e.g. "Afghanistan", "Somalia" —
  // exactly the countries this fix targets). European countries with a
  // distinct Danish name are still missed; fixing that needs a Danish name
  // table crawling the real listing page, mirroring GERMAN_NAMES/
  // SWEDISH_NAMES/etc. in advisories-tier3b.ts. Out of scope for this fix.
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
        const url = `https://um.dk/rejse-og-ophold/rejse-til-udlandet/rejsevejledninger/${entry.slug}/`;
        const r = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: FETCH_HEADERS,
        });

        if (!r.ok) return;

        const html = await r.text();
        const $ = cheerio.load(html);

        // um.dk serves a soft-200 "Vi har ingen rejsevejledning for X" page
        // for countries it has not published guidance for at all (confirmed
        // live 2026-09-25 for Afghanistan, Burundi, Burkina Faso, Bahrain,
        // Belarus, Cuba, Eritrea, Haiti among others) — that is an absence
        // of data, not a safety statement, and must not become a level.
        if ($('body').text().includes('Vi har ingen rejsevejledning')) return;

        const level = extractDkLevel($);
        if (level === null) return;

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

// mfa.gov.sg moved off the old "/Overseas-Singaporeans/..." path entirely (the redirect
// target itself now 404s); the current per-country pages live at
// "/travelling-overseas/travel-advisories-notices-and-visa-information/{slug}/". The old code
// also scraped a listing page for a "travel advisory" vs "travel notice" label to guess a
// level -- that listing is client-side (React) paginated and only ever exposes the ~10 most
// recently touched countries in the initial HTML, so it could never have found most of the
// 191 country pages that actually exist. sitemap.xml lists all of them directly (a real
// Rule-6 structured endpoint) and needs no guessing.
//
// sitemap.xml specifically (not the country pages) 403s when fetched with no identifying
// User-Agent at all (e.g. a bare HTTP client default) -- CloudFront/WAF appears to apply a
// stricter bot rule to that one path than to the rest of the site. Any *identified* client
// clears it, including this file's own default UA; no need to impersonate a browser. Use the
// same honest, self-identifying bot UA as the Ireland fetcher (advisories-tier2a.ts) instead --
// it names the project and links back to it, which is what a polite crawler is supposed to do.
const SG_SITEMAP_URL = 'https://www.mfa.gov.sg/sitemap.xml';
const SG_BOT_UA = 'Mozilla/5.0 (compatible; IsItSafeToTravelBot/1.0; +https://isitsafetotravel.org)';
const SG_PATH_PREFIX = '/travelling-overseas/travel-advisories-notices-and-visa-information/';

// Sitemap slugs that don't match a simple slugified English country name -- mfa.gov.sg uses
// each country's full official/constitutional name for some of these.
const SG_SLUG_ALIASES: Record<string, string> = {
  'bolivarian-republic-of-venezuela': 'VEN',
  'democratic-republic-of-congo': 'COD',
  'federated-states-of-micronesia': 'FSM',
  'kosovo': 'XKX',
  'kyrgyz-republic': 'KGZ',
  'lao-peoples-democratic-republic': 'LAO',
  'malta': 'MLT',
  'palestinian-territories': 'PSE',
  'republic-of-guinea': 'GIN',
  'republic-of-south-korea': 'KOR',
  'turkiye': 'TUR',
};

/** Slugify an English country name the same way mfa.gov.sg's own URLs are built. */
function slugifyEn(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchSgAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const sitemapResponse = await fetch(SG_SITEMAP_URL, {
    signal: AbortSignal.timeout(30_000),
    headers: { ...FETCH_HEADERS, 'User-Agent': SG_BOT_UA },
  });

  if (!sitemapResponse.ok) {
    console.warn(`[ADVISORIES-T2B] SG: sitemap HTTP ${sitemapResponse.status}, returning empty`);
    return { indicators, advisoryInfo };
  }

  const sitemapXml = await sitemapResponse.text();
  const slugByIso3 = new Map<string, typeof COUNTRIES[number]>();
  for (const c of COUNTRIES) slugByIso3.set(slugifyEn(c.name.en), c);

  const countryEntries: { url: string; country: typeof COUNTRIES[number] }[] = [];
  const locRegex = new RegExp(`<loc>(https://www\\.mfa\\.gov\\.sg${SG_PATH_PREFIX}([a-z0-9-]+)/)</loc>`, 'g');
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(sitemapXml)) !== null) {
    const [, url, slug] = match;
    const country = slugByIso3.get(slug) ?? (SG_SLUG_ALIASES[slug] ? COUNTRIES.find((c) => c.iso3 === SG_SLUG_ALIASES[slug]) : undefined);
    if (country && !countryEntries.find((e) => e.country.iso3 === country.iso3)) {
      countryEntries.push({ url, country });
    }
  }

  if (countryEntries.length === 0) {
    console.warn('[ADVISORIES-T2B] SG: No country URLs found in sitemap');
    return { indicators, advisoryInfo };
  }

  await fetchBatch(
    countryEntries,
    async (entry) => {
      try {
        const pageResponse = await fetch(entry.url, {
          signal: AbortSignal.timeout(20_000),
          headers: FETCH_HEADERS,
        });
        if (!pageResponse.ok) return;

        const pageHtml = await pageResponse.text();
        const page$ = cheerio.load(pageHtml);
        const paragraphs: string[] = [];
        page$('p[class*="prose-body-base"]').each((_, el) => {
          // The site injects U+00A0 (non-breaking space) mid-phrase for line-break control
          // (e.g. "non-essential travel") -- \s+ normalization must collapse it too, or
          // exact phrase matches like "defer all non-essential travel" silently never fire.
          const text = page$(el).text().replace(/\s+/g, ' ').trim();
          if (text) paragraphs.push(text);
        });

        const level = normalizeSgLevel(paragraphs.join('\n'));
        if (level === null) return; // no explicit notice published for this country -- skip, don't fabricate

        indicators.push({
          countryIso3: entry.country.iso3,
          indicatorName: 'advisory_level_sg',
          value: level,
          year: currentYear,
          source: 'advisories_sg',
          fetchedAt,
        });

        if (!advisoryInfo[entry.country.iso3]) advisoryInfo[entry.country.iso3] = {};
        advisoryInfo[entry.country.iso3].sg = {
          level,
          text: SG_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'Singapore Ministry of Foreign Affairs',
          url: entry.url,
        };
      } catch {
        // Individual country page failed, skip silently
      }
    },
    3,
  );

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

/**
 * Repair 2026-09-25 (SOURCE-REPAIR-BRIEF): the 2026-09-25 11:17 UTC run pulled 183 countries
 * from mfa.gov.rs with the exact request pattern below (bare single `fetch`, no retry); the
 * 22:35 UTC run of the SAME code (unrelated changes only touched level-extraction, not this
 * request) failed the very FIRST, uncontended request with "fetch failed" -- undici's generic
 * wrapper for a network-layer failure (DNS/TCP/TLS), never reaching an HTTP response at all, so
 * it is not the site rate-limiting or blocking us (that would surface as a clean 403/429 on
 * `response.ok`, handled separately below). Since the request/URL/headers/concurrency are
 * unchanged from the run that worked hours earlier, the likeliest explanation is a transient
 * blip on mfa.gov.rs's side (or the runner's egress path to it) rather than a change on our end
 * -- exactly the class of failure retry-with-backoff exists for. Mirrors the ES fetcher's
 * fetchWithRetry (advisories-tier3a.ts): swallow network errors and 429/503/5xx into a retry
 * with growing backoff, return null only once every attempt is exhausted, so one bad request
 * degrades to "skip this country" instead of aborting 183 countries' worth of work.
 */
async function fetchRsWithRetry(url: string, timeoutMs: number): Promise<Response | null> {
  for (const delayMs of [0, 2_000, 5_000]) {
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: FETCH_HEADERS });
      if (response.status === 429 || response.status === 503 || response.status >= 500) continue;
      return response;
    } catch {
      // Network-level failure ("fetch failed": DNS/TCP/TLS) -- fall through to retry, or give up
      // after the loop and let the caller treat it the same as an unreachable site.
    }
  }
  return null;
}

async function fetchRsAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  const baseUrl = 'https://www.mfa.gov.rs/en/citizens/travel-abroad/visas-and-states-travel-advisory';

  const response = await fetchRsWithRetry(baseUrl, 30_000);

  if (!response) {
    console.warn('[ADVISORIES-T2B] RS: listing page unreachable after retries, returning empty');
    return { indicators, advisoryInfo };
  }
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

  // Batch-crawl per-country pages. Retry-with-backoff per page too (not just the listing page):
  // the same transient-failure risk applies to any one of ~190 individual requests, and losing a
  // single severe-advisory country (e.g. a war zone) to one bad connection is exactly the silent
  // failure mode this repair targets. Concurrency lowered 3 -> 2 (SOURCE-REPAIR-BRIEF: "lower
  // concurrency" as an additional politeness margin) -- still well within the project's <= 3 cap.
  await fetchBatch(
    countryEntries,
    async (entry) => {
      try {
        const pageResponse = await fetchRsWithRetry(entry.url, 15_000);
        if (!pageResponse || !pageResponse.ok) return;

        const pageHtml = await pageResponse.text();
        // RS writes free-form prose reusing the same generic safety tips
        // ("avoid carrying large amounts of cash", "avoid demonstrations")
        // on every country page, including entirely safe ones — matching
        // against the raw page (or even the whole visible body text) makes
        // those false-positive as a country-specific warning. Scope to the
        // "SECURITY SITUATION" paragraph only, and skip when it can't be
        // found or contains no recognizable level (never guess).
        const page$ = cheerio.load(pageHtml);
        const section = extractRsSecuritySection(page$('body').text());
        const level = section === null ? null : normalizeRsLevel(section);
        if (level === null) return;

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
        };
      } catch {
        // Individual country page failed, skip silently
      }
    },
    2,
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

  // Per-source floor check: a single issuer's site redesign must not
  // silently drop its column (restores from the last healthy cache).
  enforcePerSourceFloors({
    logPrefix: '[ADVISORIES-T2B]',
    infoFile: 'advisories-tier2b-info.json',
    // Full issuer list from this tier's sub-fetchers — a zero-row collapse
    // must be caught too, not skipped because nothing was fetched.
    expectedIssuers: [
      'ar',
      'be',
      'dk',
      'ee',
      'hr',
      'ro',
      'rs',
      'sg',
    ],
    // Measured minimums — small issuers must not false-positive daily.
    floors: { dk: 21, ar: 2, hr: 0, ro: 0, sg: 0 }, // 0 = never produced data yet: monitor silently
    indicators: allIndicators,
    advisoryInfo: combinedAdvisoryInfo,
    errors,
    runDate: date,
  });

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
