// Mailing-list subscribe endpoint (quick task 260711-daily-news-and-mailing-list).
// POST /api/subscribe  { email, locale, source, website(honeypot) }  (JSON or form-encoded)
// Mirrors functions/api/vote.ts's guards (Content-Type, same-origin, body cap, salted-hash rate
// limit, graceful env degradation -> never 500 the static site) + feedback.ts's Resend call.
// Accepts BOTH application/json (JS fetch) and application/x-www-form-urlencoded (no-JS native
// form POST) so the widget works with JavaScript disabled.
import { sendEmail } from '../lib/email';
import {
  safeLocale, errorHtml, errorMessage, checkInboxHtml, alreadyConfirmedHtml, confirmEmailHtml,
  CONFIRM_SUBJECT, type Locale, type ErrorReason,
} from '../lib/newsletter-copy';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 2048;
const SIGNUP_CAP_PER_DAY = 5; // per salted IP hash
// GDPR consent-copy version (LEGAL-PRIVACY-ASSESSMENT.md §4 MUST #3). Bump whenever the consent
// microcopy or the privacy-policy newsletter section text changes.
const CONSENT_VERSION = 'v1-2026-07-11';
const FALLBACK_SALT = 'isitsafetotravel-vote-fallback-salt-v1'; // same as vote.ts

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

function htmlResp(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex', ...corsHeaders },
  });
}

/** Form submissions get an inline localized HTML page; JS fetch gets JSON. */
function respErr(isForm: boolean, locale: Locale, reason: ErrorReason, status: number): Response {
  return isForm ? htmlResp(errorHtml(locale, reason), status) : json({ ok: false, reason: errorMessage(locale, reason) }, status);
}

/** True when `origin` is absent, or matches `requestUrl`'s own origin. Copied from vote.ts. */
function isSameOriginOrAbsent(origin: string | null, requestUrl: string): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

/** SHA-256 hex digest of `salt:ip:scope` via Web Crypto. Copied from vote.ts — never store/log raw ip. */
async function voterHash(salt: string, ip: string, scope: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}:${scope}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function randomToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context: any) {
  try {
    const ct = context.request.headers.get('Content-Type') || '';
    const mediaType = ct.split(';')[0].trim().toLowerCase();
    const isForm = mediaType === 'application/x-www-form-urlencoded';
    const isJson = mediaType === 'application/json';
    if (!isForm && !isJson) return json({ ok: false, reason: 'unsupported_media_type' }, 415);
    if (!isSameOriginOrAbsent(context.request.headers.get('Origin'), context.request.url)) {
      return json({ ok: false, reason: 'origin_mismatch' }, 403);
    }

    const raw = await context.request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return isForm ? htmlResp(errorHtml('en', 'body_too_large'), 413) : json({ ok: false, reason: 'body_too_large' }, 413);
    }

    let f: Record<string, unknown> = {};
    if (isJson) {
      try {
        f = JSON.parse(raw);
      } catch {
        return json({ ok: false, reason: 'invalid_json' }, 400);
      }
    } else {
      const p = new URLSearchParams(raw);
      f = { email: p.get('email'), locale: p.get('locale'), source: p.get('source'), website: p.get('website') };
    }

    const locale = safeLocale(f.locale);

    // Honeypot: bots fill 'website'. Silently pretend success — no insert, no email sent.
    if (f.website) return isForm ? htmlResp(checkInboxHtml(locale), 200) : json({ ok: true }, 200);

    const email = String(f.email ?? '').trim().toLowerCase();
    const source = String(f.source ?? 'unknown').slice(0, 64);
    if (!EMAIL_RE.test(email) || email.length > 254) return respErr(isForm, locale, 'invalid_email', 400);

    // Rate limit via salted IP hash (never raw IP) — same shape as vote.ts.
    const ip = context.request.headers.get('CF-Connecting-IP') ?? '';
    const salt = context.env?.VOTE_HASH_SALT ?? FALLBACK_SALT;
    const ipHash = await voterHash(salt, ip, 'subscribe');
    // GDPR proof-of-consent field: coarse country only (ISO-2), never the raw IP.
    const country = context.request.cf?.country ?? context.request.headers.get('CF-IPCountry') ?? null;
    const nowSec = Math.floor(Date.now() / 1000);

    const db = context.env?.DB;
    if (!db) return respErr(isForm, locale, 'unavailable', 503); // graceful — no DB bound yet

    const rl = await db
      .prepare('SELECT COUNT(*) AS n FROM subscribers WHERE signup_ip_hash=? AND created_at>?')
      .bind(ipHash, nowSec - 86400)
      .first();
    if ((rl?.n ?? 0) >= SIGNUP_CAP_PER_DAY) return respErr(isForm, locale, 'rate', 429);

    // Resend key required to actually send the confirmation. Ship-before-secret: localized 503.
    const apiKey = context.env?.RESEND_API_KEY;
    if (!apiKey) return respErr(isForm, locale, 'unavailable', 503);

    const confirm_token = randomToken();
    const unsub_token = randomToken();

    // Upsert on email: a re-submission is treated as fresh consent (consent_at refreshed), but an
    // already-confirmed row is left untouched — re-subscribing does not require re-confirming.
    await db
      .prepare(
        `INSERT INTO subscribers (email, locale, source, status, confirm_token, unsub_token, signup_ip_hash, signup_country, consent_at, consent_version, created_at)
         VALUES (?,?,?,'pending',?,?,?,?,?,?,?)
         ON CONFLICT(email) DO UPDATE SET
           locale=excluded.locale, source=excluded.source, status='pending',
           confirm_token=excluded.confirm_token, unsub_token=excluded.unsub_token,
           signup_country=excluded.signup_country, consent_at=excluded.consent_at,
           consent_version=excluded.consent_version
         WHERE subscribers.status != 'confirmed'`,
      )
      .bind(email, locale, source, confirm_token, unsub_token, ipHash, country, nowSec, CONSENT_VERSION, nowSec)
      .run();

    // Re-read (covers the already-confirmed case where the UPDATE above was skipped by its WHERE).
    const row = await db.prepare('SELECT status, confirm_token, unsub_token FROM subscribers WHERE email=?').bind(email).first();
    if (row?.status === 'confirmed') {
      return isForm ? htmlResp(alreadyConfirmedHtml(locale), 200) : json({ ok: true, already: true }, 200);
    }

    const origin = new URL(context.request.url).origin;
    const confirmUrl = `${origin}/api/confirm?token=${row.confirm_token}`;
    const unsubUrl = `${origin}/api/unsubscribe?token=${row.unsub_token}`;
    try {
      await sendEmail(apiKey, {
        to: email,
        subject: CONFIRM_SUBJECT[locale] ?? CONFIRM_SUBJECT.en,
        html: confirmEmailHtml(locale, confirmUrl),
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
    } catch {
      return respErr(isForm, locale, 'unavailable', 503);
    }

    return isForm ? htmlResp(checkInboxHtml(locale), 200) : json({ ok: true }, 200);
  } catch {
    return json({ ok: false }, 200); // never break the static site
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
