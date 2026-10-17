/**
 * Formula changes in the score history (v10 on 2026-10-15, v10.1 on 2026-10-17). The first version
 * of the switch detection only knew "the first v10 snapshot", so on 2026-10-17 the hero badge showed
 * Japan "+0.3 vs 7 days ago" (v10.1 minus v10) and the charts had no line for v10.1. These tests pin
 * the detection, the 7-day delta that starts again after the LATEST change, the chart caption for
 * several changes and the stacked chart labels.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formulaChangesFromHeaders, formulaLabel, sevenDayDelta, type HistoryPoint } from '../scores';
import { formulaChangeMarkers, formulaChangeNote, formulaChangesInRange } from '../../i18n/formula-change-copy';
import { formulaMarkersSvg, parseFormulaMarkers } from '../formula-markers';

const HEADERS = [
  { date: '2026-10-13', weightsVersion: '9.1.0' },
  { date: '2026-10-14', weightsVersion: '9.1.0' },
  { date: '2026-10-15', weightsVersion: '10.0.0' },
  { date: '2026-10-16', weightsVersion: '10.0.0' },
  { date: '2026-10-17', weightsVersion: '10.1.0' },
  { date: '2026-10-18', weightsVersion: '10.1.1' },
];

describe('formula changes: detection from snapshot headers', () => {
  it('labels v10+ by major and non-zero minor, and ignores v9.x', () => {
    assert.equal(formulaLabel('10.0.0'), '10');
    assert.equal(formulaLabel('10.1.0'), '10.1');
    assert.equal(formulaLabel('11.0.2'), '11');
    assert.equal(formulaLabel('9.1.0'), null);
    assert.equal(formulaLabel(undefined), null);
  });

  it('finds v10 and v10.1, and treats a patch bump as the same formula', () => {
    assert.deepEqual(formulaChangesFromHeaders(HEADERS), [
      { date: '2026-10-15', version: '10' },
      { date: '2026-10-17', version: '10.1' },
    ]);
  });

  it('skips an unreadable header instead of inventing a change', () => {
    const headers = [HEADERS[2], { date: '2026-10-16' }, HEADERS[3]];
    assert.deepEqual(formulaChangesFromHeaders(headers), [{ date: '2026-10-15', version: '10' }]);
  });
});

describe('formula changes: 7-day delta after the latest change', () => {
  const japan: HistoryPoint[] = [
    { date: '2026-10-10', score: 8.1 },
    { date: '2026-10-15', score: 8.14 },
    { date: '2026-10-16', score: 8.14 },
    { date: '2026-10-17', score: 8.47 },
  ];

  it('shows no delta on the v10.1 switch day (the +0.3 is the formula, not Japan)', () => {
    assert.equal(sevenDayDelta(japan, { date: '2026-10-17', version: '10.1' }), null);
  });

  it('measures again once two v10.1 points exist', () => {
    const d = sevenDayDelta([...japan, { date: '2026-10-24', score: 8.5 }], { date: '2026-10-17', version: '10.1' });
    assert.ok(d !== null && Math.abs(d - 0.03) < 1e-9);
  });
});

describe('formula changes: chart caption and markers', () => {
  const changes = formulaChangesFromHeaders(HEADERS);

  it('keeps only changes strictly inside the plotted dates', () => {
    assert.deepEqual(formulaChangesInRange(changes, ['2026-10-01', '2026-10-17']).map((c) => c.version), ['10', '10.1']);
    assert.deepEqual(formulaChangesInRange(changes, ['2026-10-15', '2026-10-16']).map((c) => c.version), []);
    assert.deepEqual(formulaChangesInRange(changes, ['2026-10-16']), []);
  });

  it('keeps the single-change caption and lists several changes', () => {
    assert.match(formulaChangeNote('en', changes.slice(0, 1)), /^The dashed line marks October 15, 2026, when the score moved to formula v10;/);
    assert.equal(
      formulaChangeNote('en', changes),
      'The dashed lines mark the formula changes (v10 on October 15, 2026; v10.1 on October 17, 2026); points before each line were computed with the previous formula.',
    );
    assert.match(formulaChangeNote('it', changes), /v10 il 15 ottobre 2026; v10\.1 il 17 ottobre 2026/);
    assert.match(formulaChangeNote('de', changes), /v10 am 15\. Oktober 2026; v10\.1 am 17\. Oktober 2026/);
    assert.equal(formulaChangeNote('en', []), '');
  });

  it('gives each change its own label', () => {
    assert.deepEqual(formulaChangeMarkers('fr', changes), [
      { date: '2026-10-15', label: 'Formule v10' },
      { date: '2026-10-17', label: 'Formule v10.1' },
    ]);
  });

  it('draws one dashed line per change in range and stacks labels that would overlap', () => {
    const markers = parseFormulaMarkers(JSON.stringify(formulaChangeMarkers('en', changes)));
    const first = new Date('2026-10-01T00:00:00Z');
    const last = new Date('2026-10-17T00:00:00Z');
    const day = 24 * 3600 * 1000;
    const xScale = (d: Date) => ((d.getTime() - first.getTime()) / day) * 40; // 16 days -> 640 px
    const svg = formulaMarkersSvg(markers, first, last, xScale, 640, 200);
    assert.equal((svg.match(/<line /g) ?? []).length, 2);
    assert.match(svg, /y="11"[^>]*>Formula v10</);
    assert.match(svg, /y="24"[^>]*>Formula v10\.1</); // 80 px from the v10 label: one line lower
  });

  it('reads a missing or broken attribute as no markers', () => {
    assert.deepEqual(parseFormulaMarkers(undefined), []);
    assert.deepEqual(parseFormulaMarkers('{oops'), []);
  });
});
