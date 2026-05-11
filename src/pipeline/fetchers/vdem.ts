import type { FetchResult, RawSourceData, RawIndicator } from '../types.js';
import { writeJson, readJson, getRawDir, findLatestCached } from '../utils/fs.js';
import { getCountryByIso3 } from '../config/countries.js';
import { join } from 'node:path';

/**
 * V-Dem v16 governance indicators fetched from Our World in Data CSV mirrors.
 *
 * Each indicator lives at https://ourworldindata.org/grapher/{slug}.csv with stable
 * Entity / Code / Year / IndicatorValue / World region columns. V-Dem v16 was released
 * 2026-03-17 and covers data through year 2025 (~183 countries). Distributed under
 * CC-BY-SA 4.0 (Coppedge et al., DOI 10.23696/vdemds26).
 *
 * Three indicators replace the four retired WGI indicators (PV.EST / RL.EST / GE.EST / CC.EST).
 * Political stability has no clean V-Dem 1:1 equivalent and is dropped from weights.json
 * (its weight redistributed to GPI + advisories in the Conflict pillar).
 */
const INDICATORS: Array<{ slug: string; name: string; description: string }> = [
  {
    slug: 'rule-of-law-index',
    name: 'vdem_rule_of_law',
    description: 'V-Dem Rule of Law Index (0..1, higher = stronger rule of law)',
  },
  {
    slug: 'political-corruption-index',
    name: 'vdem_corruption_control',
    description: 'V-Dem Political Corruption Index (0..1, higher = more corrupt; inverted in normalize.ts)',
  },
  {
    slug: 'rigorous-and-impartial-public-administration-score',
    name: 'vdem_gov_effectiveness',
    description: 'V-Dem Rigorous and Impartial Public Administration (point estimate, ~-3.5..3.5, higher = better)',
  },
];

/**
 * Parse a V-Dem OWID CSV body and return a single RawIndicator per country
 * (the latest year-row where `year <= targetYear`).
 *
 * Exported for unit tests.
 *
 * Filter rules (mirror worldbank.ts:61-62):
 *   - skip header line
 *   - skip rows with empty Code
 *   - skip rows whose Code starts with `OWID_` (regional aggregates)
 *   - skip rows whose ISO3 fails getCountryByIso3() lookup (microstates not in our list)
 *   - skip rows whose Value is not Number.isFinite() (handles "" and "NaN")
 *   - skip rows whose Year exceeds targetYear (year-boundary safety; see test case (g))
 *
 * Column indices: parts[1]=Code, parts[2]=Year, parts[3]=Value. We do NOT use
 * parts[0] (Entity) because Entity may contain commas in future CSV revisions.
 */
export function parseVdemCsv(text: string, targetYear: number, indicatorName: string): RawIndicator[] {
  const lines = text.split('\n');
  // Group by ISO3 and keep the latest year <= targetYear.
  const byCountry = new Map<string, { value: number; year: number }>();

  // Skip header line (index 0). Skip the first line if it starts with "Entity"
  // (defensive — handles CRLF and blank-first-line edge cases).
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(',');
    if (parts.length < 4) continue;

    const code = parts[1].trim().toUpperCase();
    const yearRaw = parts[2].trim();
    const valueRaw = parts[3].trim();

    if (!code) continue;
    if (code.startsWith('OWID_')) continue;
    if (!getCountryByIso3(code)) continue;

    const year = Number.parseInt(yearRaw, 10);
    if (!Number.isFinite(year)) continue;
    if (year > targetYear) continue;

    const value = Number.parseFloat(valueRaw);
    if (!Number.isFinite(value)) continue;

    const existing = byCountry.get(code);
    if (!existing || year > existing.year) {
      byCountry.set(code, { value, year });
    }
  }

  const out: RawIndicator[] = [];
  for (const [iso3, data] of byCountry) {
    out.push({
      countryIso3: iso3,
      indicatorName,
      value: data.value,
      year: data.year,
      source: 'vdem',
    });
  }
  return out;
}

async function fetchIndicator(
  slug: string,
  indicatorName: string,
  targetYear: number,
): Promise<RawIndicator[]> {
  const url = `https://ourworldindata.org/grapher/${slug}.csv?v=1&csvType=full&useColumnShortNames=false`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(60_000),
    headers: { Accept: 'text/csv' },
  });

  if (!response.ok) {
    throw new Error(`${slug}: HTTP ${response.status}`);
  }

  const text = await response.text();
  return parseVdemCsv(text, targetYear, indicatorName);
}

