/**
 * Built-page checks for the decimal separator (run after `astro build`: `npm run test:build`).
 * Owner decision 2026-10-15: every number a reader sees uses the comma in it, es, fr, pt and de and
 * the dot in en and zh (src/lib/display-number.ts); machine-readable output keeps the dot.
 *  - the <title> and the hero print the score in the page language's format, for every place;
 *  - no visible text of a comma-language page prints a dot decimal (a dot followed by one or two
 *    digits: "8.5", "1.83"; "100.000" is a thousands group and is fine), and no en/zh page prints a
 *    comma decimal;
 *  - JSON-LD keeps numbers as numbers, and no data-* attribute carries a comma decimal.
 */
import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { ScoredCountry } from '../pipeline/types';
import type { Lang } from '../i18n/ui';
import { routes } from '../i18n/ui';
import { formatTenths } from '../lib/display-number';

const DIST_CLIENT = join(import.meta.dirname, '..', '..', 'dist', 'client');
const LANGS: Lang[] = ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'];
const COMMA_LANGS = new Set<Lang>(['it', 'es', 'fr', 'pt', 'de']);

/** Names that contain a dot by nature: licence and dataset versions, DOIs, domains, file names, PM2.5. */
const ALLOWED_DOT_TOKENS = /\b(?:PM\d+\.\d|CC[ -]BY(?:-NC|-SA)?(?:-SA)? \d\.\d|BY-NC \d\.\d|BY-SA \d\.\d|DOI \d+\.\d+|10\.\d{4,}\/\S+|[\w-]+\.(?:org|com|json|csv|txt|svg|png|md)\b|v\d+\.\d+(?:\.\d+)?|\d+\.\d+\.\d+)/g;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (entry === 'index.html') out.push(p);
  }
  return out;
}

/** The text a reader sees: no scripts, styles, JSON-LD, comments or tags; entities left as is. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ');
}

let countries: ScoredCountry[] = [];
before(() => {
  const data = JSON.parse(readFileSync(join(DIST_CLIENT, 'scores.json'), 'utf-8'));
  countries = (Array.isArray(data) ? data : data.countries) as ScoredCountry[];
});

describe('decimal separator on the built pages', () => {
  it('title and hero print the score in the page language\'s format, every scored place in 7 languages', () => {
    let checked = 0;
    for (const c of countries.filter((x) => typeof x.score === 'number' && x.scoreStatus !== 'insufficient_data')) {
      for (const lang of LANGS) {
        const html = readFileSync(join(DIST_CLIENT, lang, routes[lang].country, c.iso3.toLowerCase(), 'index.html'), 'utf-8');
        const shown = formatTenths(c.score as number, lang);
        const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
        assert.ok(title.includes(`${shown}/10`), `${lang}/${c.iso3}: title "${title}" lacks ${shown}/10`);
        const hero = html.match(/<span class="text-6xl[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/)?.[1];
        assert.equal(hero, shown, `${lang}/${c.iso3}: hero`);
        checked++;
      }
    }
    assert.ok(checked > 1000, `only ${checked} pages checked`);
  });

  it('no visible dot decimal on it/es/fr/pt/de pages and no comma decimal on en/zh pages', () => {
    const offenders: string[] = [];
    let pages = 0;
    for (const lang of LANGS) {
      for (const file of walk(join(DIST_CLIENT, lang))) {
        const text = visibleText(readFileSync(file, 'utf-8')).replace(ALLOWED_DOT_TOKENS, ' ');
        const re = COMMA_LANGS.has(lang) ? /(?<![\d.,])\d+\.\d{1,2}(?![\d.])/g : /(?<![\d.,])\d+,\d{1,2}(?![\d,])/g;
        for (const m of text.matchAll(re)) {
          if (offenders.length < 40) offenders.push(`${file.replace(DIST_CLIENT, '')}: "${text.slice(Math.max(0, m.index! - 50), m.index! + 20).replace(/\s+/g, ' ')}"`);
        }
        pages++;
      }
    }
    assert.ok(pages > 1500, `only ${pages} pages scanned`);
    assert.deepEqual(offenders, []);
  });

  it('JSON-LD numbers stay numbers and no data-* attribute carries a comma decimal', () => {
    const offenders: string[] = [];
    for (const lang of LANGS) {
      for (const file of walk(join(DIST_CLIENT, lang))) {
        const html = readFileSync(file, 'utf-8');
        for (const m of html.matchAll(/<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
          // A string that is nothing but a comma-decimal number is a machine value that got localised.
          for (const v of m[1].matchAll(/"(?:ratingValue|value|price|latitude|longitude|version)"\s*:\s*"([^"]*)"/g)) {
            if (/^-?\d+,\d+$/.test(v[1])) offenders.push(`${file}: JSON-LD "${v[1]}"`);
          }
          if (/:\s*"-?\d+,\d+"/.test(m[1])) offenders.push(`${file}: JSON-LD comma number`);
        }
        for (const a of html.matchAll(/\sdata-[\w-]+="(-?\d+,\d+)"/g)) offenders.push(`${file}: ${a[0]}`);
        if (offenders.length > 20) break;
      }
    }
    assert.deepEqual(offenders, []);
  });
});
