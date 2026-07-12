---
quick_id: 260711-daily-news-and-mailing-list
slug: mailing-list-and-vote-geolocation
date: 2026-07-11
status: planned
owner: Opus planner (mailing-list + vote-geo track)
depends_on: news-events track (produces data/news/YYYY-MM-DD.json + optional per-locale renderer)
---

# PLAN — Mailing list (double opt-in daily digest) + Vote geolocation

## Objective

1. **Mailing list**: visitors subscribe from any country page and from the news page; a
   **double opt-in** confirmation email is sent; a **daily digest** goes to all confirmed
   subscribers **in their captured locale** on days that have ≥1 news event (from the news
   track). GDPR-clean: consent proof stored, no raw IP, one-click unsubscribe on every email.
2. **Vote geolocation**: the community-vote Function starts recording the voter's
   **country only** (Cloudflare `request.cf.country` / `CF-IPCountry`) — no new PII.

Ships **before** the Resend GH-secret exists: every path degrades gracefully when a secret is
missing (subscribe → localized 503; digest → skip with log). Zero new indexable pages, so
`npm run validate:seo` stays all-pass without extra work.

---

## Key decisions (do not relitigate)

- **D1: REUSE the existing sentiment DB.** Binding `DB`, database `isitsafetotravel-sentiment`,
  id `83acaffe-32ff-43fc-b68f-5343d01000d5` (`wrangler.toml:6-9`). One binding, one ops surface,
  the digest's GH-Actions D1 access is already wired (workflow ntfy step queries this exact DB
  id via the HTTP API with `CLOUDFLARE_D1_TOKEN`→`CLOUDFLARE_API_TOKEN` fallback). No new
  `[[d1_databases]]` block, no `wrangler.toml` change.
- **Resend domain is already verified.** `functions/api/feedback.ts` already sends from
  `feedback@isitsafetotravel.org` via Resend, so `isitsafetotravel.org` is verified in Resend
  and `RESEND_API_KEY` **already exists as a Pages env secret**. New sender `updates@isitsafetotravel.org`
  needs no extra DNS (same verified domain). The ONLY new secret action is adding `RESEND_API_KEY`
  as a **GitHub Actions** secret for the digest script.
- **Email adapter is fetch-only** (global `fetch`, available in both the Workers edge runtime and
  Node 22), so one module serves both the Function and the tsx digest script. It takes the API key
  as an argument — stays pure, no runtime coupling.
- **Rate-limit reuses the vote privacy model**: salted SHA-256 of the IP (never raw IP), same
  `VOTE_HASH_SALT` secret and `voterHash()` shape as `functions/api/vote.ts`.
- **Subscribe/confirm/unsubscribe are `/api/*` Functions, not localized Astro pages** — no
  hreflang/sitemap entries, no `src/i18n/ui.ts routes` additions. Locale travels in the row and in
  hidden form fields. Confirm/unsub responses are inline `noindex` HTML.
- **No-JS works**: the subscribe Function accepts BOTH `application/json` (JS fetch) and
  `application/x-www-form-urlencoded` (native form POST) and answers the latter with an inline
  localized HTML "check your inbox" page — no new static route needed.

---

## Interface contract with the NEWS track (coordinate — single source of truth)

The digest **consumes** one file per day and (optionally) one renderer. Agree these two shapes
with the news planner; the digest has a built-in fallback renderer so it works even if the news
renderer is not ready.

**1. `data/news/YYYY-MM-DD.json`** (news track writes it; pipeline commits it):
```jsonc
{
  "date": "2026-07-11",
  "generatedAt": "2026-07-11T06:12:00Z",
  "events": [
    {
      "type": "overtake" | "big_jump" | "big_drop" | "new_severe_advisory" | "new_country" | "band_change",
      "iso3": "FRA",
      "slug": "fra",                              // == iso3.toLowerCase(); used to build country URL
      "countryName": { "en": "France", "it": "Francia", "es": "...", "fr": "...", "pt": "...", "zh": "...", "de": "..." },
      "headline":   { "en": "France overtakes Spain", "it": "..." },   // per-locale, pre-rendered plain text
      "detail":     { "en": "France's score rose to 7.2 (+0.4)...", "it": "..." },
      "score": 7.2, "prevScore": 6.8, "delta": 0.4
    }
  ]
}
```
Digest reads only: `events[].type`, `slug`, `countryName[lang]`, `headline[lang]`, `detail[lang]`.
If `events` is empty or the file is absent → **skip send** (see Digest §4).

**2. Optional shared renderer** `src/lib/news-digest.ts` (news track owns; digest imports if present):
```ts
export function renderDigestHtml(events: NewsEvent[], lang: Lang, unsubUrl: string): string
export function digestSubject(events: NewsEvent[], lang: Lang): string
```
If this module does not exist yet, the digest script uses its **built-in fallback renderer**
(§4b) that produces a clean, on-brand list from `headline`/`detail`/`slug`. Executor: try the
import; on failure, fall back. Do NOT block on the news track.

