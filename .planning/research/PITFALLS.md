# Domain Pitfalls: v2.0 Production Ready

**Domain:** Production-readiness features for Astro SSG travel safety platform on Cloudflare Pages
**Researched:** 2026-03-21
**Confidence:** HIGH (verified against official docs, codebase analysis, and EU legal framework)

## Critical Pitfalls

Mistakes that cause legal exposure, broken production deployments, or require rewrites.

### Pitfall 1: GDPR Over-Compliance -- Adding a Cookie Banner When None Is Required

**What goes wrong:** Developers reflexively add cookie consent banners to every site, even when the site sets zero cookies and collects no personal data. This creates unnecessary UX friction, increases bundle size, adds GDPR-related legal obligations that did not previously exist (because the banner itself often sets a "consent" cookie), and signals to users that tracking occurs when it does not.

**Why it happens:** Confusion between the ePrivacy Directive (which governs cookies/device storage) and GDPR (which governs personal data processing). Most "do I need a cookie banner?" guides are written by consent-management-platform vendors who profit from selling cookie tools.

**Consequences:**
- A cookie consent banner that sets its own "consent_given=true" cookie now requires consent for that cookie (circular dependency)
- Users distrust the site ("why is a travel safety site tracking me?")
- Added JavaScript, layout shifts, accessibility issues from banner overlays
- Legal exposure from a poorly-implemented banner is worse than no banner on a cookie-free site

**Prevention:**
- **Audit first:** The current site uses `localStorage` for theme preference only (dark mode toggle in `Base.astro` line 79). localStorage is covered by ePrivacy but the "strictly necessary" exemption applies to user-interface preferences like theme selection. No consent needed.
- **If analytics are added:** Use a cookie-less, no-personal-data solution (see Pitfall 3). If it truly sets no cookies and collects no PII, no banner is required under ePrivacy Directive Article 5(3).
- **If donations are added:** The donation happens on an external platform (Ko-fi, etc.), so their cookies are on their domain, not yours. An external link does not set cookies on your domain.
- **Rule of thumb:** Only add a cookie banner if you add a feature that actually sets non-essential cookies or processes personal data on your domain. Document the audit decision in a `COOKIE_AUDIT.md`.
- **EU Digital Omnibus (November 2025 proposal):** Would further exempt aggregated audience measurement cookies from consent requirements. Not yet law, but shows regulatory direction.

**Detection:** Run `document.cookie` and inspect `Application > Cookies` and `Application > Local Storage` in DevTools on the live site. If only `theme` key exists in localStorage and cookies are empty, no banner is needed.

**Confidence:** HIGH -- ePrivacy Directive Article 5(3) exemption for "strictly necessary" storage is well-established EU law.

