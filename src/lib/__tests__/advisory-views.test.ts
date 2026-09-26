import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import type { ScoredCountry } from '../../pipeline/types.js';
import {
  MIN_ISSUER_COVERAGE,
  MIN_ISSUERS_FOR_DISAGREEMENT,
  getIssuerIso3,
  getIssuerCountry,
  getValidAdvisoryLevels,
  getIssuerCoverage,
  getEligibleIssuers,
  getIssuerLatestUpdateDate,
  getCountriesForIssuer,
  getIssuerComparisonStats,
  getMostAndLeastRestrictiveIssuers,
  getDisagreementRanking,
  getLevelExtremes,
  getMostDivergentIssuer,
  countFullConsensus,
} from '../advisory-views.js';

// Minimal-but-typed ScoredCountry fixture: only iso3/name/advisories vary
// per test, everything else is filler the functions under test never read.
function fixture(iso3: string, levels: Record<string, number>): ScoredCountry {
  const advisories: Record<string, unknown> = {};
  for (const [code, level] of Object.entries(levels)) {
    advisories[code] = { level, text: `text-${code}`, source: `source-${code}`, url: `https://example.test/${code}` };
  }
  return {
    iso3,
    name: { en: iso3, it: iso3, es: iso3, fr: iso3, pt: iso3 },
    score: 5,
    scoreDisplay: 5,
    pillars: [],
    advisories: advisories as ScoredCountry['advisories'],
    dataCompleteness: 1,
    confidence: 1,
    lastUpdated: '2026-09-26T00:00:00Z',
    sources: [],
  };
}

// --- getValidAdvisoryLevels: drops missing/malformed, keeps 1-4 integers ---

describe('getValidAdvisoryLevels', () => {
  it('keeps only in-range integer levels and drops the rest', () => {
    const country = fixture('AAA', { us: 3, uk: 4 });
    // Inject a malformed entry the fixture helper can't express (out of range / non-numeric).
    (country.advisories as Record<string, unknown>).ca = { level: 0, text: '', source: '', url: '' };
    (country.advisories as Record<string, unknown>).au = { level: 'unknown', text: '', source: '', url: '' };
    const levels = getValidAdvisoryLevels(country);
    assert.deepEqual(levels.map((l) => l.code).sort(), ['uk', 'us']);
    assert.equal(levels.find((l) => l.code === 'us')?.level, 3);
  });

  it('returns an empty array for a country with no advisories', () => {
    assert.deepEqual(getValidAdvisoryLevels(fixture('ZZZ', {})), []);
  });
});

// --- issuer <-> issuing-country ISO3 mapping ---

describe('getIssuerIso3 / getIssuerCountry', () => {
  it('maps a plain issuer code to its ISO3 (lowercase-URL convention)', () => {
    assert.equal(getIssuerIso3('us'), 'USA');
    assert.equal(getIssuerIso3('hk'), 'HKG');
    assert.equal(getIssuerIso3('tw'), 'TWN');
  });

  it('applies the uk -> gb override (uk is not itself a valid ISO2)', () => {
    assert.equal(getIssuerIso3('uk'), 'GBR');
  });

  it('returns null for an unresolvable code', () => {
    assert.equal(getIssuerIso3('zz'), null);
  });

  it('getIssuerCountry finds the issuer\'s own ScoredCountry by resolved ISO3', () => {
    const usa = fixture('USA', {});
    const found = getIssuerCountry([fixture('FRA', {}), usa], 'us');
    assert.equal(found, usa);
  });

  it('getIssuerCountry returns null when the resolved country is not in the snapshot', () => {
    assert.equal(getIssuerCountry([fixture('FRA', {})], 'us'), null);
  });
});

// --- coverage + eligibility (Task A.1: >= MIN_ISSUER_COVERAGE) ---

describe('getIssuerCoverage / getEligibleIssuers', () => {
  it('counts total coverage and the per-level breakdown for one issuer', () => {
    const countries = [
      fixture('AAA', { us: 4 }),
      fixture('BBB', { us: 2 }),
      fixture('CCC', { us: 2 }),
      fixture('DDD', {}), // no us entry at all -- must not count
    ];
    const coverage = getIssuerCoverage(countries, 'us');
    assert.equal(coverage.total, 3);
    assert.deepEqual(coverage.byLevel, { 1: 0, 2: 2, 3: 0, 4: 1 });
  });

  it('excludes issuers below MIN_ISSUER_COVERAGE and sorts the rest by coverage descending', () => {
    const many = Array.from({ length: MIN_ISSUER_COVERAGE }, (_, i) => fixture(`C${i}`, { us: 1 }));
    const few = Array.from({ length: MIN_ISSUER_COVERAGE - 1 }, (_, i) => fixture(`D${i}`, { uk: 1 }));
    const eligible = getEligibleIssuers([...many, ...few]);
    assert.deepEqual(eligible.map((e) => e.code), ['us']);
    assert.equal(eligible[0].total, MIN_ISSUER_COVERAGE);
  });
});