---

## File-by-file plan

### A. D1 migrations (new directory `db/migrations/`)

Convention: `db/migrations/NNN-slug.sql`, applied **manually to the remote DB once**, in order,
tracked by hand (mirrors how `db/sentiment-schema.sql` is applied — see its header comment). Each
uses `IF NOT EXISTS` where SQLite allows it. `ALTER TABLE ADD COLUMN` cannot be `IF NOT EXISTS`;
that migration is one-shot (documented).

#### `db/migrations/001-subscribers.sql`
```sql
-- Mailing list (260711). Applied once to remote:
--   npx wrangler d1 execute isitsafetotravel-sentiment --remote --file=db/migrations/001-subscribers.sql
-- Idempotent (IF NOT EXISTS everywhere). Reuses the sentiment DB (binding DB).

CREATE TABLE IF NOT EXISTS subscribers (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT    NOT NULL,              -- stored lowercased+trimmed
  locale         TEXT    NOT NULL,              -- en|it|es|fr|pt|zh|de (captured at signup)
  source         TEXT,                          -- country slug (e.g. 'fra') or 'news-page'
  followed_iso3  TEXT,                          -- optional country follow (nullable, unused v1 but reserved)
  status         TEXT    NOT NULL DEFAULT 'pending',   -- pending | confirmed | unsubscribed
  confirm_token  TEXT    NOT NULL,              -- 32-byte crypto-random hex
  unsub_token    TEXT    NOT NULL,              -- 32-byte crypto-random hex
  signup_ip_hash TEXT,                          -- SHA-256(salt:ip:'subscribe') — rate-limit only, NEVER raw IP
  signup_country TEXT,                          -- CF request.cf.country (2-letter) — GDPR proof, coarse, no IP
  consent_at     INTEGER NOT NULL,              -- unix epoch s; explicit consent timestamp (GDPR proof)
  consent_version TEXT   NOT NULL,              -- consent-copy version, e.g. 'v1'
  created_at     INTEGER NOT NULL,
  confirmed_at   INTEGER,
  unsubscribed_at INTEGER
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_email       ON subscribers (email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_confirm_tok ON subscribers (confirm_token);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sub_unsub_tok   ON subscribers (unsub_token);
CREATE INDEX        IF NOT EXISTS idx_sub_status_loc  ON subscribers (status, locale);   -- digest fetch
CREATE INDEX        IF NOT EXISTS idx_sub_iphash      ON subscribers (signup_ip_hash, created_at); -- rate limit

-- Digest idempotency ledger: one row per day actually sent.
CREATE TABLE IF NOT EXISTS digest_log (
  send_date   TEXT PRIMARY KEY,   -- 'YYYY-MM-DD'
  sent_at     INTEGER NOT NULL,
  recipients  INTEGER NOT NULL,
  events      INTEGER NOT NULL
);
```

#### `db/migrations/002-votes-country-iso.sql`
```sql
-- Vote geolocation (260711). Applied once to remote:
--   npx wrangler d1 execute isitsafetotravel-sentiment --remote --file=db/migrations/002-votes-country-iso.sql
-- NOTE: ALTER TABLE ADD COLUMN is NOT idempotent in SQLite. Run exactly once. If re-run it errors
-- 'duplicate column name: country_iso' — that error is safe to ignore (means it's already applied).
ALTER TABLE votes ADD COLUMN country_iso TEXT;   -- CF request.cf.country (2-letter ISO), nullable. No IP.
```
> Executor: to re-run safely you may pre-check with
> `npx wrangler d1 execute isitsafetotravel-sentiment --remote --json --command "PRAGMA table_info(votes)"`
> and skip if `country_iso` is present.

---

### B. Email adapter — `functions/lib/email.ts` (NEW)

Pure, fetch-only, key-as-argument. Imported by `functions/api/subscribe.ts` (edge) and by
`scripts/send-daily-digest.ts` (Node/tsx).

```ts
// functions/lib/email.ts — Resend adapter (fetch-only; runs on Workers edge AND Node 22).
export interface EmailMessage {
  from?: string;                       // default 'IsItSafeToTravel <updates@isitsafetotravel.org>'
  to: string;
  subject: string;
  html: string;
  headers?: Record<string, string>;    // e.g. List-Unsubscribe, List-Unsubscribe-Post
}
const DEFAULT_FROM = 'IsItSafeToTravel <updates@isitsafetotravel.org>';

/** Send one email. Throws on non-2xx so callers can decide (Function → 503, script → log+count). */
export async function sendEmail(apiKey: string, m: EmailMessage): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: m.from ?? DEFAULT_FROM, to: [m.to], subject: m.subject, html: m.html, headers: m.headers }),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
}

/** Batch send (Resend /emails/batch, max 100/call). Caller chunks. Returns sent count. */
export async function sendBatch(apiKey: string, msgs: EmailMessage[]): Promise<number> {
  if (msgs.length === 0) return 0;
  const payload = msgs.map((m) => ({ from: m.from ?? DEFAULT_FROM, to: [m.to], subject: m.subject, html: m.html, headers: m.headers }));
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`resend batch ${res.status}: ${await res.text()}`);
  return msgs.length;
}
```
> `functions/lib/` is imported by Functions via relative path (`../lib/email`) and by the script via
> `../functions/lib/email` — tsx resolves the `.ts` directly.

