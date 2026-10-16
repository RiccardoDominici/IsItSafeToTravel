#!/usr/bin/env node
/**
 * scripts/audit/check-page-consistency.ts
 *
 * Deterministic half of the consistency audit (the other half is the reviewer swarm, see
 * scripts/calibration/consistency/README.md). Reads the page facts written by
 * extract-page-facts.ts plus data/scores/latest.json and reports, in the findings-database shape,
 * the inconsistencies a script can prove without judgement:
 *   - the score differs between TITLE / HERO / SUMMARY and the data;
 *   - the rank or the "of N countries" total in the SUMMARY differs from the data;
 *   - the SUMMARY's government count differs from the advisory cards on the page;
 *   - a comparison-table or related-card score differs from that place's own score;
 *   - a comparison row states a distance the proximity data does not support;
 *   - the same place shows different numbers in different languages;
 *   - text defects: a sentence starting in lowercase, doubled words, leftover placeholders;
 *   - indicator years older than the 5-year rule allows (stale data shown as current).
 *
 * Usage: npx tsx scripts/audit/check-page-consistency.ts <factsDir> [--out findings.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ScoredCountry } from '../../src/pipeline/types.js';
import { buildRankMap } from '../../src/lib/score-status.js';
import { proximityKm, roundDistanceKm, type ProximityMap } from '../../src/lib/comparisons.js';
import { roundForDisplay } from '../../src/lib/display-number.js';
import type { PageFacts } from './extract-page-facts.js';

export interface AutoFinding {
  iso3: string;
  lang: string;
  category: 'contradiction' | 'broken-text' | 'bad-comparison' | 'stale-data';
  severity: 'high' | 'medium' | 'low';
  field: string;
  quote: string;
  problem: string;
  expected: string;
  check: string;
}

const RUN_YEAR = 2026;
const MAX_AGE_YEARS = 5;
/**
 * An across-sea row carries its coast-or-border distance ("Tunisia about 290 km away"). The stated
 * number must match src/data/country-proximity.json as the page rounds it. Untagged rows are land
 * neighbours from src/lib/neighbors.ts.
 */
const DISTANCE_TAG = /\s+about ([\d,]+) km away$/;

/** The score as the pages print it (display-number.ts rounding), dot-separated for comparison. */
const round1 = (x: number): string => roundForDisplay(x, 1).toFixed(1);

/** Rank and total as the SUMMARY states them, per language template (null when absent). */
function summaryRank(summary: string, lang: string): { rank: number; total: number } | null {
  const patterns: Record<string, RegExp> = {
    en: /ranking (\d+)(?:st|nd|rd|th) of the (\d+) countries/,
    it: /(\d+)° posto su (\d+) paesi/,
    es: /puesto (\d+) de los (\d+) países/,
    fr: /(\d+)(?:e|er) sur les (\d+) pays/,
    pt: /(\d+)º lugar entre os (\d+) países/,
    de: /Unter den (\d+) (?:Ländern mit offizieller Bewertung|von uns bewerteten Ländern) steht das Land auf Rang (\d+)/,
    zh: /在(\d+)个(?:有官方评分|已评分)的国家和地区中排名第(\d+)/,
  };
  const m = summary.match(patterns[lang]);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return lang === 'de' || lang === 'zh' ? { rank: b, total: a } : { rank: a, total: b };
}

/** Government count as the SUMMARY states it ("Of the 22 governments ..."), per language. */
function summaryGovernments(summary: string, lang: string): number | null {
  const patterns: Record<string, RegExp> = {
    en: /Of the (\d+) governments/,
    it: /De(?:i|gli) (\d+) governi/,
    es: /De los (\d+) gobiernos/,
    fr: /Parmi les (\d+) gouvernements/,
    pt: /Dos (\d+) governos/,
    de: /(\d+) Regierungen veröffentlichen/,
    zh: /的(\d+)个(?:国家)?政府中/,
  };
  const m = summary.match(patterns[lang]);
  return m ? Number(m[1]) : null;
}

/**
 * The first score-shaped figure in a text, normalised to the dot ("8,5/10" -> "8.5"): it, es, fr,
 * pt and de print the decimal comma since 2026-10-15, and a dot-only pattern would silently stop
 * checking those five languages.
 */
const firstScore = (text: string): string | null =>
  text.match(/(\d{1,2}[.,]\d)\s*(?:\/\s*10|out of 10|von 10|su 10|sobre 10|sur 10|de 10|分)/)?.[1]?.replace(',', '.') ?? null;

