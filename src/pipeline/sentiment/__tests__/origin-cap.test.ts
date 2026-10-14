import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { applyOriginCap, normalizeOrigin, UNKNOWN_ORIGIN, type OriginVote } from '../origin-cap.js';

describe('normalizeOrigin', () => {
  it('uppercases and trims a two-letter country code', () => {
    assert.equal(normalizeOrigin('fr'), 'FR');
    assert.equal(normalizeOrigin(' it '), 'IT');
  });

  it('maps every value that names no country to the unknown group', () => {
    for (const raw of [null, undefined, '', 'T1', 'XX', 'USA', 'F', 42]) {
      assert.equal(normalizeOrigin(raw), UNKNOWN_ORIGIN, `expected ${JSON.stringify(raw)} to be unknown`);
    }
  });
});

/** Shares of the capped total, keyed by origin. */
function sharesOf(votes: OriginVote[]): Record<string, number> {
  return Object.fromEntries(applyOriginCap(votes).shares);
}

describe('applyOriginCap', () => {
  it('leaves weights untouched when no origin is above 50%', () => {
    const votes: OriginVote[] = [
      { origin: 'FR', weight: 1 },
      { origin: 'IT', weight: 1 },
      { origin: 'ES', weight: 1 },
    ];
    assert.deepEqual(applyOriginCap(votes).weights, [1, 1, 1]);
  });

  it('scales a 60% origin to exactly 50%: its weight becomes the weight of the rest', () => {
    // FR 6 of 10 (60%) -> rest is 4 -> FR scaled to 4 -> shares 4/8 and 4/8.
    const votes: OriginVote[] = [
      ...Array.from({ length: 6 }, () => ({ origin: 'FR', weight: 1 })),
      { origin: 'IT', weight: 2 },
      { origin: 'ES', weight: 2 },
    ];
    const { weights, shares } = applyOriginCap(votes);
    assert.ok(Math.abs((shares.get('FR') ?? 0) - 0.5) < 1e-12, `FR share ${shares.get('FR')}`);
    assert.ok(Math.abs((shares.get('IT') ?? 0) - 0.25) < 1e-12);
    assert.ok(Math.abs(weights.slice(0, 6).reduce((s, w) => s + w, 0) - 4) < 1e-12);
  });

  it('keeps the relative weights of votes inside the capped origin', () => {
    // FR votes [3, 1] (sum 4) vs IT [2] -> FR 4/6 > 50%, rest 2 -> FR scaled to 2 (factor 0.5).
    const votes: OriginVote[] = [
      { origin: 'FR', weight: 3 },
      { origin: 'FR', weight: 1 },
      { origin: 'IT', weight: 2 },
    ];
    const { weights } = applyOriginCap(votes);
    assert.ok(Math.abs(weights[0] - 1.5) < 1e-12);
    assert.ok(Math.abs(weights[1] - 0.5) < 1e-12);
    assert.ok(Math.abs(weights[0] / weights[1] - 3) < 1e-12, 'the 3:1 ratio inside FR is preserved');
    assert.equal(weights[2], 2, 'the other origin is untouched');
  });

  it('caps the dominant origin in a 70/20/10 split down to 30/20/10 of the total', () => {
    const votes: OriginVote[] = [
      { origin: 'FR', weight: 70 },
      { origin: 'IT', weight: 20 },
      { origin: 'ES', weight: 10 },
    ];
    const shares = sharesOf(votes);
    assert.ok(Math.abs(shares.FR - 0.5) < 1e-12);
    assert.ok(Math.abs(shares.IT - 1 / 3) < 1e-12);
    assert.ok(Math.abs(shares.ES - 1 / 6) < 1e-12);
  });

  it('caps the unknown group like any other origin', () => {
    const votes: OriginVote[] = [
      { origin: UNKNOWN_ORIGIN, weight: 90 },
      { origin: 'FR', weight: 10 },
    ];
    const shares = sharesOf(votes);
    assert.ok(Math.abs(shares[UNKNOWN_ORIGIN] - 0.5) < 1e-12);
  });

  it('never caps a lone origin', () => {
    const result = applyOriginCap([{ origin: 'FR', weight: 5 }, { origin: 'FR', weight: 3 }]);
    assert.deepEqual(result.weights, [5, 3]);
    assert.equal(result.shares.get('FR'), 1);
  });

  it('returns no shares and no weights for no votes', () => {
    const result = applyOriginCap([]);
    assert.deepEqual(result.weights, []);
    assert.equal(result.shares.size, 0);
  });

  it('is stable: after the cap, no origin exceeds 50% and shares sum to 1 (deterministic random sets)', () => {
    // 32-bit linear congruential generator (Math.imul keeps the arithmetic exact): the sweep is
    // reproducible run to run.
    let seed = 20261014;
    const next = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const origins = ['FR', 'IT', 'ES', 'DE', UNKNOWN_ORIGIN];

    for (let trial = 0; trial < 500; trial++) {
      const n = 2 + Math.floor(next() * 12);
      const votes: OriginVote[] = Array.from({ length: n }, () => ({
        origin: origins[Math.floor(next() * origins.length)],
        weight: 0.5 ** (next() * 120 / 30) + 1e-6,
      }));
      const result = applyOriginCap(votes);

      const distinct = new Set(votes.map((v) => v.origin)).size;
      let shareSum = 0;
      for (const share of result.shares.values()) {
        shareSum += share;
        if (distinct >= 2) assert.ok(share <= 0.5 + 1e-9, `trial ${trial}: share ${share} above the cap`);
      }
      assert.ok(Math.abs(shareSum - 1) < 1e-9, `trial ${trial}: shares sum to ${shareSum}`);

      result.weights.forEach((w, i) => {
        assert.ok(w > 0, `trial ${trial}: weight ${i} must stay positive`);
        assert.ok(w <= votes[i].weight + 1e-12, `trial ${trial}: the cap never raises a weight`);
      });
    }
  });
});