---

### C. Subscribe Function — `functions/api/subscribe.ts` (NEW)

Mirrors `vote.ts` guards (Content-Type, same-origin, body cap, salted-hash rate limit, graceful
env degradation) + `feedback.ts` Resend call. Accepts JSON (fetch) and form-encoded (no-JS).

```ts
// POST /api/subscribe  { email, locale, source, website(honeypot) }  (JSON or form-encoded)
import { sendEmail } from '../lib/email';

const LOCALES = new Set(['en','it','es','fr','pt','zh','de']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY_BYTES = 2048;
const SIGNUP_CAP_PER_DAY = 5;                 // per salted IP hash
const CONSENT_VERSION = 'v1';
const FALLBACK_SALT = 'isitsafetotravel-vote-fallback-salt-v1';   // same as vote.ts

// -- helpers: json(), isSameOriginOrAbsent(), voterHash() — COPY verbatim from vote.ts.
// -- randomToken(): 32 crypto-random bytes as hex (Web Crypto, works edge+node):
function randomToken(): string {
  const b = new Uint8Array(32); crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function onRequestPost(context: any) {
  try {
    const ct = context.request.headers.get('Content-Type') || '';
    const isForm = ct.split(';')[0].trim().toLowerCase() === 'application/x-www-form-urlencoded';
    const isJson = ct.split(';')[0].trim().toLowerCase() === 'application/json';
    if (!isForm && !isJson) return json({ ok:false, reason:'unsupported_media_type' }, 415);
    if (!isSameOriginOrAbsent(context.request.headers.get('Origin'), context.request.url))
      return json({ ok:false, reason:'origin_mismatch' }, 403);

    const raw = await context.request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ ok:false, reason:'body_too_large' }, 413);

    // Parse both shapes into { email, locale, source, website }
    let f: any = {};
    if (isJson) { try { f = JSON.parse(raw); } catch { return json({ ok:false, reason:'invalid_json' }, 400); } }
    else { const p = new URLSearchParams(raw); f = { email:p.get('email'), locale:p.get('locale'), source:p.get('source'), website:p.get('website') }; }

    // Honeypot: bots fill 'website'. Silently pretend success (no insert, no email).
    if (f.website) return isForm ? htmlResp(checkInboxHtml(safeLocale(f.locale)), 200) : json({ ok:true }, 200);

    const email = String(f.email ?? '').trim().toLowerCase();
    const locale = safeLocale(f.locale);
    const source = String(f.source ?? 'unknown').slice(0, 64);
    if (!EMAIL_RE.test(email) || email.length > 254) return respErr(isForm, locale, 'invalid_email', 400);

    // Rate limit via salted IP hash (never raw IP) — same shape as vote.ts.
    const ip = context.request.headers.get('CF-Connecting-IP') ?? '';
    const salt = context.env?.VOTE_HASH_SALT ?? FALLBACK_SALT;
    const ipHash = await voterHash(salt, ip, 'subscribe');
    const country = (context.request.cf?.country ?? context.request.headers.get('CF-IPCountry') ?? null);
    const nowSec = Math.floor(Date.now()/1000);

    const db = context.env?.DB;
    if (!db) return respErr(isForm, locale, 'unavailable', 503);   // graceful — no DB yet

    const rl = await db.prepare('SELECT COUNT(*) AS n FROM subscribers WHERE signup_ip_hash=? AND created_at>?')
      .bind(ipHash, nowSec - 86400).first();
    if ((rl?.n ?? 0) >= SIGNUP_CAP_PER_DAY) return respErr(isForm, locale, 'rate', 429);

    // Resend key required to actually confirm. Ship-before-secret: localized 503.
    const apiKey = context.env?.RESEND_API_KEY;
    if (!apiKey) return respErr(isForm, locale, 'unavailable', 503);

    const confirm_token = randomToken();
    const unsub_token = randomToken();

    // Upsert on email: re-subscribe / re-confirm resets to pending with fresh tokens.
    // (Do NOT resurrect an unsubscribed row silently without re-consent — we DO here, because the
    //  user is actively re-submitting the form = fresh consent. consent_at is refreshed.)
    await db.prepare(`
      INSERT INTO subscribers (email, locale, source, status, confirm_token, unsub_token, signup_ip_hash, signup_country, consent_at, consent_version, created_at)
      VALUES (?,?,?,'pending',?,?,?,?,?,?,?)
      ON CONFLICT(email) DO UPDATE SET
        locale=excluded.locale, source=excluded.source, status='pending',
        confirm_token=excluded.confirm_token, unsub_token=excluded.unsub_token,
        signup_country=excluded.signup_country, consent_at=excluded.consent_at,
        consent_version=excluded.consent_version
      WHERE subscribers.status != 'confirmed'`)   // already-confirmed stays confirmed; re-send handled below
      .bind(email, locale, source, confirm_token, unsub_token, ipHash, country, nowSec, CONSENT_VERSION, nowSec)
      .run();

    // Re-read the token to email (covers the already-confirmed case where UPDATE was skipped).
    const row = await db.prepare('SELECT status, confirm_token, unsub_token FROM subscribers WHERE email=?').bind(email).first();
    if (row?.status === 'confirmed') return isForm ? htmlResp(alreadyConfirmedHtml(locale), 200) : json({ ok:true, already:true }, 200);

    const origin = new URL(context.request.url).origin;
    const confirmUrl = `${origin}/api/confirm?token=${row.confirm_token}`;
    const unsubUrl   = `${origin}/api/unsubscribe?token=${row.unsub_token}`;
    try {
      await sendEmail(apiKey, {
        to: email,
        subject: CONFIRM_SUBJECT[locale] ?? CONFIRM_SUBJECT.en,
        html: confirmEmailHtml(locale, confirmUrl),
        headers: { 'List-Unsubscribe': `<${unsubUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      });
    } catch { return respErr(isForm, locale, 'unavailable', 503); }

    return isForm ? htmlResp(checkInboxHtml(locale), 200) : json({ ok:true }, 200);
  } catch { return json({ ok:false }, 200); }   // never break the static site
}
export async function onRequestOptions() { return new Response(null, { status:204, headers: corsHeaders }); }
```
Helper stubs the executor writes in the same file: `safeLocale()` (validate ∈ LOCALES else 'en'),
`respErr(isForm, locale, reason, status)` (form→inline localized HTML page, else JSON),
`htmlResp(html, status)` (text/html + `X-Robots-Tag: noindex`), and the HTML/copy builders
(`checkInboxHtml`, `alreadyConfirmedHtml`, `confirmEmailHtml`, `CONFIRM_SUBJECT`) — copy in §E.

### D. Confirm & Unsubscribe Functions

#### `functions/api/confirm.ts` (NEW) — GET `?token=`
```ts
export async function onRequestGet(context: any) {
  try {
    const token = new URL(context.request.url).searchParams.get('token') || '';
    const db = context.env?.DB;
    if (!db || !/^[a-f0-9]{64}$/.test(token)) return htmlResp(confirmResultHtml('en', false), 400);
    const row = await db.prepare('SELECT id, locale, status FROM subscribers WHERE confirm_token=?').bind(token).first();
    if (!row) return htmlResp(confirmResultHtml('en', false), 404);
    if (row.status !== 'confirmed')
      await db.prepare("UPDATE subscribers SET status='confirmed', confirmed_at=? WHERE id=?")
        .bind(Math.floor(Date.now()/1000), row.id).run();
    return htmlResp(confirmResultHtml(row.locale, true), 200);   // localized success page
  } catch { return htmlResp(confirmResultHtml('en', false), 500); }
}
```

#### `functions/api/unsubscribe.ts` (NEW) — GET `?token=` **and** POST (RFC 8058 one-click)
```ts
async function unsub(context: any): Promise<Response> {
  const url = new URL(context.request.url);
  // one-click POST puts nothing useful in body; token is always in the query string.
  const token = url.searchParams.get('token') || '';
  const db = context.env?.DB;
  if (!db || !/^[a-f0-9]{64}$/.test(token)) return htmlResp(unsubResultHtml('en', false), 400);
  const row = await db.prepare('SELECT id, locale, status FROM subscribers WHERE unsub_token=?').bind(token).first();
  if (!row) return htmlResp(unsubResultHtml('en', false), 404);
  if (row.status !== 'unsubscribed')
    await db.prepare("UPDATE subscribers SET status='unsubscribed', unsubscribed_at=? WHERE id=?")
      .bind(Math.floor(Date.now()/1000), row.id).run();
  return htmlResp(unsubResultHtml(row.locale, true), 200);
}
export const onRequestGet  = (c: any) => unsub(c);
export const onRequestPost = (c: any) => unsub(c);   // RFC 8058 List-Unsubscribe-Post
```
> `htmlResp` / result-HTML builders are shared copy in §E. Put shared inline-HTML + copy helpers in
> `functions/lib/newsletter-copy.ts` (NEW) and import into subscribe/confirm/unsubscribe to avoid
> duplication. All responses set `X-Robots-Tag: noindex`.

---

### E. Localized copy — EXACT EN + IT (executor translates es/fr/pt/zh/de)

Put in `functions/lib/newsletter-copy.ts` as `Record<Lang, string>` maps + HTML builders. Keep the
feedback.ts inline-style aesthetic (terracotta `#c96b4f`, sand background `#f9f6f3`, system font).

