---
phase: 38
plan: 03
subsystem: monetization
tags: [monetization, affiliate, travelpayouts, ko-fi-removal, footer, i18n]
provides:
  - travelpayouts-affiliate-config
  - footer-affiliate-cta-7-locales
  - kofi-purged-from-shipping-code
requires:
  - donate-keys-in-7-language-blocks-from-plan-01
affects:
  - src/config/affiliate.ts (new)
  - src/layouts/Base.astro (-9 lines: Ko-fi widget removed)
  - src/components/Footer.astro (+9 lines: CTA + import)
  - src/i18n/ui.ts (21 keys swapped: kofi → travelpayouts × 7 locales)
  - .github/FUNDING.yml (deleted)
tech-stack:
  added: []
  patterns:
    - "Single-source-of-truth affiliate config (src/config/affiliate.ts) — one-line marker swap to activate real tracking"
    - "rel=\"noopener noreferrer sponsored\" on affiliate anchors (mitigates T-38-08 referrer leak; complies with Google webmaster sponsored-link guidance)"
key-files:
  created:
    - src/config/affiliate.ts
  modified:
    - src/layouts/Base.astro
    - src/components/Footer.astro
    - src/i18n/ui.ts
  deleted:
    - .github/FUNDING.yml
decisions:
  - "Marker placeholder = '000000' with explicit TODO comment — ships safe, sends traffic to Travelpayouts white-label search but earns no commission until real marker swapped in"
  - "Affiliate CTA placed inline in footer link list (not floating widget) — minimally intrusive, brand-consistent, no third-party heavy script (net security improvement: removed external Ko-fi inline script)"
  - "donate.travelpayouts_* keys reused the existing donate.* namespace rather than a new deals.* key — preserves backward-compat with any future deal pages and avoids touching nav.donate (still used by some routes)"
  - "FUNDING.yml deleted entirely — only entry was ko_fi; no GitHub Sponsors funding entry to retain"
metrics:
  duration_seconds: 1800
  duration_minutes: 30
  task_count: 3
  file_count: 5
  completed: 2026-05-06
---

# Phase 38 Plan 03: Replace Ko-fi widget and donation pages with Travelpayouts affiliate CTA Summary

**One-liner:** Ko-fi floating chat widget and all `donate.kofi_*` translation keys removed from shipping code; replaced with a brand-consistent inline footer CTA wired to a single-source-of-truth Travelpayouts affiliate config (`src/config/affiliate.ts`) that activates real tracking via a one-line marker swap. Footer renders localized "Find Travel Deals" / "Reise-Angebote finden" / "查找旅行优惠" / etc. anchor with `rel="noopener noreferrer sponsored"` across all 7 locales.

## What Was Built

### 1. `src/config/affiliate.ts` (new file, 27 lines)

Exports:
- `TRAVELPAYOUTS_MARKER = '000000'` — placeholder constant with explicit `// TODO: replace with real Travelpayouts marker` comment
- `TRAVELPAYOUTS_DEFAULT_TARGET = 'https://search.travelpayouts.com/'` — fallback landing page
- `buildAffiliateUrl(targetUrl?)` — wraps any URL in a `https://tp.media/r?marker={MARKER}&u={ENCODED_URL}` redirect

Activation procedure documented in the file's docstring (sign up at travelpayouts.com → grab marker from dashboard → replace one constant).

### 2. `src/layouts/Base.astro` — Ko-fi widget removed

Deleted lines 119–127 (the `<script src="https://storage.ko-fi.com/cdn/scripts/overlay-widget.js">` tag and the `<script is:inline define:vars={{ donateButtonText: t('nav.donate') }}>` block calling `kofiWidgetOverlay.draw('isitsafetotravel', ...)`). The `t()` helper is still used elsewhere in the file (page title, description) so no import cleanup needed.

### 3. `src/components/Footer.astro` — Travelpayouts CTA added

- Imported `buildAffiliateUrl` from `../config/affiliate`
- Computed `affiliateUrl = buildAffiliateUrl()` in frontmatter
- Added a new `<a>` link in the existing footer link list (after `t('footer.sources')`), styled with the same Tailwind classes as sibling links for visual consistency:
  ```astro
  <a
    href={affiliateUrl}
    target="_blank"
    rel="noopener noreferrer sponsored"
    class="text-sm text-sand-600 dark:text-sand-300 hover:text-terracotta-500 dark:hover:text-terracotta-400 transition-colors"
  >
    {t('donate.travelpayouts_btn' as any)}
  </a>
  ```

