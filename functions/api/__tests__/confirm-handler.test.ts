// /api/confirm: opening the link must never confirm (antispam scanners open every link in an
// email); only the POST from the page's button does. Regression test for 2026-10-21, when 32
// bot-entered addresses had been confirmed by corporate link scanners.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet, onRequestPost } from '../confirm';

const TOKEN = 'a'.repeat(64);
const URL_WITH_TOKEN = `https://isitsafetotravel.org/api/confirm?token=${TOKEN}`;

/** Minimal D1 stand-in: one subscriber row, and a log of every UPDATE that ran. */
function fakeDb(row: { id: number; locale: string; status: string } | null) {
  const updates: unknown[][] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            first: async () => (sql.startsWith('SELECT') && args[0] === TOKEN ? row : null),
            run: async () => {
              if (sql.startsWith('UPDATE')) updates.push(args);
              return { success: true };
            },
          };
        },
      };
    },
  };
  return { db, updates };
}

function ctx(db: unknown, url = URL_WITH_TOKEN, method = 'GET') {
  return { request: new Request(url, { method }), env: { DB: db } };
}

describe('/api/confirm', () => {
  it('GET on a pending address shows a POST button and changes nothing', async () => {
    const { db, updates } = fakeDb({ id: 7, locale: 'it', status: 'pending' });
    const res = await onRequestGet(ctx(db));
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /<form method="POST" action="\/api\/confirm\?token=a{64}"/);
    assert.match(html, /Conferma iscrizione/);
    assert.equal(updates.length, 0);
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex');
  });

  it('GET on an already confirmed address says so, without a button', async () => {
    const { db, updates } = fakeDb({ id: 7, locale: 'en', status: 'confirmed' });
    const html = await (await onRequestGet(ctx(db))).text();
    assert.match(html, /already subscribed/);
    assert.doesNotMatch(html, /<form/);
    assert.equal(updates.length, 0);
  });

  it('POST from the button confirms the address', async () => {
    const { db, updates } = fakeDb({ id: 7, locale: 'en', status: 'pending' });
    const res = await onRequestPost(ctx(db, URL_WITH_TOKEN, 'POST'));
    assert.equal(res.status, 200);
    // escapeHtml turns the apostrophe into &#039;.
    assert.match(await res.text(), /You&#039;re subscribed/);
    assert.equal(updates.length, 1);
    assert.equal(updates[0][1], 7);
  });

  it('POST on an already confirmed address does not write again', async () => {
    const { db, updates } = fakeDb({ id: 7, locale: 'en', status: 'confirmed' });
    assert.equal((await onRequestPost(ctx(db, URL_WITH_TOKEN, 'POST'))).status, 200);
    assert.equal(updates.length, 0);
  });

  it('rejects malformed and unknown tokens on both methods', async () => {
    const { db, updates } = fakeDb(null);
    assert.equal((await onRequestGet(ctx(db, 'https://isitsafetotravel.org/api/confirm?token=xyz'))).status, 400);
    assert.equal((await onRequestGet(ctx(db))).status, 404);
    assert.equal((await onRequestPost(ctx(db, URL_WITH_TOKEN, 'POST'))).status, 404);
    assert.equal(updates.length, 0);
  });
});
