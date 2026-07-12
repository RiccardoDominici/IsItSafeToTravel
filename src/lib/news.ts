// Build-time loaders + i18n renderer for the Daily News / "Safety Movers" feature.
// Reads data/news/index.json from the repo, same mechanism as loadLatestScores() reading
// data/scores/latest.json (no public/ copy needed — see PLAN-news.md).
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { NewsEvent, NewsIndex, BandKey } from '../pipeline/news/types';
import type { Lang } from '../i18n/ui';
import { loadLatestScores, getLocalizedCountryName } from './scores';

const NEWS_DIR = join(process.cwd(), 'data', 'news');

function loadIndex(): NewsIndex | null {
  const p = join(NEWS_DIR, 'index.json');
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as NewsIndex;
  } catch {
    return null;
  }
}

/** Most recent date's events, deduped to one per primary country, priority order, <= n. */
export function loadLatestNews(n = 5): NewsEvent[] {
  const idx = loadIndex();
  if (!idx || idx.recentEvents.length === 0) return [];

  const latestDate = idx.recentEvents.reduce((max, e) => (e.date > max ? e.date : max), idx.recentEvents[0].date);
  const todaysEvents = idx.recentEvents
    .filter((e) => e.date === latestDate)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

  const seen = new Set<string>();
  const deduped: NewsEvent[] = [];
  for (const e of todaysEvents) {
    const key = e.params.country ?? e.id;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(e);
    if (deduped.length >= n) break;
  }
  return deduped;
}

/** [{date, events}] grouped from index.recentEvents, date desc, at most `days` groups. */
export function loadNewsArchive(days = 30): Array<{ date: string; events: NewsEvent[] }> {
  const idx = loadIndex();
  if (!idx || idx.recentEvents.length === 0) return [];

  const byDate = new Map<string, NewsEvent[]>();
  for (const e of idx.recentEvents) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }

  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a)).slice(0, days);
  return dates.map((date) => ({
    date,
    events: byDate.get(date)!.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id)),
  }));
}

/** iso3 -> localized name, using the latest scores snapshot (handles zh/de via Intl fallback). */
export function nameResolver(lang: Lang): (iso3: string) => string {
  const countries = loadLatestScores();
  const map = new Map(countries.map((c) => [c.iso3, c]));
  return (iso3: string) => {
    const c = map.get(iso3);
    return c ? getLocalizedCountryName(c, lang) : iso3;
  };
}

export interface RenderedNews {
  headline: string;
  detail: string;
  links: Array<{ iso3: string; name: string }>;
}

const BAND_LABEL_KEY: Record<BandKey, string> = {
  excellent: 'news.band.excellent',
  good: 'news.band.good',
  moderate: 'news.band.moderate',
  high_caution: 'news.band.high_caution',
  danger: 'news.band.danger',
};

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
}

/** Resolve an i18n template + params -> localized headline/detail strings. NO English is ever read from event data. */
export function renderNewsEvent(e: NewsEvent, lang: Lang, t: (key: any) => string, nameOf: (iso3: string) => string): RenderedNews {
  const P = e.params;
  const country = P.country ? nameOf(P.country) : '';
  const other = P.other ? nameOf(P.other) : '';
  const band = (b?: BandKey) => (b ? t(BAND_LABEL_KEY[b]) : '');
  const issuer = P.issuer ? t(`news.issuer.${P.issuer}`) : '';
  const levelLabel = P.level ? t(`news.advisory_level.${P.level}`) : '';

  let headlineKey: string;
  let detailKey: string;
  switch (e.type) {
    case 'rank_overtake':
      headlineKey = 'news.rank_overtake';
      detailKey = 'news.rank_overtake.detail';
      break;
    case 'score_jump':
      headlineKey = P.direction === 'down' ? 'news.score_jump_down' : 'news.score_jump_up';
      detailKey = `${headlineKey}.detail`;
      break;
    case 'band_change':
      headlineKey = P.direction === 'down' ? 'news.band_change_down' : 'news.band_change_up';
      detailKey = `${headlineKey}.detail`;
      break;
    case 'top10_change':
      headlineKey = P.direction === 'exit' ? 'news.top10_exit' : 'news.top10_enter';
      detailKey = `${headlineKey}.detail`;
      break;
    case 'severe_advisory':
      headlineKey = 'news.severe_advisory';
      detailKey = 'news.severe_advisory.detail';
      break;
    case 'new_country':
    default:
      headlineKey = 'news.new_country';
      detailKey = 'news.new_country.detail';
      break;
  }

  const values: Record<string, string> = {
    a: country,
    b: other,
    country,
    other,
    rank: String(P.rank ?? ''),
    score: P.score !== undefined ? P.score.toFixed(1) : '',
    delta: P.delta !== undefined ? Math.abs(P.delta).toFixed(2) : '',
    from: band(P.fromBand),
    to: band(P.toBand),
    issuer,
    level: String(P.level ?? ''),
    levelLabel,
  };

  const links =
    e.type === 'rank_overtake' && P.other
      ? [
          { iso3: P.country!, name: country },
          { iso3: P.other, name: other },
        ]
      : P.country
        ? [{ iso3: P.country, name: country }]
        : [];

  return {
    headline: fill(t(headlineKey), values),
    detail: fill(t(detailKey), values),
    links,
  };
}
