// Mailing-list unsubscribe (quick task 260711-daily-news-and-mailing-list).
// GET and POST /api/unsubscribe?token=<64-hex>  ->  flips subscribers.status -> 'unsubscribed'.
// POST exists to honour RFC 8058 List-Unsubscribe-Post (Gmail/Yahoo one-click unsubscribe from
// the mail client, no page load / no confirmation click required). Always returns an inline
// noindex HTML page; never breaks the static site.
import { unsubResultHtml, type Locale } from '../lib/newsletter-copy';

const TOKEN_RE = /^[a-f0-9]{64}$/;

function htmlResp(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}

async function unsub(context: any): Promise<Response> {
  try {
    // One-click POST puts nothing useful in the body; the token always travels in the query string.
    const token = new URL(context.request.url).searchParams.get('token') || '';
    const db = context.env?.DB;
    if (!db || !TOKEN_RE.test(token)) return htmlResp(unsubResultHtml('en', false), 400);

    const row = await db.prepare('SELECT id, locale, status FROM subscribers WHERE unsub_token=?').bind(token).first();
    if (!row) return htmlResp(unsubResultHtml('en', false), 404);

    if (row.status !== 'unsubscribed') {
      await db
        .prepare("UPDATE subscribers SET status='unsubscribed', unsubscribed_at=? WHERE id=?")
        .bind(Math.floor(Date.now() / 1000), row.id)
        .run();
    }
    return htmlResp(unsubResultHtml((row.locale as Locale) ?? 'en', true), 200);
  } catch {
    return htmlResp(unsubResultHtml('en', false), 500);
  }
}

export const onRequestGet = (context: any) => unsub(context);
export const onRequestPost = (context: any) => unsub(context); // RFC 8058 List-Unsubscribe-Post