### 4. `src/i18n/ui.ts` — 21 translation keys swapped (3 keys × 7 locales)

| Locale | Old (kofi) → New (travelpayouts) |
|--------|-----------------------------------|
| en | `donate.kofi_btn 'Donate on Ko-fi'` → `donate.travelpayouts_btn 'Find Travel Deals'` |
| it | `'Dona su Ko-fi'` → `'Trova Offerte di Viaggio'` |
| es | `'Donar en Ko-fi'` → `'Buscar Ofertas de Viaje'` |
| fr | `'Faire un don sur Ko-fi'` → `'Trouver des Offres de Voyage'` |
| pt | `'Doar no Ko-fi'` → `'Encontrar Ofertas de Viagem'` |
| zh | `'在 Ko-fi 上捐赠'` → `'查找旅行优惠'` |
| de | `'Auf Ko-fi spenden'` → `'Reise-Angebote finden'` |

Each block also has a corresponding `_title` (e.g., "Travel Deals" / "旅行优惠" / "Reise-Angebote") and `_desc` (e.g., "Find cheap flights, hotels, and travel insurance — every booking through this link supports the project at no cost to you.").

### 5. `.github/FUNDING.yml` — deleted

The only entry was `ko_fi: isitsafetotravel`; per CONTEXT.md the project shifts from donation to affiliate model, so the file is removed entirely. GitHub will simply not show a sponsor button on the repo page (acceptable per phase decisions).

## Sample Affiliate URL (placeholder marker)

Rendered in built HTML for every locale:

```
https://tp.media/r?marker=000000&u=https%3A%2F%2Fsearch.travelpayouts.com%2F
```

When `TRAVELPAYOUTS_MARKER` is swapped to a real 6-digit marker, every link sitewide updates automatically — no other code changes needed.

## How to Activate Real Tracking

Single-line edit in `src/config/affiliate.ts`:

```ts
// Before
export const TRAVELPAYOUTS_MARKER = '000000';

// After (with your real marker)
export const TRAVELPAYOUTS_MARKER = '123456';
```

Then commit + deploy. No other changes needed — the Footer CTA and any future affiliate consumers all read from this constant.

## File Line Count Delta

| File | Before | After | Δ |
|------|--------|-------|---|
| src/config/affiliate.ts | 0 (new) | 27 | +27 |
| src/layouts/Base.astro | 130 | 121 | −9 |
| src/components/Footer.astro | 81 | 90 | +9 |
| src/i18n/ui.ts (kofi → travelpayouts swap, same line count) | 3429 | 3429 | 0 (21 lines rewritten in-place) |
| .github/FUNDING.yml | 2 | 0 (deleted) | −2 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cleared stale build artifacts before validation**
- **Found during:** Task 3 build verification
- **Issue:** First `npm run build` failed at "generating static routes" with `Cannot find module .../dist/client/.prerender/chunks/_slug__CqZNEsSw.mjs`. The error originated in stale `.prerender` chunks left over from a previous build (predating this plan).
- **Fix:** Removed `dist/`, `node_modules/.vite/`, and `.astro/` directories, then re-ran `npm run build`. Build then succeeded cleanly: 1892 pages built in 768s, 2186/2186 SEO checks passed.
- **Files modified:** None (cache-only fix).
- **Commit:** N/A (no source changes).

### Out-of-Scope Observations (NOT auto-fixed)

- The build now reports `/zh/` and `/de/` HTML pages (e.g., `dist/client/zh/index.html`, `dist/client/de/index.html`). These were created by **plan 38-02** (parallel wave 2 plan) which committed `8129b30`, `3edef32`, `0bdc4b2` on top of this plan's commits. Plan 38-03 only modified i18n keys and the layout/footer files; the Travelpayouts CTA renders correctly across all 7 locales because plan 38-02's page tree picked up the updated Footer.astro automatically.

## Verification Results

