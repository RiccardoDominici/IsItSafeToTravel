---
status: partial
phase: 39-community-sentiment-score-phase-1-display-only-5-level-calib
source: [39-VERIFICATION.md]
started: 2026-07-02T09:45:00Z
updated: 2026-07-02T09:45:00Z
---

## Current Test

[awaiting post-deploy smoke tests — orchestrator runs items 1–3 after the next production deploy]

## Tests

### 1. Live POST /api/vote writes one row to D1
expected: `curl -X POST https://isitsafetotravel.org/api/vote -H 'Content-Type: application/json' -d '{"iso3":"ITA","delta":1}'` returns 200 with ok:true; a subsequent D1 query shows exactly one new row (iso3=ITA, delta=1, hashed voter fields, no raw IP). A repeat POST from the same IP returns the already-voted response and writes no second row (UNIQUE dedupe).
result: [pending]

### 2. wrangler.toml config-activation regression (Pitfall 2)
expected: after the first deploy with `pages_build_output_dir`, GET https://isitsafetotravel.org/ still serves the root redirect (functions/index.ts) and POST /api/feedback still returns 200 — the now-authoritative wrangler.toml did not break existing Functions/compat settings.
result: [pending]

### 3. Vote widget UX states in browser
expected: on a country page — 5 radio options + submit visible (JS on); submit → thank-you state; reload → still thank-you (localStorage `sentiment-voted-<ISO3>`); with JS disabled → submit hidden, page content intact; Sentiment pillar card shows "not enough votes yet" below the 5-vote floor.
result: [pending]

### 4. Daily GHA pipeline D1-read degradation (Stage 6)
expected: tomorrow's 06:00 UTC data-pipeline run completes green even though CLOUDFLARE_API_TOKEN lacks D1 read (Stage 6 logs skip, `data/sentiment/latest.json` empty-but-valid or absent, scores unchanged). Once the user grants D1 read to the token, Stage 6 starts committing real aggregates.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
