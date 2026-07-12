-- Mailing list (quick task 260711-daily-news-and-mailing-list). Applied once to remote:
--   npx wrangler d1 execute isitsafetotravel-sentiment --remote --file=db/migrations/001-subscribers.sql
-- Idempotent (IF NOT EXISTS everywhere). Reuses the sentiment DB (binding DB, see wrangler.toml).
-- consent_at/consent_version are the GDPR proof-of-consent fields (see LEGAL-PRIVACY-ASSESSMENT.md
-- in .planning/quick/260711-daily-news-and-mailing-list/); signup_country is ISO-2 only, never raw IP.

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
  consent_version TEXT   NOT NULL,              -- consent-copy version, e.g. 'v1-2026-07-11'
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
