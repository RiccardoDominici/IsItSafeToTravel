# Architecture Patterns

**Domain:** Production hardening for Astro 6 SSG + Cloudflare Pages travel safety platform (v2.0)
**Researched:** 2026-03-21
**Confidence:** HIGH (based on direct codebase analysis + official docs verification)

## Existing Architecture (Baseline)

```
src/
  layouts/Base.astro      -- Global HTML shell (head, body, header, footer)
  pages/
    index.astro           -- Root redirect (language detection via is:inline script)
    [lang]/               -- en/, it/, es/, fr/, pt/
      index.astro         -- Home (map)
      compare.astro       -- Country comparison
      global-safety.astro -- Global benchmark
      country/[slug].astro-- Country detail
      legal/index.astro   -- Legal page
      methodology/        -- Methodology pages
  components/             -- Astro components (Header, Footer, SafetyMap, Search, etc.)
  lib/                    -- Utilities (seo.ts, scores.ts, colors.ts)
  i18n/                   -- ui.ts (translations ~200 keys), utils.ts
public/                   -- Static assets (robots.txt, favicon, scores.json, topojson)
dist/client/              -- Build output deployed to Cloudflare Pages
wrangler.toml             -- Minimal (name, compat_date, nodejs_compat only)
```

**Key constraints for v2.0 integration:**
- Pure SSG output to `dist/client/` -- no SSR, no Cloudflare Functions, no edge runtime
- Inline scripts exist: dark mode detection (`Base.astro`), language redirect (`index.astro`), JSON-LD
- External JS: D3 chart scripts bundled by Vite into `_astro/` directory
- Deploy via `wrangler pages deploy dist/client`
- Astro version: 6.0.6 (CSP stable, but only for SSR mode)

---

## Integration Map: Where Each v2.0 Feature Goes

### Feature Classification

| Feature | Type | Touch Points | New i18n Keys | New Files |
|---------|------|-------------|---------------|-----------|
| Security headers | Config only | `public/_headers` | None | 1 |
| Cookie consent | Conditional | Possibly `Base.astro` + component | ~5-10 | 0-2 |
| Analytics script | Layout change | `Base.astro`, `public/_headers` | None | 0 |
| Donations page | New pages + footer | `[lang]/donate.astro` x5, `Footer.astro`, `ui.ts` | ~15-20 | 5 |
| llms.txt | Static file | `public/llms.txt` | None | 1 |
| Error pages (404) | New pages | `[lang]/404.astro` x5, `404.astro` | ~5-8 | 6 |
| CSP configuration | Config (in _headers) | `public/_headers` | None | 0 |

---

## Detailed Integration: Each Feature

### 1. Security Headers -- `public/_headers` File

**Where:** Create `public/_headers` (no extension). Astro copies all `public/` files to `dist/client/` at build time. Cloudflare Pages reads `_headers` automatically from the deploy directory.

**Why `_headers` and not `wrangler.toml`:** The current `wrangler.toml` has no headers configuration capability for Pages projects. Cloudflare Pages' `_headers` file is the documented, standard approach for static sites. It is version-controlled, path-aware, and requires zero code changes.

**Recommended content:**
```
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-XSS-Protection: 0
```

**Limits:** Max 100 header rules per file, 2000 chars per line. More than sufficient for this project.

