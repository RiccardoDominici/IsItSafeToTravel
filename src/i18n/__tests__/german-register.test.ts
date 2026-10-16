/**
 * The German pages address the reader as "Sie" everywhere (2026-10-15 review, task 9): the
 * newsletter block, its confirmation pages and emails used "du" ("Mit deiner Anmeldung stimmst du
 * zu", placeholder "du@beispiel.de") next to a site that says "Sie".
 */
import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ui } from '../ui';

/** Informal-address words that cannot be French or English ("du" alone also reads "du Japon"). */
const DU_FORMS = /\b(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|Dein|Deine|erhältst|möchtest|kannst|bist|warst|bestätige|versuche|überprüfe|klicke|ignoriere|schreib)\b/;

describe('German register', () => {
  it('no ui.ts German string says "du"', () => {
    for (const [key, value] of Object.entries(ui.de)) {
      assert.doesNotMatch(String(value), DU_FORMS, `ui.de["${key}"]: ${value}`);
    }
  });

  it('no German newsletter or digest email string says "du"', () => {
    const root = join(import.meta.dirname, '..', '..', '..');
    const source = readFileSync(join(root, 'functions', 'lib', 'newsletter-copy.ts'), 'utf-8');
    // rec(en, it, es, fr, pt, zh, de): the German string is the last argument of each call.
    const german = [...source.matchAll(/rec\(([\s\S]*?)\);/g)].map((m) => {
      const args = [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)];
      const last = args[args.length - 1];
      return last ? last[1] ?? last[2] ?? last[3] ?? '' : '';
    });
    assert.ok(german.length >= 15, `only ${german.length} rec() calls found`);
    for (const text of german) assert.doesNotMatch(text, DU_FORMS, text);
    const digest = readFileSync(join(root, 'scripts', 'send-daily-digest.ts'), 'utf-8');
    for (const m of digest.matchAll(/de: (['`])((?:[^'`\\]|\\.)*)\1/g)) assert.doesNotMatch(m[2], DU_FORMS, m[2]);
  });
});
