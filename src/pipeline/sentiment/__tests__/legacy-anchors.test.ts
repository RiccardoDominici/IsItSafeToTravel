import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEGACY_ANCHORS_PATH, legacyAnchorKey, parseLegacyAnchors } from '../legacy-anchors.js';

describe('legacyAnchorKey', () => {
  it('is ISO3|created_at in UTC to the second', () => {
    assert.equal(legacyAnchorKey('CHN', Date.UTC(2026, 6, 4, 3, 24, 41) / 1000), 'CHN|2026-07-04T03:24:41Z');
    assert.equal(legacyAnchorKey('FRA', Date.UTC(2026, 0, 2, 3, 4, 5) / 1000), 'FRA|2026-01-02T03:04:05Z');
  });

  it('is accepted by the parser for the keys it writes', () => {
    const key = legacyAnchorKey('SLV', Date.UTC(2026, 6, 4, 4, 31, 38) / 1000);
    assert.equal(parseLegacyAnchors({ anchors: { [key]: 2.107 } }).anchors.get(key), 2.107);
  });
});

describe('parseLegacyAnchors', () => {
  it('keeps well-formed entries and counts every other one as rejected', () => {
    const { anchors, rejected } = parseLegacyAnchors({
      anchors: {
        'CHN|2026-07-04T03:24:41Z': 2.66,
        'USA|2026-07-03T21:31:49Z': 7.35,
        'chn|2026-07-04T03:24:41Z': 2.66, // lower-case country
        'CHN|2026-07-04T03:24:41.000Z': 2.66, // milliseconds
        'CHN|2026-07-04 03:24:41': 2.66, // not ISO
        'RUS|2026-07-02T11:22:46Z': 0.5, // off the 1..10 scale
        'RUS|2026-07-02T14:19:12Z': 11,
        'JPN|2026-07-04T07:38:33Z': '8.2', // not a number
        'THA|2026-07-10T00:00:00Z': null,
      },
    });
    assert.deepEqual([...anchors.entries()], [
      ['CHN|2026-07-04T03:24:41Z', 2.66],
      ['USA|2026-07-03T21:31:49Z', 7.35],
    ]);
    assert.equal(rejected, 7);
  });

  it('reads anything without an anchors object as an empty table', () => {
    for (const data of [null, 42, 'x', [], {}, { anchors: null }, { anchors: [1, 2] }]) {
      assert.deepEqual(parseLegacyAnchors(data), { anchors: new Map(), rejected: 0 }, JSON.stringify(data));
    }
  });
});

describe(`committed ${LEGACY_ANCHORS_PATH}`, () => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), LEGACY_ANCHORS_PATH), 'utf8')) as { anchors: Record<string, unknown> };
  const { anchors, rejected } = parseLegacyAnchors(raw);

  it('parses cleanly: every entry is a well-formed key with a 1..10 score', () => {
    assert.ok(anchors.size > 0);
    assert.equal(rejected, 0);
    assert.equal(anchors.size, Object.keys(raw.anchors).length);
  });

  it('holds the score that was live, not the regenerated snapshot (China, 4 July 2026)', () => {
    // Live then: 2.66 (formula v8.1). data/scores/2026-07-04.json, regenerated under v9.1, says 6.51.
    const china = anchors.get('CHN|2026-07-04T03:24:41Z');
    assert.ok(china !== undefined && Math.abs(china - 2.663875) < 1e-9, `got ${china}`);
  });
});
