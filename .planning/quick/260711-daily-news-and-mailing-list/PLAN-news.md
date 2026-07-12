---
quick_id: 260711-daily-news
slug: daily-news-safety-movers
date: 2026-07-11
status: planned
owner_plan: PLAN-news.md (Daily News / "Safety Movers" engine + homepage section + localized news page)
sibling_plan: mailing-list (owns NewsletterSignup component + Resend digest — CONSUMES this plan's event files)
---

# PLAN — Daily News / "Safety Movers"

## Objective
Every daily pipeline run auto-derives **structured, language-neutral safety-movement events**
by diffing today's score snapshot vs. the previous one, writes them to `data/news/YYYY-MM-DD.json`
+ a rolling `data/news/index.json` (with per-key cooldown state), and surfaces them:
1. a homepage "Today's Safety Movers" section (top 3–5), and
2. a new localized `/news/` page (7 locales, ~30-day archive, SEO + JSON-LD, reserved
   `NewsletterSignup` slot).
The **same event files feed the email digest** (sibling plan) — so events store ONLY codes +
numbers; all human text is rendered from i18n templates at build/send time. Output is fully
**deterministic** (no `Date.now()` inside event bodies, no randomness) and the pipeline stage is
**non-fatal** (mirrors Stage 6 sentiment try/catch).

## Key decisions (do not relitigate)
- **6 event types** (final): `severe_advisory`, `new_country`, `top10_change`, `band_change`,
  `rank_overtake`, `score_jump`. (This is the requirement's proposed set; "big score jump up/down"
  is one type with a `direction` param, "entry/exit top-10" is one type with `direction`.)
- Diff source = two adjacent per-date snapshots via `loadSnapshot(date)` (`snapshot.ts:87`), NOT
  the 85 MB `history-index.json`. Previous date = latest snapshot date **strictly < today**.
- Advisory changes diff the numeric **`level`** field, never `updatedAt` (batch-fetch artifact —
  identical timestamps across unchanged issuers, per recon).
- Anything rank-related is gated by the existing coverage floor `hasSufficientData` (≥4 sources).
- New pipeline **Stage 7** in `src/pipeline/run.ts`, after Stage 6, wrapped in try/catch.
- News files reach the build by a build-time loader reading `data/news/` from the repo (same
  mechanism as `loadLatestScores` reading `data/scores/latest.json`). **No `public/` copy needed.**
- News page slug per locale (route key `news`): en `news`, it `notizie`, es `noticias`,
  fr `actualites`, pt `noticias`, zh `news`, de `nachrichten`.
- Schema.org for the news page: `CollectionPage` + `ItemList` `@graph` (mirrors hub ItemList pattern).

---

## Tuning constants (freeze in `src/pipeline/news/types.ts`)
Scale is [3.4, 8.9], mean ~6.6; most days are near-static (GPI is annual, advisories change rarely),
so daily jitter is ~0. Thresholds below are set to fire only on genuinely notable moves.

| Constant | Value | Rationale |
|---|---|---|
| `SCORE_JUMP_MIN` | `0.15` | ≥0.15 day-over-day on a ~5.5-wide scale is a real move, not rounding. |
| `RANK_OVERTAKE_MAX_RANK` | `40` | Overtakes only newsworthy near the top of the safest ranking. |
| `RANK_OVERTAKE_MIN_GAP` | `0.02` | Today's score gap between the pair must exceed float noise. |
| `RANK_OVERTAKE_MIN_MOVE` | `0.05` | At least one of the pair moved ≥0.05 in score (not a pure tie-break flip). |
| `BAND_HYSTERESIS` | `0.03` | Raw score must sit ≥0.03 past the crossed band boundary (kills 6.99↔7.01 flap). |
| `SEVERE_ADVISORY_MIN_LEVEL` | `3` | Fire on new level ≥3 ("Reconsider Travel") or 4 ("Do Not Travel"). |
| `MAJOR_ISSUERS` | `['us','uk','ca','au']` | Big-four advisory issuers only (avoids 37-issuer noise). |
| `MAX_DIFF_GAP_DAYS` | `7` | If prev snapshot is >7 days stale, skip movement events (keep `new_country`). |
| `MAX_EVENTS_PER_DAY` | `15` | Hard daily cap on persisted events (highest-priority kept). |
| `HOMEPAGE_MAX` | `5` | Homepage section shows ≤5. |
| `ARCHIVE_DAYS` | `30` | Rolling window for the news page + `index.recentEvents`. |

**Priorities** (higher = more prominent): `severe_advisory` 100 · `new_country` 90 ·
`top10_change` 80 · `band_change` 70 · `rank_overtake` 60 · `score_jump` 50.

**Cooldowns** (key → window days). Event is suppressed if its key exists in `index.cooldowns` and
`(today − storedDate) < window`. After capping, each **surviving** event stamps its key = today.

| Type | Cooldown key | Window |
|---|---|---|
| `rank_overtake` | `overtake:${sortedPair}` (e.g. `overtake:FRA\|ITA`) | 14 |
| `score_jump` | `jump:${iso}` | 7 |
| `band_change` | `band:${iso}` (any direction — suppresses flap) | 14 |
| `top10_change` | `top10:${iso}` (any direction) | 14 |
| `severe_advisory` | `advisory:${iso}:${issuer}` | 21 |
| `new_country` | `newcountry:${iso}` | ∞ (any stored entry suppresses) |

---

## Event schema (`src/pipeline/news/types.ts`)
```ts
export type NewsEventType =
  | 'severe_advisory' | 'new_country' | 'top10_change'
  | 'band_change' | 'rank_overtake' | 'score_jump';

export type BandKey = 'excellent' | 'good' | 'moderate' | 'high_caution' | 'danger';

/** Language-neutral: params carry ONLY ISO3 codes + numbers + enum keys. NEVER localized text. */
export interface NewsEventParams {
  country?: string;    // primary iso3 (all types except pure-pair use this as the subject)
  other?: string;      // secondary iso3 (rank_overtake: the overtaken country)
  delta?: number;      // signed score delta, 2dp (score_jump)
  score?: number;      // new score, 1dp
  prevScore?: number;  // previous score, 1dp
  rank?: number;       // 1-based global "safest" rank (rank_overtake / top10_change)
  direction?: 'up' | 'down' | 'enter' | 'exit';
  fromBand?: BandKey;  // band_change
  toBand?: BandKey;    // band_change
  issuer?: string;     // advisory issuer code, subset of MAJOR_ISSUERS
  level?: number;      // advisory level 3|4
}

export interface NewsEvent {
  id: string;          // deterministic: `${date}:${type}:${country}[:${other|issuer|direction}]`
  date: string;        // YYYY-MM-DD (the run date; used in copy, NOT generatedAt)
  type: NewsEventType;
  priority: number;
  params: NewsEventParams;
}

// Day file: data/news/YYYY-MM-DD.json
export interface NewsDayFile { date: string; generatedAt: string; events: NewsEvent[]; }

// Rolling index: data/news/index.json
export interface NewsIndex {
  generatedAt: string;
  lastProcessedDate: string;
  cooldowns: Record<string, string>;       // key -> YYYY-MM-DD
  recentEvents: NewsEvent[];               // last ARCHIVE_DAYS days, rebuilt each run, date desc
}
```

---

## File-by-file changes

### CREATE `src/lib/bands.ts` — canonical band helper (shared, deterministic)
Extracts the `ScoreHero.astro:55-56` band logic (currently duplicated inline in ≥4 places) so the
news engine + UI agree. **Why:** band_change events and their labels must match what users see.
```ts
import type { BandKey } from '../pipeline/news/types';
export const BAND_ORDER: BandKey[] = ['danger','high_caution','moderate','good','excellent'];
export function getBand(score: number): BandKey {
  const s = Number(score.toFixed(1));            // band on the displayed 1-dp value
  if (s >= 8) return 'excellent';
  if (s >= 7) return 'good';
  if (s >= 6) return 'moderate';
  if (s >= 5) return 'high_caution';
  return 'danger';
}
export function bandDirection(from: BandKey, to: BandKey): 'up' | 'down' {
  return BAND_ORDER.indexOf(to) > BAND_ORDER.indexOf(from) ? 'up' : 'down';
}
/** Hysteresis: raw score must sit ≥ BAND_HYSTERESIS past the single crossed boundary. */
export function bandCrossConfirmed(prevRaw: number, currRaw: number): boolean {
  const from = getBand(prevRaw), to = getBand(currRaw);
  if (from === to) return false;
  const fi = BAND_ORDER.indexOf(from), ti = BAND_ORDER.indexOf(to);
  if (Math.abs(fi - ti) >= 2) return true;                 // multi-band jump: always real
  const boundary = 4 + Math.max(fi, ti);                   // idx1→bd5, idx2→bd6, idx3→bd7, idx4→bd8
  return Math.abs(Number(currRaw.toFixed(2)) - boundary) >= 0.03;
}
```
(`BAND_HYSTERESIS` value 0.03 inlined above to keep bands.ts dependency-free of the const module; if
preferred, import from types.ts.) NOTE: do NOT rewire `ScoreHero.astro` in this task — out of scope;
just add the helper and consume it in the engine + news components.

### CREATE `src/pipeline/news/types.ts`
The `NewsEvent*` types above + all tuning constants + `MAJOR_ISSUERS` + `PRIORITY: Record<NewsEventType, number>`.

### CREATE `src/pipeline/news/engine.ts` — diff + rules core
```ts
import type { DailySnapshot, ScoredCountry } from '../types.js';
import { getBand, bandDirection, bandCrossConfirmed, BAND_ORDER } from '../../lib/bands.js';
import { NewsEvent, NewsEventType, /*consts*/ } from './types.js';

const MIN_RANKING_SOURCES = 4;                                    // keep in sync w/ hub-data.ts
const hasSufficientData = (c: ScoredCountry) => (c.sources?.length ?? 0) >= MIN_RANKING_SOURCES;
const round2 = (n: number) => Math.round(n * 100) / 100;
const numLevel = (l: unknown) => { const n = Number(String(l ?? '')); return Number.isFinite(n) ? n : 0; };
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

/** iso3 -> 1-based rank among sufficient-data countries, safest first. Deterministic tie-break: iso3. */
function rankSafest(list: ScoredCountry[]): Map<string, number> {
  const ranked = list.filter(hasSufficientData)
    .sort((a, b) => b.score - a.score || a.iso3.localeCompare(b.iso3));
  return new Map(ranked.map((c, i) => [c.iso3, i + 1]));
}

export function computeNews(
  prev: DailySnapshot | null, curr: DailySnapshot, date: string,
): NewsEvent[] {
  const events: NewsEvent[] = [];
  const prevByIso = new Map((prev?.countries ?? []).map(c => [c.iso3, c]));
  const gap = prev ? daysBetween(prev.date, date) : Infinity;

  // new_country: iso3 present today (with data) & absent yesterday. Needs prev set.
  if (prev) {
    const prevSet = new Set(prev.countries.map(c => c.iso3));
    for (const c of curr.countries)
      if (!prevSet.has(c.iso3) && hasSufficientData(c)) events.push(mk('new_country', c.iso3, { country: c.iso3 }, date));
  }
  if (!prev || gap > MAX_DIFF_GAP_DAYS) return events;            // first run / stale: only new_country

  const rankT = rankSafest(curr.countries), rankP = rankSafest(prev.countries);

  for (const c of curr.countries) {
    const p = prevByIso.get(c.iso3); if (!p) continue;
    const d = round2(c.score - p.score);
    const sNew = Number(c.score.toFixed(1));

    if (Math.abs(d) >= SCORE_JUMP_MIN)
      events.push(mk('score_jump', c.iso3, { country: c.iso3, delta: d, score: sNew,
        prevScore: Number(p.score.toFixed(1)), direction: d > 0 ? 'up' : 'down' }, date));

    if (bandCrossConfirmed(p.score, c.score)) {
      const from = getBand(p.score), to = getBand(c.score);
      events.push(mk('band_change', c.iso3, { country: c.iso3, fromBand: from, toBand: to,
        score: sNew, direction: bandDirection(from, to) }, date));
    }

    const rt = rankT.get(c.iso3), rp = rankP.get(c.iso3);
    if (rt && rt <= 10 && (rp === undefined || rp > 10))
      events.push(mk('top10_change', c.iso3, { country: c.iso3, direction: 'enter', rank: rt }, date));
    if (rp && rp <= 10 && (rt === undefined || rt > 10))
      events.push(mk('top10_change', c.iso3, { country: c.iso3, direction: 'exit', rank: rt ?? rp }, date));

    for (const iss of MAJOR_ISSUERS) {
      const nowL = numLevel((c.advisories as any)?.[iss]?.level);
      const wasL = numLevel((p.advisories as any)?.[iss]?.level);
      if (nowL >= SEVERE_ADVISORY_MIN_LEVEL && nowL > wasL)
        events.push(mk('severe_advisory', c.iso3, { country: c.iso3, issuer: iss, level: nowL }, date, iss));
    }
  }

  events.push(...computeOvertakes(prev, curr, rankP, rankT, prevByIso, date));
  return events;
}

/** One clean overtake per climber: the strongest (lowest-rank) country it just passed. */
function computeOvertakes(prev, curr, rankP, rankT, prevByIso, date): NewsEvent[] {
  const out: NewsEvent[] = [];
  const currByIso = new Map(curr.countries.map(c => [c.iso3, c]));
  for (const [iso, rt] of rankT) {
    const rp = rankP.get(iso);
    if (rp === undefined || rt >= rp || rt > RANK_OVERTAKE_MAX_RANK) continue;   // must have climbed, near top
    let best: string | null = null, bestRank = Infinity;
    for (const [oIso, oRt] of rankT) {
      const oRp = rankP.get(oIso);
      if (oRp === undefined || oIso === iso) continue;
      if (oRp < rp && oRt > rt && oRt < bestRank) { best = oIso; bestRank = oRt; } // was ahead, now behind
    }
    if (!best) continue;
    const a = currByIso.get(iso)!, b = currByIso.get(best)!;
    const gap = Math.abs(a.score - b.score);
    const moveA = Math.abs(a.score - (prevByIso.get(iso)?.score ?? a.score));
    const moveB = Math.abs(b.score - (prevByIso.get(best)?.score ?? b.score));
    if (gap < RANK_OVERTAKE_MIN_GAP || Math.max(moveA, moveB) < RANK_OVERTAKE_MIN_MOVE) continue;
    out.push(mk('rank_overtake', iso, { country: iso, other: best, rank: rt }, date, best));
  }
  return out;
}

function mk(type: NewsEventType, iso: string, params, date: string, suffix?: string): NewsEvent {
  return { id: `${date}:${type}:${iso}${suffix ? ':' + suffix : ''}`,
           date, type, params, priority: PRIORITY[type] };
}
```

### CREATE `src/pipeline/news/cooldown.ts` — suppression + priority cap
```ts
const WINDOW: Record<NewsEventType, number> =
  { rank_overtake:14, score_jump:7, band_change:14, top10_change:14, severe_advisory:21, new_country:Infinity };

export function cooldownKey(e: NewsEvent): string {
  switch (e.type) {
    case 'rank_overtake': return `overtake:${[e.params.country, e.params.other].sort().join('|')}`;
    case 'score_jump':    return `jump:${e.params.country}`;
    case 'band_change':   return `band:${e.params.country}`;
    case 'top10_change':  return `top10:${e.params.country}`;
    case 'severe_advisory': return `advisory:${e.params.country}:${e.params.issuer}`;
    case 'new_country':   return `newcountry:${e.params.country}`;
  }
}
function magnitude(e: NewsEvent): number {
  switch (e.type) {
    case 'score_jump':    return Math.abs(e.params.delta ?? 0);
    case 'band_change':   return Math.abs(BAND_ORDER.indexOf(e.params.toBand!) - BAND_ORDER.indexOf(e.params.fromBand!));
    case 'rank_overtake': return 1 / (e.params.rank ?? 999);
    case 'top10_change':  return 1 / (e.params.rank ?? 999);
    case 'severe_advisory': return e.params.level ?? 0;
    default: return 0;
  }
}
/** Drop cooled-down events, sort deterministically, cap. Returns kept events (already sorted). */
export function filterSortCap(events: NewsEvent[], cooldowns: Record<string,string>, date: string): NewsEvent[] {
  const alive = events.filter(e => {
    const seen = cooldowns[cooldownKey(e)];
    if (!seen) return true;
    return daysBetween(seen, date) >= WINDOW[e.type];       // Infinity window => always suppressed
  });
  alive.sort((a, b) =>
    b.priority - a.priority ||
    magnitude(b) - magnitude(a) ||
    a.type.localeCompare(b.type) ||
    a.id.localeCompare(b.id));                               // total order => deterministic
  return alive.slice(0, MAX_EVENTS_PER_DAY);
}
```

### CREATE `src/pipeline/news/snapshot.ts` — persistence + rolling index
- `getNewsDir()` (add to `src/pipeline/utils/fs.ts` instead — see below).
- `readNewsIndex(): NewsIndex` — returns `{generatedAt:'', lastProcessedDate:'', cooldowns:{}, recentEvents:[]}` if file missing (graceful init).
- `listNewsDates(): string[]` — sorted `YYYY-MM-DD.json` filenames (mirror `listSnapshotDates`).
- `writeNewsDay(date, events)` → `data/news/${date}.json` (`NewsDayFile`).
- `rebuildRecent(date)` — read the last `ARCHIVE_DAYS` day-files, concat their events, sort date desc, return array (denormalized feed for build + email).
- `writeNewsIndex(index)` → `data/news/index.json`.
- Cooldown update: after `filterSortCap`, for each kept event `cooldowns[cooldownKey(e)] = date`; **prune** cooldown entries older than 90 days to bound file size.

### MODIFY `src/pipeline/utils/fs.ts`
Add after `getScoresDir` (line ~22):
```ts
export function getNewsDir(): string { return join(process.cwd(), 'data/news'); }
```
(`writeJson` already `ensureDir`s, so no mkdir needed.)

### MODIFY `src/pipeline/run.ts` — Stage 7 (non-fatal, after Stage 6, before final log at line 135)
```ts
// Stage 7: Daily News / Safety Movers (display-only, must never abort the run)
console.log('\n--- Stage 7: News ---');
try {
  const idx = readNewsIndex();
  const prevDates = listSnapshotDates().filter(d => d < date);   // today's file already written in Stage 4
  const prev = prevDates.length ? loadSnapshot(prevDates[prevDates.length - 1]) : null;
  const curr = loadSnapshot(date)!;                              // just written; guaranteed present
  const raw = computeNews(prev, curr, date);
  const kept = filterSortCap(raw, idx.cooldowns, date);
  for (const e of kept) idx.cooldowns[cooldownKey(e)] = date;
  writeNewsDay(date, kept);
  const recent = rebuildRecent(date);
  writeNewsIndex({ generatedAt: new Date().toISOString(), lastProcessedDate: date,
                   cooldowns: pruneCooldowns(idx.cooldowns, date, 90), recentEvents: recent });
  console.log(`[News] ${kept.length} event(s) for ${date} (prev=${prev?.date ?? 'none'})`);
} catch (error) {
  console.warn(`[News] Stage 7 failed unexpectedly (non-fatal): ${error instanceof Error ? error.message : String(error)}`);
}
```
Add imports at top: `computeNews` (engine), `filterSortCap`, `cooldownKey` (cooldown),
`readNewsIndex`, `writeNewsDay`, `writeNewsIndex`, `rebuildRecent`, `pruneCooldowns`,
`listSnapshotDates`, `loadSnapshot` (snapshot.js — already exported).
**Graceful degradation:** `computeNews` returns `[]` (or new_country only) when `prev` is null/stale;
`filterSortCap([], …)` → `[]`; a same-day rerun re-reads the index and re-stamps identical cooldowns
(idempotent because `cooldowns[key]=date` is a no-op on repeat). Never throws.

### CREATE `src/lib/news.ts` — build-time loaders + renderer
Reads `data/news/index.json` from repo (like `loadLatestScores` reads `data/scores/latest.json`).
```ts
import { readFileSync } from 'node:fs'; import { join } from 'node:path';
import type { NewsEvent, NewsIndex, BandKey } from '../pipeline/news/types';
import type { Lang } from '../i18n/ui';
import { loadLatestScores, getLocalizedCountryName } from './scores';

function loadIndex(): NewsIndex | null { /* readFileSync data/news/index.json, JSON.parse, null on error */ }

/** Most recent date's events, deduped to one per primary country, ≤ n, priority order. */
export function loadLatestNews(n = 5): NewsEvent[] { /* max date in recentEvents; dedupe by params.country; slice n */ }

/** [{date, events}] grouped, date desc, within `days`. */
export function loadNewsArchive(days = 30): Array<{ date: string; events: NewsEvent[] }> { /* group recentEvents */ }

/** iso3 -> localized name, using latest scores + Intl fallback (reuse getLocalizedCountryName). */
export function nameResolver(lang: Lang): (iso3: string) => string { /* Map from loadLatestScores() */ }

export interface RenderedNews { headline: string; detail: string; links: Array<{ iso3: string; name: string }>; }
/** Resolve i18n template + params -> localized strings. NO English is ever read from the data. */
export function renderNewsEvent(e: NewsEvent, lang: Lang, t: (k:any)=>string, nameOf:(iso:string)=>string): RenderedNews {
  const P = e.params;
  const fill = (s: string, m: Record<string,string>) => s.replace(/\{(\w+)\}/g, (_,k)=> m[k] ?? '');
  const band = (b?: BandKey) => b ? t(`news.band.${b}`) : '';
  // pick key by type (+ direction) — see i18n table — then fill placeholders:
  //   score_jump -> news.score_jump_up|down ; band_change -> news.band_change_up|down ;
  //   top10_change -> news.top10_enter|exit ; else news.<type>
  // links: rank_overtake => [country, other]; others => [country]
}
```

### CREATE `src/components/news/NewsCard.astro`
Props `{ event: NewsEvent; lang: Lang; nameOf; }`. Renders headline (`<h3>`/`<a>` to primary
country page via `routes[lang].country`), detail line, localized date, and a small band/level badge
(reuse `CountryRankRow` badge classes). For `rank_overtake` links both countries.

### CREATE `src/components/news/NewsHomeSection.astro`
Props `{ lang: Lang }`. Calls `loadLatestNews(HOMEPAGE_MAX)`; **renders nothing (empty fragment)
when there are 0 events** (homepage empty-state = hidden section). Heading `t('news.section.home_title')`,
list of `NewsCard`, footer link "See all updates" → `/${lang}/${routes[lang].news}/`.

### MODIFY `src/pages/{lang}/index.astro` (×7)
Import `NewsHomeSection`; insert **between** the `TravelDealsWidget` section (ends line 46) and the
"Popular Rankings" section (line 48):
```astro
<section class="max-w-6xl mx-auto px-4 py-8">
  <NewsHomeSection lang={lang} />
</section>
```
(Self-hides when empty, so no conditional needed in the page.)

### CREATE `src/pages/{lang}/news/index.astro` (×7)
Pattern (en shown; twins swap `lang`, `canonicalUrl`, and the `routes[lang].news` slug):
```astro
---
export const prerender = true;
import Base from '../../../layouts/Base.astro';
import Breadcrumb from '../../../components/Breadcrumb.astro';
import NewsCard from '../../../components/news/NewsCard.astro';
import { loadNewsArchive, nameResolver } from '../../../lib/news';
import { useTranslations } from '../../../i18n/utils';
import { routes } from '../../../i18n/ui';
import type { Lang } from '../../../i18n/ui';

const lang: Lang = 'en';
const t = useTranslations(lang);
const nameOf = nameResolver(lang);
const archive = loadNewsArchive(30);                       // [{date, events}]
const flat = archive.flatMap(g => g.events);
const title = t('news.page.title'); const description = t('news.page.description');
const canonicalUrl = `https://isitsafetotravel.org/${lang}/${routes[lang].news}/`;
const jsonLd = { '@context':'https://schema.org', '@graph':[
  { '@type':['CollectionPage','WebPage'], name:title, description, url:canonicalUrl, inLanguage:lang },
  { '@type':'ItemList', itemListOrder:'https://schema.org/ItemListOrderDescending',
    numberOfItems: flat.length,
    itemListElement: flat.map((e,i)=>({ '@type':'ListItem', position:i+1,
      url:`https://isitsafetotravel.org/${lang}/${routes[lang].country}/${(e.params.country||'').toLowerCase()}/` })) },
]};
---
<Base lang={lang} title={title} description={description} jsonLd={jsonLd}>
  <div class="max-w-3xl mx-auto px-4 py-8 space-y-8">
    <Breadcrumb lang={lang} items={[{label:t('nav.home'),href:`/${lang}/`},{label:title,href:''}]} />
    <header class="text-center space-y-3">
      <h1 class="text-3xl md:text-4xl font-heading font-bold text-sand-800 dark:text-sand-100">{title}</h1>
      <p class="text-base text-sand-600 dark:text-sand-300">{t('news.page.intro')}</p>
    </header>

    {/* ===== RESERVED SLOT — owned by the mailing-list plan ===== */}
    {/* <NewsletterSignup lang={lang} placement="news" /> */}
    {/* Contract: component src/components/NewsletterSignup.astro; Props { lang: Lang; placement: 'news'|'home'|'country' }. */}
    {/* Insert here (after intro, before the archive). Renders its own <section>; no data deps on this page. */}

    {archive.length === 0
      ? <p class="text-center text-sand-500 dark:text-sand-400 py-12">{t('news.page.empty')}</p>
      : archive.map(group => (
          <section class="space-y-3">
            <h2 class="text-sm font-semibold text-sand-500 dark:text-sand-400">
              {new Date(group.date).toLocaleDateString(lang==='en'?'en-US':lang, {year:'numeric',month:'long',day:'numeric'})}
            </h2>
            {group.events.map(e => <NewsCard event={e} lang={lang} nameOf={nameOf} />)}
          </section>
        ))}
  </div>
</Base>
```
**Empty-state:** the page always exists (SEO permanence); shows `news.page.empty` only when the whole
30-day window is empty. Older items keep the page non-empty on quiet days.

### MODIFY `src/i18n/ui.ts`
1. Add route key `news` to **all 7** `routes` locales (`ui.ts:3638-3835`):
   en `news` · it `notizie` · es `noticias` · fr `actualites` · pt `noticias` · zh `news` · de `nachrichten`.
2. Add the news i18n keys (table below) to all 7 locale dictionaries. **EN + IT are authored here;
   executor translates es/fr/pt/zh/de** keeping placeholders `{...}` intact.

### MODIFY `scripts/validate-seo.ts` — coverage for the new page
The site-wide `validateAllHreflangTargets()` (lines 119-167) auto-passes once `news` is in every
locale's `routes` (Base.astro emits correct hreflang; sitemap `serialize()` needs no change). Add a
light explicit check so the page can never silently vanish:
```ts
function validateNewsPages() {
  console.log("\n--- News Pages ---");
  const NEWS_SLUG: Record<string,string> = { en:'news', it:'notizie', es:'noticias', fr:'actualites', pt:'noticias', zh:'news', de:'nachrichten' };
  for (const lang of LANGUAGES) {
    const p = path.join(DIST, lang, NEWS_SLUG[lang], "index.html");
    const ok = fs.existsSync(p);
    check(`news: ${lang}/${NEWS_SLUG[lang]} exists`, ok, ok ? "" : "file not found");
    if (ok) { const html = readHtml(p); check(`news: ${lang} has JSON-LD`, html.includes('application/ld+json')); }
  }
}
```
Call it alongside the other validators in the main run block. Keep `NEWS_SLUG` in sync with `routes`.

### MODIFY `.github/workflows/data-pipeline.yml`
Add `data/news` to the `git add` list (the step that stages `data/raw data/scores public/scores.json
data/history data/sentiment`). **Why:** day files + index must be committed so the deploy build sees them.

### CREATE `src/pipeline/news/__tests__/engine.test.ts` (Node `--test`)
Synthetic snapshots asserting: score_jump fires at Δ0.20 not at Δ0.10; band_change fires 6.8→7.1
but NOT 6.99→7.01 (hysteresis); overtake emits `{country:'FRA', other:'ITA'}` when FRA passes ITA in
top-40; severe_advisory fires on us 2→4 not 4→4; new_country fires for a fresh iso3; `computeNews(null,curr,…)`
returns `[]` (no throw); cooldown suppresses a repeat overtake within 14 days.

---

## i18n key / copy table (authoritative EN + IT; placeholders MUST survive translation)
Country names (`{a} {b} {country} {other}`), issuer names and band/level labels are themselves
resolved via keys below — the renderer nests them, so no raw country/band text lives in data.

| Key | EN | IT |
|---|---|---|
| `news.section.home_title` | Today's Safety Movers | Movimenti di sicurezza di oggi |
| `news.section.home_viewall` | See all safety updates | Vedi tutti gli aggiornamenti |
| `news.page.title` | Travel Safety News & Daily Updates | Notizie sulla Sicurezza dei Viaggi e Aggiornamenti Quotidiani |
| `news.page.description` | Daily travel-safety movements: score jumps, rank overtakes, band changes and new government advisories across 248 countries, recomputed every day from 40+ sources. | Movimenti quotidiani sulla sicurezza dei viaggi: variazioni di punteggio, sorpassi in classifica, cambi di fascia e nuovi avvisi governativi per 248 Paesi, ricalcolati ogni giorno da oltre 40 fonti. |
| `news.page.intro` | What changed in world travel safety today — the biggest daily movers, tracked automatically. | Cosa e cambiato oggi nella sicurezza dei viaggi nel mondo: i maggiori movimenti quotidiani, monitorati automaticamente. |
| `news.page.empty` | No notable safety changes in the past 30 days. Check back soon. | Nessun cambiamento di sicurezza rilevante negli ultimi 30 giorni. Torna presto. |
| `news.rank_overtake` | {a} overtakes {b} among the world's safest countries | {a} supera {b} tra i Paesi piu sicuri al mondo |
| `news.rank_overtake.detail` | {a} climbs to #{rank} in the global safety ranking, edging past {b}. | {a} sale al #{rank} nella classifica mondiale della sicurezza, superando {b}. |
| `news.score_jump_up` | {country}'s safety score climbs to {score} | Il punteggio di sicurezza di {country} sale a {score} |
| `news.score_jump_up.detail` | {country} gained {delta} points over the past day, now {score}/10. | {country} guadagna {delta} punti nell'ultimo giorno, ora a {score}/10. |
| `news.score_jump_down` | {country}'s safety score slips to {score} | Il punteggio di sicurezza di {country} scende a {score} |
| `news.score_jump_down.detail` | {country} lost {delta} points over the past day, now {score}/10. | {country} perde {delta} punti nell'ultimo giorno, ora a {score}/10. |
| `news.band_change_up` | {country} upgraded from '{from}' to '{to}' | {country} migliora da '{from}' a '{to}' |
| `news.band_change_up.detail` | {country}'s safety rating improved to {to} ({score}/10), up from {from}. | La valutazione di sicurezza di {country} migliora a {to} ({score}/10), da {from}. |
| `news.band_change_down` | {country} downgraded from '{from}' to '{to}' | {country} peggiora da '{from}' a '{to}' |
| `news.band_change_down.detail` | {country}'s safety rating fell to {to} ({score}/10), down from {from}. | La valutazione di sicurezza di {country} scende a {to} ({score}/10), da {from}. |
| `news.top10_enter` | {country} enters the world's 10 safest countries | {country} entra tra i 10 Paesi piu sicuri al mondo |
| `news.top10_enter.detail` | {country} rises to #{rank} globally, joining the top 10 safest destinations. | {country} sale al #{rank} a livello mondiale, entrando nella top 10 delle mete piu sicure. |
| `news.top10_exit` | {country} drops out of the world's 10 safest countries | {country} esce dai 10 Paesi piu sicuri al mondo |
| `news.top10_exit.detail` | {country} slips to #{rank}, leaving the top 10 safest destinations. | {country} scende al #{rank}, lasciando la top 10 delle mete piu sicure. |
| `news.severe_advisory` | {issuer} issues a '{levelLabel}' warning for {country} | {issuer} emette un avviso '{levelLabel}' per {country} |
| `news.severe_advisory.detail` | {issuer} raised its advisory for {country} to level {level} — {levelLabel}. | {issuer} ha alzato il proprio avviso per {country} al livello {level} — {levelLabel}. |
| `news.new_country` | {country} added to IsItSafeToTravel | {country} aggiunto a IsItSafeToTravel |
| `news.new_country.detail` | {country} now has a daily safety score, tracked across 40+ global sources. | Ora {country} ha un punteggio di sicurezza quotidiano, monitorato da oltre 40 fonti globali. |
| `news.band.excellent` | Excellent | Eccellente |
| `news.band.good` | Good | Buono |
| `news.band.moderate` | Moderate | Moderato |
| `news.band.high_caution` | High Caution | Alta Cautela |
| `news.band.danger` | Danger | Pericolo |
| `news.issuer.us` | U.S. State Department | Dipartimento di Stato USA |
| `news.issuer.uk` | UK FCDO | FCDO britannico |
| `news.issuer.ca` | Government of Canada | Governo del Canada |
| `news.issuer.au` | Australia (DFAT) | Australia (DFAT) |
| `news.advisory_level.3` | Reconsider Travel | Riconsiderare il Viaggio |
| `news.advisory_level.4` | Do Not Travel | Non Viaggiare |

Renderer notes: `{delta}` rendered as **absolute value, 2dp**; sign is carried by the up/down key.
`{levelLabel}` = `t('news.advisory_level.'+level)`; `{issuer}` = `t('news.issuer.'+issuer)`;
`{from}`/`{to}` = `t('news.band.'+bandKey)`; `{a}`/`{b}`/`{country}`/`{other}` = localized country names.

---

## Acceptance criteria
1. `npx tsx src/pipeline/run.ts 2026-07-10` completes with a `--- Stage 7: News ---` block and a
   `[News] N event(s) …` line; **exit code unchanged** even if Stage 7 is forced to throw (non-fatal).
2. `data/news/2026-07-10.json` (`NewsDayFile`) and `data/news/index.json` (`NewsIndex` with
   `cooldowns` + `recentEvents`) exist and validate against the schema. Events contain **no
   English strings** — only iso3 codes, numbers, and enum keys.
3. Re-running the same date is idempotent (identical day file; cooldowns unchanged).
4. Diff engine degrades: `computeNews(null, curr, date)` → `[]` (or new_country only); gap >7 days →
   movement events skipped; pipeline never crashes.
5. `npx astro build` succeeds; homepage renders "Today's Safety Movers" when events exist and
   **omits the section entirely** when empty; `/en/news/` … `/de/nachrichten/` all build with valid
   `CollectionPage`+`ItemList` JSON-LD and a reserved (commented) `NewsletterSignup` slot.
6. `npm run validate:seo` is **ALL-PASS**, including the hreflang target sweep and the new
   `validateNewsPages()` (7 pages present, each with JSON-LD).
7. All 7 homepages + 7 news pages edited; `news` route in all 7 locales; every new i18n key present
   in all 7 dictionaries (es/fr/pt/zh/de translated, placeholders intact).
8. `.github/workflows/data-pipeline.yml` stages `data/news`.

## Verification steps (run against the two most recent real snapshots on disk)
1. **Engine dry-run** (no fetch, no writes) against `2026-07-09` → `2026-07-10`:
   ```bash
   npx tsx -e "import {loadSnapshot} from './src/pipeline/scoring/snapshot.js'; \
   import {computeNews} from './src/pipeline/news/engine.js'; \
   import {filterSortCap} from './src/pipeline/news/cooldown.js'; \
   const prev=loadSnapshot('2026-07-09'), curr=loadSnapshot('2026-07-10'); \
   const ev=filterSortCap(computeNews(prev,curr,'2026-07-10'),{}, '2026-07-10'); \
   console.log(ev.length,'events'); console.log(JSON.stringify(ev.slice(0,10),null,2));"
   ```
   Expect: runs clean, prints a small, plausible event list (likely a handful given near-static data;
   0 is acceptable and must NOT error). Inspect that params hold only codes/numbers.
2. **Full stage** (writes files): `npx tsx src/pipeline/run.ts 2026-07-10` — but this refetches; for a
   pure-diff check prefer step 1. If run, confirm `data/news/2026-07-10.json` + `index.json` appear.
3. **Unit tests:** `node --test --import tsx src/pipeline/news/__tests__/engine.test.ts` (matches the
   project's existing `--test` runner convention) — all pass.
4. **Build + SEO gate:** `npx astro build && npm run validate:seo` → ALL-PASS; manually open
   `dist/client/en/news/index.html` and `dist/client/de/nachrichten/index.html` to eyeball headlines
   + JSON-LD.
5. **Determinism:** run step 1 twice, diff the two JSON outputs — must be byte-identical.

## Top risks
- **Quiet-data days → 0 events.** Expected (GPI annual, advisories rare). Homepage self-hides; news
  page shows the 30-day archive. Not a bug. If EN copy feels empty long-term, sibling backlog can add
  a "no major changes today" filler — out of scope here.
- **GPI-refresh day → event flood.** The annual GPI drop could move many countries at once. Mitigated
  by `MAX_EVENTS_PER_DAY=15` + priority ordering; cooldowns then damp the following days.
- **`getBand` / `ScoreHero` drift.** New shared `bands.ts` must match `ScoreHero.astro:55-56`
  thresholds exactly (≥8/≥7/≥6/≥5). Not refactoring ScoreHero now = duplicate logic risk; flagged.
- **`MIN_RANKING_SOURCES` now duplicated in a 3rd place** (engine.ts) alongside hub-data.ts +
  generate-llms-full.ts. Add a code comment pointing at the other two.
- **Cooldown file growth.** Bounded by 90-day prune in `writeNewsIndex`; `new_country` keys are kept
  permanently (rare, ~few/year).
