import { fetchAllSources } from './fetchers/index.js';
import { computeAllScores } from './scoring/engine.js';
import { writeSnapshot } from './scoring/snapshot.js';
import { readJson, getRawDir } from './utils/fs.js';
import type { WeightsConfig, RawSourceData } from './types.js';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface PipelineResult {
  success: boolean;
  countriesScored: number;
  sourcesSucceeded: number;
  sourcesTotal: number;
}

/**
 * Run the entire data pipeline: fetch -> score -> snapshot.
 *
 * @param dateOverride - Optional YYYY-MM-DD date string; defaults to today
 * @returns Pipeline result with success flag and counts
 */
export async function runPipeline(dateOverride?: string): Promise<PipelineResult> {
  const date = dateOverride || new Date().toISOString().slice(0, 10);
  console.log(`=== Pipeline run for ${date} ===`);

  // Load weights config
  const weightsPath = join(process.cwd(), 'src/pipeline/config/weights.json');
  const weightsConfig = readJson<WeightsConfig>(weightsPath);
  if (!weightsConfig) {
    console.error('FATAL: Could not load weights config from', weightsPath);
    return { success: false, countriesScored: 0, sourcesSucceeded: 0, sourcesTotal: 0 };
  }

  // Stage 1: Fetch
  console.log('\n--- Stage 1: Fetch ---');
  const fetchResults = await fetchAllSources(date);
  const sourcesSucceeded = fetchResults.filter((r) => r.success).length;
  const sourcesTotal = fetchResults.length;
  console.log(`Fetch summary: ${sourcesSucceeded}/${sourcesTotal} sources succeeded`);

  // Stage 2: Load raw data
  console.log('\n--- Stage 2: Load raw data ---');
  const rawDir = getRawDir(date);
  const rawDataMap = new Map<string, RawSourceData>();

  if (existsSync(rawDir)) {
    const parsedFiles = readdirSync(rawDir).filter((f) => f.endsWith('-parsed.json'));
    for (const file of parsedFiles) {
      const filePath = join(rawDir, file);
      const data = readJson<RawSourceData>(filePath);
      if (data) {
        rawDataMap.set(data.source, data);
        console.log(`  Loaded: ${data.source} (${data.indicators.length} indicators)`);
      }
    }
  }

  if (rawDataMap.size === 0) {
    console.error('ERROR: No raw data available — all fetchers failed and no cached data found');
    return { success: false, countriesScored: 0, sourcesSucceeded: 0, sourcesTotal };
  }

  console.log(`Loaded ${rawDataMap.size} source(s) with raw data`);

  // Stage 3: Score
  console.log('\n--- Stage 3: Score ---');
  const scoredCountries = computeAllScores(rawDataMap, weightsConfig);
  console.log(`Scored ${scoredCountries.length} countries`);

  // Stage 4: Snapshot
  console.log('\n--- Stage 4: Snapshot ---');
  writeSnapshot(date, scoredCountries, fetchResults, weightsConfig.version);

  console.log(
    `\n=== Pipeline complete: ${scoredCountries.length} countries scored, ${sourcesSucceeded}/${sourcesTotal} sources succeeded ===`,
  );

  return {
    success: sourcesSucceeded > 0,
    countriesScored: scoredCountries.length,
    sourcesSucceeded,
    sourcesTotal,
  };
}

// Auto-run when executed directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('run.ts');

if (isMainModule) {
  const dateArg = process.argv[2]; // optional: YYYY-MM-DD
  runPipeline(dateArg)
    .then((result) => {
      if (!result.success) process.exit(result.sourcesSucceeded === 0 ? 2 : 1);
    })
    .catch((err) => {
      console.error('Pipeline failed:', err);
      process.exit(2);
    });
}
