-- Vote geolocation (quick task 260711-daily-news-and-mailing-list). Applied once to remote:
--   npx wrangler d1 execute isitsafetotravel-sentiment --remote --file=db/migrations/002-votes-country-iso.sql
-- NOTE: ALTER TABLE ADD COLUMN is NOT idempotent in SQLite. Run exactly once. If re-run it errors
-- 'duplicate column name: country_iso' — that error is safe to ignore (means it's already applied).
-- Pre-check first if unsure:
--   npx wrangler d1 execute isitsafetotravel-sentiment --remote --json --command "PRAGMA table_info(votes)"
ALTER TABLE votes ADD COLUMN country_iso TEXT;   -- CF request.cf.country (2-letter ISO), nullable. No IP.
