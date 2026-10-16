/**
 * Built-page checks for the 2026-10-15 page-UI fixes (run after `astro build`: `npm run test:build`).
 * Data-driven from dist/client/scores.json, so they hold on any day's snapshot:
 *  - I08: the hero's big number is the one-decimal score of the <title>, never a rounded integer;
 *  - I31: a pillar with nothing measured behind it shows "No data", not the prior as a score;
 *  - I34: militarisation / V-Dem state rows sit under "Country context", not in the pillar tables;
 *  - I27: a grey place with no advisory and no source says "No data yet", with no empty list;
 *  - I55: the community block heading is not followed by a second "Community" label;
 *  - affiliate removal: no Travelpayouts / Aviasales trace anywhere in the built pages.
 */
import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ScoredCountry } from '../pipeline/types';
import { isEstimatedPillar } from '../lib/pillar-presentation';
import { greyHasNoData } from '../i18n/grey-copy';

const ROOT = join(import.meta.dirname, '..', '..');
const DIST_CLIENT = join(ROOT, 'dist', 'client');

const countryPage = (iso3: string, lang = 'en', segment = 'country'): string =>
  readFileSync(join(DIST_CLIENT, lang, segment, iso3.toLowerCase(), 'index.html'), 'utf-8');

/** The hero's big number: the first text-6xl span of the scored hero. */
function heroBigNumber(html: string): string | null {
  const m = html.match(/<span class="text-6xl[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/);
  return m ? m[1] : null;
}

let countries: ScoredCountry[] = [];
before(() => {
  const data = JSON.parse(readFileSync(join(DIST_CLIENT, 'scores.json'), 'utf-8'));
  countries = (Array.isArray(data) ? data : data.countries) as ScoredCountry[];
});
const scored = () => countries.filter((c) => c.scoreStatus !== 'insufficient_data' && typeof c.score === 'number');
const grey = () => countries.filter((c) => c.scoreStatus === 'insufficient_data');

describe('I08: hero shows the one-decimal score', () => {
  it('every scored en page: big number === score.toFixed(1), the same figure as the <title>', () => {
    for (const c of scored()) {
      const html = countryPage(c.iso3);
      const big = heroBigNumber(html);
      assert.equal(big, c.score!.toFixed(1), `${c.iso3}: hero shows ${big}`);
      assert.ok(html.includes(`<title>`) && html.match(/<title>[^<]*<\/title>/)![0].includes(`${big}/10`), `${c.iso3}: title disagrees`);
    }
  });
});

describe('I31: estimated pillars are not shown as measured scores', () => {
  it('every estimated pillar renders "No data" and no "x.x/10" bar', () => {
    let checked = 0;
    for (const c of scored()) {
      for (const p of c.pillars.filter(isEstimatedPillar)) {
        const html = countryPage(c.iso3);
        const row = html.match(new RegExp(`<div[^>]*data-pillar="${p.name}"[^>]*>[\\s\\S]*?</div>`))?.[0] ?? '';
        assert.ok(row.includes('data-pillar-estimated="true"'), `${c.iso3}/${p.name}: not marked estimated`);
        assert.ok(row.includes('No data'), `${c.iso3}/${p.name}: no "No data" label`);
        assert.ok(!/\d\.\d\/10/.test(row), `${c.iso3}/${p.name}: still prints a score`);
        checked++;
      }
    }
    console.log(`  (${checked} estimated pillars checked)`);
  });
});

describe('I47: "not an average of the bars" note', () => {
  it('appears exactly when the hero score is above every printed bar (every scored en page)', () => {
    let shown = 0;
    for (const c of scored()) {
      const html = countryPage(c.iso3);
      const has = html.includes('data-note="score-above-bars"');
      const top = Math.max(...c.pillars.filter((p) => !isEstimatedPillar(p)).map((p) => Number((p.score * 10).toFixed(1))));
      assert.equal(has, Number(c.score!.toFixed(1)) > top, `${c.iso3}: score ${c.score!.toFixed(1)}, top bar ${top}`);
      if (has) shown++;
    }
    console.log(`  (note shown on ${shown} scored places)`);
  });
});

describe('I34: state indicators sit under "Country context"', () => {
  for (const [lang, segment, summary] of [['en', 'country', 'Country context'], ['de', 'land', 'Länderkontext']] as const) {
    it(`${lang}: DEU and PRK list militarisation / V-Dem rows only inside #country-context`, () => {
      for (const iso3 of ['DEU', 'PRK']) {
        const c = countries.find((x) => x.iso3 === iso3);
        if (!c || c.scoreStatus === 'insufficient_data') continue;
        const html = countryPage(iso3, lang, segment);
        const ctxStart = html.indexOf('id="country-context"');
        assert.ok(ctxStart > 0, `${lang}/${iso3}: no country-context section`);
        const ctx = html.slice(ctxStart, html.indexOf('</details>', ctxStart));
        assert.ok(ctx.includes(summary), `${lang}/${iso3}: summary text`);
        const label = lang === 'en' ? 'Political corruption (V-Dem)' : 'Politische Korruption (V-Dem)';
        assert.ok(ctx.includes(label), `${lang}/${iso3}: corruption row missing from context`);
        const before = html.slice(html.indexOf('id="pillars"'), ctxStart);
        assert.ok(!before.includes(label), `${lang}/${iso3}: corruption row still in a pillar table`);
      }
    });
  }
});

describe('I27: grey places with nothing to list', () => {
  it('say "No data yet" and show no "What we do have" heading', () => {
    const none = grey().filter(greyHasNoData);
    for (const c of none) {
      const html = countryPage(c.iso3);
      assert.ok(html.includes('No data yet'), `${c.iso3}: no "No data yet"`);
      assert.ok(!html.includes('What we do have'), `${c.iso3}: empty "What we do have" heading`);
      const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
      assert.ok(title.includes('No Data Yet') && !title.includes('Partial'), `${c.iso3}: title "${title}"`);
    }
    console.log(`  (${none.length} no-data grey places checked)`);
  });

  it('the map tooltip gets the same set: data-no-data-isos lists exactly those places, in every language', () => {
    const expected = grey().filter(greyHasNoData).map((c) => c.iso3).sort().join(',');
    for (const lang of ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de']) {
      const html = readFileSync(join(DIST_CLIENT, lang, 'index.html'), 'utf-8');
      const listed = html.match(/data-no-data-isos="([^"]*)"/)?.[1];
      assert.ok(listed !== undefined, `${lang}: homepage map has no data-no-data-isos`);
      assert.equal(listed.split(',').filter(Boolean).sort().join(','), expected, `${lang}: map no-data set`);
    }
  });

  it('grey places with something to list keep the list, advisories counted as one source', () => {
    const some = grey().filter((c) => !greyHasNoData(c) && Object.keys(c.advisories ?? {}).length > 1);
    for (const c of some.slice(0, 10)) {
      const html = countryPage(c.iso3);
      assert.ok(html.includes('What we do have'), c.iso3);
      assert.ok(html.includes('(counted together as one source)'), c.iso3);
    }
  });
});

describe('I55: the community heading is not repeated', () => {
  it('en, it, es: no "<heading> <badge>" doubling', () => {
    for (const [lang, segment, doubled] of [
      ['en', 'country', /Community Sentiment\s*<\/h2>\s*<span[^>]*>\s*Community/],
      ['it', 'paese', /<\/h2>\s*<span[^>]*>\s*Community\s*<\/span>/],
      ['es', 'pais', /<\/h2>\s*<span[^>]*>\s*Comunidad\s*<\/span>/],
    ] as const) {
      const html = countryPage('CHN', lang, segment);
      assert.ok(html.includes('id="community-sentiment"'), `${lang}: community block missing`);
      assert.ok(!doubled.test(html), `${lang}: heading followed by a duplicate label`);
    }
  });
});

describe('affiliate removal', () => {
  it('no Travelpayouts / Aviasales / affiliate marker in any built HTML page', () => {
    const pattern = /travelpayouts|aviasales|tp-em\.com|affiliate|name="marker"/i;
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.html') && pattern.test(readFileSync(full, 'utf-8'))) offenders.push(full);
      }
    };
    walk(DIST_CLIENT);
    assert.deepEqual(offenders.slice(0, 5), [], `${offenders.length} pages still carry affiliate traces`);
  });
});
