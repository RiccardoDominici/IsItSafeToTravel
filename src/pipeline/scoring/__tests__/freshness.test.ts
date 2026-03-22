import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { freshnessWeight } from '../freshness.js';

const DAY_MS = 86_400_000; // 1 day in milliseconds

describe('freshnessWeight', () => {
  it('returns 1.0 for fresh data (age = 0)', () => {
    assert.equal(freshnessWeight(0, 365, 730), 1.0);
  });

  it('returns ~0.5 at half-life for baseline sources (365-day half-life)', () => {
    const weight = freshnessWeight(365 * DAY_MS, 365, 730);
    assert.ok(Math.abs(weight - 0.5) < 0.001, `Expected ~0.5, got ${weight}`);
  });

  it('returns 0 when past maxAgeDays (baseline: 731 days > 730 maxAge)', () => {
    assert.equal(freshnessWeight(731 * DAY_MS, 365, 730), 0);
  });

  it('returns 1.0 for negative age (treated as fresh)', () => {
    assert.equal(freshnessWeight(-1, 365, 730), 1.0);
  });

  it('returns ~0.5 at GDELT half-life (3-day half-life)', () => {
    const weight = freshnessWeight(3 * DAY_MS, 3, 14);
    assert.ok(Math.abs(weight - 0.5) < 0.001, `Expected ~0.5, got ${weight}`);
  });

  it('returns 0 when past GDELT maxAge (14 days exceeded)', () => {
    assert.equal(freshnessWeight(14 * DAY_MS + 1, 3, 14), 0);
  });

  it('returns ~0.5 at advisories half-life (7-day half-life)', () => {
    const weight = freshnessWeight(7 * DAY_MS, 7, 30);
    assert.ok(Math.abs(weight - 0.5) < 0.001, `Expected ~0.5, got ${weight}`);
  });

  it('returns value between 0 and 1 for intermediate ages', () => {
    const weight = freshnessWeight(100 * DAY_MS, 365, 730);
    assert.ok(weight > 0 && weight < 1, `Expected between 0 and 1, got ${weight}`);
  });

  it('decays monotonically — older data always has lower weight', () => {
    const w1 = freshnessWeight(10 * DAY_MS, 365, 730);
    const w2 = freshnessWeight(100 * DAY_MS, 365, 730);
    const w3 = freshnessWeight(500 * DAY_MS, 365, 730);
    assert.ok(w1 > w2, `10-day weight (${w1}) should exceed 100-day weight (${w2})`);
    assert.ok(w2 > w3, `100-day weight (${w2}) should exceed 500-day weight (${w3})`);
  });
});
