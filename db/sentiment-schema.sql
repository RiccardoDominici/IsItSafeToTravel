-- Phase 39: Community Sentiment Score — vote ingestion schema (D1)
-- Append-only. Every row is a single 5-level calibration vote (D-01/D-02).
-- Apply (remote, once provisioned): npx wrangler d1 execute isitsafetotravel-sentiment
--   --remote --file=db/sentiment-schema.sql  (database_id 83acaffe-32ff-43fc-b68f-5343d01000d5)
-- Idempotent: safe to re-run (IF NOT EXISTS everywhere).

CREATE TABLE IF NOT EXISTS votes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  iso3           TEXT    NOT NULL,
  delta          INTEGER NOT NULL,          -- -2..+2 (validated in the Function)
  official_score REAL,                      -- score shown at vote time (audit/context)
  voter_hash     TEXT    NOT NULL,          -- SHA-256(salt:ip:iso3:weekBucket) — per-country weekly dedupe; never raw IP
  day_hash       TEXT    NOT NULL,          -- SHA-256(salt:ip:dayBucket) — per-visitor daily volume cap
  created_at     INTEGER NOT NULL           -- unix epoch seconds, server time
);

-- Read path: per-country windowed aggregation queries (daily pipeline)
CREATE INDEX IF NOT EXISTS idx_votes_iso3_created ON votes (iso3, created_at);

-- Per-country weekly dedupe check (Task 2 step 6)
CREATE INDEX IF NOT EXISTS idx_votes_dedupe ON votes (iso3, voter_hash, created_at);

-- Per-visitor daily volume cap check (Task 2 step 7)
CREATE INDEX IF NOT EXISTS idx_votes_daycap ON votes (day_hash, created_at);

-- Atomic dedupe: voter_hash already encodes iso3:weekBucket, so this UNIQUE index enforces
-- exactly one vote per IP per country per week bucket at the DB level (WR-01) — the
-- check-then-insert above is a cheap pre-check only, this constraint is authoritative.
CREATE UNIQUE INDEX IF NOT EXISTS idx_votes_unique_voter ON votes (iso3, voter_hash);
