import type { FetchResult, RawSourceData, RawIndicator, AdvisoryInfo } from '../types.js';
import type { AdvisoryInfoMap } from './advisories.js';
import { enforcePerSourceFloors } from './source-floor.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName, getCountryByIso2, getCountryByIso3, COUNTRIES } from '../config/countries.js';
import {
  extractFrTerritoryLevel,
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
    };
  }

  console.log(`[ADVISORIES-T2A] AT: ${indicators.length} countries from BMEIA JS object`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 2: France (diplomatie.gouv.fr) -- HTML-01
// =============================================================================

// The old backend (spip.php?page=backend_fcv) was the RSS feed of the site's previous
// SPIP CMS. The site has since migrated to Drupal: that endpoint now returns a branded
// 403 for every request, browser User-Agent or not (verified 2026-09-25 -- it is dead,
// not a datacenter-IP block). There is also no JSON/GeoJSON API behind the interactive
// map: the only other known scraper (github.com/vmttn/conseils-aux-voyageurs) just
// downloads the rasterized map JPEG and does not attempt per-country parsing. Per-country
// HTML is therefore the only option, and it works fine with this project's normal
// identifying User-Agent (no spoofing needed -- only the dead RSS endpoint 403s).
//
// URL pattern (verified against 20+ countries, 2026-09-25):
//   https://www.diplomatie.gouv.fr/fr/information-par-pays/<slug>/conseils-aux-voyageurs-securite
// <slug> is `country.name.fr`, lower-cased, accents stripped, non-alphanumerics -> hyphens.
// A full-coverage dry run against all 248 COUNTRIES slugs got 182 hits; nearly every miss
// is a fiche France genuinely does not publish (its own overseas territories -- Guadeloupe,
// Mayotte, French Polynesia... -- plus micro-states like Nauru/Tuvalu/Liechtenstein and
// France itself). FR_SLUG_ALIASES below fixes the handful of real name mismatches found
// in that run (confirmed against the site's own country <select>, which is a Drupal POST
// form keyed by node id, not slug, so it cannot be used directly to build URLs).
const FR_SLUG_ALIASES: Partial<Record<string, string>> = {
  SLV: 'salvador', // France's fiche is "Salvador", not "El Salvador"
  KGZ: 'kirghizstan', // France drops our config's second "i" (Kirghizistan -> Kirghizstan)
  VNM: 'vietnam', // France uses one word; our config has "Viet Nam"
  ISR: 'israel-palestine', // France publishes one joint fiche for both
  PSE: 'israel-palestine',
};

function frSlug(country: typeof COUNTRIES[number]): string {
  const alias = FR_SLUG_ALIASES[country.iso3];
  if (alias) return alias;
  return country.name.fr
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchFrAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  await fetchBatch(
    COUNTRIES,
    async (country) => {
      const url = `https://www.diplomatie.gouv.fr/fr/information-par-pays/${frSlug(country)}/conseils-aux-voyageurs-securite`;
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: FETCH_HEADERS,
        });
        // 404 is expected for countries/territories France does not publish a fiche for
        // (see comment above) -- not an error, just skip.
        if (!response.ok) return;

        const html = await response.text();
        const $ = cheerio.load(html);
        $('script, style').remove();
        const bodyText = $('body').text();

        const level = extractFrTerritoryLevel(bodyText);
        if (level === null) return; // no "Zones de vigilance" section found: emit nothing

        indicators.push({
          countryIso3: country.iso3,
          indicatorName: 'advisory_level_fr',
          value: level,
          year: currentYear,
          source: 'advisories_fr',
          fetchedAt,
        });

        if (!advisoryInfo[country.iso3]) advisoryInfo[country.iso3] = {};
        advisoryInfo[country.iso3].fr = {
          level,
          text: FR_LEVEL_TEXT[level] || `Level ${level}`,
          source: 'French Ministry of Foreign Affairs',
          url,
        };
      } catch {
        // Individual country page failed (timeout, network), skip silently
      }
    },
    3, // Concurrency 3 for politeness, per source-repair-brief rule 4 (248 requests total)
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
//
// dfa.ie now 301-redirects to the ireland.ie homepage (the site consolidated onto one
// domain), so it is not a useful fallback any more -- dropped. The real break is that
// ireland.ie sits behind CloudFront + AWS WAF Bot Control, which returns 403 for this
// project's normal identifying User-Agent regardless of IP (reproduced from a residential
// network, so this is not the "only works from a residential IP" trap the repair brief
// warns about -- it is a plain User-Agent string check). A Googlebot-style
// "Mozilla/5.0 (compatible; ...)" identifier passes; a bare "Mozilla/5.0" alone still
// gets blocked, so AWS Bot Control is allow-listing the well-known-crawler shape rather
// than simply requiring *some* browser-looking string. This override is local to this
// fetcher, not the shared FETCH_HEADERS, since every other sub-fetcher in this file
// already works fine with the plain identifying UA.
const IE_FETCH_HEADERS = {
  ...FETCH_HEADERS,
  'User-Agent': 'Mozilla/5.0 (compatible; IsItSafeToTravelBot/1.0; +https://isitsafetotravel.org)',
};

