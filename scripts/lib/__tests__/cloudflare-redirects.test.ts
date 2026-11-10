/**
 * `_redirects` must be applied in full by Cloudflare Pages. The parser mirror in
 * scripts/lib/cloudflare-redirects.ts reproduces the rule that broke production
 * between 2026-09-25 and 2026-11-10 (a splat rule mid-file pushed the last 28
 * rules past the 100-dynamic-rule cap, silently dropping them), and the last test
 * runs it on the real public/_redirects so the regression cannot come back.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  analyzeRedirects,
  formatRedirectIssue,
  MAX_DYNAMIC_REDIRECT_RULES,
} from '../cloudflare-redirects';

const statics = (n: number, prefix = '/s') =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}/ /target${i}/ 301`);

describe('analyzeRedirects — Cloudflare parsing semantics', () => {
  it('keeps plain rules static when every splat rule comes last', () => {
    const a = analyzeRedirects([...statics(150), '/country/* /en/country/:splat 301'].join('\n'));
    assert.equal(a.issues.length, 0);
    assert.equal(a.staticCount, 150);
    assert.equal(a.dynamicCount, 1);
    assert.equal(a.rules.length, 151);
  });

  it('reproduces the 2026-09-25 bug: a splat rule mid-file drops everything past 100 dynamic rules', () => {
    // 40 statics, then the splat rule (dynamic #1), then 127 plain rules.
    const text = [...statics(40, '/a'), '/country/* /en/country/:splat 301', ...statics(127, '/b')].join('\n');
    const a = analyzeRedirects(text);
    const dropped = a.issues.filter((i) => i.kind === 'dropped');
    // dynamic budget = splat + 99 plain rules; the remaining 28 plain rules are lost.
    assert.equal(dropped.length, 28);
    assert.equal(a.rules.length, 40 + MAX_DYNAMIC_REDIRECT_RULES);
    assert.ok(a.issues.some((i) => i.kind === 'static-after-dynamic'));
    assert.equal(a.rules.at(-1)?.from, '/b98/');
  });

  it('rejects host-based sources like Pages does ("Only relative URLs are allowed")', () => {
    const a = analyzeRedirects('https://www.example.org/* https://example.org/:splat 301');
    assert.equal(a.rules.length, 0);
    assert.equal(a.issues[0]?.kind, 'invalid-line');
  });

  it('flags bad token counts, bad status codes and duplicate sources', () => {
    const a = analyzeRedirects(['/x', '/y /z 404', '/a/ /b/ 301', '/a/ /c/ 301'].join('\n'));
    assert.deepEqual(
      a.issues.map((i) => i.kind),
      ['invalid-line', 'invalid-line', 'duplicate-source'],
    );
    assert.equal(a.rules.length, 1);
  });

  it('ignores comments, blank lines and trailing inline comments', () => {
    const a = analyzeRedirects('# header\n\n/a/ /b/ 301 # why\n');
    assert.equal(a.issues.length, 0);
    assert.deepEqual(a.rules.map((r) => [r.from, r.to, r.status]), [['/a/', '/b/', 301]]);
  });
});

describe('public/_redirects', () => {
  const file = path.resolve(import.meta.dirname ?? '.', '../../../public/_redirects');
  const analysis = analyzeRedirects(fs.readFileSync(file, 'utf8'));

  it('is applied in full by Cloudflare: no ignored, demoted, duplicate or dropped line', () => {
    assert.deepEqual(analysis.issues.map(formatRedirectIssue), []);
  });

  it('keeps every splat/placeholder rule in the final section', () => {
    const firstDynamic = analysis.rules.findIndex((r) => r.dynamic);
    assert.ok(firstDynamic > 0, 'expected at least one static rule before the dynamic section');
    assert.ok(analysis.rules.slice(firstDynamic).every((r) => r.hasPattern));
    assert.ok(analysis.dynamicCount <= MAX_DYNAMIC_REDIRECT_RULES);
  });

  it('still carries the rules that were dead in production until 2026-11-10', () => {
    const bySource = new Map(analysis.rules.map((r) => [r.from, r.to]));
    assert.equal(bySource.get('/de/methodology/'), '/de/methodik/');
    assert.equal(bySource.get('/pt/most-dangerous-countries/'), '/pt/paises-mais-perigosos/');
    assert.equal(bySource.get('/de/country/*'), '/de/land/:splat');
  });
});