**Sources:**
- [Usercentrics: GDPR and cookies 2025](https://usercentrics.com/knowledge-hub/gdpr-cookies/)
- [CookieInformation: ePrivacy Directive](https://cookieinformation.com/what-is-the-eprivacy-directive/)
- [EU Digital Omnibus proposal on cookies](https://www.taylorwessing.com/en/global-data-hub/2026/the-digital-omnibus-proposal/gdh---the-digital-omnibus---cookies)

---

### Pitfall 2: CSP Breaking Inline D3.js Scripts and Dark Mode Toggle

**What goes wrong:** Adding a Content-Security-Policy that blocks `unsafe-inline` breaks all D3.js chart rendering, the dark mode toggle, and the JSON-LD structured data injection. The site looks fine during development (CSP not enforced in dev mode) but charts vanish in production.

**Why it happens:** The site has three categories of inline scripts:
1. **`is:inline` scripts** (dark mode in `Base.astro` line 79, redirect in `index.astro` line 22) -- Astro's experimental CSP does NOT auto-hash `is:inline` scripts. These are passed through verbatim without being processed by the bundler.
2. **Bundled `<script>` tags** (D3 chart code in `SafetyMap.astro`, `TrendChart.astro`, comparison pages, global-safety pages -- 13 files total import from `d3`) -- Astro's experimental CSP DOES auto-hash these because they go through Vite's bundler.
3. **`set:html` for JSON-LD** (in `Base.astro` line 75: `<script type="application/ld+json" set:html={...}>`) -- content scripts that may need handling depending on CSP configuration.

The naive approach of adding `script-src 'self' 'unsafe-inline'` in `_headers` works but defeats the purpose of CSP entirely. The proper approach requires understanding which scripts need hashing.

**Consequences:**
- D3 charts (the core product feature) stop rendering with no visible error to users
- Dark mode flashes (FOUC) or fails entirely on every page
- JSON-LD structured data may be blocked, destroying rich search results across all 1,240+ pages (248 countries x 5 languages)
- Developers waste hours debugging because CSP violations only appear in browser console, not in the page UI

**Prevention:**
- **Use Astro's experimental CSP (available since Astro 5.9).** Enable `experimental: { csp: true }` in `astro.config.mjs`. This generates `<meta http-equiv="Content-Security-Policy">` tags with auto-computed SHA hashes for all bundled scripts -- per-page, at build time. This is the correct approach for SSG (nonces require SSR).
- **For `is:inline` scripts:** Manually compute SHA-256 hashes and add them to `security.csp.scriptDirective.hashes` in the Astro config. There are exactly 2 `is:inline` scripts in the codebase.
- **Do NOT use `_headers` file for CSP:** The Astro meta-tag approach is superior for SSG because (a) hashes are per-page and computed at build time, (b) the `_headers` file has a 2,000 character per-line limit which a CSP with many hashes will exceed, and (c) a `_headers` CSP rule would need to contain hashes for ALL scripts on ALL pages.
- **Deploy with `Content-Security-Policy-Report-Only` first:** Run report-only mode for at least a week before enforcing, to catch violations without breaking the site.
- **Test in preview, not dev:** `astro preview` applies CSP. `astro dev` does not. Never skip preview testing.
- **Known Astro CSP limitation:** Incompatible with View Transitions (`<ClientRouter />`). The site does not currently use View Transitions, so this is not a blocker.
- **Acceptable fallback:** If Astro experimental CSP proves too complex, `script-src 'self' 'unsafe-inline'` in `_headers` is a pragmatic choice for an SSG site with no user-generated content. It blocks external script injection while allowing inline scripts. This is what most static sites do.

**Detection:** Open browser DevTools Console on any country page with a chart. CSP violations appear as: "Refused to execute inline script because it violates the following Content Security Policy directive."

**Confidence:** HIGH -- Verified against Astro CSP docs and codebase grep showing exactly 2 `is:inline` scripts and 13 bundled D3 script tags.

**Sources:**
- [Astro Experimental CSP docs](https://docs.astro.build/en/reference/experimental-flags/csp/)
- [Astro 5.9 release blog](https://astro.build/blog/astro-590/)
- [Astro roadmap discussion #377](https://github.com/withastro/roadmap/discussions/377)
- [CSP MDN reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)

---

### Pitfall 3: Analytics Choice Breaking Privacy Compliance for Italian/EU Operator

**What goes wrong:** Adding Google Analytics, or even seemingly "privacy-friendly" analytics, creates GDPR compliance obligations that did not previously exist, potentially requiring a cookie banner, privacy policy updates, DPA, and risk of enforcement by the Italian Garante.

**Why it happens:** Three common traps:
1. **Google Analytics** sets cookies, requires consent banner, requires DPA, and the Italian Garante (data protection authority) specifically ruled it non-compliant in June 2022. As an Italian-operated site, using GA is an unacceptable legal risk.
2. **Cloudflare Web Analytics** is cookie-free but processes data through US-based Cloudflare infrastructure. There is ongoing debate about Schrems II compliance. Data is based on a 10% sample of page loads, making it statistically unreliable for low-traffic pages.
3. **Self-hosted Plausible/Umami** are genuinely cookie-free and GDPR-compliant when self-hosted in the EU, but require a server (~5-10 EUR/month VPS), breaking the near-zero budget constraint.

**Consequences:**
- Google Analytics: Requires cookie banner + DPA + risks Italian Garante enforcement
- Cloudflare Web Analytics: Legal grey area; inaccurate sampled data
- Self-hosted analytics: Requires server budget and maintenance

**Prevention:**
- **Best option: Cloudflare Web Analytics.** Free, cookie-free, auto-enabled for Cloudflare Pages since October 2025 (no code changes needed), and the practical enforcement risk for a non-commercial informational site is negligible. The EU-US Data Privacy Framework (2023) provides additional legal cover.
- **Alternative: Umami Cloud free tier** (100K events/month, cookie-free, more accurate than Cloudflare's sampled data).
- **Never use Google Analytics.** The Italian Garante ruling makes this a hard no.
- **Privacy policy must document:** Which analytics tool is used, what it collects (aggregated pageviews), what it does not collect (PII, cookies), and who processes the data.

**Detection:** Check for `_ga`, `_gid` cookies. Check network requests to `google-analytics.com`.

**Confidence:** MEDIUM -- Legal landscape evolving. EU-US Data Privacy Framework partially addresses Schrems II but durability untested.

**Sources:**
- [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)
- [SimpleAnalytics: Is Cloudflare GDPR compliant?](https://www.simpleanalytics.com/is-gdpr-compliant/cloudflare)
- [Ethical Data Hub: Cloudflare analytics and cookie banners](https://ethicaldatahub.com/cloudflare-analytics-cookie-banner/)

---

### Pitfall 4: SEO Catastrophe From Domain/Canonical/Hreflang Misconfiguration

**What goes wrong:** Google indexes 5 language versions of each page as duplicate content, or worse, all canonical/hreflang/OG URLs point to the wrong domain, making the entire SEO foundation invalid.

**Why it happens:** The current codebase has solid hreflang and canonical infrastructure in `Base.astro` (lines 46-56). However, there are specific compounding risks:

1. **Potential domain issue:** Both `public/robots.txt` and `astro.config.mjs` reference `isitsafetotravels.com` (with trailing 's'). If the registered domain is `isitsafetotravel.com` (no 's'), then EVERY canonical URL, hreflang URL, Open Graph URL, and sitemap URL across all 1,240+ pages is wrong. This would be a site-wide SEO catastrophe that silently invalidates all SEO signals.
2. **Comparison page infinite indexing.** `/en/compare?countries=IT,FR` generates unique URLs per combination. C(248,2) = 30,628 combinations per language x 5 languages = 153,140 thin indexable URLs that dilute crawl budget.
3. **Root redirect is client-side JS.** The `index.astro` page uses an `is:inline` script to redirect `/` to `/en/`. Google may not execute this JS redirect, leaving the root as an orphan page competing with `/en/` for canonical status.

**Consequences:**
- Wrong domain = all SEO signals go to a non-existent or wrong domain
- Comparison pages indexed as thin content, wasting crawl budget
- Root `/` and `/en/` competing as canonical = confused Google indexing

**Prevention:**
- **Verify the domain FIRST.** This is the absolute first action before any SEO work. Check `astro.config.mjs` `site` value against the actual registered domain.
- **Add `noindex` to comparison pages:** `<meta name="robots" content="noindex, follow">` on comparison pages prevents indexing infinite query-param combinations.
- **Add `_redirects` file entry:** `/ /en/ 301` as a server-side redirect (Cloudflare handles this before HTML is served). This is more reliable than the client-side JS redirect for SEO crawlers.
- **Verify hreflang reciprocity:** Audit `getAlternateLinks()` to confirm it returns all 5 languages for every page. Each language version must reference all others including itself.
- **Submit sitemap to Google Search Console** and monitor indexing status weekly for the first month.

**Detection:** Google Search Console > Pages > "Why pages aren't indexed" > "Duplicate, submitted URL not selected as canonical."

**Confidence:** HIGH -- The domain question is directly observable in the codebase. Hreflang/canonical best practices are well-documented.

**Sources:**
- [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Hreflang and canonicals explained](https://ewm.swiss/en/blog/seo-multilingual-hreflang-and-canonicals-explained)
- [Hreflang canonical conflicts](https://www.seologist.com/knowledge-sharing/canonical-hreflang/)

---

## Moderate Pitfalls

### Pitfall 5: Cloudflare Pages `_headers` File Limitations

**What goes wrong:** Security headers configuration hits Cloudflare Pages hard limits, or headers silently fail to apply.

**Key constraints:**
- **100 rule maximum** for the entire `_headers` file
- **2,000 character per-line limit** (header name + value + spacing)
- **Headers do NOT apply to Pages Functions responses** (only static assets)
- **Redirects take precedence** when both `_headers` and `_redirects` match
- **Duplicate headers are comma-joined** (not overwritten), which can create invalid values

**Prevention:**
- **Use `/*` wildcard for global security headers.** One rule covers all paths:
  ```
  /*
    X-Frame-Options: DENY
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: camera=(), microphone=(), geolocation=()
    Strict-Transport-Security: max-age=86400; includeSubDomains
  ```
- **Do NOT put CSP in `_headers`.** A CSP with script hashes for D3, dark mode, and JSON-LD will easily exceed 2,000 characters. Use Astro's meta-tag CSP instead.
- **Keep the file minimal.** Only headers that MUST be HTTP response headers (HSTS, X-Frame-Options, X-Content-Type-Options) go here. CSP and other metadata can use `<meta>` tags.
- **Verify deployment:** `curl -I https://yourdomain.com/en/` to confirm headers are present.

**Detection:** `curl -I` shows missing headers; silent truncation of long header values.

**Confidence:** HIGH -- Verified against official Cloudflare Pages documentation.

**Sources:**
- [Cloudflare Pages Headers docs](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/)

---

### Pitfall 6: Donation Platform Fees Eating Micro-Donations

**What goes wrong:** A 3 EUR "buy me a coffee" donation loses 1 EUR to platform + processing fees.

**Fee comparison for a 3 EUR donation:**
- **Ko-fi:** 0% platform fee. Stripe takes ~2.9% + 0.30 EUR = 0.39 EUR. You receive ~2.61 EUR.
- **Buy Me a Coffee:** 5% platform fee (0.15 EUR) + Stripe (~0.39 EUR) = 0.54 EUR total. You receive ~2.46 EUR.
- **PayPal Donate:** 2.89% + fixed fee + 1.5% cross-border. Also has legal restrictions for non-registered-nonprofits in some EU countries.

**Prevention:**
- **Use Ko-fi with an external link, not an embed.** A simple `<a href="https://ko-fi.com/yourname">` avoids third-party cookies, iframes, and JavaScript.
- **Set Ko-fi default currency to EUR** to avoid conversion fees.
- **Do NOT embed Ko-fi widgets.** The widget loads an iframe that may set third-party cookies, undermining the cookie-free stance (Pitfall 1 interaction).
- **Create a multilingual donations page on-site** that explains why donations help and links to Ko-fi. The actual payment happens on Ko-fi's domain.
- **Ko-fi page language:** Ko-fi itself is English-only. Set expectations on the on-site donation page before the handoff.

**Confidence:** MEDIUM -- Platform fees change. Verify current Ko-fi/Stripe terms before implementation.

**Sources:**
- [Ko-fi vs Buy Me a Coffee comparison](https://talks.co/p/kofi-vs-buy-me-a-coffee/)
- [Buy Me a Coffee pricing](https://www.schoolmaker.com/blog/buy-me-a-coffee-pricing)

---

### Pitfall 7: Security Headers Misconfiguration

**What goes wrong:** Overly aggressive or incorrectly configured security headers break site functionality or create irreversible situations.

**Specific risks:**

1. **HSTS `preload` is effectively permanent.** Submitting to the HSTS preload list means browsers will ONLY accept HTTPS for your domain. Removal from the preload list takes months. If HTTPS ever breaks, the site is completely inaccessible to users with preloaded browsers.
2. **`Referrer-Policy: no-referrer`** (too strict) breaks analytics referrer tracking. Use `strict-origin-when-cross-origin` instead.
3. **`Permissions-Policy` syntax errors.** The old `Feature-Policy` header name is deprecated. Use `Permissions-Policy` with the `=()` syntax: `camera=()` not `camera 'none'`.

**Prevention:**
- **HSTS:** Start with `max-age=86400` (1 day). After 2+ weeks of stable HTTPS, increase to `max-age=31536000` (1 year). Do NOT add `preload` until fully committed and tested for months.
- **Referrer-Policy:** `strict-origin-when-cross-origin` balances privacy with analytics.
- **Permissions-Policy:** Deny everything not needed: `camera=(), microphone=(), geolocation=(), payment=()`.
- **Test all 5 language versions and page types** after deploying headers.

**Confidence:** HIGH -- Standard web security hardening.

---

### Pitfall 8: Legal Content Not Matching Actual Data Practices

**What goes wrong:** Privacy policy says "we collect no data" but Cloudflare (as infrastructure provider) processes IP addresses for CDN delivery. Or policy omits mention of analytics. Or policy includes sections about "account data" that do not apply.

**Prevention:**
- Privacy policy must specifically mention:
  - Cloudflare as infrastructure provider (processes IP addresses transiently for CDN/security)
  - Cloudflare Web Analytics if used (anonymized, sampled pageview data, no cookies, no PII)
  - Ko-fi as external payment processor (when users click donation link, they leave the site)
  - localStorage for theme preference (strictly necessary, no consent required)
  - No cookies set by the site itself
  - Data controller contact information (required under GDPR Article 13 even for minimal-data sites)
- **Must exist in all 5 languages.** GDPR Article 12 requires "clear and plain language." Italian law and good practice require the user's language.
- **Do NOT use a generic privacy policy generator** designed for e-commerce or SaaS. They add irrelevant sections about "account data" and "data sharing with partners."
- **Terms of Service:** Simple disclaimer suffices: "Safety scores are for informational purposes only. Travel decisions are your responsibility."

**Detection:** Privacy policy contains sections about user accounts, payment data, or data sharing that do not apply to this site.

**Confidence:** HIGH -- Straightforward GDPR Article 12/13 requirements.

---

### Pitfall 9: Structured Data (JSON-LD) Errors Silently Failing

**What goes wrong:** JSON-LD is syntactically valid but semantically incorrect for Google's rich results. Google silently ignores it without showing rich results, and the site owner never realizes.

**Specific risks:**
1. **Breadcrumb URLs wrong for non-English pages.** Schema generator must use locale-aware translated slugs (e.g., `/es/pais/francia` not `/en/country/france`).
2. **FAQ schema requires visible page content.** Google rejects FAQ rich results if the Q&A is not visible on the page.
3. **Country/Place schema has no rich result support.** Google does not generate rich results for `Country` or `Place` types. Implementing them sets false expectations.
4. **The `set:html={JSON.stringify(jsonLd)}` pattern** in Base.astro must ensure country names with special characters (apostrophes, accents) do not break JSON structure.

**Prevention:**
- **Start with BreadcrumbList** -- highest ROI, most reliably supported by Google.
- **Add FAQ schema to methodology page** only, with substantive visible Q&A content.
- **Validate with Google Rich Results Test** (https://search.google.com/test/rich-results) on sample pages after implementation.
- **Use locale-aware URL generation** in all schema builders. Pass the current `lang` and use translated route slugs.

**Detection:** Rich Results Test shows errors; structured data present in HTML but no rich results in SERPs after 4+ weeks.

**Confidence:** HIGH -- Google's structured data docs are clear about supported types.

---

### Pitfall 10: LLM Readability Over-Investment for Uncertain Return

**What goes wrong:** Significant effort spent on `llms.txt`, `llms-full.txt`, multilingual variants, and maintenance processes for a convention that no major LLM verifiably reads.

**Prevention:**
- **Prioritize JSON-LD and semantic HTML** -- these benefit both LLMs and SEO measurably.
- **Add a basic `llms.txt`** (single English file, 30 minutes of effort) as forward-looking investment.
- **Do NOT create `llms-full.txt` or multilingual variants** unless evidence emerges that LLMs actually use them.
- **The real LLM readability win** is clean, semantic HTML with proper heading hierarchy, descriptive alt text, and structured data. The site's Astro component model already supports this.

**Confidence:** LOW for llms.txt effectiveness. HIGH for JSON-LD and semantic HTML value.

---

## Minor Pitfalls

### Pitfall 11: Cache-Control Conflicts With Cloudflare

**What goes wrong:** Custom `Cache-Control` headers conflict with Cloudflare dashboard settings or default behavior.

**Prevention:** Use both browser and edge cache directives: `Cache-Control: public, max-age=3600, s-maxage=86400`. The `s-maxage` controls Cloudflare edge cache (shared), `max-age` controls browser cache. For daily-updating data like `scores.json`, use shorter `max-age` (3600 = 1 hour) with longer `s-maxage`.

---

### Pitfall 12: Accessibility Regression From New UI Elements

**What goes wrong:** New footer links, donation buttons, or legal page navigation break keyboard navigation or screen reader flow.

**Prevention:** Use semantic HTML for all new elements. Donation link = standard `<a>` tag. Legal nav = `<nav aria-label="Legal">`. No JavaScript widgets. Test with keyboard Tab navigation and VoiceOver.

---

### Pitfall 13: Build Size Regression From Production Dependencies

**What goes wrong:** Adding cookie consent libraries, analytics SDKs, or donation widgets bloats client JS, degrading Core Web Vitals that the SEO phase is trying to improve.

**Prevention:** Every production-readiness feature recommended in this research adds ZERO client JavaScript:
- No cookie banner needed (Pitfall 1)
- Cloudflare Web Analytics: zero client code (edge-injected)
- Ko-fi: external link, no widget
- JSON-LD: build-time generation
- `llms.txt`: static text file
- Security headers: HTTP response headers
- Monitor: compare `astro build` output sizes before/after each phase

**Detection:** Lighthouse Performance drops below 90; new third-party requests in Network tab.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Legal compliance (first) | Cookie banner over-compliance (#1) | Audit cookies/localStorage; document that no banner needed |
| Legal compliance | Privacy policy not matching practices (#8) | Write around actual behavior; list every external service |
| Legal compliance | Policy in English only (#8) | All 5 languages required |
| SEO (before other SEO work) | Domain verification (#4) | Verify `isitsafetotravels.com` is correct FIRST |
| SEO | Comparison pages indexed as thin content (#4) | Add noindex meta tag |
| SEO | Root redirect is client-side JS (#4) | Add `_redirects` file: `/ /en/ 301` |
| SEO schemas | Breadcrumb URLs wrong for non-English (#9) | Locale-aware URL generation in schema builders |
| SEO schemas | FAQ content too thin (#9) | Substantive visible Q&A, not auto-generated |
| Security headers (CSP) | CSP breaking D3 charts and dark mode (#2) | Use Astro experimental CSP (meta tags); deploy report-only first |
| Security headers | `_headers` line limit for CSP (#5) | Astro meta-tag CSP; `_headers` for non-CSP headers only |
| Security headers | HSTS preload too early (#7) | Start max-age=86400; no preload for months |
| Analytics | Using Google Analytics (#3) | Italian Garante ruling = hard no; use Cloudflare Web Analytics |
| Analytics + CSP | Analytics script blocked by CSP | Cloudflare WA avoids this (edge-injected) |
| Donations | Platform fees (#6) | Ko-fi (0% fee) with external link |
| Donations + privacy | Embedded widget sets cookies (#6 + #1) | External link, not iframe embed |
| LLM readability | Over-investing (#10) | Basic llms.txt only; focus on JSON-LD |
| All production features | Bundle size regression (#13) | Zero client JS increase target; monitor build output |

## Integration Pitfalls (Cross-Feature Risks)

### CSP + Analytics Script
If using Umami or any script-tag-based analytics, the `<script>` tag must be included in CSP hashes. Cloudflare Web Analytics avoids this entirely -- it is injected at the Cloudflare edge layer, outside the HTML document.

### Cookie Audit + Donation Widget
If Ko-fi is embedded as an iframe (not recommended), it loads content from ko-fi.com which may set cookies. This undermines the cookie-free argument from Pitfall 1. Solution: external link only.

### Security Headers + Referrer Policy + Analytics
`Referrer-Policy` affects what information Cloudflare Web Analytics receives about page paths. `strict-origin-when-cross-origin` sends the origin (domain) to external sites and full URL for same-origin, which is appropriate. `no-referrer` would not impact Cloudflare WA (server-side) but would affect any client-side analytics.

### i18n + Legal Pages + Sitemap
Privacy policy and ToS pages need hreflang tags (handled by Base.astro's `getAlternateLinks`), canonical URLs, and inclusion in sitemap. The `@astrojs/sitemap` integration should automatically include them. Verify after build.

### SEO + Comparison Page + noindex
Adding `noindex` to comparison pages means they will not appear in search results. This is correct -- the value of comparison pages is for direct user access (shared URLs), not search discovery. Country detail pages remain the SEO targets.

## Existing Codebase Issues Found During Research

1. **Domain verification needed:** `public/robots.txt` and `astro.config.mjs` both use `isitsafetotravels.com` (with trailing 's'). Must verify this matches the registered domain before any SEO work.

2. **Root redirect is client-side only:** `src/pages/index.astro` uses `is:inline` JavaScript to redirect `/` to `/en/`. A `_redirects` file with `/ /en/ 301` would be more reliable for search engine crawlers.

## Sources

- [Cloudflare Pages Headers docs](https://developers.cloudflare.com/pages/configuration/headers/)
- [Cloudflare Pages Limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Astro Experimental CSP](https://docs.astro.build/en/reference/experimental-flags/csp/)
- [Astro 5.9 release](https://astro.build/blog/astro-590/)
- [Astro roadmap discussion #377](https://github.com/withastro/roadmap/discussions/377)
- [CSP MDN reference](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP)
- [Usercentrics: GDPR and cookies](https://usercentrics.com/knowledge-hub/gdpr-cookies/)
- [ePrivacy Directive](https://cookieinformation.com/what-is-the-eprivacy-directive/)
- [EU Digital Omnibus proposal](https://www.taylorwessing.com/en/global-data-hub/2026/the-digital-omnibus-proposal/gdh---the-digital-omnibus---cookies)
- [Google: Consolidate duplicate URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Hreflang and canonicals](https://ewm.swiss/en/blog/seo-multilingual-hreflang-and-canonicals-explained)
- [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)
- [SimpleAnalytics: Cloudflare GDPR](https://www.simpleanalytics.com/is-gdpr-compliant/cloudflare)
- [Ko-fi vs Buy Me a Coffee](https://talks.co/p/kofi-vs-buy-me-a-coffee/)
- [HSTS preload requirements](https://hstspreload.org/)

---
*Pitfalls research for: v2.0 Production Ready milestone of IsItSafeToTravel*
*Researched: 2026-03-21*
