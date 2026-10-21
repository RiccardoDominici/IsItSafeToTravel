// Mailing-list double opt-in confirmation (quick task 260711-daily-news-and-mailing-list).
// GET  /api/confirm?token=<64-hex> -> a page with a "Confirm subscription" POST button. A GET must
//      NOT mutate state: corporate antispam scanners open every link in an email, and from
//      2026-10-08 they confirmed 32 addresses that bots had typed into the signup form (the same
//      lesson as /api/unsubscribe on day one).
// POST /api/confirm?token=<64-hex> -> flips subscribers.status -> 'confirmed'.
// Always returns an inline noindex HTML page; never breaks the static site.
import { alreadyConfirmedHtml, confirmPromptHtml, confirmResultHtml, type Locale } from '../lib/newsletter-copy';

const TOKEN_RE = /^[a-f0-9]{64}$/;

function htmlResp(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}

async function lookup(context: any): Promise<{ db: any; token: string; row: any } | Response> {
  // The form posts back to the same URL, so the token always travels in the query string.
  const token = new URL(context.request.url).searchParams.get('token') || '';
  const db = context.env?.DB;
  if (!db || !TOKEN_RE.test(token)) return htmlResp(confirmResultHtml('en', false), 400);
  const row = await db.prepare('SELECT id, locale, status FROM subscribers WHERE confirm_token=?').bind(token).first();
  if (!row) return htmlResp(confirmResultHtml('en', false), 404);
  return { db, token, row };
}

export async function onRequestGet(context: any): Promise<Response> {
  try {
    const r = await lookup(context);
    if (r instanceof Response) return r;
    const locale = (r.row.locale as Locale) ?? 'en';
    // Already confirmed: say so instead of asking again.
    if (r.row.status === 'confirmed') return htmlResp(alreadyConfirmedHtml(locale), 200);
    const u = new URL(context.request.url);
    return htmlResp(confirmPromptHtml(locale, `${u.pathname}?token=${r.token}`), 200);
  } catch {
    return htmlResp(confirmResultHtml('en', false), 500);
  }
}

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const r = await lookup(context);
    if (r instanceof Response) return r;
    if (r.row.status !== 'confirmed') {
      await r.db
        .prepare("UPDATE subscribers SET status='confirmed', confirmed_at=? WHERE id=?")
        .bind(Math.floor(Date.now() / 1000), r.row.id)
        .run();
    }
    return htmlResp(confirmResultHtml((r.row.locale as Locale) ?? 'en', true), 200);
  } catch {
    return htmlResp(confirmResultHtml('en', false), 500);
  }
}
