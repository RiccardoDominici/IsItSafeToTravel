-- Migration 005: absolute rating for grey countries (formula v10, SPEC §5).
--
-- A country whose official score is null (insufficient data, scoreStatus 'insufficient_data')
-- has no number to be "too high" or "too low" against, so its visitors answer an absolute
-- question instead: rating 1..5 (very unsafe .. very safe). Relative votes (delta, -2..+2)
-- keep working unchanged and leave rating NULL.
--
-- delta stays NOT NULL (SQLite cannot drop NOT NULL without rebuilding the table), so a rating
-- row stores delta = 0 as a placeholder. Readers must branch on `rating IS NOT NULL`, never on
-- delta, to tell the two vote kinds apart.
--
-- Apply ONCE, before deploying code that writes or reads `rating`. Migrations 001-004 were
-- applied with `d1 execute --file` (no d1_migrations ledger exists), so use the same form:
--   npx wrangler d1 execute isitsafetotravel-sentiment --remote --file=db/migrations/005-votes-rating.sql
-- ALTER TABLE ADD COLUMN is not idempotent: a re-run fails with "duplicate column name: rating",
-- which is safe to ignore (already applied).

ALTER TABLE votes ADD COLUMN rating INTEGER CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);
