// Cookie-consent telemetry endpoint — aggregate accept/reject counts only.
// POST /api/consent  { choice: 'granted' | 'denied', nonce?, lang? }
// Fired (fire-and-forget) by CookieBanner.astro on Accept/Reject clicks so the
// daily pipeline can report the accept rate — the only way to estimate real
// traffic once Clarity is consent-gated. Mirrors functions/api/vote.ts (guards,
// graceful degradation, salted hashes — never raw IP); one row per visitor per
// UTC day, a same-day re-choice replaces the earlier one. The client nonce
// (random, stored inside the localStorage consent record) keeps visitors that
// share an egress IP (iCloud Private Relay, CGNAT) from collapsing into one row.

import { FALLBACK_SALT, isJsonContentType, isSameOriginOrAbsent, voterHash } from './vote';

const MAX_BODY_BYTES = 512;
const VALID_CHOICES = new Set(['granted', 'denied']);
const VALID_LANGS = new Set(['en', 'it', 'es', 'fr', 'pt', 'zh', 'de']);

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

/** True only for the two banner outcomes: 'granted' | 'denied'. */
export function isValidChoice(x: unknown): x is 'granted' | 'denied' {
  return typeof x === 'string' && VALID_CHOICES.has(x);
}

/** Known UI locale or null — never undefined (D1 .bind() throws on undefined). */
export function normalizeLang(x: unknown): string | null {
  return typeof x === 'string' && VALID_LANGS.has(x) ? x : null;
}

/**
 * Client nonce sanitized to [a-z0-9]{1,40}, or '' for anything else. Empty means
 * the visitor's storage was unavailable — hashing degrades to IP-only bucketing.
 */
export function normalizeNonce(x: unknown): string {
  return typeof x === 'string' && /^[a-z0-9]{1,40}$/i.test(x) ? x : '';
}

export async function onRequestPost(context: any) {
  try {
    if (!isJsonContentType(context.request.headers.get('Content-Type'))) {
      return json({ ok: false, reason: 'unsupported_media_type' }, 415);
    }
    if (!isSameOriginOrAbsent(context.request.headers.get('Origin'), context.request.url)) {
      return json({ ok: false, reason: 'origin_mismatch' }, 403);
    }

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

    if (!isValidChoice(body?.choice)) {
      return json({ ok: false, reason: 'invalid_input' }, 400);
    }
    const choice: string = body.choice;
    const lang = normalizeLang(body?.lang);
    const nonce = normalizeNonce(body?.nonce);

    // Salted daily hash — 'consent:' scope keeps it unlinkable to vote hashes;
    // the client nonce disambiguates visitors behind a shared egress IP.
    const ip = context.request.headers.get('CF-Connecting-IP') ?? '';
    const salt = context.env?.VOTE_HASH_SALT ?? FALLBACK_SALT;
    const nowMs = Date.now();
    const dayBucket = Math.floor(nowMs / 864e5);
    const day_hash = await voterHash(salt, ip, `consent:${nonce}:${dayBucket}`);
    const country = context.request.cf?.country ?? context.request.headers.get('CF-IPCountry') ?? null;

    // Graceful degradation: no D1 binding -> never break the static site.
    const db = context.env?.DB;
    if (!db) {
      return json({ ok: false, reason: 'no_db' }, 200);
    }

    // INSERT OR REPLACE + UNIQUE(day_hash): one row per visitor per UTC day,
    // latest choice wins (footer reopen -> re-choice updates, no double count).
    await db
      .prepare(
        'INSERT OR REPLACE INTO consent_log (choice, day_hash, country_iso, lang, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(choice, day_hash, country, lang, Math.floor(nowMs / 1000))
      .run();

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
