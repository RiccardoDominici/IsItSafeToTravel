import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { computeRedirectUrl, onRequest } from '../_middleware.ts';

// `computeRedirectUrl` carries all the redirect logic and needs nothing
// beyond a URL, so most cases live here — see 2026-09-25 audit findings
// technical.md T2 (host aliasing) and T9 (case normalization).
describe('computeRedirectUrl — host aliasing', () => {
  it('redirects .pages.dev to the canonical host, preserving path', () => {
    const result = computeRedirectUrl(new URL('https://isitsafetotravel.pages.dev/en/country/jpn/'));
    assert.equal(result?.toString(), 'https://isitsafetotravel.org/en/country/jpn/');
  });

  it('redirects www.isitsafetotravels.com (the full-site mirror, T2) to the canonical host', () => {
    const result = computeRedirectUrl(new URL('https://www.isitsafetotravels.com/en/'));
    assert.equal(result?.toString(), 'https://isitsafetotravel.org/en/');
  });

  it('redirects the bare isitsafetotravels.com apex to the canonical host', () => {
    const result = computeRedirectUrl(new URL('https://isitsafetotravels.com/it/paese/jpn/'));
    assert.equal(result?.toString(), 'https://isitsafetotravel.org/it/paese/jpn/');
  });

  it('redirects www.isitsafetotravel.org (www on the real domain) to the canonical host', () => {
    const result = computeRedirectUrl(new URL('https://www.isitsafetotravel.org/en/methodology/'));
    assert.equal(result?.toString(), 'https://isitsafetotravel.org/en/methodology/');
  });

  it('preserves the query string across a host redirect', () => {
    const result = computeRedirectUrl(new URL('https://www.isitsafetotravels.com/en/compare/?a=ita&b=fra'));
    assert.equal(result?.toString(), 'https://isitsafetotravel.org/en/compare/?a=ita&b=fra');
  });

  it('redirects the root path on an alias host too', () => {
    const result = computeRedirectUrl(new URL('https://isitsafetotravels.com/'));
    assert.equal(result?.toString(), 'https://isitsafetotravel.org/');
  });

  it('passes through a request already on the canonical host', () => {
    assert.equal(computeRedirectUrl(new URL('https://isitsafetotravel.org/en/')), null);
  });
});

describe('computeRedirectUrl — locale path lowercasing (T9)', () => {
  it('lowercases an uppercase ISO3 segment under a locale prefix', () => {
    const result = computeRedirectUrl(new URL('https://isitsafetotravel.org/en/country/JPN/'));
    assert.equal(result?.toString(), 'https://isitsafetotravel.org/en/country/jpn/');
  });

  it('lowercases mixed-case segments too', () => {
    const result = computeRedirectUrl(new URL('https://isitsafetotravel.org/en/country/Jpn/'));
    assert.equal(result?.toString(), 'https://isitsafetotravel.org/en/country/jpn/');
  });

  it('does the host fix and the path fix in one hop when both apply', () => {
    const result = computeRedirectUrl(new URL('https://www.isitsafetotravels.com/en/country/JPN/'));
    assert.equal(result?.toString(), 'https://isitsafetotravel.org/en/country/jpn/');
  });

  it('passes through an already-lowercase locale path', () => {
    assert.equal(computeRedirectUrl(new URL('https://isitsafetotravel.org/en/country/jpn/')), null);
  });

  it('never touches /_astro/* even if it were mixed-case', () => {
    const url = new URL('https://isitsafetotravel.org/_astro/Some-Chunk.HASH123.js');
    assert.equal(computeRedirectUrl(url), null);
  });

  it('never touches a path with a file extension', () => {
    // Hypothetical — sitemap/JSON endpoints never sit under a locale
    // prefix today, but the rule must not fire if one ever does.
    const url = new URL('https://isitsafetotravel.org/en/country/JPN.json');
    assert.equal(computeRedirectUrl(url), null);
  });

  it('ignores uppercase outside any locale prefix', () => {
    // e.g. a root-level path that isn't under /en/, /it/, etc.
    const url = new URL('https://isitsafetotravel.org/ABOUT/');
    assert.equal(computeRedirectUrl(url), null);
  });

  it('ignores uppercase in the query string, not just the path', () => {
    const url = new URL('https://isitsafetotravel.org/en/compare/?ref=CAMPAIGN');
    assert.equal(computeRedirectUrl(url), null);
  });
});

// `onRequest` is a thin wrapper around computeRedirectUrl — exercised here
// with a minimal mock EventContext (only `request` and `next` are ever
// read by the handler) per the brief's request for context-level coverage.
describe('onRequest (mock context)', () => {
  function mockContext(url: string) {
    return {
      request: new Request(url),
      next: async () => new Response('passed through', { status: 200 }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  }

  it('returns a 301 with the rewritten Location for an alias host', async () => {
    const res = await onRequest(mockContext('https://isitsafetotravels.com/en/country/JPN/'));
    assert.equal(res.status, 301);
    assert.equal(res.headers.get('Location'), 'https://isitsafetotravel.org/en/country/jpn/');
  });

  it('calls next() and returns its response for a canonical, lowercase, real request', async () => {
    const res = await onRequest(mockContext('https://isitsafetotravel.org/en/country/jpn/'));
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'passed through');
  });
});