describe('getIssuerLatestUpdateDate', () => {
  it('returns the most recent updatedAt, comparing "YYYY-MM-DD" and full-ISO formats correctly', () => {
    const a = fixture('AAA', { us: 2 });
    (a.advisories as Record<string, unknown>).us = { level: 2, text: '', source: '', url: '', updatedAt: '2026-01-10' };
    const b = fixture('BBB', { us: 2 });
    (b.advisories as Record<string, unknown>).us = { level: 2, text: '', source: '', url: '', updatedAt: '2026-09-24T09:12:45.000Z' };
    const c = fixture('CCC', { us: 2 }); // no updatedAt at all -- must not win or crash
    assert.equal(getIssuerLatestUpdateDate([a, b, c], 'us'), '2026-09-24T09:12:45.000Z');
  });

  it('returns null when no entry for this issuer carries a date', () => {
    assert.equal(getIssuerLatestUpdateDate([fixture('AAA', { us: 2 })], 'us'), null);
  });
});

// --- per-issuer grouping (Task A.2) ---

describe('getCountriesForIssuer', () => {
  it('groups by level 4 -> 1 and sorts each group alphabetically by the given name resolver', () => {
    const countries = [
      fixture('FRA', { us: 2 }),
      fixture('DEU', { us: 4 }),
      fixture('ITA', { us: 4 }),
      fixture('ESP', {}), // no US entry -- must be absent everywhere, not "level 1"
    ];
    const groups = getCountriesForIssuer(countries, 'us', (c) => c.iso3);
    assert.deepEqual(groups.map((g) => g.level), [4, 3, 2, 1]);
    const level4 = groups.find((g) => g.level === 4)!;
    assert.deepEqual(level4.entries.map((e) => e.country.iso3), ['DEU', 'ITA']); // alphabetical
    const level2 = groups.find((g) => g.level === 2)!;
    assert.deepEqual(level2.entries.map((e) => e.country.iso3), ['FRA']);
    const level3 = groups.find((g) => g.level === 3)!;
    assert.deepEqual(level3.entries, []); // present but empty, not omitted
    const allIso3 = groups.flatMap((g) => g.entries.map((e) => e.country.iso3));
    assert.ok(!allIso3.includes('ESP'));
  });
});

// --- issuer vs. peers: the bias-corrected comparison (Task A.2 + A.1) ---

describe('getIssuerComparisonStats', () => {
  it('reports ~0 mean deviation for an issuer that always agrees with the peer median', () => {
    // "sg"-like selective publisher: only rates 3 high-consensus countries, but
    // its own level always matches what everyone else says about them. A naive
    // "average of sg's own published levels" would read ~4 (all high) and look
    // like the most restrictive government -- the bias-corrected metric must not.
    const countries = [
      fixture('AAA', { us: 4, uk: 4, ca: 4, sg: 4 }),
      fixture('BBB', { us: 4, uk: 3, ca: 4, sg: 4 }),
      fixture('CCC', { us: 3, uk: 4, ca: 4, sg: 4 }),
    ];
    const stats = getIssuerComparisonStats(countries, ['sg', 'us']);
    const sg = stats.find((s) => s.code === 'sg')!;
    assert.equal(sg.n, 3);
    assert.ok(Math.abs(sg.meanDeviation) < 0.01, `expected ~0, got ${sg.meanDeviation}`);
    assert.equal(sg.agreementPct, 100);
  });

  it('gives a positive mean deviation to an issuer that is consistently more cautious than the peer median on the same countries', () => {
    const countries = [
      fixture('AAA', { us: 2, uk: 2, ca: 2, nz: 4 }),
      fixture('BBB', { us: 1, uk: 2, ca: 1, nz: 3 }),
      fixture('CCC', { us: 2, uk: 1, ca: 2, nz: 4 }),
    ];
    const stats = getIssuerComparisonStats(countries, ['nz', 'us']);
    const nz = stats.find((s) => s.code === 'nz')!;
    const us = stats.find((s) => s.code === 'us')!;
    assert.ok(nz.meanDeviation > us.meanDeviation, 'nz should read more cautious than us relative to the same peers');
    assert.ok(nz.meanDeviation > 0, `expected a positive deviation, got ${nz.meanDeviation}`);
  });

  it('getMostAndLeastRestrictiveIssuers ignores issuers below the minimum sample size', () => {
    // 5 "always" issuers agree at level 2 in all 20 countries (mean deviation
    // 0, n=20 each); nz only ever reports (at level 4) on the first 5 -- too
    // thin a sample (n=5 < the 15-sample floor) to be crowned anything, even
    // though its own deviation (+2) would otherwise look the most extreme.
    const countries = Array.from({ length: 20 }, (_, i) => {
      const levels: Record<string, number> = { us: 2, uk: 2, ca: 2, au: 2, de: 2 };
      if (i < 5) levels.nz = 4;
      return fixture(`C${i}`, levels);
    });
    const { mostRestrictive } = getMostAndLeastRestrictiveIssuers(
      countries,
      ['us', 'uk', 'ca', 'au', 'de', 'nz'],
      15,
    );
    assert.notEqual(mostRestrictive?.code, 'nz', 'nz has too few samples (5) to be crowned "most restrictive"');
    assert.equal(mostRestrictive?.code, 'us', 'tie among the 5 always-agreeing issuers resolves to array order');
  });
});

