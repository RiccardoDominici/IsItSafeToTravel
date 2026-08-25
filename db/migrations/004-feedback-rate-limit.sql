-- Migration 004: rate limiting table for POST /api/feedback.
--
-- The feedback endpoint used to be an open relay (no same-origin check, no rate
-- limit) — this table backs a per-day cap keyed by SALTED IP HASH, never the
-- raw IP (same privacy model as subscribers.signup_ip_hash; see
-- .planning/quick/260711-daily-news-and-mailing-list/LEGAL-PRIVACY-ASSESSMENT.md).
-- Apply with:
--   npx wrangler d1 execute isitsafetotravel-sentiment --remote --file=db/migrations/004-feedback-rate-limit.sql
CREATE TABLE IF NOT EXISTS feedback_log (
  ip_hash    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  country    TEXT
);

CREATE INDEX IF NOT EXISTS idx_feedback_log_ip_time ON feedback_log (ip_hash, created_at);
