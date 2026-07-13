// Mailing-list unsubscribe (quick task 260711-daily-news-and-mailing-list).
// GET  /api/unsubscribe?token=<64-hex> -> confirmation page with a POST button. A GET must
//      NOT mutate state: antispam link scanners fetch every URL in an email and were able to
//      unsubscribe people silently (happened on day one).
// POST /api/unsubscribe?token=<64-hex> -> flips subscribers.status -> 'unsubscribed'. Serves
//      both the confirmation form and RFC 8058 List-Unsubscribe-Post one-click (Gmail/Yahoo).
// Always returns an inline noindex HTML page; never breaks the static site.
import { unsubResultHtml, unsubConfirmHtml, type Locale } from '../lib/newsletter-copy';

const TOKEN_RE = /^[a-f0-9]{64}$/;

function htmlResp(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}

async function lookup(context: any): Promise<{ db: any; token: string; row: any } | Response> {
  // One-click POST puts nothing useful in the body; the token always travels in the query string.
  const token = new URL(context.request.url).searchParams.get('token') || '';
  const db = context.env?.DB;
  if (!db || !TOKEN_RE.test(token)) return htmlResp(unsubResultHtml('en', false), 400);
  const row = await db.prepare('SELECT id, locale, status FROM subscribers WHERE unsub_token=?').bind(token).first();
  if (!row) return htmlResp(unsubResultHtml('en', false), 404);
  return { db, token, row };
}

export async function onRequestGet(context: any): Promise<Response> {
  try {
    const r = await lookup(context);
    if (r instanceof Response) return r;
    const locale = (r.row.locale as Locale) ?? 'en';
    // Already unsubscribed: show the neutral "done" page instead of re-asking.
    if (r.row.status === 'unsubscribed') return htmlResp(unsubResultHtml(locale, true), 200);
    const u = new URL(context.request.url);
    return htmlResp(unsubConfirmHtml(locale, `${u.pathname}?token=${r.token}`), 200);
  } catch {
    return htmlResp(unsubResultHtml('en', false), 500);
  }
}

export async function onRequestPost(context: any): Promise<Response> {
  try {
    const r = await lookup(context);
    if (r instanceof Response) return r;
    if (r.row.status !== 'unsubscribed') {
      await r.db
        .prepare("UPDATE subscribers SET status='unsubscribed', unsubscribed_at=? WHERE id=?")
        .bind(Math.floor(Date.now() / 1000), r.row.id)
        .run();
    }
    return htmlResp(unsubResultHtml((r.row.locale as Locale) ?? 'en', true), 200);
  } catch {
    return htmlResp(unsubResultHtml('en', false), 500);
  }
}