// --- "where governments disagree" ranking (Task B) ---

describe('getDisagreementRanking', () => {
  it('computes spread, median, stdDev and >= 2-level outliers, and excludes countries below the issuer floor', () => {
    // 8 issuers (the minimum): mostly 3s/4s, two calm outliers at level 1 --
    // modelled directly on the real PRK case found while researching this task.
    const contested = fixture('AAA', {
      us: 4, ca: 4, de: 3, nl: 4, jp: 1, at: 3, fr: 4, cz: 1,
    });
    const tooFew = fixture('BBB', { us: 4, uk: 3 }); // only 2 issuers, below MIN_ISSUERS_FOR_DISAGREEMENT

    const rows = getDisagreementRanking([contested, tooFew]);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.country.iso3, 'AAA');
    assert.equal(row.n, 8);
    assert.equal(row.spread, 3); // 4 - 1
    assert.equal(row.median, 3.5); // 4 threes-or-above of value>=3 (5 threes/fours... ) -- see sorted values below
    assert.deepEqual(
      row.outliers.map((o) => o.code).sort(),
      ['cz', 'jp'],
    );
  });

  it('a country where every issuer agrees has spread 0 and no outliers', () => {
    const consensus = fixture('AAA', { us: 2, uk: 2, ca: 2, au: 2, de: 2, nl: 2, jp: 2, pl: 2 });
    const [row] = getDisagreementRanking([consensus]);
    assert.equal(row.spread, 0);
    assert.deepEqual(row.outliers, []);
  });

  it('sorts by spread descending, tie-broken by stdDev descending', () => {
    // Both have spread 2 (n=8), but A's levels are more spread out around the middle.
    const a = fixture('AAA', { us: 1, uk: 1, ca: 3, au: 3, de: 3, nl: 3, jp: 3, pl: 3 });
    const b = fixture('BBB', { us: 2, uk: 2, ca: 2, au: 2, de: 2, nl: 2, jp: 4, pl: 2 });
    const rows = getDisagreementRanking([b, a]); // insertion order deliberately reversed
    assert.equal(rows[0].spread, rows[1].spread);
    assert.equal(rows[0].country.iso3, 'AAA');
    assert.ok(rows[0].stdDev > rows[1].stdDev);
  });
});

describe('getLevelExtremes', () => {
  it('names up to 2 issuers at the highest and lowest level present, in ADVISORY_CODES order', () => {
    const [row] = getDisagreementRanking([
      fixture('AAA', { us: 4, uk: 4, ca: 4, au: 1, de: 1, nl: 3, jp: 2, pl: 4 }),
    ]);
    const extremes = getLevelExtremes(row);
    assert.equal(extremes.maxLevel, 4);
    assert.equal(extremes.minLevel, 1);
    assert.deepEqual(extremes.maxCodes, ['us', 'uk']); // first 2 in ADVISORY_CODES order among the 4s
    assert.deepEqual(extremes.minCodes, ['au', 'de']);
  });
});

describe('getMostDivergentIssuer / countFullConsensus', () => {
  it('finds the issuer with the highest outlier RATE (not raw count) among issuers meeting the participation floor', () => {
    // "sk" (standing in for a small, always-diverging issuer) participates in
    // exactly MIN_ISSUERS_FOR_DISAGREEMENT-qualifying rows and is an outlier
    // every time (rate 1.0). "ee" (standing in for a high-volume issuer)
    // participates far more often but is only occasionally an outlier (low
    // rate) despite a higher raw outlier COUNT -- rate must win, not count.
    const rows: ScoredCountry[] = [];
    for (let i = 0; i < MIN_ISSUERS_FOR_DISAGREEMENT; i++) {
      rows.push(
        fixture(`S${i}`, { us: 3, uk: 3, ca: 3, au: 3, de: 3, nl: 3, jp: 3, sk: 1 }), // sk is 2 away from median 3 -> outlier
      );
    }
    for (let i = 0; i < 50; i++) {
      rows.push(
        fixture(`B${i}`, { us: 2, uk: 2, ca: 2, au: 2, de: 2, nl: 2, jp: 2, ee: i === 0 ? 4 : 2 }),
      );
    }
    const ranking = getDisagreementRanking(rows);
    const most = getMostDivergentIssuer(ranking);
    assert.equal(most?.code, 'sk');
    assert.equal(most?.rate, 1);
  });

  it('countFullConsensus counts only spread === 0 rows', () => {
    const consensus = fixture('AAA', { us: 2, uk: 2, ca: 2, au: 2, de: 2, nl: 2, jp: 2, pl: 2 });
    const disagreement = fixture('BBB', { us: 1, uk: 2, ca: 2, au: 2, de: 2, nl: 2, jp: 2, pl: 4 });
    const rows = getDisagreementRanking([consensus, disagreement]);
    assert.equal(countFullConsensus(rows), 1);
  });
});