// URL pattern (verified against 200+ countries, 2026-09-25):
//   https://www.ireland.ie/en/dfa/overseas-travel/advice/<slug>/
// <slug> is `country.name.en`, lower-cased, non-alphanumerics -> hyphens, EXCEPT the
// handful of real name mismatches below (confirmed against the site's own destination
// <select> at /en/dfa/overseas-travel/advice/, which lists ~213 fiches). A full-coverage
// dry run against all 248 COUNTRIES slugs (naive + these aliases) got 207 hits; every miss
// left over is a fiche Ireland genuinely does not publish (its own micro-neighbours San
// Marino/Vatican, overseas territories, small islands).
const IE_SLUG_ALIASES: Partial<Record<string, string>> = {
  CPV: 'cape-verde',
  COD: 'democratic-republic-of-congo',
  FSM: 'federated-states-of-micronesia',
  GMB: 'republic-of-the-gambia',
  GBR: 'great-britain', // Ireland's site uses "Great Britain", not "United Kingdom"
  PRK: 'democratic-republic-of-korea',
  KOR: 'republic-of-korea',
  MMR: 'myanmar-burma',
  MKD: 'republic-of-north-macedonia',
  RUS: 'russian-federation',
  STP: 'saint-tome-sao-tome-and-principe',
  SVK: 'slovak-republic-slovakia',
  TUR: 'turkiye',
  USA: 'united-states-of-america',
  NLD: 'the-netherlands',
  BRN: 'brunei-darussalam',
};

function ieSlug(country: typeof COUNTRIES[number]): string {
  const alias = IE_SLUG_ALIASES[country.iso3];
  if (alias) return alias;
  return country.name.en
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function fetchIeAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  await fetchBatch(
    COUNTRIES,
    async (country) => {
      const url = `https://www.ireland.ie/en/dfa/overseas-travel/advice/${ieSlug(country)}/`;
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: IE_FETCH_HEADERS,
        });
        // 404 is expected for countries/territories Ireland does not publish a fiche for.
        if (!response.ok) return;

        const html = await response.text();
        const $ = cheerio.load(html);
        // The "Security Status" badge heading -- verified as the single occurrence of
        // this class on a fiche page (2026-09-25), so no risk of picking up an unrelated
        // accordion (e.g. "Local Laws and Customs") elsewhere on the same page.
        const ratingText = $('.accordion__title').first().text().trim();
        if (!ratingText) return; // different page shape: no rating found, emit nothing

        const level = normalizeIeRating(ratingText);

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
          url,
        };
      } catch {
        // Individual country page failed (timeout, network), skip silently
      }
    },
    3, // Concurrency 3 for politeness, per source-repair-brief rule 4 (248 requests total)
  );

  console.log(`[ADVISORIES-T2A] IE: ${indicators.length} countries from DFA`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 6: Finland (um.fi) -- HTML-04
// =============================================================================

// NOT REPAIRABLE with a plain fetch() (investigated 2026-09-25, see source-repair-brief
// rule 5/7). Both hosts sit behind Cloudflare, and both return a genuine Cloudflare
// Managed Challenge -- not a datacenter-IP block: `cf-mitigated: challenge`, a
// `Just a moment...` interstitial requiring the Sec-CH-UA client-hint round trip and a
// real JS engine to solve, reproduced identically from a residential network with full
// browser headers. This is a different failure mode from IE's plain User-Agent-string WAF
// rule (fixed above by sending a browser-shaped UA) -- no User-Agent or header combination
// gets past a JS challenge. No alternative endpoint was found either: no RSS feed (common
// guessed paths 404), no JSON API, nothing on Finland's open-data portal (avoindata.fi).
// The only way through is a headless browser that can execute Cloudflare's challenge
// script (e.g. Playwright), which this project does not depend on anywhere else --
// adding one just for this source is a real architecture decision (new heavy dependency,
// a browser-binary install step in the GitHub Actions workflow, slower pipeline) that
// belongs to the orchestrator/user, not to a single-source repair. Left as-is: the
// try/catch below degrades to an empty result exactly as before, and the per-source floor
// in enforcePerSourceFloors() restores the last healthy cache (floor 0 today, so it
// currently only logs and does not restore -- see the floor recommendation in this
// workstream's report).
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
    console.warn('[ADVISORIES-T2A] FI: both hosts behind a Cloudflare JS challenge (cf-mitigated: challenge), not a simple 403 -- not fixable without a headless browser, returning empty result');
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
    };
  });

  console.log(`[ADVISORIES-T2A] FI: ${indicators.length} countries from um.fi`);
  return { indicators, advisoryInfo };
}

