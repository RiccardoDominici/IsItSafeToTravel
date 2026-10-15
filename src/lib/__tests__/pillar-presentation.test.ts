import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import type { IndicatorScore, PillarScore } from '../../pipeline/types.js';
import {
  COUNTRY_CONTEXT_INDICATORS,
  isCountryContextIndicator,
  isEstimatedPillar,
  scoreAboveAllBars,
  splitContextIndicators,
} from '../pillar-presentation.js';
import { displayedIndicators, isScoredIndicator } from '../indicator-display.js';
import { pillarPresentationCopy } from '../../i18n/pillar-presentation-copy.js';
import { publishedLanguages, type Lang } from '../../i18n/ui.js';

const ind = (name: string, source = 'x'): IndicatorScore =>
  ({ name, rawValue: 1, normalizedValue: 0.5, source, year: 2025 }) as unknown as IndicatorScore;

const pillar = (name: string, indicators: IndicatorScore[], dataCompleteness: number, score = 0.57): PillarScore =>
  ({ name, score, weight: 0.2, indicators, dataCompleteness }) as unknown as PillarScore;

describe('isEstimatedPillar (audit I31)', () => {
  it('a crime pillar with no indicator is the regional prior: estimated', () => {
    assert.equal(isEstimatedPillar(pillar('crime', [], 0)), true);
  });

  it('one measured indicator is enough to be a measured pillar', () => {
    assert.equal(isEstimatedPillar(pillar('crime', [ind('wb_homicide')], 0.5)), false);
    assert.equal(isEstimatedPillar(pillar('health', [ind('inform_epidemic')], 0.5)), false);
  });

  it('conflict with advisories only (the synthetic "A" slot) is measured, without anything is estimated', () => {
    // A is not listed in `indicators`; dataCompleteness 1/4 says one of the four slots was found.
    assert.equal(isEstimatedPillar(pillar('conflict', [], 0.25)), false);
    assert.equal(isEstimatedPillar(pillar('conflict', [], 0)), true);
    assert.equal(isEstimatedPillar(pillar('conflict', [ind('gpi_overall')], 0.25)), false);
  });

  it('zero-precision alert feeds alone do not make the natural-hazards pillar measured', () => {
    assert.equal(isEstimatedPillar(pillar('environment', [ind('gdacs_disaster_alerts')], 1 / 3)), true);
    assert.equal(isEstimatedPillar(pillar('environment', [ind('inform_natural'), ind('gdacs_disaster_alerts')], 2 / 3)), false);
  });
});

describe('scoreAboveAllBars (audit I47)', () => {
  const measured = (name: string, p: number) => pillar(name, [ind(name === 'crime' ? 'wb_homicide' : 'inform_epidemic')], 1, p);

  it('true only when the printed score is above the highest printed bar', () => {
    const bars = [measured('crime', 0.84), measured('health', 0.852)]; // printed 8.4 and 8.5
    assert.equal(scoreAboveAllBars(8.6, bars), true);
    assert.equal(scoreAboveAllBars(8.5, bars), false, 'equal to the top bar is not above it');
    assert.equal(scoreAboveAllBars(8.54, bars), false, 'compared on the printed decimal (8.5)');
    assert.equal(scoreAboveAllBars(8.55, bars), true, '8.55 prints 8.6');
    assert.equal(scoreAboveAllBars(6.1, bars), false);
  });

  it('skips estimated pillars (they print no number) and grey places (no score)', () => {
    const bars = [measured('health', 0.7), pillar('crime', [], 0, 0.95)];
    assert.equal(scoreAboveAllBars(7.4, bars), true, 'the 9.5 prior of an estimated pillar is not a bar');
    assert.equal(scoreAboveAllBars(null, bars), false);
    assert.equal(scoreAboveAllBars(undefined, bars), false);
    assert.equal(scoreAboveAllBars(9.9, [pillar('crime', [], 0)]), false, 'no displayed bar at all');
  });

  it('the engine mapping 1 + 9·c^0.96 sits above the bar scale 10·c everywhere below 10 (why the note exists)', () => {
    for (let c = 0; c < 1; c += 0.01) assert.ok(1 + 9 * Math.pow(c, 0.96) > 10 * c, `c = ${c}`);
  });
});

