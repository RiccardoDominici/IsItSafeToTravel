import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { loadSentimentForCountry, loadAllSentiment, MIN_VOTE_FLOOR, MIN_ORIGIN_FLOOR, pickVoteNextSuggestions, POPULAR_TOURIST_DESTINATIONS } from '../sentiment.js';
import type { ScoredCountry } from '../../pipeline/types.js';

const DATA_DIR = path.join(process.cwd(), 'data', 'sentiment');
const LATEST_PATH = path.join(DATA_DIR, 'latest.json');

// --- SENT-05: build-time loader never throws, degrades to null (D-14) ---

describe('sentiment.ts: activation floors (formula v10, SPEC §5)', () => {
  it('MIN_VOTE_FLOOR is 30 votes', () => {
    assert.equal(MIN_VOTE_FLOOR, 30);
  });

  it('MIN_ORIGIN_FLOOR is 3 known countries of origin', () => {
    assert.equal(MIN_ORIGIN_FLOOR, 3);
  });
});

describe('sentiment.ts: loadSentimentForCountry graceful degradation', () => {
  it('returns null (not throw) when data/sentiment/latest.json is absent', () => {
    if (fs.existsSync(LATEST_PATH)) {
      // File already present in this environment (e.g. pipeline has run) --
      // the missing-file branch is still covered below via a swap/restore fixture.
      return;
    }
    const result = loadSentimentForCountry('ITA');
    assert.equal(result, null, 'Missing file must resolve to null, never throw');
  });

  describe('with a fixture file at data/sentiment/latest.json', () => {
    const preexisting = fs.existsSync(LATEST_PATH) ? fs.readFileSync(LATEST_PATH, 'utf-8') : null;

    before(() => {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    });

    after(() => {
      // Restore whatever was on disk before this test file ran (or remove the fixture).
      if (preexisting !== null) {
        fs.writeFileSync(LATEST_PATH, preexisting, 'utf-8');
      } else if (fs.existsSync(LATEST_PATH)) {
        fs.rmSync(LATEST_PATH);
      }
    });

    it('returns the matching SentimentEntry when the country is present', () => {
      const fixture = {
        generatedAt: '2026-07-02T00:00:00.000Z',
        countries: {
          ITA: { iso3: 'ITA', votes: 34, origins: 4, topOriginShare: 0.4, nEff: 21.5, perceived: 8.2, status: 'active' },
        },
      };
      fs.writeFileSync(LATEST_PATH, JSON.stringify(fixture), 'utf-8');
      const result = loadSentimentForCountry('ITA');
      assert.deepEqual(result, fixture.countries.ITA);
    });

    it('ignores a pre-v10 entry (count/correction, no status) and returns null', () => {
      const fixture = {
        generatedAt: '2026-07-02T00:00:00.000Z',
        countries: {
          ITA: { iso3: 'ITA', count: 12, avgDelta: 0.4, correction: 0.4, perceived: 8.2, official: 7.8 },
        },
      };
      fs.writeFileSync(LATEST_PATH, JSON.stringify(fixture), 'utf-8');
      assert.equal(loadSentimentForCountry('ITA'), null);
    });

    it('ignores a v10 entry missing a field the block renders (origins)', () => {
      const fixture = {
        generatedAt: '2026-10-14T00:00:00.000Z',
        countries: {
          ITA: { iso3: 'ITA', votes: 34, topOriginShare: 0.4, nEff: 21.5, perceived: 8.2, status: 'active' },
        },
      };
      fs.writeFileSync(LATEST_PATH, JSON.stringify(fixture), 'utf-8');
      assert.equal(loadSentimentForCountry('ITA'), null);
    });

    it('returns null when the file exists but the country is absent', () => {
      const fixture = { generatedAt: '2026-07-02T00:00:00.000Z', countries: {} };
      fs.writeFileSync(LATEST_PATH, JSON.stringify(fixture), 'utf-8');
      const result = loadSentimentForCountry('ZZZ');
      assert.equal(result, null);
    });

    it('never throws on malformed JSON -- resolves to null', () => {
      fs.writeFileSync(LATEST_PATH, '{ this is not valid json', 'utf-8');
      assert.doesNotThrow(() => loadSentimentForCountry('ITA'));
      assert.equal(loadSentimentForCountry('ITA'), null);
    });
  });
});

// --- 39-11: loadAllSentiment powers the /community-vs-data/ ranking page ---

