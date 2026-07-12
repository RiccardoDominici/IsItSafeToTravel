// Daily News / "Safety Movers" — diff engine. Pure function of two adjacent snapshots;
// no I/O, no Date.now(), no randomness (must be byte-identical across repeat runs on the
// same input pair). See PLAN-news.md.
import type { DailySnapshot, ScoredCountry } from '../types.js';
import { getBand, bandDirection, bandCrossConfirmed } from '../../lib/bands.js';
import type { NewsEvent, NewsEventType, NewsEventParams } from './types.js';
import {
  SCORE_JUMP_MIN,
  RANK_OVERTAKE_MAX_RANK,
  RANK_OVERTAKE_MIN_GAP,
  RANK_OVERTAKE_MIN_MOVE,
  SEVERE_ADVISORY_MIN_LEVEL,
  MAJOR_ISSUERS,
  MAX_DIFF_GAP_DAYS,
  PRIORITY,
  daysBetween,
} from './types.js';

// Data-coverage floor, same idea as src/lib/hub-data.ts / scripts/generate-llms-full.ts.
// This is now a 3rd duplication of MIN_RANKING_SOURCES (flagged in PLAN-news.md "Top risks") —
// keep all three in sync, or sparse micro-territories pollute rank-based news events.
const MIN_RANKING_SOURCES = 4;
const hasSufficientData = (c: ScoredCountry): boolean => (c.sources?.length ?? 0) >= MIN_RANKING_SOURCES;

const round2 = (n: number): number => Math.round(n * 100) / 100;

function numLevel(level: unknown): number {
  const n = Number(level ?? NaN);
  return Number.isFinite(n) ? n : 0;
}

type AdvisoryIssuer = keyof ScoredCountry['advisories'];

/** iso3 -> 1-based rank among sufficient-data countries, safest first. Deterministic tie-break: iso3. */
function rankSafest(list: ScoredCountry[]): Map<string, number> {
  const ranked = [...list]
    .filter(hasSufficientData)
    .sort((a, b) => b.score - a.score || a.iso3.localeCompare(b.iso3));
  return new Map(ranked.map((c, i) => [c.iso3, i + 1]));
}

function mk(type: NewsEventType, iso: string, params: NewsEventParams, date: string, suffix?: string): NewsEvent {
  return {
    id: `${date}:${type}:${iso}${suffix ? ':' + suffix : ''}`,
    date,
    type,
    params,
    priority: PRIORITY[type],
  };
}

export function computeNews(prev: DailySnapshot | null, curr: DailySnapshot, date: string): NewsEvent[] {
  const events: NewsEvent[] = [];
  const prevByIso = new Map((prev?.countries ?? []).map((c) => [c.iso3, c] as const));
  const gap = prev ? daysBetween(prev.date, date) : Infinity;

  // new_country: iso3 present today (with sufficient data) & absent yesterday. Needs prev set.
  if (prev) {
    const prevSet = new Set(prev.countries.map((c) => c.iso3));
    for (const c of curr.countries) {
      if (!prevSet.has(c.iso3) && hasSufficientData(c)) {
        events.push(mk('new_country', c.iso3, { country: c.iso3 }, date));
      }
    }
  }

  // First run (no prior snapshot) or too stale a gap: only new_country is meaningful.
  if (!prev || gap > MAX_DIFF_GAP_DAYS) return events;

  const rankT = rankSafest(curr.countries);
  const rankP = rankSafest(prev.countries);

  for (const c of curr.countries) {
    const p = prevByIso.get(c.iso3);
    if (!p) continue;

    const d = round2(c.score - p.score);
    const sNew = Number(c.score.toFixed(1));

    if (Math.abs(d) >= SCORE_JUMP_MIN) {
      events.push(
        mk(
          'score_jump',
          c.iso3,
          {
            country: c.iso3,
            delta: d,
            score: sNew,
            prevScore: Number(p.score.toFixed(1)),
            direction: d > 0 ? 'up' : 'down',
          },
          date,
        ),
      );
    }

    if (bandCrossConfirmed(p.score, c.score)) {
      const from = getBand(p.score);
      const to = getBand(c.score);
      events.push(
        mk(
          'band_change',
          c.iso3,
          { country: c.iso3, fromBand: from, toBand: to, score: sNew, direction: bandDirection(from, to) },
          date,
        ),
      );
    }

    const rt = rankT.get(c.iso3);
    const rp = rankP.get(c.iso3);
    if (rt !== undefined && rt <= 10 && (rp === undefined || rp > 10)) {
      events.push(mk('top10_change', c.iso3, { country: c.iso3, direction: 'enter', rank: rt }, date));
    }
    if (rp !== undefined && rp <= 10 && (rt === undefined || rt > 10)) {
      events.push(mk('top10_change', c.iso3, { country: c.iso3, direction: 'exit', rank: rt ?? rp }, date));
    }

    for (const iss of MAJOR_ISSUERS) {
      const nowL = numLevel(c.advisories[iss as AdvisoryIssuer]?.level);
      const wasL = numLevel(p.advisories[iss as AdvisoryIssuer]?.level);
      if (nowL >= SEVERE_ADVISORY_MIN_LEVEL && nowL > wasL) {
        events.push(mk('severe_advisory', c.iso3, { country: c.iso3, issuer: iss, level: nowL }, date, iss));
      }
    }
  }

  events.push(...computeOvertakes(prevByIso, rankP, rankT, curr, date));
  return events;
}

/** One clean overtake per climber: the nearest crossed country now trailing it. */
function computeOvertakes(
  prevByIso: Map<string, ScoredCountry>,
  rankP: Map<string, number>,
  rankT: Map<string, number>,
  curr: DailySnapshot,
  date: string,
): NewsEvent[] {
  const out: NewsEvent[] = [];
  const currByIso = new Map(curr.countries.map((c) => [c.iso3, c] as const));

  for (const [iso, rt] of rankT) {
    const rp = rankP.get(iso);
    if (rp === undefined || rt >= rp || rt > RANK_OVERTAKE_MAX_RANK) continue; // must have climbed, near top

    let best: string | null = null;
    let bestRank = Infinity;
    for (const [oIso, oRt] of rankT) {
      if (oIso === iso) continue;
      const oRp = rankP.get(oIso);
      if (oRp === undefined) continue;
      if (oRp < rp && oRt > rt && oRt < bestRank) {
        best = oIso;
        bestRank = oRt;
      } // was ahead, now behind
    }
    if (!best) continue;

    const a = currByIso.get(iso)!;
    const b = currByIso.get(best)!;
    const gap = Math.abs(a.score - b.score);
    const moveA = Math.abs(a.score - (prevByIso.get(iso)?.score ?? a.score));
    const moveB = Math.abs(b.score - (prevByIso.get(best)?.score ?? b.score));
    if (gap < RANK_OVERTAKE_MIN_GAP || Math.max(moveA, moveB) < RANK_OVERTAKE_MIN_MOVE) continue;

    out.push(mk('rank_overtake', iso, { country: iso, other: best, rank: rt }, date, best));
  }

  return out;
}
