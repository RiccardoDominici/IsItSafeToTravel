// Phase 39: Community Sentiment Score — vote ingestion endpoint.
// POST /api/vote  { iso3, delta, token? }
// Mirrors functions/api/feedback.ts (corsHeaders, try/catch shape, context.env?.X access),
// with one deliberate inversion: missing optional env (TURNSTILE_SECRET_KEY) must DEGRADE
// gracefully (skip verification, keep working) instead of 500ing — D-12/D-14.

// Claude's-discretion tunable thresholds (CONTEXT.md "Claude's Discretion").
const DEDUPE_WINDOW_DAYS = 7; // per-country weekly dedupe window (voter_hash)
const DAILY_PER_VISITOR_CAP = 30; // max votes/day per salted visitor hash (day_hash)
const MAX_BODY_BYTES = 1024; // reject oversized bodies before parsing/using fields
const FALLBACK_SALT = 'isitsafetotravel-vote-fallback-salt-v1'; // used only if VOTE_HASH_SALT secret is unset

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
    const weekBucket = Math.floor(nowMs / (7 * 864e5));
    const dayBucket = Math.floor(nowMs / 864e5);
    const voter_hash = await voterHash(salt, ip, `${iso3}:${weekBucket}`);
    const day_hash = await voterHash(salt, ip, `day:${dayBucket}`);

    // (5) Graceful degradation: no D1 binding attached -> never break the UX (D-14).
    const db = context.env?.DB;
    if (!db) {
      return json({ ok: false, reason: 'no_db' }, 200);
    }

    const nowSec = Math.floor(nowMs / 1000);

    // (6) Per-country weekly dedupe: same salted voter hash within the window is rejected
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
    // officialScore is never part of the POST contract ({iso3, delta, token?}), so it is
    // always explicitly nulled here; D1 .bind() throws D1_TYPE_ERROR on undefined.
    await db
      .prepare(
        'INSERT INTO votes (iso3, delta, official_score, voter_hash, day_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .bind(iso3, delta, body.officialScore ?? null, voter_hash, day_hash, nowSec)
      .run();

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
