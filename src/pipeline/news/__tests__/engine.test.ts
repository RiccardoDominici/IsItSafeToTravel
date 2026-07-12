import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeNews } from '../engine.js';
import { filterSortCap, cooldownKey } from '../cooldown.js';
import type { DailySnapshot, ScoredCountry, SourceMeta } from '../../types.js';
import type { NewsEvent } from '../types.js';

// 4 sources = meets hasSufficientData / MIN_RANKING_SOURCES floor (see engine.ts + hub-data.ts).
const SOURCES: SourceMeta[] = [
  { name: 'gpi', url: 'https://x', fetchedAt: '2026-01-01T00:00:00Z', description: '' },
  { name: 'worldbank', url: 'https://x', fetchedAt: '2026-01-01T00:00:00Z', description: '' },
  { name: 'vdem', url: 'https://x', fetchedAt: '2026-01-01T00:00:00Z', description: '' },
  { name: 'advisories', url: 'https://x', fetchedAt: '2026-01-01T00:00:00Z', description: '' },
];

function mkCountry(iso3: string, score: number, overrides: Partial<ScoredCountry> = {}): ScoredCountry {
  return {
    iso3,
    name: { en: iso3, it: iso3, es: iso3, fr: iso3, pt: iso3 },
    score,
    scoreDisplay: Math.round(score),
    pillars: [],
    advisories: {},
    dataCompleteness: 1,
    confidence: 1,
    lastUpdated: '2026-01-01T00:00:00Z',
    sources: SOURCES,
    ...overrides,
  };
}

function mkSnapshot(date: string, countries: ScoredCountry[]): DailySnapshot {
  return {
    date,
    generatedAt: `${date}T00:00:00Z`,
    pipelineVersion: 'test',
    weightsVersion: 'test',
    globalScore: 6.6,
    countries,
    fetchResults: [],
  };
}

describe('computeNews: score_jump', () => {
  it('fires at delta >= 0.15 (0.20 case)', () => {
    const prev = mkSnapshot('2026-07-09', [mkCountry('AAA', 6.0)]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('AAA', 6.2)]);
    const events = computeNews(prev, curr, '2026-07-10');
    const jump = events.find((e) => e.type === 'score_jump' && e.params.country === 'AAA');
    assert.ok(jump, 'expected a score_jump event at delta=0.20');
  });

  it('does NOT fire below threshold (0.10 case)', () => {
    const prev = mkSnapshot('2026-07-09', [mkCountry('AAA', 6.0)]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('AAA', 6.1)]);
    const events = computeNews(prev, curr, '2026-07-10');
    const jump = events.find((e) => e.type === 'score_jump' && e.params.country === 'AAA');
    assert.equal(jump, undefined);
  });
});

describe('computeNews: band_change hysteresis', () => {
  it('fires for 6.8 -> 7.1 (crosses moderate/good boundary by >= 0.03)', () => {
    const prev = mkSnapshot('2026-07-09', [mkCountry('BBB', 6.8)]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('BBB', 7.1)]);
    const events = computeNews(prev, curr, '2026-07-10');
    const bandEvt = events.find((e) => e.type === 'band_change' && e.params.country === 'BBB');
    assert.ok(bandEvt);
    assert.equal(bandEvt!.params.fromBand, 'moderate');
    assert.equal(bandEvt!.params.toBand, 'good');
  });

  it('does NOT fire for 6.99 -> 7.01 (rounds into the same displayed band)', () => {
    const prev = mkSnapshot('2026-07-09', [mkCountry('BBB', 6.99)]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('BBB', 7.01)]);
    const events = computeNews(prev, curr, '2026-07-10');
    const bandEvt = events.find((e) => e.type === 'band_change' && e.params.country === 'BBB');
    assert.equal(bandEvt, undefined);
  });
});

describe('computeNews: rank_overtake', () => {
  it('emits {country: FRA, other: ITA} when FRA passes ITA within the top-40', () => {
    const filler = Array.from({ length: 38 }, (_, i) => mkCountry(`F${i.toString().padStart(2, '0')}`, 7.0 - i * 0.01));
    const prevCountries = [mkCountry('ITA', 8.0), mkCountry('FRA', 7.9), ...filler];
    const currCountries = [mkCountry('FRA', 8.0), mkCountry('ITA', 7.85), ...filler];
    const prev = mkSnapshot('2026-07-09', prevCountries);
    const curr = mkSnapshot('2026-07-10', currCountries);
    const events = computeNews(prev, curr, '2026-07-10');
    const overtake = events.find((e) => e.type === 'rank_overtake' && e.params.country === 'FRA');
    assert.ok(overtake, 'expected FRA to overtake ITA');
    assert.equal(overtake!.params.other, 'ITA');
  });
});

describe('computeNews: severe_advisory', () => {
  const adv = (level: number) => ({ us: { level, text: '', source: '', url: '', updatedAt: '' } });

  it('fires when the US advisory rises 2 -> 4', () => {
    const prev = mkSnapshot('2026-07-09', [mkCountry('CCC', 6.0, { advisories: adv(2) })]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('CCC', 6.0, { advisories: adv(4) })]);
    const events = computeNews(prev, curr, '2026-07-10');
    const evt = events.find((e) => e.type === 'severe_advisory' && e.params.country === 'CCC');
    assert.ok(evt);
    assert.equal(evt!.params.level, 4);
  });

  it('does NOT fire when the US advisory stays at 4 -> 4', () => {
    const prev = mkSnapshot('2026-07-09', [mkCountry('CCC', 6.0, { advisories: adv(4) })]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('CCC', 6.0, { advisories: adv(4) })]);
    const events = computeNews(prev, curr, '2026-07-10');
    const evt = events.find((e) => e.type === 'severe_advisory' && e.params.country === 'CCC');
    assert.equal(evt, undefined);
  });
});

