// Feedback endpoint (POST /api/feedback) — forwards the contact form to the
// site owner's mailbox via Resend.
//
// Hardened after a security review found it acting as an OPEN RELAY: it was
// the only POST endpoint without the vote.ts/subscribe.ts guard set, so any
// third-party site could POST here and spam unlimited email through our
// Resend account. It now mirrors those endpoints:
//   1. Content-Type must be application/json
//   2. same-origin check on Origin (absent Origin = curl/no-cors, allowed)
//   3. body-size cap before parsing
//   4. field validation + type allowlist (subject never contains raw input)
//   5. rate limit — D1-backed daily cap per salted IP hash when the DB binding
//      exists, in-memory sliding window as graceful fallback otherwise
//      (migration: db/migrations/004-feedback-rate-limit.sql)
//   6. generic error bodies only — internals (missing secret names, Resend
//      error bodies) go to server logs, never to the client (the UI only
//      branches on res.ok).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 2048;
const FEEDBACK_CAP_PER_DAY = 5; // per salted IP hash, rolling 24h
const RATE_WINDOW_SEC = 86_400;
const FALLBACK_SALT = 'isitsafetotravel-vote-fallback-salt-v1'; // same constant as vote/subscribe

const TYPE_LABELS: Record<string, string> = {
  suggestion: 'Suggestion',
  bug: 'Bug Report',
  data: 'Data Issue',
  compliment: 'Compliment',
  other: 'Other',
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/** Minimal structural typing for the D1 subset we use (keeps this file standalone). */
interface FeedbackD1 {
  prepare(query: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

interface Env {
  RESEND_API_KEY?: string;
  FEEDBACK_EMAIL?: string;
  VOTE_HASH_SALT?: string;
  DB?: FeedbackD1;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Same-origin guard copied from vote.ts / subscribe.ts. */
function isSameOriginOrAbsent(origin: string | null, requestUrl: string): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/** SHA-256 hex digest of `salt:ip:scope` via Web Crypto — never store/log raw IPs. */
async function ipHash(salt: string, ip: string, scope: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}:${scope}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Strip control characters and line breaks from free-text fields destined for
 * the email SUBJECT header (Resend takes JSON, so this is hygiene rather than
 * SMTP injection defense — but a clean single-line subject is still enforced).
 */
function sanitizeHeaderValue(value: unknown, maxLen: number): string {
  return String(value ?? '').replace(/[\r\n\x00-\x1f\x7f]/g, ' ').trim().slice(0, maxLen);
}

// --- In-memory fallback rate limiter (per-isolate; best-effort when no DB) ---
const memoryHits = new Map<string, number[]>();

function memoryRateLimit(key: string, nowMs: number): boolean {
  const windowStart = nowMs - RATE_WINDOW_SEC * 1000;
  const hits = (memoryHits.get(key) ?? []).filter((t) => t > windowStart);
  if (hits.length >= FEEDBACK_CAP_PER_DAY) {
    memoryHits.set(key, hits);
    return false;
  }
  hits.push(nowMs);
  memoryHits.set(key, hits);
  // Keep the map bounded: drop keys with no recent hits once it grows.
  if (memoryHits.size > 10_000) {
    for (const [k, ts] of memoryHits) {
      if (ts.every((t) => t <= windowStart)) memoryHits.delete(k);
    }
  }
  return true;
}

/** D1-backed rate limit; false = over cap, null = DB unusable (fall back to memory). */
async function d1RateLimit(
  db: FeedbackD1,
  hash: string,
  country: string | null,
  nowSec: number,
): Promise<boolean | null> {
  try {
    // Housekeeping first: rows older than 7 days are dead weight.
    await db.prepare('DELETE FROM feedback_log WHERE created_at < ?').bind(nowSec - 7 * RATE_WINDOW_SEC).run();

    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM feedback_log WHERE ip_hash=? AND created_at>?')
      .bind(hash, nowSec - RATE_WINDOW_SEC)
      .first<{ n: number }>();
    if ((row?.n ?? 0) >= FEEDBACK_CAP_PER_DAY) return false;

    await db.prepare('INSERT INTO feedback_log (ip_hash, created_at, country) VALUES (?,?,?)').bind(hash, nowSec, country).run();
    return true;
  } catch (err) {
    console.error('[feedback] D1 rate-limit unavailable, falling back to memory:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  try {
    // (1) Content-Type + same-origin guards — closes the cross-site relay.
    const ct = context.request.headers.get('Content-Type') || '';
    if (ct.split(';')[0].trim().toLowerCase() !== 'application/json') {
      return json({ ok: false, reason: 'unsupported_media_type' }, 415);
    }
    if (!isSameOriginOrAbsent(context.request.headers.get('Origin'), context.request.url)) {
      return json({ ok: false, reason: 'origin_mismatch' }, 403);
    }

    // (2) Body-size cap before parsing/trusting anything.
    const rawBody = await context.request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) {
      return json({ ok: false, reason: 'body_too_large' }, 413);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return json({ ok: false, reason: 'invalid_json' }, 400);
    }

    // (3) Field validation. Unknown type falls back to the 'Other' LABEL
    // (allowlisted) — subject lines contain whitelisted text only.
    const name = sanitizeHeaderValue(body.name, 200);
    const email = String(body.email ?? '').trim().toLowerCase().slice(0, 254);
    const message = String(body.message ?? '').slice(0, 5000);
    const typeLabel = TYPE_LABELS[String(body.type ?? '')] ?? TYPE_LABELS.other;

    if (!name || !EMAIL_RE.test(email) || !message.trim()) {
      return json({ ok: false, reason: 'invalid_input' }, 400);
    }

    // Server-side detail only — the old build leaked WHICH secrets were missing.
    const apiKey = context.env?.RESEND_API_KEY;
    const recipientEmail = context.env?.FEEDBACK_EMAIL;
    if (!apiKey || !recipientEmail) {
      console.error('[feedback] misconfigured: missing RESEND_API_KEY and/or FEEDBACK_EMAIL');
      return json({ ok: false, reason: 'server_error' }, 500);
    }

    // (4) Rate limit per salted IP hash (never raw IP). D1 preferred, memory fallback.
    const ip = context.request.headers.get('CF-Connecting-IP') ?? '';
    const salt = context.env?.VOTE_HASH_SALT || FALLBACK_SALT;
    const hash = await ipHash(salt, ip, 'feedback');
    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const cf = (context.request as Request & { cf?: { country?: string } }).cf;
    const country = cf?.country ?? null;

    let allowed: boolean | null = context.env?.DB
      ? await d1RateLimit(context.env.DB, hash, country, nowSec)
      : null;
    if (allowed === null) allowed = memoryRateLimit(hash, nowMs);
    if (!allowed) return json({ ok: false, reason: 'rate_limited' }, 429);

    // (5) Send. Internal failures are logged server-side, reported generically.
    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #c96b4f; padding-bottom: 10px;">
          New Feedback from IsItSafeToTravel
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; color: #555; width: 120px;">Name</td>
            <td style="padding: 8px 12px; color: #1a1a1a;">${escapeHtml(name)}</td>
          </tr>
          <tr style="background: #f9f6f3;">
            <td style="padding: 8px 12px; font-weight: 600; color: #555;">Email</td>
            <td style="padding: 8px 12px; color: #1a1a1a;">
              <a href="mailto:${escapeHtml(email)}" style="color: #c96b4f;">${escapeHtml(email)}</a>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: 600; color: #555;">Type</td>
            <td style="padding: 8px 12px; color: #1a1a1a;">${escapeHtml(typeLabel)}</td>
          </tr>
        </table>
        <div style="margin-top: 20px; padding: 16px; background: #f9f6f3; border-radius: 8px; border-left: 4px solid #c96b4f;">
          <p style="margin: 0; color: #555; font-weight: 600; font-size: 14px;">Message</p>
          <p style="margin: 8px 0 0; color: #1a1a1a; white-space: pre-wrap; line-height: 1.6;">${escapeHtml(message)}</p>
        </div>
        <p style="margin-top: 24px; color: #999; font-size: 12px;">
          Sent via IsItSafeToTravel feedback form &middot; ${new Date().toISOString()}
        </p>
      </div>
    `;

    let res: Response;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'IsItSafeToTravel <feedback@isitsafetotravel.org>',
          to: [recipientEmail],
          reply_to: email,
          subject: `[Feedback] ${typeLabel} from ${name}`,
          html: htmlContent,
        }),
      });
    } catch (err) {
      console.error('[feedback] Resend fetch threw:', err instanceof Error ? err.message : err);
      return json({ ok: false, reason: 'server_error' }, 502);
    }

    if (!res.ok) {
      // Log the upstream body server-side only — never echo it back (info leak).
      const errorText = await res.text().catch(() => '');
      console.error(`[feedback] Resend responded ${res.status}: ${errorText.slice(0, 500)}`);
      return json({ ok: false, reason: 'server_error' }, 502);
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error('[feedback] unhandled error:', err instanceof Error ? err.message : err);
    return json({ ok: false, reason: 'server_error' }, 500);
  }
}

export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}
