// Phase 39: Community Sentiment Score — vote ingestion endpoint.
// POST /api/vote  { iso3, delta, token? }
// Mirrors functions/api/feedback.ts (corsHeaders, try/catch shape, context.env?.X access),
// with one deliberate inversion: missing optional env (TURNSTILE_SECRET_KEY) must DEGRADE
// gracefully (skip verification, keep working) instead of 500ing — D-12/D-14.

// Claude's-discretion tunable thresholds (CONTEXT.md "Claude's Discretion").
const DEDUPE_WINDOW_DAYS = 1; // per-country daily dedupe window (voter_hash, UTC day bucket)
const DAILY_PER_VISITOR_CAP = 30; // max votes/day per salted visitor hash (day_hash)
const MAX_BODY_BYTES = 1024; // reject oversized bodies before parsing/using fields
export const FALLBACK_SALT = 'isitsafetotravel-vote-fallback-salt-v1'; // used only if VOTE_HASH_SALT secret is unset (also imported by consent.ts)

// Compact allowlist Set derived from src/pipeline/config/countries.ts COUNTRIES (248 entries).
// Embedded here (not imported) because Pages Functions at the edge can't cheaply pull from src/.
const VALID_ISO3 = new Set([
  'ABW', 'AFG', 'AGO', 'AIA', 'ALA', 'ALB', 'AND', 'ARE', 'ARG', 'ARM', 'ASM', 'ATA', 'ATF', 'ATG', 'AUS',
  'AUT', 'AZE', 'BDI', 'BEL', 'BEN', 'BES', 'BFA', 'BGD', 'BGR', 'BHR', 'BHS', 'BIH', 'BLM', 'BLR', 'BLZ',
  'BOL', 'BRA', 'BRB', 'BRN', 'BTN', 'BVT', 'BWA', 'CAF', 'CAN', 'CCK', 'CHE', 'CHL', 'CHN', 'CIV', 'CMR',
  'COD', 'COG', 'COK', 'COL', 'COM', 'CPV', 'CRI', 'CUB', 'CUW', 'CXR', 'CYM', 'CYP', 'CZE', 'DEU', 'DJI',
  'DMA', 'DNK', 'DOM', 'DZA', 'ECU', 'EGY', 'ERI', 'ESH', 'ESP', 'EST', 'ETH', 'FIN', 'FJI', 'FLK', 'FRA',
  'FRO', 'FSM', 'GAB', 'GBR', 'GEO', 'GGY', 'GHA', 'GIB', 'GIN', 'GLP', 'GMB', 'GNB', 'GNQ', 'GRC', 'GRD',
  'GRL', 'GTM', 'GUF', 'GUM', 'GUY', 'HKG', 'HND', 'HRV', 'HTI', 'HUN', 'IDN', 'IMN', 'IND', 'IOT', 'IRL',
  'IRN', 'IRQ', 'ISL', 'ISR', 'ITA', 'JAM', 'JEY', 'JOR', 'JPN', 'KAZ', 'KEN', 'KGZ', 'KHM', 'KIR', 'KNA',
  'KOR', 'KWT', 'LAO', 'LBN', 'LBR', 'LBY', 'LCA', 'LIE', 'LKA', 'LSO', 'LTU', 'LUX', 'LVA', 'MAC', 'MAF',
  'MAR', 'MCO', 'MDA', 'MDG', 'MDV', 'MEX', 'MHL', 'MKD', 'MLI', 'MLT', 'MMR', 'MNE', 'MNG', 'MNP', 'MOZ',
  'MRT', 'MSR', 'MTQ', 'MUS', 'MWI', 'MYS', 'MYT', 'NAM', 'NCL', 'NER', 'NFK', 'NGA', 'NIC', 'NIU', 'NLD',
  'NOR', 'NPL', 'NRU', 'NZL', 'OMN', 'PAK', 'PAN', 'PCN', 'PER', 'PHL', 'PLW', 'PNG', 'POL', 'PRI', 'PRK',
  'PRT', 'PRY', 'PSE', 'PYF', 'QAT', 'REU', 'ROU', 'RUS', 'RWA', 'SAU', 'SDN', 'SEN', 'SGP', 'SGS', 'SHN',
  'SJM', 'SLB', 'SLE', 'SLV', 'SMR', 'SOM', 'SPM', 'SRB', 'SSD', 'STP', 'SUR', 'SVK', 'SVN', 'SWE', 'SWZ',
  'SXM', 'SYC', 'SYR', 'TCA', 'TCD', 'TGO', 'THA', 'TJK', 'TKL', 'TKM', 'TLS', 'TON', 'TTO', 'TUN', 'TUR',
  'TUV', 'TWN', 'TZA', 'UGA', 'UKR', 'UMI', 'URY', 'USA', 'UZB', 'VAT', 'VCT', 'VEN', 'VGB', 'VIR', 'VNM',
  'VUT', 'WLF', 'WSM', 'XKX', 'YEM', 'ZAF', 'ZMB', 'ZWE',
]);