describe('country context indicators (audit I34)', () => {
  it('are militarisation and the V-Dem public administration / corruption rows, and every one is scored', () => {
    assert.deepEqual([...COUNTRY_CONTEXT_INDICATORS].sort(), ['gpi_militarisation', 'vdem_corruption_control', 'vdem_gov_effectiveness']);
    // A context row still counts in the score (display only). If the formula stops scoring one,
    // this fails on purpose so the context list and its explanation are revisited.
    for (const name of COUNTRY_CONTEXT_INDICATORS) assert.ok(isScoredIndicator(name), `${name} is no longer scored`);
  });

  it('the traveller rows (rule of law, GPI overall, homicide...) stay in the main table', () => {
    for (const name of ['gpi_overall', 'vdem_rule_of_law', 'inform_governance', 'wb_homicide', 'ucdp_conflict_deaths']) {
      assert.equal(isCountryContextIndicator(name), false, name);
    }
  });

  it('splitContextIndicators keeps the weights.json order on both sides', () => {
    const governance = pillar('governance', [ind('inform_governance'), ind('vdem_corruption_control'), ind('vdem_rule_of_law'), ind('vdem_gov_effectiveness')], 1);
    const { traveller, context } = splitContextIndicators(displayedIndicators(governance));
    assert.deepEqual(traveller.map((i) => i.name), ['vdem_rule_of_law', 'inform_governance']);
    assert.deepEqual(context.map((i) => i.name), ['vdem_gov_effectiveness', 'vdem_corruption_control']);
    const conflict = pillar('conflict', [ind('gpi_overall'), ind('gpi_militarisation'), ind('ucdp_conflict_deaths')], 1);
    const split = splitContextIndicators(displayedIndicators(conflict));
    assert.deepEqual(split.traveller.map((i) => i.name), ['gpi_overall', 'ucdp_conflict_deaths']);
    assert.deepEqual(split.context.map((i) => i.name), ['gpi_militarisation']);
  });
});

describe('pillarPresentationCopy (7 locales)', () => {
  const LANGS = publishedLanguages as readonly Lang[];

  it('covers every published language, no empty field, {pillar} only where it is filled', () => {
    assert.deepEqual(Object.keys(pillarPresentationCopy).sort(), [...LANGS].sort());
    for (const lang of LANGS) {
      const c = pillarPresentationCopy[lang];
      for (const [key, value] of Object.entries(c)) {
        assert.ok(value.trim().length > 0, `${lang}.${key} is empty`);
        assert.equal(value.includes('{pillar}'), key === 'contextCountsIn', `${lang}.${key}`);
        assert.equal(value.split('{link}').length - 1, key === 'scoreAboveBarsNote' ? 1 : 0, `${lang}.${key}: {link}`);
      }
    }
  });

  it('zh uses full-width punctuation (F0200: the old note had ASCII "," and ".")', () => {
    for (const [key, value] of Object.entries(pillarPresentationCopy.zh)) {
      assert.ok(!/[,.;:]/.test(value), `zh.${key}: ${value}`);
    }
  });

  it('fr puts a non-breaking space before ":" (never a plain space)', () => {
    for (const [key, value] of Object.entries(pillarPresentationCopy.fr)) {
      assert.ok(!/ [?!:;]/.test(value), `fr.${key}: ${value}`);
    }
  });

  it('the notes no longer claim a thin pillar is "excluded" from the score', () => {
    assert.ok(!/exclu/i.test(pillarPresentationCopy.en.lowCoverageNote));
    assert.match(pillarPresentationCopy.en.estimateNote, /estimate/);
  });
});