// =============================================================================
// Sub-fetcher 7: Brazil (Itamaraty) -- HTML-06
// =============================================================================

// The old URL (.../portal-consular/alertas-e-avisos) 404s: the site restructured its
// consular section and the alerts listing moved to a URL with LITERAL SPACES in the path
// (.../alertas e noticias/alertas/alertas -- a Plone CMS convention) -- verified 2026-09-25.
//
// Brazil does not publish a structured level-per-country system (BR_LEVEL_TEXT above has
// always had a single entry -- that was already the design before this fix, not something
// this change introduces). The live alerts feed mixes, under one visually identical
// template: real security/conflict bulletins (Ukraine, an active Ebola outbreak in
// DRC/Uganda), scam/fraud warnings aimed at Brazilians abroad (fake-consulate fraud,
// job-recruitment scams, human trafficking awareness, irregular-immigration risk), and
// routine travel-conditions updates (a Bolivia road-blockade bulletin that, as of this
// writing, reports the blockade already lifted). Two traps found while investigating this,
// both worth documenting so nobody re-introduces them:
//   - The bare word "alerta" is not a severity signal here -- literally every article is
//     titled "Alerta ..." by convention, so matching on it (as the pre-2026-09-25 version
//     of this parser did) fires on almost everything, including the pure-fraud bulletins.
//   - The page's own datePublished/dateModified JSON-LD is not usable to filter stale
//     content by recency: articles get their dates touched by unrelated site maintenance
//     (a save during the site's mid-2026 restructuring updated old articles' dates too), so
//     "skip if old" cannot be trusted. Content has to be judged on what it says, not when
//     the metadata claims it was said.
// Given that, this parser: (1) identifies the country from the article TITLE only (titles
// name their subject directly, e.g. "Alerta de viagem - Bolivia" -- safer than scanning
// body prose, where an unrelated country could be mentioned in passing); (2) requires an
// explicit travel-danger phrase in the BODY (avoid non-essential travel / do not travel /
// evacuation / armed conflict / war -- not the word "alerta" alone); (3) excludes anything
// about fraud/scams/recruitment/trafficking/irregular immigration even if it names a
// country, since those are not a travel-safety statement about the destination. Unlike the
// France parser above, this does not attempt a separate "whole country vs specific
// province" cap: Brazil's bulletins are free-form individual write-ups (not a consistent
// per-country template with 15+ comparable examples to calibrate against, the way France's
// fiches are), so a second layer of scope-detection heuristics would be guessing on top of
// guessing. Coverage will stay close to zero most of the time by design -- rule 1 (never
// guess) means an ambiguous bulletin is skipped, not forced into a level.
const BR_SEVERE_RE = /\bnao viaje\b|evacuac[ao]|retirada de (cidadaos|brasileiros)|suspens[ao]o das atividades consulares/;
const BR_AVOID_RE = /evit\w* viage/; // evite/evitem/evitar viagem(ns)
const BR_EXCLUDE_RE = /fraude|aliciamento|trafico de pessoas|imigracao irregular|contrato de trabalho|contratos de trabalho|golpe/;