const VALID_DELTAS = new Set([-2, -1, 0, 1, 2]);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

/** True only for the 5 valid calibration deltas (D-02): -2, -1, 0, 1, 2. */
export function isValidDelta(x: unknown): boolean {
  return typeof x === 'number' && Number.isInteger(x) && VALID_DELTAS.has(x);
}

/** True only for an uppercase 3-letter ISO3 code present in the embedded allowlist. */
export function isValidIso3(x: unknown): boolean {
  return typeof x === 'string' && VALID_ISO3.has(x);
}

/**
 * Validated 1-10 finite number, or null for anything else (missing, wrong type, NaN/Infinity,
 * out of range). Never returns undefined — D1 `.bind()` throws `D1_TYPE_ERROR` on undefined.
 */
export function normalizeOfficialScore(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) && x >= 1 && x <= 10 ? x : null;
}

/** True only when the Content-Type header (ignoring charset/params) is exactly application/json. */
export function isJsonContentType(contentType: string | null): boolean {
  if (!contentType) return false;
  return contentType.split(';')[0].trim().toLowerCase() === 'application/json';
}

/**
 * True when `origin` is absent (no Origin header — curl, or same-origin fetches in browsers
 * that omit it) or when it matches `requestUrl`'s own origin. False only on an explicit
 * cross-origin mismatch.
 */
export function isSameOriginOrAbsent(origin: string | null, requestUrl: string): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/**
 * SHA-256 hex digest of `salt:ip:scope` via Web Crypto (crypto.subtle) — NOT Node's built-in
 * crypto module, so this runs regardless of the nodejs_compat flag. Never store or log the raw ip.
 */
