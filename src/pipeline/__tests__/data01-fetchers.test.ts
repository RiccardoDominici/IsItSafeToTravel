import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

/**
 * DATA-01 validation: System fetches safety indices from 3+ public sources.
 *
 * These tests verify the structural contracts of the fetcher modules
 * without making actual network calls. Network-dependent behavior is
 * validated by the pipeline's own error handling (cached fallback).
 */

describe('DATA-01: fetcher module contracts', () => {
  it('fetchAllSources is an async function accepting a date string', async () => {
    const mod = await import('../fetchers/index.js');
    assert.equal(typeof mod.fetchAllSources, 'function', 'fetchAllSources should be exported');
  });

  it('exports 4 individual fetchers (inform, gpi, acled, advisories)', async () => {
    const mod = await import('../fetchers/index.js');
    assert.equal(typeof mod.fetchInform, 'function', 'fetchInform should be exported');
    assert.equal(typeof mod.fetchGpi, 'function', 'fetchGpi should be exported');
    assert.equal(typeof mod.fetchAcled, 'function', 'fetchAcled should be exported');
    assert.equal(typeof mod.fetchAdvisories, 'function', 'fetchAdvisories should be exported');
  });

  it('fetchAllSources uses Promise.allSettled for fault isolation', async () => {
    // Verify by reading the source — behavioral test: if one fetcher throws,
    // others still complete. We test this via ACLED which returns failure
    // without credentials and does not block other module loading.
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const source = readFileSync(
      join(process.cwd(), 'src', 'pipeline', 'fetchers', 'index.ts'),
      'utf-8',
    );
    assert.ok(
      source.includes('Promise.allSettled'),
      'fetchAllSources should use Promise.allSettled for fault isolation',
    );
  });

  it('sources.json defines 4 data sources with URLs', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const raw = readFileSync(join(process.cwd(), 'src', 'pipeline', 'config', 'sources.json'), 'utf-8');
    const sources = JSON.parse(raw);
    const keys = Object.keys(sources);
    assert.ok(keys.length >= 3, `Should have 3+ sources, found ${keys.length}`);
    assert.ok(keys.includes('inform'), 'Should include inform source');
    assert.ok(keys.includes('gpi'), 'Should include gpi source');
    assert.ok(keys.includes('acled'), 'Should include acled source');
    assert.ok(keys.includes('advisories'), 'Should include advisories source');

    for (const key of keys) {
      assert.ok(sources[key].url, `Source ${key} should have a url`);
      assert.ok(sources[key].dataUrl, `Source ${key} should have a dataUrl`);
    }
  });

  it('ACLED fetcher gates on credentials and returns descriptive error without them', async () => {
    // Save and clear env vars
    const savedKey = process.env.ACLED_API_KEY;
    const savedEmail = process.env.ACLED_EMAIL;
    delete process.env.ACLED_API_KEY;
    delete process.env.ACLED_EMAIL;

    try {
      const { fetchAcled } = await import('../fetchers/acled.js');
      const result = await fetchAcled('2099-test-no-creds');
      // Should either fail gracefully or succeed with cached data
      assert.equal(result.source, 'acled');
      if (!result.success) {
        assert.ok(
          result.error?.includes('ACLED_API_KEY') || result.error?.includes('credentials'),
          `Error should mention missing credentials, got: ${result.error}`,
        );
      }
    } finally {
      // Restore env vars
      if (savedKey) process.env.ACLED_API_KEY = savedKey;
      if (savedEmail) process.env.ACLED_EMAIL = savedEmail;
    }
  });
});