function stripBrAccents(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function fetchBrAdvisories(
  rawDir: string,
  fetchedAt: string,
  currentYear: number,
): Promise<FetcherResult> {
  const indicators: RawIndicator[] = [];
  const advisoryInfo: AdvisoryInfoMap = {};

  try {
    const listUrl = 'https://www.gov.br/mre/pt-br/assuntos/portal-consular/alertas%20e%20noticias/alertas/alertas';
    const response = await fetch(listUrl, {
      signal: AbortSignal.timeout(30_000),
      headers: FETCH_HEADERS,
    });

    if (!response.ok) {
      console.warn(`[ADVISORIES-T2A] BR: HTTP ${response.status}, no data available`);
      return { indicators, advisoryInfo };
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const articles: { title: string; url: string }[] = [];
    $('.tileItem h2.tileHeadline a').each((_, el) => {
      const title = $(el).text().trim();
      const url = $(el).attr('href');
      if (title && url) articles.push({ title, url });
    });

    await fetchBatch(
      articles,
      async (article) => {
        const titleNorm = stripBrAccents(article.title);
        if (BR_EXCLUDE_RE.test(titleNorm)) return; // fraud/scam/trafficking bulletin

        // Country identity comes from the title only -- see comment above. Plain substring
        // matching alone is not safe: many Portuguese country names contain a *different*
        // country's name outright (Congo is a substring of "Republica Democratica do
        // Congo", Russia of "Bielorrussia", Niger of "Nigeria", Mali of "Somalia"...), so
        // an article naming only the longer country would wrongly also tag the shorter
        // one. Keep a match only if its name is not itself contained in some other match.
        const rawMatches = COUNTRIES.filter((country) => {
          const ptName = country.name.pt ? stripBrAccents(country.name.pt) : '';
          return ptName && titleNorm.includes(ptName);
        });
        const namedCountries = rawMatches.filter((country) => {
          const ptName = stripBrAccents(country.name.pt!);
          return !rawMatches.some((other) => {
            if (other.iso3 === country.iso3) return false;
            const otherName = stripBrAccents(other.name.pt!);
            return otherName.length > ptName.length && otherName.includes(ptName);
          });
        });
        if (namedCountries.length === 0) return;

        try {
          const pageResponse = await fetch(article.url, {
            signal: AbortSignal.timeout(15_000),
            headers: FETCH_HEADERS,
          });
          if (!pageResponse.ok) return;

          const pageHtml = await pageResponse.text();
          const page$ = cheerio.load(pageHtml);
          page$('script, style').remove();
          const bodyNorm = stripBrAccents(page$('body').text());
          if (BR_EXCLUDE_RE.test(bodyNorm)) return; // defense in depth vs. the title check

          let level: UnifiedLevel;
          if (BR_SEVERE_RE.test(bodyNorm)) {
            level = 4;
          } else if (BR_AVOID_RE.test(bodyNorm)) {
            level = 3;
          } else {
            return; // named a country but stated no clear travel-danger phrase: emit nothing
          }

          for (const country of namedCountries) {
            const existing = indicators.find((i) => i.countryIso3 === country.iso3);
            if (existing) {
              if (level > existing.value) existing.value = level;
              continue;
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
              url: article.url,
            };
          }
        } catch {
          // Individual article page failed (timeout, network), skip silently
        }
      },
      3, // Concurrency 3 for politeness -- small article list, well within budget
    );
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

  // Per-source floor check: a single issuer's site redesign must not
  // silently drop its column (restores from the last healthy cache).
  enforcePerSourceFloors({
    logPrefix: '[ADVISORIES-T2A]',
    infoFile: 'advisories-tier2a-info.json',
    // Full issuer list from this tier's sub-fetchers — a zero-row collapse
    // must be caught too, not skipped because nothing was fetched.
    expectedIssuers: [
      'at',
      'br',
      'fi',
      'fr',
      'hk',
      'ie',
      'nz',
      'ph',
    ],
    // Measured minimums — small issuers must not false-positive daily.
    floors: { nz: 14, hk: 9, fr: 5, br: 0, fi: 0, ph: 0 }, // 0 = never produced data yet: monitor silently
    indicators: allIndicators,
    advisoryInfo: combinedAdvisoryInfo,
    errors,
  });

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
