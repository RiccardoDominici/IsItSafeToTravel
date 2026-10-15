#!/usr/bin/env node
/**
 * scripts/audit/extract-page-facts.ts
 *
 * Reads every BUILT country page (dist/client/<lang>/<country-route>/<iso3>/index.html, 248 x 7)
 * and writes what a visitor sees, per page, as structured facts plus a compact text rendering.
 * Input for the consistency audit (scripts/calibration/consistency/README.md): reviewers judge
 * the rendered text, not the data behind it, because the 2026-10-14 critique was about what the
 * pages SAID (stale years shown as current, generic sentences, nonsensical comparisons).
 *
 * Usage (after `npx astro build`):
 *   npx tsx scripts/audit/extract-page-facts.ts <outDir> [--only ECU,DEU] [--langs en,de]
 * Writes <outDir>/facts.json and <outDir>/pages/<ISO3>.<lang>.txt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';

const LANG_ROUTES: Record<string, string> = {
  en: 'country', it: 'paese', es: 'pais', fr: 'pays', pt: 'pais', zh: 'country', de: 'land',
};
const DIST = path.join(process.cwd(), 'dist', 'client');

export interface IndicatorRow { pillar: string; pillarSummary: string; label: string; value: string; note: string; source: string; year: string }
export interface AdvisoryCard { issuer: string; level: string; text: string; updated: string }
export interface PageFacts {
  iso3: string;
  lang: string;
  url: string;
  title: string;
  description: string;
  h1: string;
  hero: string;
  summary: string;
  pillars: string[];
  indicators: IndicatorRow[];
  community: string;
  advisories: AdvisoryCard[];
  faq: Array<{ q: string; a: string }>;
  compare: { heading: string; columns: string[]; rows: string[][] } | null;
  related: Array<{ heading: string; items: string[] }>;
  sourcesText: string;
}

const clean = (s: string | undefined): string => (s ?? '').replace(/\s+/g, ' ').trim();

function extractPage(html: string, iso3: string, lang: string, url: string): PageFacts {
  // Element boundaries become spaces, so adjacent inline elements ("Costa Rica" + the "nearby"
  // badge) do not run together the way cheerio's .text() joins them.
  const $ = cheerio.load(html.replace(/<\/(span|a|div|p|li|td|th|h[1-6]|summary|button)>/g, ' </$1>'));
  $('script, style, noscript').remove();
  const main = $('main').first().length ? $('main').first() : $('body');

  const h1 = clean(main.find('h1').first().text());
  const heroSection = main.find('h1').first().closest('section');
  const hero = clean(heroSection.text());
  // The answer-first summary: the first centred lead paragraph after the hero.
  const summary = clean(main.find('p.leading-relaxed').first().text());

  const pillarsSection = main.find('#pillars');
  const pillars: string[] = [];
  pillarsSection.find('div.flex.items-center.gap-3').each((_, el) => {
    const t = clean($(el).text());
    if (t) pillars.push(t);
  });
  const indicators: IndicatorRow[] = [];
  pillarsSection.find('h3').each((_, h3) => {
    const pillarHeading = $(h3);
    const pillar = clean(pillarHeading.clone().children().remove().end().text());
    const pillarSummary = clean(pillarHeading.find('span').first().text());
    const table = pillarHeading.nextAll('table').first();
    table.find('tbody tr').each((__, tr) => {
      const tds = $(tr).find('td');
      if (tds.length < 4) return;
      const valueCell = $(tds[1]);
      const note = clean(valueCell.find('span.block').text());
      const value = clean(valueCell.clone().find('span.block').remove().end().text());
      const labelCell = $(tds[0]);
      indicators.push({
        pillar,
        pillarSummary,
        label: clean(labelCell.text()),
        value,
        note,
        source: clean($(tds[2]).text()),
        year: clean($(tds[3]).text()),
      });
    });
  });

  const community = clean(main.find('#community-sentiment').first().text()).slice(0, 900);

  const advisories: AdvisoryCard[] = [];
  main.find('[data-advisory-source]').each((_, el) => {
    const card = $(el);
    const issuer = clean(card.find('h3').first().text());
    if (!issuer) return;
    advisories.push({
      issuer,
      level: clean(card.find('h3').first().next('span').text()) || clean(card.find('span.rounded-full').first().text()),
      text: clean(card.find('p').first().text()),
      updated: clean(card.find('div.text-xs span').first().text()),
    });
  });

  const faq: Array<{ q: string; a: string }> = [];
  main.find('#faq details').each((_, d) => {
    const q = clean($(d).find('summary').first().text());
    const a = clean($(d).children().not('summary').text());
    if (q) faq.push({ q, a });
  });

  let compare: PageFacts['compare'] = null;
  const related: PageFacts['related'] = [];
  main.find('section').each((_, sec) => {
    const section = $(sec);
    const h2 = clean(section.children('h2').first().text());
    if (!h2) return;
    const table = section.find('table').first();
    if (!compare && table.length && section.find('table thead th').length >= 3 && !section.closest('#pillars').length && section.attr('id') !== 'pillars') {
      const columns = table.find('thead th').map((__, th) => clean($(th).text())).get();
      const rows = table.find('tbody tr').map((__, tr) => [$(tr).find('td').map((___, td) => clean($(td).text())).get()]).get() as string[][];
      if (rows.length > 0 && rows[0].length === columns.length) compare = { heading: h2, columns, rows };
      return;
    }
    const subheads = section.find('h3');
    if (subheads.length && section.find('a[href]').length && !section.find('details').length && section.attr('id') !== 'sources') {
      subheads.each((__, h3) => {
        const heading = clean($(h3).text());
        const box = $(h3).next();
        const items = box.find('a').map((___, a) => clean($(a).text())).get().filter(Boolean);
        if (items.length) related.push({ heading: `${h2} > ${heading}`, items });
      });
    }
  });

  return {
    iso3,
    lang,
    url,
    title: clean($('title').first().text()),
    description: clean($('meta[name="description"]').attr('content')),
    h1,
    hero,
    summary,
    pillars,
    indicators,
    community,
    advisories,
    faq,
    compare,
    related,
    sourcesText: clean(main.find('#sources').first().text()).slice(0, 600),
  };
}

/** Compact text rendering for reviewers: one block per page, stable field order. */
export function renderFacts(f: PageFacts): string {
  const lines: string[] = [];
  lines.push(`### ${f.iso3} · ${f.lang} · ${f.url}`);
  lines.push(`TITLE: ${f.title}`);
  lines.push(`DESCRIPTION: ${f.description}`);
  lines.push(`H1: ${f.h1}`);
  lines.push(`HERO: ${f.hero}`);
  lines.push(`SUMMARY: ${f.summary}`);
  if (f.pillars.length) lines.push(`PILLAR BARS: ${f.pillars.join(' | ')}`);
  if (f.indicators.length) {
    lines.push('INDICATOR TABLE (pillar | indicator | value | note | source | year):');
    for (const r of f.indicators) lines.push(`- ${r.pillar} (${r.pillarSummary}) | ${r.label} | ${r.value} | ${r.note} | ${r.source} | ${r.year}`);
  }
  if (f.community) lines.push(`COMMUNITY BLOCK: ${f.community}`);
  if (f.advisories.length) {
    lines.push(`GOVERNMENT ADVISORIES (${f.advisories.length}):`);
    for (const a of f.advisories) lines.push(`- ${a.issuer} | ${a.level} | ${a.text} | ${a.updated}`);
  }
  if (f.compare) {
    lines.push(`COMPARISON TABLE "${f.compare.heading}" (${f.compare.columns.join(' | ')}):`);
    for (const r of f.compare.rows) lines.push(`- ${r.join(' | ')}`);
  }
  for (const r of f.related) lines.push(`RELATED "${r.heading}": ${r.items.join(' ; ')}`);
  if (f.faq.length) {
    lines.push('FAQ:');
    for (const qa of f.faq) lines.push(`Q: ${qa.q}\nA: ${qa.a}`);
  }
  return lines.join('\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const outDir = args.find((a) => !a.startsWith('--'));
  if (!outDir) throw new Error('usage: extract-page-facts.ts <outDir> [--only ISO3,...] [--langs en,de]');
  const only = args.includes('--only') ? new Set(args[args.indexOf('--only') + 1].split(',').map((s) => s.toUpperCase())) : null;
  const langs = args.includes('--langs') ? args[args.indexOf('--langs') + 1].split(',') : Object.keys(LANG_ROUTES);
  fs.mkdirSync(path.join(outDir, 'pages'), { recursive: true });

  const facts: Record<string, Record<string, PageFacts>> = {};
  let pages = 0;
  for (const lang of langs) {
    const dir = path.join(DIST, lang, LANG_ROUTES[lang]);
    if (!fs.existsSync(dir)) throw new Error(`missing build output ${dir} (run npx astro build first)`);
    for (const slug of fs.readdirSync(dir).filter((d) => /^[a-z]{3}$/.test(d)).sort()) {
      const iso3 = slug.toUpperCase();
      if (only && !only.has(iso3)) continue;
      const file = path.join(dir, slug, 'index.html');
      if (!fs.existsSync(file)) continue;
      const url = `https://isitsafetotravel.org/${lang}/${LANG_ROUTES[lang]}/${slug}/`;
      const f = extractPage(fs.readFileSync(file, 'utf-8'), iso3, lang, url);
      (facts[iso3] ??= {})[lang] = f;
      fs.writeFileSync(path.join(outDir, 'pages', `${iso3}.${lang}.txt`), renderFacts(f) + '\n');
      pages++;
    }
  }
  fs.writeFileSync(path.join(outDir, 'facts.json'), JSON.stringify(facts));
  console.log(`[EXTRACT] ${pages} page(s), ${Object.keys(facts).length} place(s) -> ${outDir}`);
}

// Run only as a script, so other audit scripts can import its types and helpers without side effects.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
