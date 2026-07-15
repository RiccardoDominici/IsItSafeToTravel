-- Cookie-consent telemetry (quick task: consent accept/reject monitoring).
-- One row per visitor per UTC day recording the LATEST banner choice — lets the
-- daily pipeline report the accept rate so real traffic can be estimated from
-- Clarity's consented-only sessions (real ≈ clarity / accept-rate).
-- Aggregate telemetry only, deliberately NOT a per-person consent ledger: the
-- salted daily hash is unlinkable to any individual, never raw IP (same
-- privacy posture as votes/subscribers).
-- Apply (remote): npx wrangler d1 execute isitsafetotravel-sentiment \
--   --remote --file=db/migrations/003-consent-log.sql
-- Idempotent: safe to re-run (IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS consent_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  choice      TEXT    NOT NULL,      -- 'granted' | 'denied' (validated in the Function)
  day_hash    TEXT    NOT NULL,      -- SHA-256(salt:ip:consent:nonce:dayBucket) — never raw IP
  country_iso TEXT,                  -- CF request.cf.country (2-letter), coarse geo only
  lang        TEXT,                  -- UI locale at click time (en|it|es|fr|pt|zh|de)
  created_at  INTEGER NOT NULL       -- unix epoch seconds, server time
);

-- One row per visitor per UTC day: INSERT OR REPLACE on this index makes a
-- same-day re-choice (footer "Cookie preferences" reopen) update, not double-count.
CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_day_hash ON consent_log (day_hash);

-- Read path: daily aggregate counts in the pipeline ntfy report.
CREATE INDEX IF NOT EXISTS idx_consent_created ON consent_log (created_at);