describe('computeNews: new_country', () => {
  it('fires for a fresh iso3 not present yesterday', () => {
    const prev = mkSnapshot('2026-07-09', [mkCountry('AAA', 6.0)]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('AAA', 6.0), mkCountry('ZZZ', 6.0)]);
    const events = computeNews(prev, curr, '2026-07-10');
    const evt = events.find((e) => e.type === 'new_country' && e.params.country === 'ZZZ');
    assert.ok(evt);
  });
});

describe('computeNews: no prior snapshot', () => {
  it('returns [] and never throws', () => {
    const curr = mkSnapshot('2026-07-10', [mkCountry('AAA', 6.0)]);
    assert.doesNotThrow(() => computeNews(null, curr, '2026-07-10'));
    const events = computeNews(null, curr, '2026-07-10');
    assert.deepEqual(events, []);
  });
});

describe('computeNews: confidence gate (MIN_NEWS_CONFIDENCE = 0.4)', () => {
  it('suppresses band_change for a low-confidence country', () => {
    const prev = mkSnapshot('2026-07-09', [mkCountry('LOW', 6.8, { confidence: 0.25 })]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('LOW', 7.1, { confidence: 0.25 })]);
    const events = computeNews(prev, curr, '2026-07-10');
    assert.equal(events.find((e) => e.type === 'band_change'), undefined);
  });

  it('suppresses score_jump for a low-confidence country', () => {
    const prev = mkSnapshot('2026-07-09', [mkCountry('LOW', 6.0, { confidence: 0.39 })]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('LOW', 6.3, { confidence: 0.39 })]);
    const events = computeNews(prev, curr, '2026-07-10');
    assert.equal(events.find((e) => e.type === 'score_jump'), undefined);
  });

  it('suppresses rank_overtake when EITHER side is low-confidence', () => {
    const filler = Array.from({ length: 38 }, (_, i) => mkCountry(`F${i.toString().padStart(2, '0')}`, 7.0 - i * 0.01));
    const prev = mkSnapshot('2026-07-09', [mkCountry('ITA', 8.0, { confidence: 0.3 }), mkCountry('FRA', 7.9), ...filler]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('FRA', 8.0), mkCountry('ITA', 7.85, { confidence: 0.3 }), ...filler]);
    const events = computeNews(prev, curr, '2026-07-10');
    assert.equal(events.find((e) => e.type === 'rank_overtake'), undefined);
  });

  it('does NOT suppress severe_advisory for a low-confidence country (real external fact)', () => {
    const adv = (level: number) => ({ us: { level, text: '', source: '', url: '', updatedAt: '' } });
    const prev = mkSnapshot('2026-07-09', [mkCountry('LOW', 6.0, { confidence: 0.2, advisories: adv(2) })]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('LOW', 6.0, { confidence: 0.2, advisories: adv(4) })]);
    const events = computeNews(prev, curr, '2026-07-10');
    assert.ok(events.find((e) => e.type === 'severe_advisory'));
  });

  it('attaches internal confidence param to gated types and treats missing confidence as confident', () => {
    const prev = mkSnapshot('2026-07-09', [mkCountry('AAA', 6.0, { confidence: 0.83 })]);
    const curr = mkSnapshot('2026-07-10', [mkCountry('AAA', 6.2, { confidence: 0.83 })]);
    const jump = computeNews(prev, curr, '2026-07-10').find((e) => e.type === 'score_jump');
    assert.ok(jump);
    assert.equal(jump!.params.confidence, 0.83);

    // confidence: undefined (pre-v9 snapshot shape) must NOT suppress
    const prevU = mkSnapshot('2026-07-09', [mkCountry('BBB', 6.0, { confidence: undefined as unknown as number })]);
    const currU = mkSnapshot('2026-07-10', [mkCountry('BBB', 6.2, { confidence: undefined as unknown as number })]);
    assert.ok(computeNews(prevU, currU, '2026-07-10').find((e) => e.type === 'score_jump'));
  });
});

describe('filterSortCap: cooldown suppression', () => {
  const event: NewsEvent = {
    id: '2026-07-10:rank_overtake:FRA:ITA',
    date: '2026-07-10',
    type: 'rank_overtake',
    priority: 60,
    params: { country: 'FRA', other: 'ITA', rank: 1 },
  };

  it('suppresses a repeat rank_overtake within the 14-day window', () => {
    const key = cooldownKey(event);
    const cooldowns = { [key]: '2026-07-05' }; // 5 days ago, within the 14-day window
    const kept = filterSortCap([event], cooldowns, '2026-07-10');
    assert.equal(kept.length, 0);
  });

  it('allows the same overtake again once past the cooldown window', () => {
    const key = cooldownKey(event);
    const cooldowns = { [key]: '2026-06-20' }; // > 14 days ago
    const kept = filterSortCap([event], cooldowns, '2026-07-10');
    assert.equal(kept.length, 1);
  });
});
