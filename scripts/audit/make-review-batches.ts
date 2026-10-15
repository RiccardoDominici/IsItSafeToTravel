#!/usr/bin/env node
/**
 * scripts/audit/make-review-batches.ts
 *
 * Second step of the consistency audit (scripts/calibration/consistency/README.md): turns the page
 * facts written by extract-page-facts.ts into the text files the reviewer swarm reads.
 *
 *   language/<lang>-<k>.txt  every page in one language; FAQ sentences that repeat on >= 15 pages
 *                            (numbers masked) are shown once at the top as [B1], [B2]... so the
 *                            reviewer judges a template sentence once, not 190 times
 *   comparisons/cmp-<k>.txt  English comparison table, related lists and pillar bars per place
 *   plausibility/pl-<k>.txt  English hero, summary, pillars, indicator table, advisories, community
 *   ordering/<name>.txt      one row per place (score, band, rank, pillars, advisory split, homicide
 *                            rate, conflict deaths), per region plus popular destinations and the
 *                            30 highest / 30 lowest scores: for score bounds and orderings
 *   manifest.json            what each file covers
 *
 * Batch sizes: on 2026-10-15 three Haiku reviewers given ~83 pages each spent their whole output
 * budget thinking and returned nothing, so the defaults are about half that (~41 places per
 * language or comparison file). Override with --language-parts / --comparison-parts.
 *
 * Usage (after extract-page-facts.ts):
 *   npx tsx scripts/audit/make-review-batches.ts <factsDir> [--language-parts 6] [--comparison-parts 6]
 *     [--plausibility-parts 8]
 * Writes <factsDir>/batches/...; reads data/scores/latest.json for the ordering tables.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PillarName, ScoredCountry } from '../../src/pipeline/types.js';
import { buildRankMap } from '../../src/lib/score-status.js';
import { getBand } from '../../src/lib/bands.js';
import { regionMap } from '../../src/lib/regions.js';
import type { PageFacts } from './extract-page-facts.js';

const LANGS = ['en', 'it', 'es', 'fr', 'pt', 'zh', 'de'] as const;
/** A FAQ sentence on at least this many pages (numbers masked) is a template sentence. */
const BOILERPLATE_MIN_PAGES = 15;
/** International arrivals leaders (UN Tourism 2024-25) and a few much-asked destinations. */
const POPULAR = [
  'FRA', 'ESP', 'USA', 'ITA', 'TUR', 'MEX', 'GBR', 'DEU', 'GRC', 'AUT', 'JPN', 'THA', 'CHN', 'PRT', 'NLD', 'HRV', 'ARE', 'SAU', 'MYS', 'HKG',
  'POL', 'CAN', 'IND', 'EGY', 'MAR', 'VNM', 'IDN', 'KOR', 'SGP', 'ZAF', 'BRA', 'ARG', 'DOM', 'CRI', 'PER', 'COL', 'TUN', 'JOR', 'ISR', 'KEN',
  'TZA', 'NZL', 'AUS', 'CHE', 'CZE', 'HUN', 'IRL', 'ISL', 'PHL', 'LKA', 'MDV', 'CUB', 'JAM', 'QAT', 'OMN', 'NPL', 'VEN', 'BLR', 'RUS', 'UKR',
];
const REGIONS = ['europe', 'asia', 'middle_east', 'africa', 'americas', 'oceania'] as const;
/** Pillar order in the ordering tables (the score's own weight order). */
const PILLARS: PillarName[] = ['conflict', 'crime', 'health', 'governance', 'environment'];

type Facts = Record<string, Record<string, PageFacts>>;
interface ManifestEntry { file: string; isos: string[]; lang?: string; name?: string; title?: string; scored?: number }

/** Split into n nearly equal consecutive groups (the first ones one larger). */
export function chunks<T>(seq: readonly T[], n: number): T[][] {
  const size = Math.floor(seq.length / n);
  const extra = seq.length % n;
  const out: T[][] = [];
  let i = 0;
  for (let j = 0; j < n; j++) {
    const len = size + (j < extra ? 1 : 0);
    out.push(seq.slice(i, i + len));
    i += len;
  }
  return out.filter((g) => g.length > 0);
}

