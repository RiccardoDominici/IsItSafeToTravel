/**
 * The consistency-database re-check (scripts/audit/recheck-findings.ts): text folding, quote
 * search and the issue roll-up. A "fixed" status is what tells the owner a defect is gone, so the
 * matcher must not call a quote gone because of a decimal comma, and the roll-up must never call
 * an issue fixed while one of its findings is open or unsettled.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeText, quoteSegments, quoteState, rollUp } from '../recheck-findings';

const corpus = (pages: Record<string, string>) => {
  const byPage = new Map(Object.entries(pages).map(([k, v]) => [k, normalizeText(v)]));
  const byLang = new Map<string, string>();
  for (const [k, v] of byPage) {
    const lang = k.split('.')[1];
    byLang.set(lang, [byLang.get(lang), v].filter(Boolean).join('\n'));
  }
  return { byPage, byLang };
};

describe('recheck: text folding', () => {
  it('reads decimal commas, typographic quotes and odd spaces as the plain text', () => {
    assert.equal(normalizeText('Sicherheit 6,7/10 «sûr» !'), 'Sicherheit 6.7/10 "sûr" !');
    assert.equal(normalizeText('Population 1,234,567'), 'Population 1.234.567');
  });

  it('masks every number when asked', () => {
    assert.equal(normalizeText('Exercise caution 7 6.7 out of 10', true), 'Exercise caution # # out of #');
  });

  it('splits a quote at the excerpt joins and drops scraps', () => {
    assert.deepEqual(quoteSegments('First long excerpt ... second long excerpt / ok'), ['First long excerpt', 'second long excerpt']);
  });
});

describe('recheck: quote state', () => {
  const oldC = corpus({ 'KAZ.de': 'Schwächster Bereich: Naturgefahren (6,6).', 'CHN.de': 'Schwächster Bereich: Naturgefahren (5,5).' });

  it('is gone when the old page had it and the new one does not', () => {
    const newC = corpus({ 'KAZ.de': 'Hauptaugenmerk: Naturgefahren (6,6).' });
    assert.equal(quoteState({ iso3: 'KAZ', lang: 'de', quote: 'Schwächster Bereich: Naturgefahren (6.6)' }, oldC, newC, false), 'gone');
  });

  it('is still present across a decimal-comma change', () => {
    const newC = corpus({ 'KAZ.de': 'Schwächster Bereich: Naturgefahren (6,6).' });
    assert.equal(quoteState({ iso3: 'KAZ', lang: 'de', quote: 'Schwächster Bereich: Naturgefahren (6.6)' }, oldC, newC, false), 'still-present');
  });

  it('searches the whole language for a template finding', () => {
    const newC = corpus({ 'KAZ.de': 'x', 'CHN.de': 'Schwächster Bereich: Naturgefahren (5,5).' });
    assert.equal(quoteState({ iso3: 'ALL', lang: 'de', quote: 'Schwächster Bereich: Naturgefahren' }, oldC, newC, false), 'still-present');
  });

  it('is unmatched when the old pages never had the quote (a paraphrase)', () => {
    assert.equal(quoteState({ iso3: 'KAZ', lang: 'de', quote: 'never said anything like this' }, oldC, oldC, false), 'unmatched');
  });
});

describe('recheck: issue roll-up', () => {
  it('is fixed only when nothing is open or unsettled', () => {
    assert.equal(rollUp(['fixed', 'fixed']), 'fixed');
    assert.equal(rollUp(['fixed', 'open']), 'partial');
    assert.equal(rollUp(['open']), 'open');
    assert.equal(rollUp(['fixed', 'unverified']), 'partial');
    assert.equal(rollUp(['unverified']), 'unverified');
    assert.equal(rollUp([]), 'unverified');
  });

  it('weighs fixed against by-design when nothing is left to do', () => {
    assert.equal(rollUp(['fixed', 'fixed', 'by-design']), 'fixed');
    assert.equal(rollUp(['by-design', 'by-design', 'fixed']), 'by-design');
  });
});
