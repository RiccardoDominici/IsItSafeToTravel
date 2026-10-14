import { join } from 'node:path';
import { readJson } from '../utils/fs.js';
import type { CommunityComponent, CommunityConfig } from '../types.js';

/**
 * Formula v10 community component (SPEC §5), engine side.
 *
 * The vote aggregation (origin cap, activation floors, recency weights) happens in the
 * sentiment stage, which writes data/sentiment/latest.json. The engine only READS that
 * file and turns each country's entry into a bounded adjustment of the data score:
 *
 *   Z          = nEff / (nEff + k)
 *   adjustment = clamp(Z * (P - S_data), -cap, +cap)     only when the entry is active
 *   score      = clamp(S_data + adjustment, 1, 10)
 *
 * Safety rules:
 *  - absent file, unreadable file or the pre-v10 shape => no adjustment for anyone;
 *  - a grey official country (no S_data) never gets an official score from votes;
 *  - an entry claiming 'active' that fails the configured floors (votes, origins, origin
 *    share) is treated as insufficient: the engine re-checks what it is told.
 */

/** One country of data/sentiment/latest.json (formula v10 contract). */
export interface CommunityEntry {
  iso3: string;
  votes: number;
  origins: number;
  topOriginShare: number;
  nEff: number;
  perceived: number;
  status: 'active' | 'insufficient';
}

export type CommunityLookup = ReadonlyMap<string, CommunityEntry>;

export const DEFAULT_SENTIMENT_PATH = (): string => join(process.cwd(), 'data', 'sentiment', 'latest.json');

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** True when `v` has every field of the v10 contract with a sane type and range. */
export function isCommunityEntry(v: unknown): v is CommunityEntry {
  if (!v || typeof v !== 'object') return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.iso3 === 'string' &&
    isNum(e.votes) && e.votes >= 0 &&
    isNum(e.origins) && e.origins >= 0 &&
    isNum(e.topOriginShare) && e.topOriginShare >= 0 && e.topOriginShare <= 1 &&
    isNum(e.nEff) && e.nEff >= 0 &&
    isNum(e.perceived) &&
    (e.status === 'active' || e.status === 'insufficient')
  );
}

/**
 * Validate a parsed sentiment snapshot. Returns null when it is not the v10 shape (e.g.
 * the v9.1 file with count/avgDelta/correction, or a corrupt file): the whole file is
 * then ignored, so a half-migrated file can never move a score. An empty `countries`
 * object is valid (no votes yet).
 */
export function parseCommunitySnapshot(json: unknown): Map<string, CommunityEntry> | null {
  if (!json || typeof json !== 'object') return null;
  const countries = (json as { countries?: unknown }).countries;
  if (!countries || typeof countries !== 'object' || Array.isArray(countries)) return null;

  const lookup = new Map<string, CommunityEntry>();
  for (const [key, entry] of Object.entries(countries as Record<string, unknown>)) {
    if (!isCommunityEntry(entry)) return null;
    lookup.set((entry.iso3 || key).toUpperCase(), entry);
  }
  return lookup;
}

/**
 * Read data/sentiment/latest.json (or `path`). Missing, unreadable or pre-v10 => null,
 * with a log line saying why, so the run log shows whether the community counted.
 */
export function loadCommunitySnapshot(path: string = DEFAULT_SENTIMENT_PATH()): Map<string, CommunityEntry> | null {
  const json = readJson<unknown>(path);
  if (json === null) {
    console.log(`[COMMUNITY] No sentiment snapshot at ${path}: no community adjustment this run`);
    return null;
  }
  const lookup = parseCommunitySnapshot(json);
  if (lookup === null) {
    console.warn(`[COMMUNITY] ${path} is not in the v10 shape (pre-v10 or corrupt): no community adjustment this run`);
    return null;
  }
  const active = [...lookup.values()].filter((e) => e.status === 'active').length;
  console.log(`[COMMUNITY] Loaded ${lookup.size} country entries (${active} marked active) from ${path}`);
  return lookup;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** True when an entry meets every configured activation floor (the engine's own check). */
export function meetsActivationFloors(entry: CommunityEntry, params: CommunityConfig): boolean {
  return (
    entry.status === 'active' &&
    entry.votes >= params.minVotes &&
    entry.origins >= params.minOrigins &&
    entry.topOriginShare <= params.originCap + 1e-9
  );
}

export interface CommunityResult {
  component: CommunityComponent;
  /** True when the entry said 'active' but failed the engine's floors (logged by the caller). */
  rejectedActive: boolean;
}

/** Shrinkage weight of the community: Z = nEff / (nEff + k). */
export function communityWeight(nEff: number, k: number): number {
  return nEff > 0 ? nEff / (nEff + k) : 0;
}

/**
 * The community component for one country. `dataScore` is S_data, or null for a grey
 * country (which keeps its community reading for display but never gets an adjustment).
 * Without params (no community section in the config) the component is inert.
 */
export function computeCommunityComponent(
  entry: CommunityEntry | undefined,
  dataScore: number | null,
  params: CommunityConfig | undefined,
): CommunityResult {
  if (!entry) {
    return {
      component: { status: 'insufficient', votes: 0, origins: 0, perceived: null, adjustment: 0 },
      rejectedActive: false,
    };
  }

  const active = params !== undefined && meetsActivationFloors(entry, params);
  const rejectedActive = entry.status === 'active' && !active;
  let adjustment = 0;
  if (active && dataScore !== null) {
    const z = communityWeight(entry.nEff, params.k);
    adjustment = clamp(z * (entry.perceived - dataScore), -params.cap, params.cap);
  }

  return {
    component: {
      status: active ? 'active' : 'insufficient',
      votes: entry.votes,
      origins: entry.origins,
      perceived: entry.perceived,
      adjustment,
    },
    rejectedActive,
  };
}