/** Sentences of a FAQ answer: CJK full stops for zh, ". X" boundaries elsewhere. */
export function sentences(text: string, lang: string): string[] {
  const parts = lang === 'zh' ? text.split(/(?<=[。！？])/) : text.split(/(?<=[.!?])\s+(?=[A-ZÀ-ÖØ-Þ0-9«„“"(])/);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** A sentence with its numbers masked, so "8.5/10" and "6.1/10" variants count as one template. */
export const maskNumbers = (s: string): string => s.replace(/\d+(?:[.,]\d+)?/g, '#');

function languageBatches(facts: Facts, isos: string[], lang: string, parts: number): Array<[string, string, string[]]> {
  // Count each masked sentence once per page; frequent ones are boilerplate.
  const counts = new Map<string, number>();
  for (const iso of isos) {
    const seen = new Set<string>();
    for (const qa of facts[iso][lang].faq) {
      for (const s of sentences(qa.a, lang)) {
        const k = maskNumbers(s);
        if (!seen.has(k)) {
          seen.add(k);
          counts.set(k, (counts.get(k) ?? 0) + 1);
        }
      }
    }
  }
  // Most frequent first; ties keep first-seen order (Map iteration order), so the numbering is stable.
  const boiler = [...counts].filter(([, c]) => c >= BOILERPLATE_MIN_PAGES).sort((a, b) => b[1] - a[1]);
  const bid = new Map(boiler.map(([k], i) => [k, i + 1]));
  const header = [
    `# LANGUAGE REVIEW BATCH · language=${lang}`,
    `# Boilerplate FAQ sentences (identical on >=${BOILERPLATE_MIN_PAGES} pages after replacing numbers with #). Review each ONCE; in the pages below they appear as [B<n>].`,
    ...boiler.map(([k, c]) => `[B${bid.get(k)}] (on ${c} pages) ${k}`),
  ];
  return chunks(isos, parts).map((group, gi) => {
    const lines = [...header, '', `# PAGES (${group.length} places: ${group[0]}..${group[group.length - 1]})`, ''];
    for (const iso of group) {
      const f = facts[iso][lang];
      lines.push(`### ${iso} · ${lang} · ${f.url}`, `TITLE: ${f.title}`, `DESCRIPTION: ${f.description}`, `H1: ${f.h1}`, `HERO: ${f.hero}`, `SUMMARY: ${f.summary}`);
      if (f.pillars.length) lines.push(`PILLAR BARS: ${f.pillars.join(' | ')}`);
      if (f.compare) lines.push(`COMPARISON HEADING: ${f.compare.heading}`);
      for (const r of f.related) lines.push(`RELATED HEADING: ${r.heading}`);
      if (f.community) lines.push(`COMMUNITY: ${f.community.slice(0, 400)}`);
      for (const qa of f.faq) {
        const answer = sentences(qa.a, lang).map((s) => (bid.has(maskNumbers(s)) ? `[B${bid.get(maskNumbers(s))}]` : s));
        lines.push(`Q: ${qa.q}`, `A: ${answer.join(' ')}`);
      }
      lines.push('');
    }
    return [`language/${lang}-${gi + 1}.txt`, lines.join('\n'), group];
  });
}

function comparisonBatches(facts: Facts, isos: string[], parts: number): Array<[string, string, string[]]> {
  return chunks(isos, parts).map((group, gi) => {
    const lines = ['# COMPARISONS REVIEW BATCH (English pages)', ''];
    for (const iso of group) {
      const f = facts[iso].en;
      lines.push(`### ${iso} · ${f.h1} · ${f.url}`, `HERO: ${f.hero}`);
      if (f.pillars.length) lines.push(`PILLAR BARS: ${f.pillars.join(' | ')}`);
      if (f.compare) {
        lines.push(`COMPARISON TABLE "${f.compare.heading}" (${f.compare.columns.join(' | ')}):`);
        for (const r of f.compare.rows) lines.push(`- ${r.join(' | ')}`);
      } else {
        lines.push('COMPARISON TABLE: (none)');
      }
      for (const r of f.related) lines.push(`RELATED "${r.heading}": ${r.items.join(' ; ')}`);
      if (!f.related.length) lines.push('RELATED: (none)');
      lines.push('');
    }
    return [`comparisons/cmp-${gi + 1}.txt`, lines.join('\n'), group];
  });
}

function plausibilityBatches(facts: Facts, isos: string[], parts: number): Array<[string, string, string[]]> {
  return chunks(isos, parts).map((group, gi) => {
    const lines = ['# PLAUSIBILITY REVIEW BATCH (English pages)', ''];
    for (const iso of group) {
      const f = facts[iso].en;
      lines.push(`### ${iso} · ${f.h1} · ${f.url}`, `HERO: ${f.hero}`, `SUMMARY: ${f.summary}`);
      if (f.pillars.length) lines.push(`PILLAR BARS: ${f.pillars.join(' | ')}`);
      if (f.indicators.length) {
        lines.push('INDICATORS (pillar | indicator | value | note | source | year):');
        for (const r of f.indicators) lines.push(`- ${r.pillar} | ${r.label} | ${r.value} | ${r.note} | ${r.source} | ${r.year}`);
      }
      if (f.advisories.length) lines.push(`ADVISORIES (${f.advisories.length}): ${f.advisories.map((a) => `${a.issuer}: ${a.level} (${a.text.slice(0, 60)})`).join(' ; ')}`);
      if (f.community) lines.push(`COMMUNITY: ${f.community.slice(0, 300)}`);
      lines.push('');
    }
    return [`plausibility/pl-${gi + 1}.txt`, lines.join('\n'), group];
  });
}

const BAND_LABEL: Record<string, string> = { danger: 'danger', high_caution: 'high caution', moderate: 'moderate', good: 'good', excellent: 'excellent' };

function orderingBatches(facts: Facts, countries: ScoredCountry[], dataDate: string): Array<[string, string, string[], ManifestEntry]> {
  const { ranks, total } = buildRankMap(countries);
  const byIso = new Map(countries.map((c) => [c.iso3, c]));
  const indicator = (iso: string, needle: string): string => {
    const r = facts[iso]?.en.indicators.find((x) => x.label.includes(needle));
    return r ? `${r.value} (${r.year})` : '-';
  };
  const row = (c: ScoredCountry): string => {
    const s = typeof c.score === 'number' ? c.score : null;
    const pillars = new Map(c.pillars.map((p) => [p.name, p.score]));
    const levels = Object.values(c.advisories ?? {}).map((a) => (a && typeof a === 'object' ? (a as { level?: unknown }).level : undefined)).filter((l): l is number => typeof l === 'number');
    const advisories = [1, 2, 3, 4].filter((l) => levels.includes(l)).map((l) => `L${l}x${levels.filter((x) => x === l).length}`).join(' ') || 'none';
    const community = (c as { community?: { adjustment?: number; votes?: number } }).community;
    const adj = community?.adjustment ?? 0;
    return [
      c.iso3, c.name.en, s === null ? 'grey' : s.toFixed(1), String(ranks.get(c.iso3) ?? '-'), s === null ? 'grey (partial data, no score)' : BAND_LABEL[getBand(s)],
      PILLARS.filter((k) => pillars.has(k)).map((k) => `${k.slice(0, 4)}=${((pillars.get(k) ?? 0) * 10).toFixed(1)}`).join(' '),
      advisories, indicator(c.iso3, 'Intentional homicide'), indicator(c.iso3, 'Conflict deaths'),
      adj ? `${adj >= 0 ? '+' : ''}${adj.toFixed(2)} (${community?.votes ?? 0} votes)` : `none (${community?.votes ?? 0} votes)`,
    ].join(' | ');
  };
  const header = `ISO3 | name | score (1-10, higher = safer) | world rank of ${total} | band | pillars x/10 (conf=conflict, crim=crime, heal=health, gove=governance, envi=natural hazards; higher = safer) | government advisories by level (L1 normal precautions .. L4 do not travel) | homicide per 100k (year) | conflict deaths UCDP (year) | community adjustment`;
  const byScore = (a: ScoredCountry, b: ScoredCountry) => (typeof b.score === 'number' ? b.score : -1) - (typeof a.score === 'number' ? a.score : -1);
  const scored = countries.filter((c) => typeof c.score === 'number').sort(byScore);
  const sets: Array<[string, string, ScoredCountry[]]> = [
    ...REGIONS.map((r): [string, string, ScoredCountry[]] => [r, `region ${r}`, countries.filter((c) => regionMap[c.iso3] === r).sort(byScore)]),
    ['popular', `${POPULAR.length} popular travel destinations, all regions`, POPULAR.map((i) => byIso.get(i)).filter((c): c is ScoredCountry => !!c).sort(byScore)],
    ['extremes', 'the 30 highest and the 30 lowest official scores worldwide', [...scored.slice(0, 30), ...scored.slice(-30)]],
  ];
  return sets.map(([name, title, rows]) => {
    const n = rows.filter((c) => typeof c.score === 'number').length;
    const text = [
      `# ORDERING REVIEW BATCH: ${title} (${rows.length} places, ${n} with an official score), data ${dataDate}`,
      '# Bands: <5 danger, 5-6 high caution, 6-7 moderate, 7-8 good, >=8 excellent. Grey places have no score on purpose.',
      '', header, ...rows.map(row),
    ].join('\n') + '\n';
    return [`ordering/${name}.txt`, text, rows.map((c) => c.iso3), { file: '', isos: [], name, title, scored: n }];
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const dir = args.find((a) => !a.startsWith('--') && !/^\d+$/.test(a));
  if (!dir) throw new Error('usage: make-review-batches.ts <factsDir> [--language-parts 6] [--comparison-parts 6] [--plausibility-parts 8]');
  const opt = (name: string, def: number): number => (args.includes(name) ? Number(args[args.indexOf(name) + 1]) : def);
  const facts: Facts = JSON.parse(fs.readFileSync(path.join(dir, 'facts.json'), 'utf-8'));
  const latest = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'scores', 'latest.json'), 'utf-8')) as { date: string; countries: ScoredCountry[] };
  const isos = Object.keys(facts).sort();
  const out = path.join(dir, 'batches');
  const manifest: Record<string, ManifestEntry[]> = { language: [], comparisons: [], plausibility: [], ordering: [] };
  const write = (kind: string, file: string, text: string, group: string[], extra: Partial<ManifestEntry> = {}) => {
    fs.mkdirSync(path.join(out, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(out, file), text);
    manifest[kind].push({ ...extra, file: `batches/${file}`, isos: group });
  };
  for (const lang of LANGS) for (const [file, text, group] of languageBatches(facts, isos, lang, opt('--language-parts', 6))) write('language', file, text, group, { lang });
  for (const [file, text, group] of comparisonBatches(facts, isos, opt('--comparison-parts', 6))) write('comparisons', file, text, group);
  for (const [file, text, group] of plausibilityBatches(facts, isos, opt('--plausibility-parts', 8))) write('plausibility', file, text, group);
  for (const [file, text, group, extra] of orderingBatches(facts, latest.countries, latest.date)) write('ordering', file, text, group, { name: extra.name, title: extra.title, scored: extra.scored });
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1));
  for (const [kind, entries] of Object.entries(manifest)) {
    console.log(`[BATCHES] ${kind}: ${entries.length} file(s), ${entries.map((e) => `${Math.round(fs.statSync(path.join(dir, e.file)).size / 1024)}KB`).join(' ')}`);
  }
}

// Run only as a script, so tests can import the helpers without side effects.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
