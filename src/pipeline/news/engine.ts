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
  MIN_NEWS_CONFIDENCE,
  PRIORITY,
  daysBetween,
} from './types.js';

// Data-coverage floor, same idea as src/lib/hub-data.ts / scripts/generate-llms-full.ts.
// This is now a 3rd duplication of MIN_RANKING_SOURCES (flagged in PLAN-news.md "Top risks") —
// keep all three in sync, or sparse micro-territories pollute rank-based news events.
const MIN_RANKING_SOURCES = 4;
const hasSufficientData = (c: ScoredCountry): boolean => (c.sources?.length ?? 0) >= MIN_RANKING_SOURCES;

const round2 = (n: number): number => Math.round(n * 100) / 100;

// Coverage-confidence gate for movement events. `confidence` is absent only on
// pre-v9 snapshots (never regenerated ones), where suppressing everything would be
// worse than the old behavior — treat missing as confident.
const conf = (c: ScoredCountry): number => c.confidence ?? 1;
const isConfident = (c: ScoredCountry): boolean => conf(c) >= MIN_NEWS_CONFIDENCE;

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

  // A dataRevision bump (data-revision.ts) marks a one-time correction to score inputs (e.g. rev 2:
  // bounding source-floor.ts restores + fixing parsers that defaulted to a false level 1; rev 3: the
  // SK/ES/RS/DK advisory-parser repairs) rather than a real change in conditions on the ground. Diffing
  // across that boundary would manufacture "movement" out of the correction itself — and EVERY event
  // type this function produces is diff-derived, not just the four score-delta ones. Repair 2026-09-26:
  // the rev 2 -> 3 boundary proved severe_advisory and new_country are not exempt either. The US
  // advisory source had been frozen on a 2026-07-13 cache, and the pre-repair HTML parser never matched
  // "Burma" / "North Korea" / "West Bank and Gaza" at all — so once the SK/ES/RS/DK repair landed (same
  // run, rev 3) and those countries' real, long-standing level-4 advisories started resolving correctly,
  // the diff read them as brand-new severe_advisory events and emailed them as "new today", when e.g.
  // Myanmar and North Korea have been level 4 for years — the exact same "correction masquerading as
  // movement" failure mode the four score-delta types were already guarded against. new_country has the
  // identical exposure (a country absent from yesterday's snapshot only because a frozen/broken source
  // never produced data for it, not because it didn't exist). So: ANY dataRevision mismatch between prev
  // and curr suppresses EVERY event type for that one run, unconditionally — there is no event type this
  // engine produces that is safe to report across a revision boundary. Still deterministic: same (prev,
  // curr, date) in, same (empty) events out — only a diagnostic log is a side effect.
  const revisionMismatch = prev !== null && (prev.dataRevision ?? 1) !== (curr.dataRevision ?? 1);
  if (revisionMismatch) {
    console.log(
      `[NEWS] dataRevision changed ${prev!.dataRevision ?? 1} -> ${curr.dataRevision ?? 1} between ` +
      `${prev!.date} and ${curr.date} — suppressing ALL event types for this run (every event this ` +
      `engine produces is diff-derived; none are safe to report across a revision boundary)`,
    );
    return events; // [] — nothing is diffed across a revision boundary, not even new_country/severe_advisory
  }

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
    const cConf = round2(conf(c));

    if (Math.abs(d) >= SCORE_JUMP_MIN && isConfident(c)) {
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
            confidence: cConf,
          },
          date,
        ),
      );
    }

    if (bandCrossConfirmed(p.score, c.score) && isConfident(c)) {
      const from = getBand(p.score);
      const to = getBand(c.score);
      events.push(
        mk(
          'band_change',
          c.iso3,
          {
            country: c.iso3,
            fromBand: from,
            toBand: to,
            score: sNew,
            direction: bandDirection(from, to),
            confidence: cConf,
          },
          date,
        ),
      );
    }

    const rt = rankT.get(c.iso3);
    const rp = rankP.get(c.iso3);
    if (isConfident(c)) {
      if (rt !== undefined && rt <= 10 && (rp === undefined || rp > 10)) {
        events.push(mk('top10_change', c.iso3, { country: c.iso3, direction: 'enter', rank: rt, confidence: cConf }, date));
      }
      if (rp !== undefined && rp <= 10 && (rt === undefined || rt > 10)) {
        events.push(mk('top10_change', c.iso3, { country: c.iso3, direction: 'exit', rank: rt ?? rp, confidence: cConf }, date));
      }
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
    if (!isConfident(a) || !isConfident(b)) continue; // both sides need real coverage
    const gap = Math.abs(a.score - b.score);
    const moveA = Math.abs(a.score - (prevByIso.get(iso)?.score ?? a.score));
    const moveB = Math.abs(b.score - (prevByIso.get(best)?.score ?? b.score));
    if (gap < RANK_OVERTAKE_MIN_GAP || Math.max(moveA, moveB) < RANK_OVERTAKE_MIN_MOVE) continue;

    out.push(
      mk(
        'rank_overtake',
        iso,
        { country: iso, other: best, rank: rt, confidence: round2(Math.min(conf(a), conf(b))) },
        date,
        best,
      ),
    );
  }

  return out;
}