describe('sentiment.ts: loadAllSentiment graceful degradation', () => {
  it('returns [] (not throw) when data/sentiment/latest.json is absent', () => {
    if (fs.existsSync(LATEST_PATH)) {
      // File already present in this environment -- covered via the fixture below instead.
      return;
    }
    assert.doesNotThrow(() => loadAllSentiment());
    assert.deepEqual(loadAllSentiment(), []);
  });

  describe('with a fixture file at data/sentiment/latest.json', () => {
    const preexisting = fs.existsSync(LATEST_PATH) ? fs.readFileSync(LATEST_PATH, 'utf-8') : null;

    before(() => {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    });

    after(() => {
      if (preexisting !== null) {
        fs.writeFileSync(LATEST_PATH, preexisting, 'utf-8');
      } else if (fs.existsSync(LATEST_PATH)) {
        fs.rmSync(LATEST_PATH);
      }
    });

    it('returns every country entry as a flat array', () => {
      const fixture = {
        generatedAt: '2026-09-26T00:00:00.000Z',
        countries: {
          ITA: { iso3: 'ITA', votes: 34, origins: 4, topOriginShare: 0.4, nEff: 21.5, perceived: 8.2, status: 'active' },
          CHN: { iso3: 'CHN', votes: 73, origins: 13, topOriginShare: 0.3, nEff: 40.1, perceived: 7.54, status: 'active' },
          // Pre-v10 leftover: must be filtered out, not rendered.
          OLD: { iso3: 'OLD', count: 9, avgDelta: 0.1, correction: 0.1, perceived: 6.1, official: 6.0 },
        },
      };
      fs.writeFileSync(LATEST_PATH, JSON.stringify(fixture), 'utf-8');
      const result = loadAllSentiment();
      assert.equal(result.length, 2);
      assert.deepEqual(
        result.find((e) => e.iso3 === 'ITA'),
        fixture.countries.ITA
      );
      assert.ok(!result.some((e) => e.iso3 === 'OLD'));
    });

    it('returns [] when the file has zero countries', () => {
      fs.writeFileSync(LATEST_PATH, JSON.stringify({ generatedAt: '2026-09-26T00:00:00.000Z', countries: {} }), 'utf-8');
      assert.deepEqual(loadAllSentiment(), []);
    });

    it('never throws on malformed JSON -- resolves to []', () => {
      fs.writeFileSync(LATEST_PATH, '{ this is not valid json', 'utf-8');
      assert.doesNotThrow(() => loadAllSentiment());
      assert.deepEqual(loadAllSentiment(), []);
    });
  });
});

// --- "Vote next" CTA on /community-vs-data/ (team-lead correction, 2026-09-26:
// replaces an earlier "most advisory sources" rule that surfaced high-scrutiny
// countries like Afghanistan/Iran/Pakistan instead of places most voters have
// actually been to) ---

describe('sentiment.ts: POPULAR_TOURIST_DESTINATIONS', () => {
  it('is exactly the specified 20 ISO3 codes, in order', () => {
    assert.deepEqual(POPULAR_TOURIST_DESTINATIONS, [
      'FRA', 'ESP', 'ITA', 'TUR', 'MEX', 'GBR', 'DEU', 'GRC', 'THA', 'JPN',
      'PRT', 'AUT', 'NLD', 'ARE', 'HRV', 'EGY', 'MAR', 'IDN', 'VNM', 'BRA',
    ]);
  });
});

describe('sentiment.ts: pickVoteNextSuggestions', () => {
  /** Minimal ScoredCountry stand-in -- only iso3 and sources.length (hasSufficientData's input) matter here. */
  function makeCountry(iso3: string, sourceCount = 5): ScoredCountry {
    return {
      iso3,
      sources: Array.from({ length: sourceCount }, () => ({ name: 'stub', url: '', fetchedAt: '', description: '' })),
    } as unknown as ScoredCountry;
  }

  const allDestinations = POPULAR_TOURIST_DESTINATIONS.map((iso3) => makeCountry(iso3));

  it('returns the first 8 destinations in list order when none are ranked', () => {
    const result = pickVoteNextSuggestions(allDestinations, new Set());
    assert.deepEqual(
      result.map((c) => c.iso3),
      POPULAR_TOURIST_DESTINATIONS.slice(0, 8)
    );
  });

  it('skips countries already in the ranking, keeping the relative order of the rest', () => {
    // Excluding ESP (index 1) and MEX (index 4) should backfill from THA/JPN,
    // still yielding 8 -- FRA, ITA, TUR, GBR, DEU, GRC, THA, JPN.
    const result = pickVoteNextSuggestions(allDestinations, new Set(['ESP', 'MEX']));
    assert.deepEqual(
      result.map((c) => c.iso3),
      ['FRA', 'ITA', 'TUR', 'GBR', 'DEU', 'GRC', 'THA', 'JPN']
    );
  });

  it('skips a destination that fails hasSufficientData and backfills from further down the list', () => {
    const withThinGbr = allDestinations.map((c) => (c.iso3 === 'GBR' ? makeCountry('GBR', 2) : c));
    const result = pickVoteNextSuggestions(withThinGbr, new Set());
    assert.deepEqual(
      result.map((c) => c.iso3),
      ['FRA', 'ESP', 'ITA', 'TUR', 'MEX', 'DEU', 'GRC', 'THA']
    );
  });

  it('skips a destination missing from the current snapshot entirely', () => {
    const withoutDeu = allDestinations.filter((c) => c.iso3 !== 'DEU');
    const result = pickVoteNextSuggestions(withoutDeu, new Set());
    assert.ok(!result.some((c) => c.iso3 === 'DEU'));
    assert.equal(result.length, 8);
  });

  it('returns fewer than 8 when not enough qualifying candidates exist, still in order', () => {
    const onlyFive = allDestinations.slice(0, 5); // FRA, ESP, ITA, TUR, MEX
    const result = pickVoteNextSuggestions(onlyFive, new Set());
    assert.deepEqual(
      result.map((c) => c.iso3),
      ['FRA', 'ESP', 'ITA', 'TUR', 'MEX']
    );
  });
});