```
=== 1. Affiliate config ===
OK: TRAVELPAYOUTS_MARKER constant exported
OK: buildAffiliateUrl helper exported
OK: TODO comment present for one-line marker swap

=== 2. Ko-fi purged from shipping code ===
src/, public/, functions/, scripts/, astro.config.mjs: 0 ko-fi references

=== 3. i18n keys ===
donate.kofi*: 0 occurrences (expected 0)
donate.travelpayouts_btn: 7 occurrences (expected 7, one per locale)
donate.travelpayouts_title: 7 occurrences
donate.travelpayouts_desc: 7 occurrences

=== 4. Footer wires affiliate URL ===
OK: imports buildAffiliateUrl
OK: rel="noopener noreferrer sponsored" attribute present

=== 5. FUNDING.yml ===
OK: file deleted

=== 6. Build (npm run build) ===
EXIT 0 — 1892 pages built in 768.59s
2186/2186 post-build SEO checks PASSED

=== 7. Built HTML output ===
PASS: dist/client/{en,it,es,fr,pt,zh,de}/index.html all contain `tp.media/r?marker=`
PASS: en HTML contains 'Find Travel Deals'
PASS: de HTML contains 'Reise-Angebote finden'
PASS: zh HTML contains '查找旅行优惠'
PASS: zero ko-fi references in dist/client/
```

## Build Performance

- Build duration: **768.59s** (12.8 minutes)
- Pages built: **1892** (across all 7 locales)
- Post-build SEO checks: **2186 PASSED, 0 FAILED**
- Build warnings: none related to plan 38-03 changes
- First build attempt failed due to stale `.prerender` cache (unrelated, pre-existing artifacts) — clearing `dist/`, `node_modules/.vite/`, and `.astro/` resolved it. This is a one-time hygiene issue, not a regression.

## Threat Model Compliance

| Threat ID | Disposition | Mitigation Implemented |
|-----------|-------------|------------------------|
| T-38-07 | accept | TRAVELPAYOUTS_MARKER is single source of truth in `src/config/affiliate.ts` with explicit TODO; one-line activation |
| T-38-08 | mitigate | Footer anchor uses `rel="noopener noreferrer sponsored"` — `noopener noreferrer` blocks referrer leakage of internal page URLs; `sponsored` discloses monetization to crawlers per Google guidance |
| T-38-09 | mitigate | Removed `storage.ko-fi.com` external script tag and inline `kofiWidgetOverlay.draw(...)` invocation entirely — eliminates external script-injection vector (net security improvement) |
| T-38-10 | accept | No internal click logging; Travelpayouts dashboard is system of record for v1 |

## Commits

- `1f8dd0a` feat(38-03): add Travelpayouts affiliate config and footer CTA, remove Ko-fi widget
- `30a74ae` feat(38-03): replace donate.kofi_* with donate.travelpayouts_* across all 7 locales

## Notes for Next Plan / User Action

1. **To activate real Travelpayouts tracking:** Edit `src/config/affiliate.ts` line 16, replace `'000000'` with the real marker from the Travelpayouts dashboard. Commit + push. No other code changes needed.
2. **Plan 38-02 will perform the final push to deploy** (per execution rules — keeps deploy atomic; this plan does NOT push).
3. The `nav.donate` translation key is still defined in all 7 locales (used by some legacy routes if any). It is no longer consumed by Base.astro. Future cleanup could rename it to `nav.deals` or remove it if no consumer remains, but that is out of scope for this plan.

## Self-Check: PASSED

- [x] `src/config/affiliate.ts` exists — confirmed via `[ -f src/config/affiliate.ts ]`
- [x] `src/layouts/Base.astro` modified (Ko-fi removed) — confirmed via `grep -c kofi` returns 0
- [x] `src/components/Footer.astro` modified (CTA added) — confirmed via `grep buildAffiliateUrl`
- [x] `src/i18n/ui.ts` modified (21 keys swapped) — confirmed via grep counts (0 kofi, 7×3 travelpayouts)
- [x] `.github/FUNDING.yml` deleted — confirmed via `[ ! -f .github/FUNDING.yml ]`
- [x] Commit `1f8dd0a` exists — confirmed via `git log`
- [x] Commit `30a74ae` exists — confirmed via `git log`
- [x] Production build succeeds (`npm run build` exit 0)
- [x] All 2186 post-build SEO checks pass
- [x] Built HTML in dist/client/{en,it,es,fr,pt,zh,de}/index.html contains affiliate URL and zero ko-fi residue
