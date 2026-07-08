import { fetchAllSources } from './fetchers/index.js';
import { computeAllScores } from './scoring/engine.js';
import { writeSnapshot } from './scoring/snapshot.js';
import { writeHistoryIndex } from './scoring/history.js';
import { readJson, getRawDir } from './utils/fs.js';
import { injectUcdpForDate } from './backfill.js';
import { aggregateVotes } from './sentiment/aggregate.js';
import { fetchVotes } from './sentiment/fetch-votes.js';
import { writeSentimentSnapshot, writeSentimentHistoryIndex, getSentimentDir } from './sentiment/snapshot.js';
import type { WeightsConfig, RawSourceData } from './types.js';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** Only aggregate votes newer than this window (Pitfall 8: D1 free-tier rows-read budget). */
const SENTIMENT_WINDOW_DAYS = 180;

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

  // v9.1 (SHIP-SPEC 1.3): today's ucdp-parsed.json holds ALL years 1989-latest
  // per country (fetchUcdp always dumps the full consolidated OWID mirror) —
  // without this injection the engine's rawByName Map.set would keep an
  // ARBITRARY year's row per country. Select the correct current-year vintage,
  // mirroring the same injection backfill.ts applies per historical date.
  injectUcdpForDate(date, rawDataMap);

  console.log(`Loaded ${rawDataMap.size} source(s) with raw data`);

  // Stage 3: Score
  console.log('\n--- Stage 3: Score ---');
  const scoredCountries = computeAllScores(rawDataMap, weightsConfig);
  console.log(`Scored ${scoredCountries.length} countries`);

  // Log tier contribution summary
  const avgScore = scoredCountries.reduce((sum, c) => sum + c.score, 0) / scoredCountries.length;
  console.log(`  Average score: ${avgScore.toFixed(1)}`);
  console.log(`  Countries scored: ${scoredCountries.length}`);

  // Log data completeness summary
  const avgCompleteness = scoredCountries.reduce((sum, c) => sum + c.dataCompleteness, 0) / scoredCountries.length;
  console.log(`  Average data completeness: ${(avgCompleteness * 100).toFixed(1)}%`);

  // Stage 4: Snapshot
  console.log('\n--- Stage 4: Snapshot ---');
  writeSnapshot(date, scoredCountries, fetchResults, weightsConfig.version);

  // Stage 5: History Index
  console.log('\n--- Stage 5: History Index ---');
  writeHistoryIndex();

  // Stage 6: Sentiment
  // Display-only community sentiment (D-06/D-14): wrapped so ANY failure here
  // (missing CF credentials, D1 unreachable, unexpected error) only warns and
  // never changes PipelineResult.success or aborts the run.
  console.log('\n--- Stage 6: Sentiment ---');
  try {
    const cutoff = Math.floor(Date.now() / 1000) - SENTIMENT_WINDOW_DAYS * 86_400;
    const { ok, rows } = await fetchVotes(cutoff);
    const officialScores = new Map(scoredCountries.map((c) => [c.iso3, c.score]));

    if (ok) {
      const sentimentSnapshot = aggregateVotes(rows, officialScores, Date.now());
      writeSentimentSnapshot(date, sentimentSnapshot);
      writeSentimentHistoryIndex();
      console.log(
        `[Sentiment] Aggregated ${Object.keys(sentimentSnapshot.countries).length} countries from ${rows.length} vote(s)`,
      );
    } else {
      const latestPath = join(getSentimentDir(), 'latest.json');
      if (existsSync(latestPath)) {
        console.warn('[Sentiment] D1 read unavailable — keeping last-known data/sentiment/latest.json');
      } else {
        writeSentimentSnapshot(date, { generatedAt: new Date().toISOString(), countries: {} });
        console.warn(
          '[Sentiment] D1 read unavailable and no prior snapshot — wrote empty-but-valid data/sentiment/latest.json',
        );
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Sentiment] Stage 6 failed unexpectedly (non-fatal): ${message}`);
  }

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