**Confidence:** HIGH -- [Cloudflare Pages Headers docs](https://developers.cloudflare.com/pages/configuration/headers/) confirm this approach.

---

### 2. Cookie Consent -- Likely NOT Needed

**Assessment:** The site currently sets zero cookies. If the analytics choice is cookieless (Cloudflare Web Analytics or Plausible), no cookie consent banner is legally required.

**The dark mode `localStorage` usage is NOT a cookie.** The ePrivacy Directive covers cookies and "similar technologies," but localStorage for strictly functional purposes (theme preference) is generally covered under legitimate interest, not requiring consent.

**If future changes introduce cookies (unlikely):**
- Create `src/components/CookieConsent.astro` -- banner at bottom of viewport
- Include in `Base.astro` before closing `</body>`
- Use `localStorage` to track consent state (no server needed for SSG)
- Block non-essential scripts until consent granted via conditional `is:inline` loader
- i18n keys: `consent.message`, `consent.accept`, `consent.reject`, `consent.settings`

**Recommendation:** Choose cookieless analytics. No cookies = no consent banner = no UX friction = no legal complexity. This is the simplest, cheapest, most privacy-respecting option.

**Confidence:** MEDIUM on legal assessment (jurisdiction-specific nuances exist). HIGH on technical approach.

---

### 3. Analytics Script -- `Base.astro` Layout Change

**Where:** In `src/layouts/Base.astro`, the single layout file used by all pages.

**Option A: Cloudflare Web Analytics (RECOMMENDED -- free, zero config)**
Add before `</body>` in `Base.astro`:
```html
<script defer src='https://static.cloudflareinsights.com/beacon.min.js'
  data-cf-beacon='{"token": "YOUR_TOKEN"}'></script>
```
- Free on all Cloudflare plans
- No cookies, GDPR-compliant by design
- Already on CF infrastructure (no external dependency)
- Privacy-preserving: no PII, no cross-site tracking

**Option B: Plausible Analytics ($9/mo cloud, or self-hosted free)**
Add in `<head>` of `Base.astro`:
```html
<script defer data-domain="isitsafetotravels.com" src="https://plausible.io/js/script.js"></script>
```

**CSP impact:** The analytics script domain must be added to `script-src` in `_headers`. For Cloudflare Web Analytics: `https://static.cloudflareinsights.com`. For Plausible: `https://plausible.io`.

**Recommendation:** Cloudflare Web Analytics. Zero cost, already on the same infrastructure, cookieless, and the budget constraint is "near-zero (~10EUR/month max)."

**Confidence:** HIGH -- both options well-documented and cookieless.

---

### 4. Donations Page -- New Page + Footer Link

**Where:** New Astro page per language, following the existing routing pattern.

**New files:**
```
src/pages/en/donate.astro
src/pages/it/dona.astro
src/pages/es/donar.astro
src/pages/fr/faire-un-don.astro
src/pages/pt/doar.astro
```

**Route registration in `ui.ts`:**
```typescript
export const routes = {
  en: { /* existing... */ donate: 'donate' },
  it: { /* existing... */ donate: 'dona' },
  es: { /* existing... */ donate: 'donar' },
  fr: { /* existing... */ donate: 'faire-un-don' },
  pt: { /* existing... */ donate: 'doar' },
};
```

**Page structure:** Uses `Base.astro` layout. Content is static text explaining the project mission + external link/button to donation platform. No embedded payment forms.

**Footer modification in `Footer.astro`:**
```astro
<a href={`/${lang}/${r.donate}/`}
   class="text-sm text-sand-600 dark:text-sand-300 hover:text-terracotta-500 ...">
  {t('footer.donate')}
</a>
```

**External platform: Ko-fi** -- zero fees on donations, simple link integration, no account required for donors. Just a styled `<a>` link to `https://ko-fi.com/isitsafetotravel`. No external scripts needed (avoid the widget JS for simplicity and CSP cleanliness).

**New i18n keys:** `donate.title`, `donate.meta_description`, `donate.heading`, `donate.intro`, `donate.why`, `donate.how`, `donate.cta_text`, `donate.cta_label`, `donate.thankyou`, `footer.donate` (~10 keys x 5 languages).

**Confidence:** HIGH -- follows existing page creation patterns exactly.

---

### 5. llms.txt -- Static File in `public/`

**Where:** `public/llms.txt` -- copied to `dist/client/llms.txt` at build, served at `https://isitsafetotravels.com/llms.txt`.

**Content (following [llmstxt.org spec](https://llmstxt.org/)):**
```markdown
# IsItSafeToTravel

> Travel safety scores for 248 countries in 5 languages, powered by transparent open data. Combines conflict, crime, health, governance, and environment indices into a 1-10 safety rating, updated daily.

## Documentation
- [Methodology](https://isitsafetotravels.com/en/methodology/): How safety scores are calculated, data sources, and weights
- [Legal](https://isitsafetotravels.com/en/legal/): Terms of service and privacy policy

## Data
- [Safety Scores JSON](https://isitsafetotravels.com/scores.json): Machine-readable safety data for all 248 countries

## Pages
- [Home / World Map](https://isitsafetotravels.com/en/): Interactive safety map with per-pillar filtering
- [Country Comparison](https://isitsafetotravels.com/en/compare/): Side-by-side safety comparison (up to 5 countries)
- [Global Safety Index](https://isitsafetotravels.com/en/global-safety/): World average benchmark and trends

## Optional
- [Sitemap](https://isitsafetotravels.com/sitemap-index.xml): Full page index
```

**robots.txt update:** Add `llms.txt` reference (emerging convention, not standardized):
```
# robots.txt for isitsafetotravel.com
User-agent: *
Allow: /

Sitemap: https://isitsafetotravels.com/sitemap-index.xml

# LLM-readable site summary
# https://llmstxt.org/
# See: https://isitsafetotravels.com/llms.txt
```

**Confidence:** HIGH -- static file, spec is simple and well-documented.

---

### 6. Custom Error Pages (404)

**How Cloudflare Pages handles 404s:** Looks for `404.html` in the same directory as the request path, then walks up the directory tree until it finds one, ending at root `/404.html`.

**Strategy -- per-language 404 pages:**
```
src/pages/en/404.astro  --> dist/client/en/404.html   (English 404)
src/pages/it/404.astro  --> dist/client/it/404.html   (Italian 404)
src/pages/es/404.astro  --> dist/client/es/404.html   (Spanish 404)
src/pages/fr/404.astro  --> dist/client/fr/404.html   (French 404)
src/pages/pt/404.astro  --> dist/client/pt/404.html   (Portuguese 404)
src/pages/404.astro     --> dist/client/404.html       (Root fallback, English)
```

**How routing works:**
- Request to `/en/nonexistent-page` --> CF looks for `/en/404.html` --> found, serves English 404
- Request to `/it/pagina-inesistente` --> CF looks for `/it/404.html` --> found, serves Italian 404
- Request to `/random-path` --> CF walks up to `/404.html` --> serves root fallback (English)

**Page content:** Use `Base.astro` layout for consistent header/footer/styling. Show friendly message with link back to home page. Include the search component so users can find what they were looking for.

**500 pages:** Not applicable. Pure static sites have no server to produce 500 errors. Cloudflare serves its own error page for infrastructure issues. No action needed.

**New i18n keys:** `error.404.title`, `error.404.heading`, `error.404.message`, `error.404.back_home`, `error.404.search_suggestion` (~5 keys x 5 languages).

**Confidence:** HIGH -- [Cloudflare Pages Serving docs](https://developers.cloudflare.com/pages/configuration/serving-pages/) confirm hierarchical `404.html` lookup.

---

### 7. CSP Configuration -- `_headers` File (NOT Astro's Built-in CSP)

**Critical finding:** Astro 6's `security.csp` feature (stable since 6.0) generates CSP via `<meta>` tags but **only works for SSR/on-demand rendered pages**. It is explicitly incompatible with SSG/prerendered pages. Since this project is 100% SSG, Astro's built-in CSP cannot be used.

Source: [Astro CSP docs](https://docs.astro.build/en/reference/experimental-flags/csp/) -- "These features only exist for pages rendered on demand (SSR)."

**Approach: CSP via `_headers` file with `unsafe-inline` (pragmatic) or hashes (strict)**

**Inline scripts that need CSP allowance:**
1. Dark mode detection in `Base.astro` (`is:inline`, ~8 lines)
2. Language redirect in `index.astro` (`is:inline`, ~12 lines)
3. JSON-LD (`type="application/ld+json"`) -- exempt from `script-src`, not executable

**Bundled scripts (D3, Fuse.js):** Vite outputs these as external `.js` files in `_astro/` with hashed filenames. They load from the same origin, so `script-src 'self'` covers them.

**Option A: Pragmatic CSP with `unsafe-inline` (RECOMMENDED to start)**
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
```

**Why `unsafe-inline` is acceptable here:**
- The site has no user-generated content, no form inputs that render to HTML, no dynamic content injection
- All inline scripts are author-controlled and static
- The primary XSS vector (`unsafe-inline` blocks) does not exist on a read-only SSG site
- The security benefit of hash-based CSP over `unsafe-inline` on a static site with no user input is marginal

**Option B: Strict hash-based CSP (follow-up hardening)**
1. Build the site
2. Run a script to extract inline `<script>` content from built HTML
3. Compute SHA-256 hashes: `echo -n "content" | openssl dgst -sha256 -binary | base64`
4. Replace `'unsafe-inline'` with `'sha256-XXXXX' 'sha256-YYYYY'` in `_headers`

**Problem with hashes:** Every time an inline script changes, hashes break. Requires a build-time script (`scripts/generate-csp-hashes.js`) and CI integration. Worth doing later, not for initial v2.0.

**Analytics domain in CSP:** Must allowlist the analytics script source:
- Cloudflare Web Analytics: `https://static.cloudflareinsights.com`
- Plausible: `https://plausible.io`

Also add `connect-src` for the analytics beacon endpoint if needed.

**Confidence:** HIGH -- Astro SSG + CSP limitation confirmed in official docs. `_headers` approach confirmed by Cloudflare docs.

---

## Component Boundaries (v2.0 Updated)

| Component | Responsibility | Status | Communicates With |
|-----------|---------------|--------|-------------------|
| `public/_headers` | Security headers + CSP | **NEW** | Cloudflare Pages (auto-read at deploy) |
| `public/llms.txt` | LLM discoverability | **NEW** | External AI crawlers |
| `public/robots.txt` | Crawler directives | **MODIFIED** (add llms.txt ref) | Search engines, AI crawlers |
| `src/layouts/Base.astro` | Global HTML shell | **MODIFIED** (analytics script) | All pages |
| `src/components/Footer.astro` | Site footer links | **MODIFIED** (donate link) | i18n/ui.ts for routes |
| `src/i18n/ui.ts` | Translations + routes | **MODIFIED** (~30 new keys, donate route) | All pages + components |
| `src/pages/[lang]/donate.astro` | Donations page | **NEW** (x5 languages) | Base.astro, i18n, Ko-fi (external link) |
| `src/pages/[lang]/404.astro` | Per-language error page | **NEW** (x5 languages) | Base.astro, i18n, Search component |
| `src/pages/404.astro` | Root fallback error | **NEW** | Language detection (same as index.astro) |

## Data Flow Changes

**None.** All v2.0 production-readiness features are either:
- Static configuration files (`_headers`, `llms.txt`)
- New static pages following existing patterns (donations, 404)
- Layout additions (analytics snippet)

The data pipeline (`src/pipeline/`), scoring system (`src/lib/scores.ts`), and build process remain completely unchanged. The only build process addition is Astro's automatic copying of new `public/` files to `dist/client/`.

---

## Recommended Build Order

Dependencies dictate this order:

```
Phase 1: Zero-dependency config files (all parallel, zero risk)
  |-- Create public/_headers (security headers + initial CSP with unsafe-inline)
  |-- Create public/llms.txt
  |-- Update public/robots.txt (add llms.txt reference)
  Deploy and verify headers with curl -I or securityheaders.com

Phase 2: Analytics (single layout change, affects all pages)
  |-- Set up Cloudflare Web Analytics in CF dashboard (get beacon token)
  |-- Add analytics script to Base.astro before </body>
  |-- Update _headers CSP script-src to allow analytics domain
  Deploy and verify analytics collecting data

Phase 3: New pages (parallel after i18n keys added)
  |-- Add all new i18n keys to ui.ts (404 + donate, all 5 languages)
  |-- Add donate route to ui.ts routes object
  |-- Create src/pages/[lang]/404.astro (x5) + root src/pages/404.astro
  |-- Create src/pages/[lang]/donate.astro (x5)
  |-- Add donate link to Footer.astro
  Deploy and verify 404 pages work, donate pages render correctly

Phase 4: Cookie consent assessment (decision gate)
  |-- Verify: does Cloudflare Web Analytics set any cookies? (Answer: No)
  |-- If no cookies anywhere: SKIP cookie consent entirely
  |-- If cookies found: implement CookieConsent.astro + Base.astro integration
```

**Rationale:**
- Phase 1 is pure additive (new files only), zero risk of breaking existing functionality
- Phase 2 changes the global layout -- validate before adding new pages that use it
- Phase 3 follows established page patterns but needs i18n keys committed first
- Phase 4 is a decision gate that depends on Phase 2's analytics choice -- likely results in "skip"

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Using Astro's `security.csp` for SSG
**What:** Enabling `security: { csp: true }` in `astro.config.mjs`
**Why bad:** Only works for SSR pages. SSG pages silently ignore it -- no error, no CSP meta tag generated. Creates a false sense of security.
**Instead:** Use Cloudflare Pages `_headers` file for CSP on static sites.

### Anti-Pattern 2: Embedding Payment Processing
**What:** Building a custom donation form or embedding Ko-fi's JavaScript widget
**Why bad:** PCI compliance burden, CSP complications (external scripts), maintenance cost -- all for a "nice to have" feature on a zero-budget project.
**Instead:** Simple `<a>` link to external Ko-fi page. Zero scripts, zero CSP additions, zero liability.

### Anti-Pattern 3: Full CMP for a Cookieless Site
**What:** Adding CookieYes, OneTrust, or similar Consent Management Platform
**Why bad:** Adds 30-100KB JS, UX friction (banner), legal complexity, ongoing maintenance -- when the site sets literally zero cookies.
**Instead:** Choose cookieless analytics (Cloudflare Web Analytics). No cookies = no consent needed = no banner.

### Anti-Pattern 4: Server-Side 404 Routing
**What:** Adding Cloudflare Functions/Workers for language-aware 404 routing
**Why bad:** Breaks the pure SSG model. Introduces SSR dependency, cold starts, complexity.
**Instead:** Use Cloudflare Pages' built-in hierarchical `404.html` lookup with per-directory files.

### Anti-Pattern 5: Nonce-Based CSP for Static Sites
**What:** Trying to use CSP nonces (`'nonce-XXXX'`) with SSG output
**Why bad:** Nonces require a server to generate a unique value per request and inject it into both the header and each `<script>` tag. Impossible with pre-built static HTML.
**Instead:** Use hash-based CSP (or `unsafe-inline` as pragmatic starting point).

---

## Sources

- [Cloudflare Pages Headers docs](https://developers.cloudflare.com/pages/configuration/headers/) -- `_headers` file format and limits
- [Cloudflare Pages Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/) -- 404.html hierarchical lookup
- [Astro CSP docs](https://docs.astro.build/en/reference/experimental-flags/csp/) -- confirms SSR-only limitation
- [llms.txt specification](https://llmstxt.org/) -- format and required sections
- [Cloudflare Web Analytics](https://developers.cloudflare.com/analytics/web-analytics/) -- free, cookieless analytics
- [Ko-fi donation widget](https://help.ko-fi.com/hc/en-us/articles/360018381678-Ko-fi-tip-widget) -- integration options
- [Plausible privacy-focused analytics](https://plausible.io/privacy-focused-web-analytics) -- cookieless alternative
- [GDPR cookie consent requirements 2025](https://secureprivacy.ai/blog/gdpr-cookie-consent-requirements-2025) -- when consent is/isn't required
- Direct codebase analysis: `Base.astro`, `Footer.astro`, `astro.config.mjs`, `wrangler.toml`, `deploy.yml`, `ui.ts`, `index.astro`