**Confirmation email — subject**
- EN: `Confirm your IsItSafeToTravel subscription`
- IT: `Conferma la tua iscrizione a IsItSafeToTravel`

**Confirmation email — body (HTML text)**
- EN: heading `One last step`; body `Please confirm you want daily travel-safety updates from
  IsItSafeToTravel. If this wasn't you, just ignore this email.`; button `Confirm subscription`;
  footer `You're receiving this because someone entered this address on isitsafetotravel.org. No
  emails are sent until you confirm.`
- IT: heading `Un ultimo passaggio`; body `Conferma di voler ricevere gli aggiornamenti quotidiani
  sulla sicurezza di viaggio da IsItSafeToTravel. Se non sei stato tu, ignora questa email.`;
  button `Conferma iscrizione`; footer `Ricevi questo messaggio perché questo indirizzo è stato
  inserito su isitsafetotravel.org. Nessuna email viene inviata prima della conferma.`

**"Check your inbox" page (no-JS form response) / JS success state**
- EN: `Almost there — check your inbox and click the confirmation link to finish subscribing.`
- IT: `Ci siamo quasi: controlla la tua casella di posta e clicca sul link di conferma per completare l'iscrizione.`

**Confirm result — success**
- EN: `You're subscribed. You'll get travel-safety updates whenever something notable changes.` + link back to site.
- IT: `Iscrizione confermata. Riceverai gli aggiornamenti sulla sicurezza di viaggio quando qualcosa di rilevante cambia.`

