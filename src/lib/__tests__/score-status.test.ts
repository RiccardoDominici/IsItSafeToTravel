/**
 * Formula v10 grey rule on the site side (src/lib/score-status.ts and its consumers): both data
 * shapes must work. A v9.1 snapshot (number score, no scoreStatus) renders exactly as scored; a v10
 * `insufficient_data` place has no score, no rank, and never enters a ranking or a comparison.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { ScoredCountry } from '../../pipeline/types';
import { buildRankMap, isGrey, isScored, officialScore, scoredOnly } from '../score-status';
import { hasSufficientData } from '../hub-data';
import { getCountriesByRegion } from '../regions';
import { comparisonRows } from '../comparisons';
import { sevenDayDelta, type HistoryPoint } from '../scores';

function country(iso3: string, score: number | null, extra: Partial<ScoredCountry> = {}): ScoredCountry {
  return {
    iso3,
    name: { en: iso3, it: iso3, es: iso3, fr: iso3, pt: iso3 },
    score,
    scoreDisplay: score === null ? null : Math.round(score),
    pillars: [],
    advisories: {},
    dataCompleteness: 1,
    confidence: 0.8,
    lastUpdated: '2026-10-15T00:00:00Z',
    sources: Array.from({ length: 5 }, (_, i) => ({ name: `s${i}`, url: 'u', fetchedAt: '', description: '' })),
    ...extra,
  };
}

describe('score-status: both data shapes', () => {
  it('treats a v9.1-shaped entry (number score, no scoreStatus) as scored', () => {
    const c = country('FRA', 7.9);
    assert.equal(isScored(c), true);
    assert.equal(isGrey(c), false);
    assert.equal(officialScore(c), 7.9);
  });

  it('treats a v10 scored entry as scored and an insufficient_data entry as grey', () => {
    assert.equal(isScored(country('DEU', 8.5, { scoreStatus: 'scored' })), true);
    const grey = country('ALA', null, { scoreStatus: 'insufficient_data', dataScore: null });
    assert.equal(isScored(grey), false);
    assert.equal(officialScore(grey), null);
  });

  it('never treats a non-finite score as official', () => {
    assert.equal(isScored(country('XXX', Number.NaN)), false);
    // A status that says grey wins over a stray number.
    assert.equal(isScored(country('YYY', 5.9, { scoreStatus: 'insufficient_data' })), false);
  });

  it('scoredOnly keeps only countries with an official score', () => {
    const list = [country('A', 7), country('B', null, { scoreStatus: 'insufficient_data' }), country('C', 5)];
    assert.deepEqual(scoredOnly(list).map((c) => c.iso3), ['A', 'C']);
  });
});

describe('score-status: ranks', () => {
  it('ranks only scored countries, safest first, iso3 tie-break, and counts only them', () => {
    const list = [
      country('BBB', 6),
      country('GRY', null, { scoreStatus: 'insufficient_data' }),
      country('AAA', 6),
      country('TOP', 8.8),
    ];
    const { ranks, total } = buildRankMap(list);
    assert.equal(total, 3);
    assert.equal(ranks.get('TOP'), 1);
    assert.equal(ranks.get('AAA'), 2);
    assert.equal(ranks.get('BBB'), 3);
    assert.equal(ranks.has('GRY'), false);
  });
});

describe('score-status consumers', () => {
  it('hasSufficientData needs an official score as well as 4+ sources', () => {
    assert.equal(hasSufficientData(country('OK', 6.1)), true);
    assert.equal(hasSufficientData(country('GRY', null, { scoreStatus: 'insufficient_data' })), false);
    // v10 danger guard: scored with 3 sources, still not ranked.
    const guard = country('DNG', 3.9, { sources: country('x', 1).sources.slice(0, 3) });
    assert.equal(hasSufficientData(guard), false);
  });

  it('region rankings leave grey places out', () => {
    const list = [country('FRA', 7.9), country('ALA', null, { scoreStatus: 'insufficient_data' }), country('DEU', 8.5)];
    assert.deepEqual(getCountriesByRegion(list, 'europe').map((c) => c.iso3), ['DEU', 'FRA']);
  });

  it('comparison rows put a grey subject first and keep the others in distance order, not by score', () => {
    const subject = country('ALA', null, { scoreStatus: 'insufficient_data' });
    const fin = country('FIN', 8.6);
    const swe = country('SWE', 8.9);
    const rows = comparisonRows(subject, {
      others: [
        { country: fin, relation: 'sea', km: 9 },
        { country: swe, relation: 'sea', km: 35 },
      ],
    });
    assert.deepEqual(rows.map((r) => r.country.iso3), ['ALA', 'FIN', 'SWE']);
    assert.equal(rows[0].relation, 'self');
  });
});

describe('scores: sevenDayDelta never crosses a formula change', () => {
  const points: HistoryPoint[] = [
    { date: '2026-10-07', score: 6.2 },
    { date: '2026-10-14', score: 6.3 },
    { date: '2026-10-15', score: 5.9 },
  ];

  it('compares within the same formula only', () => {
    // Switch on 10-15: only one comparable point, so no 7-day delta at all.
    assert.equal(sevenDayDelta(points, { date: '2026-10-15', version: '10' }), null);
  });

  it('keeps the plain 7-day delta without a formula change', () => {
    const d = sevenDayDelta(points.slice(0, 2), null);
    assert.ok(d !== null && Math.abs(d - 0.1) < 1e-9);
  });

  it('uses points from the switch date onwards once there are two of them', () => {
    const later: HistoryPoint[] = [...points, { date: '2026-10-22', score: 6.0 }];
    const d = sevenDayDelta(later, { date: '2026-10-15', version: '10' });
    assert.ok(d !== null && Math.abs(d - 0.1) < 1e-9);
  });
});