export async function voterHash(salt: string, ip: string, scope: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}:${scope}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context: any) {
  try {
    // (0) Content-Type + same-origin guard for this state-changing endpoint (WR-03). Absent
    // Origin (curl, same-origin fetch in some browsers) stays allowed; an explicit
    // cross-origin mismatch is rejected. No CORS headers are added for cross-origin requests.
    if (!isJsonContentType(context.request.headers.get('Content-Type'))) {
      return json({ ok: false, reason: 'unsupported_media_type' }, 415);
    }
    if (!isSameOriginOrAbsent(context.request.headers.get('Origin'), context.request.url)) {
      return json({ ok: false, reason: 'origin_mismatch' }, 403);
    }

    // (1) Body-size cap — read as text first so we can measure before parsing/trusting fields.
    const rawBody = await context.request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return json({ ok: false, reason: 'body_too_large' }, 413);
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, reason: 'invalid_json' }, 400);
    }

    // (2) Validate iso3 + delta.
    if (!isValidIso3(body?.iso3) || !isValidDelta(body?.delta)) {
      return json({ ok: false, reason: 'invalid_input' }, 400);
    }
    const iso3: string = body.iso3;
    const delta: number = body.delta;

    // (3) Env-gated Turnstile: only verify if the secret is configured (D-12). Absence
    // means SKIP entirely and continue — never 500 on a missing optional secret.
    const turnstileSecret = context.env?.TURNSTILE_SECRET_KEY;
    if (turnstileSecret) {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: body.token ?? '',
          remoteip: context.request.headers.get('CF-Connecting-IP') ?? '',
        }),
      });
      const verifyOut: any = await verifyRes.json().catch(() => ({ success: false }));
      if (!verifyOut?.success) {
        return json({ ok: false, reason: 'turnstile' }, 403);
      }
    }

    // (4) Salted, cookie-free hashes. Never log the raw ip.
    const ip = context.request.headers.get('CF-Connecting-IP') ?? '';
    const salt = context.env?.VOTE_HASH_SALT ?? FALLBACK_SALT;
    const nowMs = Date.now();
    const dayBucket = Math.floor(nowMs / 864e5);
    // Day-bucketed voter hash: same visitor + same country hashes identically only within
    // the same UTC day, so UNIQUE(iso3, voter_hash) enforces exactly one vote/country/day.
    const voter_hash = await voterHash(salt, ip, `${iso3}:${dayBucket}`);
    const day_hash = await voterHash(salt, ip, `day:${dayBucket}`);
    // Coarse geolocation only (2-letter ISO country, or null/'T1'/'XX' — Tor/unknown), from
    // Cloudflare's edge-populated request.cf.country / CF-IPCountry header. No raw IP, no
    // city, no lat/long — see LEGAL-PRIVACY-ASSESSMENT.md §B (legitimate interest, Art. 6(1)(f)).
    const country = context.request.cf?.country ?? context.request.headers.get('CF-IPCountry') ?? null;

    // (5) Graceful degradation: no D1 binding attached -> never break the UX (D-14).
    const db = context.env?.DB;
    if (!db) {
      return json({ ok: false, reason: 'no_db' }, 200);
    }

    const nowSec = Math.floor(nowMs / 1000);

    // (6) Per-country daily dedupe: same salted voter hash within the window is rejected
    // WITHOUT inserting a new row.
    const dedupeWindowStart = nowSec - DEDUPE_WINDOW_DAYS * 86400;
    const dedupeRow = await db
      .prepare('SELECT COUNT(*) AS n FROM votes WHERE iso3 = ? AND voter_hash = ? AND created_at > ?')
      .bind(iso3, voter_hash, dedupeWindowStart)
      .first();
    if ((dedupeRow?.n ?? 0) >= 1) {
      return json({ ok: true, deduped: true }, 200);
    }

    // (7) Per-visitor daily volume cap.
    const dayWindowStart = nowSec - 86400;
    const dayRow = await db
      .prepare('SELECT COUNT(*) AS n FROM votes WHERE day_hash = ? AND created_at > ?')
      .bind(day_hash, dayWindowStart)
      .first();
    if ((dayRow?.n ?? 0) >= DAILY_PER_VISITOR_CAP) {
      return json({ ok: false, reason: 'rate' }, 429);
    }

    // (8) Single parameterized INSERT — never string-concatenate SQL (T-39-01).
    // officialScore must be a validated 1-10 number or null — never undefined, since D1
    // .bind() throws D1_TYPE_ERROR on undefined. INSERT OR IGNORE + the UNIQUE index on
    // (iso3, voter_hash) is the authoritative dedupe (WR-01); the step-6 SELECT above is
    // just a cheap pre-check that saves a write for the common case.
    const officialScore = normalizeOfficialScore(body.officialScore);
    const res = await db
      .prepare(
        'INSERT OR IGNORE INTO votes (iso3, delta, official_score, voter_hash, day_hash, created_at, country_iso) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(iso3, delta, officialScore ?? null, voter_hash, day_hash, nowSec, country)
      .run();
    if (res.meta?.changes === 0) {
      return json({ ok: true, deduped: true }, 200);
    }

    // (9)
    return json({ ok: true }, 200);
  } catch {
    // Any unexpected failure must never break the static site.
    return json({ ok: false }, 200);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
