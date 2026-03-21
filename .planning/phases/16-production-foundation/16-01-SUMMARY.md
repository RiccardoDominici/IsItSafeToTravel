---
plan: 16-01
status: complete
started: 2026-03-21
completed: 2026-03-21
---

# Plan 16-01: Security Headers, Cache-Control, Domain Fix

## What Was Built

Created `public/_headers` with security headers (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) and cache-control rules. Fixed critical domain typo from `isitsafetotravels.com` to `isitsafetotravel.com` in both `robots.txt` and `astro.config.mjs`. Added AI crawler directives (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, Amazonbot, anthropic-ai).

## Key Files

### Created
- `public/_headers` — Security headers and cache-control for Cloudflare Pages

### Modified
- `public/robots.txt` — Fixed domain typo, added AI crawler directives
- `astro.config.mjs` — Fixed site URL from isitsafetotravels.com to isitsafetotravel.com

## Decisions Made

- Domain confirmed as `isitsafetotravel.com` (no 's') based on Cloudflare Pages project name in deploy.yml
- HSTS max-age=86400 (1 day) — NOT preload, per research recommendation
- No CSP header — deferred to Phase 20

## Self-Check: PASSED
- All 5 security headers present in _headers
- Cache-control rules for JS/CSS (immutable, 1yr) and HTML (10min, revalidate)
- Domain typo fixed in robots.txt and astro.config.mjs
- AI crawler directives present