**Unsubscribe result — success**
- EN: `You've been unsubscribed. You won't receive any more emails from us.`
- IT: `Iscrizione annullata. Non riceverai più email da noi.`

**Error strings (`respErr`)**
- `invalid_email`: EN `That doesn't look like a valid email address.` / IT `L'indirizzo email non sembra valido.`
- `rate`: EN `Too many attempts — please try again later.` / IT `Troppi tentativi, riprova più tardi.`
- `unavailable`: EN `Subscriptions are temporarily unavailable. Please try again soon.` / IT `Le iscrizioni non sono momentaneamente disponibili. Riprova a breve.`

**Digest — subject** (fallback if news renderer absent)
- EN: `Travel-safety news — {n} update(s) today` / IT: `Sicurezza di viaggio — {n} aggiornamenti oggi`

**Digest — wrapper** (header + footer around the event list)
- EN header: `Today's travel-safety changes`; footer: `You're getting this because you subscribed on
  isitsafetotravel.org.` + `Unsubscribe` (links to unsub URL).
- IT header: `I cambiamenti di oggi sulla sicurezza di viaggio`; footer: `Ricevi questa email perché
  ti sei iscritto su isitsafetotravel.org.` + `Annulla iscrizione`.

---

### F. Daily digest script — `scripts/send-daily-digest.ts` (NEW, tsx)

```
USAGE: npx tsx scripts/send-daily-digest.ts [YYYY-MM-DD]
ENV:   RESEND_API_KEY (required), CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (or CLOUDFLARE_D1_TOKEN)
```
Flow:
1. `date = argv[2] || todayUTC()`.
2. Read `data/news/${date}.json`. **Missing OR `events.length===0` → log `"no events, skipping"` and `process.exit(0)`.** (Policy: send only on event days.)
3. **Idempotency**: `d1('SELECT 1 FROM digest_log WHERE send_date=?')`. If a row exists → log `"already sent"` and exit 0.
4. Fetch confirmed subscribers:
   `d1json("SELECT email, locale, unsub_token FROM subscribers WHERE status='confirmed'")`.
   If zero → still write a `digest_log` row (recipients 0) and exit (prevents reprocessing).
5. Group by `locale`. For each locale build the per-recipient message:
   - `unsubUrl = https://isitsafetotravel.org/api/unsubscribe?token=${unsub_token}`
   - `html = renderDigestHtml(events, locale, unsubUrl)` (imported; else **fallback §4b**)
   - `subject = digestSubject(events, locale)` (imported; else fallback EN/IT subject with `{n}`)
   - `headers = { 'List-Unsubscribe': '<'+unsubUrl+'>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }`
