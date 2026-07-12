// Mailing-list double opt-in confirmation (quick task 260711-daily-news-and-mailing-list).
// GET /api/confirm?token=<64-hex>  ->  flips subscribers.status 'pending' -> 'confirmed'.
// Always returns an inline noindex HTML page; never breaks the static site.
import { confirmResultHtml, type Locale } from '../lib/newsletter-copy';

const TOKEN_RE = /^[a-f0-9]{64}$/;

function htmlResp(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}

export async function onRequestGet(context: any) {
  try {
    const token = new URL(context.request.url).searchParams.get('token') || '';
    const db = context.env?.DB;
    if (!db || !TOKEN_RE.test(token)) return htmlResp(confirmResultHtml('en', false), 400);

    const row = await db.prepare('SELECT id, locale, status FROM subscribers WHERE confirm_token=?').bind(token).first();
    if (!row) return htmlResp(confirmResultHtml('en', false), 404);

    if (row.status !== 'confirmed') {
      await db
        .prepare("UPDATE subscribers SET status='confirmed', confirmed_at=? WHERE id=?")
        .bind(Math.floor(Date.now() / 1000), row.id)
        .run();
    }
    return htmlResp(confirmResultHtml((row.locale as Locale) ?? 'en', true), 200);
  } catch {
    return htmlResp(confirmResultHtml('en', false), 500);
  }
}
