#!/usr/bin/env node
/**
 * scripts/correct-gum-ca-history.ts
 *
 * One-off correction (SHIP-SPEC 1.1f): Guam (GUM)'s Canada (ca) advisory level
 * was transiently misparsed as Level 4 ("Avoid all travel") for four consecutive
 * days — verified against the live travel.gc.ca page (Canada has never issued a
 * "do not travel" advisory for Guam; Guam is a US territory under the same
 * baseline guidance as the rest of the US Pacific). The correct level is 1
 * ("Exercise normal security precautions"), matching every date immediately
 * before and after this window.
 *
 * Scripted (never hand-edited — data/raw/** is covered by the repo's
 * PreToolUse hook that blocks direct Edit/Write on generated data). Run once;
 * the v9.1 backfill regen then produces clean scores for these 4 dates.
 *
 * Usage: npx tsx scripts/correct-gum-ca-history.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const AFFECTED_DATES = ['2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07'];
const ISO3 = 'GUM';
const WRONG_LEVEL = 4;
const CORRECT_LEVEL = 1;
const CORRECT_TEXT = 'Exercise normal security precautions';

function correctAdvisoriesInfo(date: string): boolean {
  const path = join(process.cwd(), 'data', 'raw', date, 'advisories-info.json');
  if (!existsSync(path)) {
    console.warn(`[GUM-FIX] ${date}: advisories-info.json not found, skipping`);
    return false;
  }
  const data = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, { ca?: { level: number; text: string } }>;
  const entry = data[ISO3];
  if (!entry?.ca) {
    console.warn(`[GUM-FIX] ${date}: no ${ISO3}.ca entry in advisories-info.json, skipping`);
    return false;
  }
  if (entry.ca.level !== WRONG_LEVEL) {
    console.log(`[GUM-FIX] ${date}: advisories-info.json ${ISO3}.ca.level is already ${entry.ca.level}, not ${WRONG_LEVEL} — leaving as-is`);
    return false;
  }
  entry.ca.level = CORRECT_LEVEL;
  entry.ca.text = CORRECT_TEXT;
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`[GUM-FIX] ${date}: advisories-info.json ${ISO3}.ca.level corrected ${WRONG_LEVEL} -> ${CORRECT_LEVEL}`);
  return true;
}

function correctAdvisoriesParsed(date: string): boolean {
  const path = join(process.cwd(), 'data', 'raw', date, 'advisories-parsed.json');
  if (!existsSync(path)) {
    console.warn(`[GUM-FIX] ${date}: advisories-parsed.json not found, skipping`);
    return false;
  }
  interface Indicator { countryIso3: string; indicatorName: string; value: number; [key: string]: unknown }
  const data = JSON.parse(readFileSync(path, 'utf-8')) as { indicators: Indicator[] };
  let corrected = false;
  for (const ind of data.indicators) {
    if (ind.countryIso3 === ISO3 && ind.indicatorName === 'advisory_level_ca' && ind.value === WRONG_LEVEL) {
      ind.value = CORRECT_LEVEL;
      corrected = true;
    }
  }
  if (!corrected) {
    console.log(`[GUM-FIX] ${date}: advisories-parsed.json had no ${ISO3} advisory_level_ca=${WRONG_LEVEL} entry — leaving as-is`);
    return false;
  }
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log(`[GUM-FIX] ${date}: advisories-parsed.json ${ISO3} advisory_level_ca corrected ${WRONG_LEVEL} -> ${CORRECT_LEVEL}`);
  return true;
}

function main(): void {
  console.log(`=== GUM ca advisory history correction (SHIP-SPEC 1.1f) ===`);
  let anyChanged = false;
  for (const date of AFFECTED_DATES) {
    const a = correctAdvisoriesInfo(date);
    const b = correctAdvisoriesParsed(date);
    if (a || b) anyChanged = true;
  }
  console.log(anyChanged ? '\nDone — re-run the backfill to regenerate clean scores for these dates.' : '\nNo changes made (already corrected or no matching data).');
}

main();