6. Send with `sendBatch(apiKey, chunk)` in chunks of 100; sum successes; on a chunk error log it and continue (best-effort, don't abort the whole run).
7. `d1("INSERT OR REPLACE INTO digest_log (send_date, sent_at, recipients, events) VALUES (?,?,?,?)", ...)`.
8. `console.log` a summary line: `digest ${date}: ${sent} sent across ${localeCount} locales, ${events.length} events`.

**§4b Fallback renderer** (self-contained, used when `src/lib/news-digest.ts` is absent):
```ts
function fallbackDigestHtml(events, lang, unsubUrl) {
  const rows = events.map((e) => {
    const name = e.countryName?.[lang] ?? e.countryName?.en ?? e.iso3;
    const head = e.headline?.[lang] ?? e.headline?.en ?? '';
    const body = e.detail?.[lang] ?? e.detail?.en ?? '';
    const url = `https://isitsafetotravel.org/${lang}/${countrySeg(lang)}/${e.slug}/`;  // seg via routes map
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #eee">
      <a href="${url}" style="color:#c96b4f;font-weight:600;text-decoration:none">${name}</a><br>
      <strong>${escapeHtml(head)}</strong><br>
      <span style="color:#555">${escapeHtml(body)}</span></td></tr>`;
  }).join('');
  return wrapperHtml(lang, rows, unsubUrl);   // header + table + footer (copy §E)
}
```
> `countrySeg(lang)` = the localized country route word from `src/i18n/ui.ts routes[lang].country`
> (`country`/`paese`/`pais`/`pays`/`land`…). Import the `routes` map, don't hardcode.

**D1 access from the script**: shell out to wrangler (as specified):
```ts
import { execFileSync } from 'node:child_process';
function d1json(sql: string): any[] {
  const out = execFileSync('npx', ['wrangler','d1','execute','isitsafetotravel-sentiment','--remote','--json','--command', sql],
    { encoding:'utf8', env:{ ...process.env, CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_D1_TOKEN || process.env.CLOUDFLARE_API_TOKEN } });
  return JSON.parse(out)[0]?.results ?? [];
}
```
> Wrangler reads `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. We override it with the
> D1-scoped `CLOUDFLARE_D1_TOKEN` (fallback to API token) to match the workflow's existing pattern.

### G. Workflow change — `.github/workflows/data-pipeline.yml`

Add ONE step in the existing `pipeline` job, **after** `Trigger deploy` (so digest failure never
blocks deploy), non-fatal:
```yaml
      - name: Send daily digest
        if: success()
        continue-on-error: true
        env:
          RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_D1_TOKEN: ${{ secrets.CLOUDFLARE_D1_TOKEN }}
        run: npx tsx scripts/send-daily-digest.ts ${{ github.event.inputs.date || '' }}
```
> Runs against the working tree already on disk (post-commit), so it sees the freshly generated
> `data/news/${date}.json` without a re-checkout. The D1 `digest_log` guard makes reruns safe.
> No change to `git add` list — the script writes nothing to the repo (digest_log lives in D1).

### H. Vote geolocation — `functions/api/vote.ts` (MODIFY, minimal)

Two edits, nothing else stored (no raw IP — unchanged):
1. After step (4) read country:
```ts
const country = context.request.cf?.country ?? context.request.headers.get('CF-IPCountry') ?? null;
```
2. Extend the INSERT (step 8) to include `country_iso`:
```ts
.prepare('INSERT OR IGNORE INTO votes (iso3, delta, official_score, voter_hash, day_hash, created_at, country_iso) VALUES (?, ?, ?, ?, ?, ?, ?)')
.bind(iso3, delta, officialScore ?? null, voter_hash, day_hash, nowSec, country)
```
Confirm: `country` is a 2-letter ISO (or `null` / `'T1'` for Tor / `'XX'` unknown — stored as-is,
coarse, non-identifying). No IP, no city, no lat/long. `db/migrations/002` must be applied to
remote **before** deploying this edit (else `no such column` → but the outer try/catch returns a
benign 200, so votes silently stop persisting; apply the migration first).

### I. Component — `src/components/NewsletterSignup.astro` (NEW)

Props `{ lang: Lang; source: string }`. Progressive enhancement modeled on `SentimentVote.astro`
(JS-gated fetch, inline success/error, `astro:after-swap` re-init) with a native no-JS form POST
fallback.
```astro
---
import type { Lang } from '../i18n/ui';
import { useTranslations } from '../i18n/utils';
interface Props { lang: Lang; source: string; }
const { lang, source } = Astro.props;
const t = useTranslations(lang);
---
<section class="max-w-2xl mx-auto px-4 py-6">
  <form id="newsletter-form" action="/api/subscribe" method="POST" novalidate
        class="rounded-xl border border-sand-200 dark:border-sand-700 p-5 bg-sand-50 dark:bg-sand-800/50">
    <h2 class="font-heading font-semibold text-sand-800 dark:text-sand-100">{t('newsletter.title')}</h2>
    <p class="text-sm text-sand-600 dark:text-sand-400 mt-1">{t('newsletter.subtitle')}</p>
    <input type="hidden" name="locale" value={lang} />
    <input type="hidden" name="source" value={source} />
    <!-- honeypot: visually hidden, aria-hidden, tabindex -1 -->
    <input type="text" name="website" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true" />
    <div class="mt-3 flex flex-col sm:flex-row gap-2">
      <input type="email" name="email" required autocomplete="email" placeholder={t('newsletter.placeholder')}
             class="flex-1 min-h-[44px] rounded-lg border ..." />
      <button type="submit" class="min-h-[44px] rounded-xl px-5 font-heading font-semibold text-white bg-terracotta-500 ...">
        {t('newsletter.cta')}
      </button>
    </div>
    <p class="text-xs text-sand-500 mt-2">{t('newsletter.consent')}</p>  <!-- GDPR micro-consent line + link to /legal -->
  </form>
  <div aria-live="polite">
    <p id="newsletter-success" class="hidden ...">{t('newsletter.success')}</p>
    <p id="newsletter-error"   class="hidden ...">{t('newsletter.error')}</p>
  </div>
</section>
<script>
  function initNewsletter() {
    const form = document.getElementById('newsletter-form'); if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ok = document.getElementById('newsletter-success'), err = document.getElementById('newsletter-error');
      const email = form.querySelector('input[name=email]').value;
      const body = { email, locale: form.querySelector('input[name=locale]').value,
                     source: form.querySelector('input[name=source]').value,
                     website: form.querySelector('input[name=website]').value };
      try {
        const res = await fetch('/api/subscribe', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
        if (res.ok) { form.classList.add('hidden'); ok.classList.remove('hidden'); }
        else { err.classList.remove('hidden'); }
      } catch { err.classList.remove('hidden'); }
    });
  }
  initNewsletter(); document.addEventListener('astro:after-swap', initNewsletter);
