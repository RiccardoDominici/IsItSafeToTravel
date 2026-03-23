import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByName } from '../config/countries.js';
import { join } from 'node:path';

const WHO_DONS_URL = 'https://www.who.int/api/news/diseaseoutbreaknews';

interface WhoDonItem {
  Title?: string;
  PublicationDateGMT?: string;
  DatePublished?: string;
}

/**
 * Extract country name from a WHO DON title.
 * Common patterns:
 *   "Disease - Country"
 *   "Disease - Country (or sub-region)"
 *   "Disease in Country"
 */
function extractCountryFromTitle(title: string): string | undefined {
  // Try "Disease - Country" pattern first (most common)
  if (title.includes(' - ')) {
    const parts = title.split(' - ');
    const candidate = parts[parts.length - 1].trim();
    // Remove parenthetical sub-regions like "(Province of ...)"
    const cleaned = candidate.replace(/\s*\(.*\)/, '').trim();
    if (cleaned.length > 0) {
      const resolved = getCountryByName(cleaned);
      if (resolved) return resolved.iso3;
    }
  }

  // Try "Disease in Country" pattern
  if (title.includes(' in ')) {
    const parts = title.split(' in ');
    const candidate = parts[parts.length - 1].trim();
    const cleaned = candidate.replace(/\s*\(.*\)/, '').trim();
    if (cleaned.length > 0) {
      const resolved = getCountryByName(cleaned);
      if (resolved) return resolved.iso3;
    }
  }

  return undefined;
}

export async function fetchWhoDons(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);

  try {
    console.log('[WHO-DONs] Fetching disease outbreak news...');

    const response = await fetch(WHO_DONS_URL, {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const rawData = await response.json();
    writeJson(join(rawDir, 'who-dons.json'), rawData);

    const indicators = parseWhoDons(rawData, date, fetchedAt);
    const sourceData: RawSourceData = {
      source: 'who-dons',
      fetchedAt,
      indicators,
    };
    writeJson(join(rawDir, 'who-dons-parsed.json'), sourceData);

    const uniqueCountries = new Set(indicators.map((i) => i.countryIso3));
    console.log(
      `[WHO-DONs] Successfully processed data for ${uniqueCountries.size} countries (${indicators.length} indicators)`,
    );

    return {
      source: 'who-dons',
      success: true,
      countriesFound: uniqueCountries.size,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[WHO-DONs] Fetch failed: ${errorMessage}`);

    // Try fallback to cached data
    const cached = findLatestCached('who-dons-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[WHO-DONs] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'who-dons-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'who-dons',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'who-dons',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}

function parseWhoDons(rawData: unknown, date: string, fetchedAt: string): RawIndicator[] {
  const indicators: RawIndicator[] = [];
  const currentYear = new Date().getFullYear();

  // WHO DONs API returns { value: [...items] }
  const items = (rawData as Record<string, unknown>)?.value;
  if (!Array.isArray(items)) {
    console.log('[WHO-DONs] No DON items found in response');
    return indicators;
  }

  // Filter to items published within last 90 days from the date parameter
  const referenceDate = new Date(date);
  const ninetyDaysAgo = new Date(referenceDate.getTime() - 90 * 24 * 60 * 60 * 1000);

  const recentItems: WhoDonItem[] = [];
  for (const item of items as WhoDonItem[]) {
    const pubDateStr = item.PublicationDateGMT || item.DatePublished;
    if (!pubDateStr) continue;

    const pubDate = new Date(pubDateStr);
    if (isNaN(pubDate.getTime())) continue;
    if (pubDate >= ninetyDaysAgo && pubDate <= referenceDate) {
      recentItems.push(item);
    }
  }

  console.log(`[WHO-DONs] Found ${recentItems.length} DONs in last 90 days`);

  // Count qualifying outbreaks per country ISO3
  const countryOutbreaks = new Map<string, number>();

  for (const item of recentItems) {
    const title = item.Title;
    if (!title) continue;

    const iso3 = extractCountryFromTitle(title);
    if (!iso3) continue;

    countryOutbreaks.set(iso3, (countryOutbreaks.get(iso3) || 0) + 1);
  }

  // Convert to indicators
  for (const [iso3, count] of countryOutbreaks) {
    indicators.push({
      countryIso3: iso3,
      indicatorName: 'who_active_outbreaks',
      value: count,
      year: currentYear,
      source: 'who-dons',
      fetchedAt,
    });
  }

  return indicators;
}