function textDefects(f: PageFacts): AutoFinding[] {
  const out: AutoFinding[] = [];
  const fields: Array<[string, string]> = [
    ['TITLE', f.title], ['DESCRIPTION', f.description], ['H1', f.h1], ['SUMMARY', f.summary],
    ...f.faq.flatMap((qa, i): Array<[string, string]> => [[`FAQ Q${i + 1}`, qa.q], [`FAQ A${i + 1}`, qa.a]]),
  ];
  for (const [field, text] of fields) {
    if (!text) continue;
    if (f.lang !== 'zh') {
      // ". conflict (6.9/10) is ..." — a sentence that starts in lowercase.
      const m = text.match(/[.!?]\s+([a-zà-öø-ÿ][\p{L}-]*)/u);
      const at = m ? text.indexOf(m[0]) : -1;
      // An abbreviation's own period is not a sentence end: "EE.UU. ahora", "U.S. officials", "z.B. die".
      const abbreviation = at > 0 && /(?:\b\p{Lu}{1,3}\.\p{Lu}{1,3}|\b(?:e\.g|i\.e|etc|vs|z\.B|bzw|ca|p\.ex|Nr|n|nº|St|Dr))$/u.test(text.slice(Math.max(0, at - 12), at));
      if (m && !abbreviation) {
        out.push({
          iso3: f.iso3, lang: f.lang, category: 'broken-text', severity: field.startsWith('FAQ') ? 'medium' : 'high', field,
          quote: text.slice(Math.max(0, at - 40), at + 60), problem: `A sentence starts in lowercase ("${m[1]}").`,
          expected: 'Every sentence starts with a capital letter.', check: 'lowercase-sentence-start',
        });
      }
      // Letter-aware boundaries: \b is ASCII-only, so "per Perù" would read as "per Per".
      const dbl = text.match(/(?<![\p{L}])(\p{L}{2,})\s+\1(?![\p{L}])/iu);
      if (dbl && !/^(nous|vous|que)$/i.test(dbl[1])) {
        out.push({
          iso3: f.iso3, lang: f.lang, category: 'broken-text', severity: 'medium', field, quote: dbl[0],
          problem: `Doubled word "${dbl[1]}".`, expected: 'The word once.', check: 'doubled-word',
        });
      }
    }
    const ph = text.match(/\{[a-zA-Z_]+\}|\bundefined\b|\bNaN\b|\bnull\b/);
    if (ph) {
      out.push({
        iso3: f.iso3, lang: f.lang, category: 'broken-text', severity: 'high', field, quote: ph[0],
        problem: 'Unfilled template placeholder or programming value in visible text.', expected: 'A real value.', check: 'placeholder',
      });
    }
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--'));
  if (!dir) throw new Error('usage: check-page-consistency.ts <factsDir> [--out file.json]');
  const outFile = args.includes('--out') ? args[args.indexOf('--out') + 1] : path.join(dir, 'auto-findings.json');
  const facts: Record<string, Record<string, PageFacts>> = JSON.parse(fs.readFileSync(path.join(dir, 'facts.json'), 'utf-8'));
  const latest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'scores', 'latest.json'), 'utf-8')) as { date: string; countries: ScoredCountry[] };
  const proximity: ProximityMap = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'country-proximity.json'), 'utf-8'));
  const byIso = new Map(latest.countries.map((c) => [c.iso3, c]));
  const { ranks, total } = buildRankMap(latest.countries);
  // Localized name -> iso3, for reading comparison rows and related cards.
  const nameToIso = new Map<string, string>();
  for (const iso3 of Object.keys(facts)) {
    for (const c of [byIso.get(iso3)].filter(Boolean) as ScoredCountry[]) {
      for (const v of Object.values(c.name ?? {})) if (typeof v === 'string') nameToIso.set(v.toLowerCase(), iso3);
    }
  }

  const findings: AutoFinding[] = [];
  for (const [iso3, langs] of Object.entries(facts)) {
    const c = byIso.get(iso3);
    if (!c) continue;
    const scored = typeof c.score === 'number';
    const want = scored ? round1(c.score as number) : null;
    const seenByLang: Record<string, { hero: string | null; rank: number | null; gov: number | null; faq: number }> = {};
    for (const [lang, f] of Object.entries(langs)) {
      findings.push(...textDefects(f));
      const hero = firstScore(f.hero);
      const title = firstScore(f.title);
      const summary = firstScore(f.summary);
      if (scored) {
        for (const [field, got] of [['HERO', hero], ['TITLE', title], ['SUMMARY', summary]] as const) {
          if (got !== null && got !== want) {
            findings.push({ iso3, lang, category: 'contradiction', severity: 'high', field, quote: got, problem: `${field} shows ${got} but the published score is ${want}.`, expected: want!, check: 'score-mismatch' });
          }
        }
      } else if (hero || summary) {
        findings.push({ iso3, lang, category: 'contradiction', severity: 'high', field: hero ? 'HERO' : 'SUMMARY', quote: (hero ?? summary)!, problem: 'A grey (partial-data) place shows a score.', expected: 'No number.', check: 'grey-with-score' });
      }
      const r = summaryRank(f.summary, lang);
      if (scored && r) {
        if (r.rank !== ranks.get(iso3) || r.total !== total) {
          findings.push({ iso3, lang, category: 'contradiction', severity: 'high', field: 'SUMMARY', quote: `${r.rank} / ${r.total}`, problem: `Rank ${r.rank} of ${r.total} stated; the data gives ${ranks.get(iso3)} of ${total}.`, expected: `${ranks.get(iso3)} of ${total}`, check: 'rank-mismatch' });
        }
      }
      const gov = summaryGovernments(f.summary, lang);
      if (gov !== null && gov !== f.advisories.length) {
        findings.push({ iso3, lang, category: 'contradiction', severity: 'medium', field: 'SUMMARY', quote: String(gov), problem: `The summary counts ${gov} governments, the page shows ${f.advisories.length} advisory cards.`, expected: String(f.advisories.length), check: 'government-count-mismatch' });
      }
      for (const row of f.indicators) {
        const y = Number(row.year);
        if (Number.isFinite(y) && y < RUN_YEAR - MAX_AGE_YEARS) {
          findings.push({ iso3, lang, category: 'stale-data', severity: 'high', field: 'INDICATORS', quote: `${row.label} | ${row.value} | ${row.year}`, problem: `Value from ${y} shown although the 5-year rule should drop it.`, expected: `Year >= ${RUN_YEAR - MAX_AGE_YEARS} or no value.`, check: 'over-max-age' });
        }
      }
      // Comparison rows: own-score agreement and distance.
      if (f.compare && lang === 'en') {
        for (const row of f.compare.rows) {
          const tag = DISTANCE_TAG.exec(row[0]);
          const name = row[0].replace(DISTANCE_TAG, '').trim();
          const other = nameToIso.get(name.toLowerCase());
          if (!other) continue;
          const oc = byIso.get(other);
          const shown = row[1].replace(',', '.');
          if (oc && typeof oc.score === 'number' && shown !== round1(oc.score)) {
            findings.push({ iso3, lang, category: 'contradiction', severity: 'medium', field: 'COMPARISON TABLE', quote: `${row[0]} | ${shown}`, problem: `${name} is shown at ${shown} here but its own page says ${round1(oc.score)}.`, expected: round1(oc.score), check: 'comparison-score-mismatch' });
          }
          const km = tag && other !== iso3 ? proximityKm(iso3, other, proximity) : null;
          if (tag && km !== null) {
            const stated = Number(tag[1].replace(/,/g, ''));
            if (stated !== roundDistanceKm(km)) {
              findings.push({ iso3, lang, category: 'bad-comparison', severity: 'medium', field: 'COMPARISON TABLE', quote: row[0], problem: `${name} is labelled ${stated} km away, the proximity data says ${km} km.`, expected: `about ${roundDistanceKm(km)} km away`, check: 'comparison-distance' });
            }
          }
        }
      }
      seenByLang[lang] = { hero, rank: r?.rank ?? null, gov, faq: f.faq.length };
    }
    // Cross-language agreement (same place, same snapshot).
    const heroes = new Set(Object.values(seenByLang).map((s) => s.hero).filter((x) => x !== null));
    const rankSet = new Set(Object.values(seenByLang).map((s) => s.rank).filter((x) => x !== null));
    const govSet = new Set(Object.values(seenByLang).map((s) => s.gov).filter((x) => x !== null));
    const faqSet = new Set(Object.values(seenByLang).map((s) => s.faq));
    for (const [label, set] of [['hero score', heroes], ['rank', rankSet], ['government count', govSet], ['number of FAQ items', faqSet]] as const) {
      if (set.size > 1) {
        findings.push({ iso3, lang: 'ALL', category: 'contradiction', severity: 'medium', field: 'ALL', quote: [...set].join(' / '), problem: `The ${label} differs between languages: ${Object.entries(seenByLang).map(([l, s]) => `${l}=${label === 'hero score' ? s.hero : label === 'rank' ? s.rank : label === 'government count' ? s.gov : s.faq}`).join(', ')}.`, expected: 'The same value in every language.', check: 'cross-language' });
      }
    }
  }

  const byCheck: Record<string, number> = {};
  for (const f of findings) byCheck[f.check] = (byCheck[f.check] ?? 0) + 1;
  fs.writeFileSync(outFile, JSON.stringify({ dataDate: latest.date, count: findings.length, byCheck, findings }, null, 1));
  console.log(`[AUDIT] ${findings.length} automatic finding(s) on ${latest.date} -> ${outFile}`);
  console.log(`[AUDIT] by check: ${JSON.stringify(byCheck)}`);
}

// Run only as a script, so other audit scripts can import its types and helpers without side effects.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
