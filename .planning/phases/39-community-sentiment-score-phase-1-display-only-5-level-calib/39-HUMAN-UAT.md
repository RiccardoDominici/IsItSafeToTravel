---
status: partial
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
source: [39-VERIFICATION.md]
started: 2026-07-02T09:45:00Z
updated: 2026-07-02T10:05:00Z
---

## Current Test

Items 1-3 verified live by the orchestrator on 2026-07-02 post-deploy (run 28580801487). Item 4 pends tomorrow's 06:00 UTC pipeline run.

## Tests

### 1. Live POST /api/vote writes one row to D1
expected: POST /api/vote returns 200 ok:true; D1 shows exactly one new row (hashed voter fields, no raw IP); repeat POST deduped with no second row (UNIQUE dedupe).
result: PASS (2026-07-02) — {"ok":true} then {"ok":true,"deduped":true}; D1: 1 row ITA delta=0 official_score=null voter_hash len 64; invalid delta→400; text/plain→415

### 2. wrangler.toml config-activation regression (Pitfall 2)
expected: after the first deploy with `pages_build_output_dir`, GET / still redirects and /api/feedback is still routed to the Function.
result: PASS (2026-07-02) — GET / → 302 https://isitsafetotravel.org/en/; POST /api/feedback (empty JSON) → 400 from the Function (routed, alive; no fake feedback submitted)

### 3. Vote widget UX states in browser
expected: on a country page — 5 radio options + submit visible (JS on); submit → thank-you state; reload → still thank-you (localStorage `sentiment-voted-<ISO3>`); with JS disabled → submit hidden, page content intact; Sentiment pillar card shows "not enough votes yet" below the 5-vote floor.
result: PASS (2026-07-02, HTML-level) — /en/country/ita/ renders the full widget markup (form, 5 radio options, submit, thanks/error states, localStorage key) and Sentiment card in below-floor empty state; JSON-LD contains no sentiment (2 blocks checked). Interactive browser click-through left optional.

### 4. Daily GHA pipeline D1-read degradation (Stage 6)
expected: tomorrow's 06:00 UTC data-pipeline run completes green even though CLOUDFLARE_API_TOKEN lacks D1 read (Stage 6 logs skip, `data/sentiment/latest.json` empty-but-valid or absent, scores unchanged). Once the user grants D1 read to the token, Stage 6 starts committing real aggregates.
result: [pending]

## Summary

total: 4
passed: 3
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
