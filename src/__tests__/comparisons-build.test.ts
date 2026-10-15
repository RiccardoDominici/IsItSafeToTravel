/**
 * Built-page check for the comparison table (run after `astro build`: `npm run test:build`).
 * Data-driven from dist/client/scores.json, so it holds on any day's snapshot.
 *
 * WHY: the pillar bars stopped printing a regional prior as a measured score (audit I31), but the
 * comparison table still did for neighbours (Nauru's crime prior shown as 5.7 on Fiji's and
 * Kiribati's tables). Every pillar cell must follow the same rule as the bars: an estimated pillar
 * reads "No data" (localised) and carries no number.
 */
import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScoredCountry } from '../pipeline/types';
import { isEstimatedPillar } from '../lib/pillar-presentation';
import { pillarPresentationCopy } from '../i18n/pillar-presentation-copy';
import { greyCopy, greyHasNoData } from '../i18n/grey-copy';
import { communityCopy } from '../i18n/community-copy';

const DIST_CLIENT = join(import.meta.dirname, '..', '..', 'dist', 'client');
const SEGMENT = { en: 'country', de: 'land' } as const;

let countries: ScoredCountry[] = [];
before(() => {
  const data = JSON.parse(readFileSync(join(DIST_CLIENT, 'scores.json'), 'utf-8'));
  countries = (Array.isArray(data) ? data : data.countries) as ScoredCountry[];
});

/** Pillar cells of the comparison table, per row place: iso3 -> pillar -> { estimated, text }. */
function tableCells(html: string, lang: keyof typeof SEGMENT): Map<string, Map<string, { estimated: boolean; text: string }>> {
  const rows = new Map<string, Map<string, { estimated: boolean; text: string }>>();
  for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
    if (!/<td[^>]*data-pillar=/.test(tr)) continue;
    const iso3 = tr.match(new RegExp(`href="/${lang}/${SEGMENT[lang]}/([a-z]{3})/"`))?.[1]?.toUpperCase();
    if (!iso3) continue;
    const cells = new Map<string, { estimated: boolean; text: string }>();
    for (const m of tr.matchAll(/<td([^>]*data-pillar="([a-z]+)"[^>]*)>([\s\S]*?)<\/td>/g)) {
      cells.set(m[2], { estimated: m[1].includes('data-pillar-estimated="true"'), text: m[3].replace(/<[^>]+>/g, '').trim() });
    }
    rows.set(iso3, cells);
  }
  return rows;
}

describe('comparison table: estimated pillars read "No data", like the pillar bars', () => {
  for (const lang of ['en', 'de'] as const) {
    it(`${lang}: every pillar cell of every table follows isEstimatedPillar`, () => {
      const byIso = new Map(countries.map((c) => [c.iso3, c]));
      const noData = pillarPresentationCopy[lang].noData;
      let estimatedSeen = 0;
      let measuredSeen = 0;
      for (const page of countries) {
        const html = readFileSync(join(DIST_CLIENT, lang, SEGMENT[lang], page.iso3.toLowerCase(), 'index.html'), 'utf-8');
        for (const [iso3, cells] of tableCells(html, lang)) {
          const row = byIso.get(iso3);
          assert.ok(row, `${page.iso3}: table row for unknown ${iso3}`);
          for (const [name, cell] of cells) {
            const pillar = row.pillars.find((p) => p.name === name);
            if (!pillar || isEstimatedPillar(pillar)) {
              assert.ok(cell.estimated && cell.text === noData, `${page.iso3} ${lang}: ${iso3}/${name} shows "${cell.text}"`);
              estimatedSeen++;
            } else {
              assert.ok(!cell.estimated && cell.text === (pillar.score * 10).toFixed(1), `${page.iso3} ${lang}: ${iso3}/${name} shows "${cell.text}"`);
              measuredSeen++;
            }
          }
        }
      }
      assert.ok(measuredSeen > 1000, `only ${measuredSeen} measured cells checked`);
      const anyEstimated = countries.some((c) => c.scoreStatus !== 'insufficient_data' && c.pillars.some(isEstimatedPillar));
      if (anyEstimated) assert.ok(estimatedSeen > 0, 'estimated pillars exist in the data but no table showed one');
    });
  }
});

describe('comparison table: a place without a score is labelled like its hero', () => {
  for (const lang of ['en', 'de'] as const) {
    it(`${lang}: "No data yet" with no advisory and no source, "Partial data" otherwise`, () => {
      const byIso = new Map(countries.map((c) => [c.iso3, c]));
      const seen = { 'no-data': 0, partial: 0 };
      for (const page of countries) {
        const html = readFileSync(join(DIST_CLIENT, lang, SEGMENT[lang], page.iso3.toLowerCase(), 'index.html'), 'utf-8');
        for (const tr of html.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) ?? []) {
          const label = tr.match(/<td[^>]*data-grey-label="(no-data|partial)"[^>]*>([\s\S]*?)<\/td>/);
          if (!label) continue;
          const iso3 = tr.match(new RegExp(`href="/${lang}/${SEGMENT[lang]}/([a-z]{3})/"`))?.[1]?.toUpperCase();
          const place = iso3 ? byIso.get(iso3) : undefined;
          assert.ok(place, `${page.iso3}: grey row without a known place`);
          const noData = greyHasNoData(place);
          const text = label[2].replace(/<[^>]+>/g, '').trim();
          assert.equal(label[1], noData ? 'no-data' : 'partial', `${page.iso3} ${lang}: ${iso3}`);
          assert.equal(text, noData ? greyCopy[lang].noDataTitle : communityCopy[lang].partialDataTitle, `${page.iso3} ${lang}: ${iso3}`);
          seen[label[1] as 'no-data' | 'partial']++;
        }
      }
      assert.ok(seen.partial > 0, 'no "Partial data" row seen');
      const anyNoData = countries.some((c) => c.scoreStatus === 'insufficient_data' && greyHasNoData(c));
      if (anyNoData) assert.ok(seen['no-data'] > 0, 'places with no data exist but no table showed one');
    });
  }
});