/**
 * Fetch V-Dem v16 governance indicators for the given snapshot date.
 *
 * Mirrors fetchWorldBank's structure:
 *   - parallel Promise.allSettled across the 3 indicators
 *   - partial-failure cache fallback via findLatestCached('vdem-parsed.json')
 *   - writes data/raw/{date}/vdem-parsed.json with the RawSourceData envelope
 *
 * The fetcher's targetYear = parseInt(date.slice(0,4)). For 2026 snapshots the
 * latest available V-Dem v16 row is year 2025 — the parser handles the boundary
 * automatically (see parseVdemCsv test case (g)).
 */
export async function fetchVdem(date: string): Promise<FetchResult> {
  const fetchedAt = new Date().toISOString();
  const rawDir = getRawDir(date);
  const targetYear = parseInt(date.slice(0, 4), 10);

  try {
    console.log(`[VDEM] Fetching V-Dem v16 indicators for year ${targetYear}...`);
    const allIndicators: RawIndicator[] = [];
    const errors: string[] = [];

    const results = await Promise.allSettled(
      INDICATORS.map((ind) => fetchIndicator(ind.slug, ind.name, targetYear)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const ind = INDICATORS[i];
      if (result.status === 'fulfilled') {
        const count = result.value.length;
        console.log(`  ${ind.slug} (${ind.name}): ${count} countries`);
        allIndicators.push(...result.value);
      } else {
        const msg = result.reason instanceof Error ? result.reason.message : String(result.reason);
        console.warn(`  ${ind.slug}: FAILED — ${msg}`);
        errors.push(`${ind.slug}: ${msg}`);
      }
    }

    // Partial failure: merge cached data for failed indicators
    const succeededNames = new Set(allIndicators.map((ind) => ind.indicatorName));
    const failedIndicators = INDICATORS.filter((ind) => !succeededNames.has(ind.name));

    if (failedIndicators.length > 0 && allIndicators.length > 0) {
      const cached = findLatestCached('vdem-parsed.json');
      if (cached) {
        const cachedData = readJson<RawSourceData>(cached);
        if (cachedData) {
          const failedNames = new Set(failedIndicators.map((ind) => ind.name));
          const cachedFill = cachedData.indicators.filter((ind) => failedNames.has(ind.indicatorName));
          if (cachedFill.length > 0) {
            allIndicators.push(...cachedFill);
            console.log(`[VDEM] Merged cached data for failed indicators: ${[...failedNames].join(', ')} (${cachedFill.length} data points)`);
          }
        }
      }
    }

    if (allIndicators.length === 0) {
      throw new Error(`All indicators failed: ${errors.join('; ')}`);
    }

    const sourceData: RawSourceData = {
      source: 'vdem',
      fetchedAt,
      indicators: allIndicators,
    };
    writeJson(join(rawDir, 'vdem-parsed.json'), sourceData);

    const uniqueCountries = new Set(allIndicators.map((i) => i.countryIso3));
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    console.log(
      `[VDEM] ${successCount}/${INDICATORS.length} indicators fetched, ${uniqueCountries.size} countries, ${allIndicators.length} data points`,
    );

    return {
      source: 'vdem',
      success: true,
      countriesFound: uniqueCountries.size,
      error: errors.length > 0 ? `Partial: ${errors.join('; ')}` : undefined,
      fetchedAt,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[VDEM] Fetch failed: ${errorMessage}`);

    const cached = findLatestCached('vdem-parsed.json');
    if (cached) {
      const cachedData = readJson<RawSourceData>(cached);
      if (cachedData) {
        console.warn(`[VDEM] Using cached data from ${cached}`);
        writeJson(join(rawDir, 'vdem-parsed.json'), cachedData);
        const uniqueCountries = new Set(cachedData.indicators.map((i) => i.countryIso3));
        return {
          source: 'vdem',
          success: true,
          countriesFound: uniqueCountries.size,
          error: `Used cached data. Original error: ${errorMessage}`,
          fetchedAt: cachedData.fetchedAt,
        };
      }
    }

    return {
      source: 'vdem',
      success: false,
      countriesFound: 0,
      error: errorMessage,
      fetchedAt,
    };
  }
}