</script>
```
Without JS the native `method="POST"` submit hits `/api/subscribe` as form-encoded and the Function
returns the inline localized "check your inbox" HTML page (§C/§E) — fully functional.

**Mount points** (`source` value differs so we can attribute signups):
- **Country page** — `src/pages/{lang}/country/[slug].astro` (×7), immediately after the
  `TravelDealsWidget mode="country"` block (~line 110): `<NewsletterSignup lang={lang} source={iso3.toLowerCase()} />`.
- **News page** — the news track's reserved slot: `<NewsletterSignup lang={lang} source="news-page" />`.

**i18n strings** — add a `newsletter` block to every locale in `src/i18n/ui.ts` translations
(EN+IT exact below; executor translates es/fr/pt/zh/de):
| key | EN | IT |
|---|---|---|
| `newsletter.title` | Get travel-safety updates | Ricevi aggiornamenti sulla sicurezza di viaggio |
| `newsletter.subtitle` | A short email on the days safety scores meaningfully change. | Una breve email nei giorni in cui i punteggi cambiano in modo significativo. |
| `newsletter.placeholder` | you@example.com | tu@esempio.com |
| `newsletter.cta` | Subscribe | Iscriviti |
| `newsletter.consent` | By subscribing you agree to receive emails; unsubscribe anytime. See our privacy notice. | Iscrivendoti accetti di ricevere email; puoi annullare in qualsiasi momento. Leggi l'informativa privacy. |
| `newsletter.success` | Almost there — check your inbox to confirm. | Ci siamo quasi: controlla la posta per confermare. |
| `newsletter.error` | Something went wrong. Please try again. | Qualcosa è andato storto. Riprova. |

### J. Legal page — `src/pages/{lang}/legal/index.astro` (MODIFY ×7)

Add a `legal.newsletter_title` / `legal.newsletter_text` subsection (mirror the existing
`legal.privacy_votes_title/text` pattern). EN text: what we store (email, locale, consent
timestamp + version, coarse signup country, no raw IP), lawful basis (consent, double opt-in),
retention (until unsubscribe), how to unsubscribe (one-click link in every email), and that votes
now record coarse country only. IT translated; es/fr/pt/zh/de by executor.

---

## Secrets / config summary

| Name | Where | Who creates | Used by | Status |
|---|---|---|---|---|
| `RESEND_API_KEY` | **Pages env secret** | user (exists) | `subscribe.ts` confirmation email | ✅ already set (feedback.ts uses it) |
| `RESEND_API_KEY` | **GitHub Actions secret** | **user (NEW)** | `send-daily-digest.ts` | ❌ must add |
| `VOTE_HASH_SALT` | Pages env secret | user (exists) | subscribe rate-limit hash (reused) | ✅ already set |
| `CLOUDFLARE_ACCOUNT_ID` | GH Actions secret | user (exists) | wrangler d1 in digest | ✅ |
| `CLOUDFLARE_API_TOKEN` | GH Actions secret | user (exists) | wrangler d1 fallback | ✅ |
| `CLOUDFLARE_D1_TOKEN` | GH Actions secret | user (exists) | wrangler d1 (preferred) | ✅ |
| Resend sender `updates@isitsafetotravel.org` | Resend dashboard | user (NEW, trivial) | adapter `from` | ⚠️ same verified domain, no new DNS |

## USER ACTION ITEMS (must happen before the feature is live end-to-end)
1. **Add `RESEND_API_KEY` as a GitHub Actions secret** (repo → Settings → Secrets → Actions). Same
   value as the Pages secret. Without it the digest step logs "no key" and skips.
2. **Apply the two D1 migrations to remote** (commands below) — do `002` **before** the vote.ts
   deploy reaches production.
3. (Optional) In Resend, confirm `updates@isitsafetotravel.org` sends (same verified domain as
   `feedback@`; usually zero config). If Resend restricts to a single from-address on the free
   tier, either reuse `feedback@` or upgrade.
4. Nothing else — Pages `RESEND_API_KEY`, `VOTE_HASH_SALT`, and all CF tokens already exist.

### Migration commands (run once, in order)
```bash
npx wrangler d1 execute isitsafetotravel-sentiment --remote --file=db/migrations/001-subscribers.sql
npx wrangler d1 execute isitsafetotravel-sentiment --remote --file=db/migrations/002-votes-country-iso.sql
# local mirrors (for wrangler pages dev testing): same commands with --local instead of --remote
```

---

## Acceptance criteria
- [ ] `001` + `002` applied to remote D1; `PRAGMA table_info(votes)` shows `country_iso`; `subscribers` + `digest_log` exist.
- [ ] `POST /api/subscribe` (JSON) with a valid email → 200, a `pending` row, and a confirmation email arrives; honeypot-filled → 200 with NO row; invalid email → 400; 6th signup from same IP in 24h → 429; no `RESEND_API_KEY` → localized 503.
- [ ] No-JS native form POST → inline localized "check your inbox" HTML (200), `X-Robots-Tag: noindex`.
- [ ] `GET /api/confirm?token=…` flips the row to `confirmed` and returns a localized success page; bad/expired token → localized error, no crash.
- [ ] `GET` and `POST /api/unsubscribe?token=…` both flip to `unsubscribed`; `List-Unsubscribe-Post` one-click works from Gmail/Apple Mail.
- [ ] Every digest + confirmation email carries `List-Unsubscribe` + `List-Unsubscribe-Post` headers.
- [ ] `scripts/send-daily-digest.ts` on a **no-event** day exits 0 without sending; on an event day sends one email per confirmed subscriber in their locale, writes a `digest_log` row, and a **rerun is a no-op** (idempotent).
- [ ] `vote.ts` now stores `country_iso` on new votes; existing dedupe/rate-limit/behavior unchanged; still no raw IP anywhere.
- [ ] `NewsletterSignup.astro` renders on all 7 country-page locales and on the news page; `npm run validate:seo` stays **all-pass** (no new indexable routes, confirm/unsub are noindex).
- [ ] Legal page documents newsletter data + vote-country change in all 7 locales.

## Verification steps
1. **Local E2E** (no prod risk):
   - `npx wrangler d1 execute isitsafetotravel-sentiment --local --file=db/migrations/001-subscribers.sql` (+`002`).
   - `npx astro build` then `npx wrangler pages dev dist/client` (picks up the `DB` binding from `wrangler.toml`; set `RESEND_API_KEY` via `--binding` or a local `.dev.vars`).
   - `curl -X POST localhost:8788/api/subscribe -H 'Content-Type: application/json' -d '{"email":"t@t.co","locale":"it","source":"fra"}'` → 200; check the local row: `wrangler d1 execute isitsafetotravel-sentiment --local --command "SELECT status,locale,confirm_token FROM subscribers"`.
   - Hit `localhost:8788/api/confirm?token=<that>` → status `confirmed`; hit `/api/unsubscribe?token=<unsub>` → `unsubscribed`.
   - Digest dry run: create a fake `data/news/<today>.json` with 1 event, `RESEND_API_KEY=… npx tsx scripts/send-daily-digest.ts` against `--local` D1 (temporarily point `d1json` at `--local`), confirm one send + `digest_log` row + rerun no-op.
2. **Vote geo**: local POST `/api/vote` then `SELECT country_iso FROM votes` shows a 2-letter code (or null in local dev where `cf` is absent — acceptable).
3. **Build gate**: `npx astro build && npm run validate:seo` → all-pass.
4. **Prod smoke** (after deploy + GH secret): subscribe with a real address, confirm, wait for the next event-day digest (or `workflow_dispatch` with a date that has a news file), verify receipt + one-click unsubscribe.

## Top risks
1. **News-track coupling** — digest depends on `data/news/YYYY-MM-DD.json` shape + optional
   `renderDigestHtml`. Mitigated by the built-in fallback renderer and the empty-file skip; if the
   news schema drifts, only the fallback rendering needs a tweak. **Confirm the JSON contract with
   the news planner before coding.**
2. **Resend free-tier from-address / volume limits** — a single verified sender or 100/day cap
   could throttle the digest. Batch API + chunking helps; flag to user if subscriber count grows.
3. **Migration ordering** — deploying `vote.ts` before `002` silently stops vote persistence (outer
   try/catch swallows the `no such column`). Apply `002` first (called out in Acceptance + user items).
4. **wrangler auth in CI** — the digest's `wrangler d1 execute` needs a D1-write-capable token; we
   reuse `CLOUDFLARE_D1_TOKEN`→`CLOUDFLARE_API_TOKEN` exactly as the ntfy step does. If that token
   lacks D1 write, `digest_log` insert fails (send still happens, idempotency breaks) — verify token scope.
5. **Double-send on partial failure** — if a chunk sends but the run crashes before writing
   `digest_log`, a rerun re-sends. Accepted (rare); a per-recipient sent-ledger is deferred as v2.
</content>
</invoke>
