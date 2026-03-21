# Feature Landscape: v2.0 Production Ready

**Domain:** Production-readiness features for a free, open-source, data-driven informational website (EU-based, no user accounts, no cookies currently)
**Researched:** 2026-03-21
**Milestone:** v2.0 Production Ready
**Confidence:** HIGH (legal requirements verified via multiple sources; technical features verified against Cloudflare/Astro documentation)

## Legal Classification Key

Throughout this document, features are tagged:

- **[REQUIRED]** -- Legally mandated for an EU-based informational website
- **[CONDITIONAL]** -- Required only if certain conditions are met (noted)
- **[BEST PRACTICE]** -- Not legally required, but expected by users/search engines/industry standards
- **[DIFFERENTIATOR]** -- Competitive advantage, not expected

---

## Existing Infrastructure (relevant to v2.0 features)

| Asset | Location | How v2.0 Uses It |
|-------|----------|-------------------|
| `seo.ts` | `src/lib/` | JSON-LD builders for WebPage, Place, AggregateRating, WebSite+SearchAction. Extend with BreadcrumbList, Organization, FAQPage, Dataset schemas. |
| Legal page | `src/pages/{lang}/legal/` | Basic disclaimer in 5 languages. Expand into proper privacy policy + terms structure. |
| `robots.txt` | `public/` | Exists but has typo in sitemap URL ("isitsafetotravels" vs "isitsafetotravel"). Extend with AI crawler directives. |
| `Base.astro` | `src/layouts/` | Main layout. Add skip-nav link, security meta tags, analytics snippet slot. |
| i18n system | `src/i18n/` | 5 languages (EN, IT, ES, FR, PT). Donations page and expanded legal pages need translation keys. |
| D3 map + charts | `src/components/` | Client-side SVG. Need ARIA labels, keyboard navigation, color contrast audit. |
| Cloudflare Pages | Deployment | Supports `_headers` file for security headers, `404.html` for custom error pages. |

---

## 1. GDPR / ePrivacy Legal Compliance

### Context

The site is EU-based, informational-only, no user accounts, no login, no cookies, no forms, no personal data collection. The ePrivacy Regulation was withdrawn by the European Commission in February 2025; the existing ePrivacy Directive remains in force. GDPR applies only when personal data is processed.

### Table Stakes

| Feature | Legal Status | Why Expected | Complexity | Notes |
|---------|-------------|--------------|------------|-------|
| Privacy Policy page | **[CONDITIONAL]** -- required if ANY personal data is processed | Even Cloudflare Web Analytics (no personal data) warrants a transparency page explaining what IS and IS NOT collected. Multiple EU member states expect transparency regardless. | Low | Expand existing legal page or create separate privacy policy page. State clearly: "This site does not use cookies, does not collect personal data, and does not track users." |
| Terms of Service / Disclaimer | **[BEST PRACTICE]** | Protects against liability for safety score accuracy. Partially exists in current legal page. | Low | Review and formalize existing legal page content. |
| Imprint / Legal Notice | **[REQUIRED]** in DE/AT/CH; **[BEST PRACTICE]** elsewhere in EU | Several EU member states mandate website operator identification (Telemediengesetz in Germany, E-Commerce-Gesetz in Austria). | Low | Include: operator name/contact, responsible person. Costs nothing, builds trust. Add to existing legal page structure. |
| Data source attribution | **[BEST PRACTICE]** | Transparency about where safety data originates. Already exists. | None | Already implemented via sources section. No changes needed. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Cookie consent banner (no cookies to consent to) | Legally unnecessary; hurts UX; signals tracking where none exists; adds JS weight | Maintain zero-cookie architecture. Document this in privacy policy. |
| Full consent management platform (OneTrust, Cookiebot) | Overkill for a site with no personal data collection. Adds 50-200KB JS. Costs money. | Not needed unless cookies are introduced. |
| Email newsletter / contact forms | Introduces GDPR obligations (consent records, right to erasure, data portability, DPO considerations) | Keep site anonymous. Use donation platforms for community engagement. |
| Google reCAPTCHA | Sets cookies, transfers data to Google, requires consent banner | No forms exist; no CAPTCHA needed. |

### Dependencies
- Legal pages already exist in 5 languages -- expand, do not rebuild
- Zero-cookie architecture is the baseline -- every feature decision must preserve it

---

## 2. Advanced SEO (2025-2026)

### Context

Already implemented: JSON-LD (WebPage, Place, AggregateRating, WebSite+SearchAction), unique meta descriptions per country, XML sitemap, hreflang tags, robots.txt. Less than 30% of websites implement schema properly -- the site is already ahead.

### Table Stakes

| Feature | Legal Status | Why Expected | Complexity | Notes |
|---------|-------------|--------------|------------|-------|
| BreadcrumbList schema markup | **[BEST PRACTICE]** | Google displays breadcrumb trails in SERPs. Case studies show ~3% CTR improvement. Currently missing. | Low | Path: Home > Countries > [Country]. Add `buildBreadcrumbJsonLd()` to `seo.ts`. |
| Organization schema | **[BEST PRACTICE]** | Establishes site identity in Google Knowledge Graph. Missing from homepage JSON-LD. | Low | Add Organization node with name, url, logo to homepage `@graph`. |
| robots.txt sitemap URL fix | **[REQUIRED]** for correct SEO | Current robots.txt points to "isitsafetotravels.com" (extra 's'). Google may not be discovering the sitemap. | Trivial | Fix the typo immediately. |
| Image/SVG alt text and ARIA | **[BEST PRACTICE]** | D3 map and charts lack descriptive text alternatives. Google uses alt text for image indexing. | Medium | SVG charts need `role="img"` and `aria-label`. Map needs descriptive fallback text. |
| Breadcrumb navigation UI component | **[BEST PRACTICE]** | Visual breadcrumbs help users orient on multi-level site. Pairs with BreadcrumbList schema. | Low | Simple component: Home > [Section] > [Page]. ~50 lines. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Dataset schema (schema.org/Dataset) | Signals to Google Dataset Search that safety data is a structured dataset. Very few travel safety sites do this. | Medium | Dataset schema with distribution (JSON), temporal coverage (daily), spatial coverage (global). |
| FAQPage schema on methodology | Methodology page has expandable Q&A content -- natural FAQPage candidate. Google restricted FAQ rich results to authoritative sites Aug 2023, but schema still helps LLMs. | Low | Low effort addition to methodology JSON-LD. |
| SpeakableSpecification schema | Marks content for voice assistants (Google Assistant). Future-proofing. | Low | Apply to country summary paragraphs. |
| Internal cross-linking | Link country pages to comparison, methodology, global score. Improves crawl depth and page authority. | Medium | Template changes across country detail pages. |
| Core Web Vitals audit | Only 54.6% of sites pass CWV. SSG should score well but D3 client-side rendering may affect LCP/INP. | Medium | Profile with Lighthouse; optimize D3 bundle if needed. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Pre-generated comparison pages | C(248,2) = 30K+ pages; bloats build; Google may see as thin content | Keep client-side comparison. Assess organic demand later. |
| Keyword-stuffed meta descriptions | Google penalizes over-optimization | Current data-driven descriptions are already excellent. |
| AMP pages | Google no longer prioritizes AMP. Astro SSG is already fast. | Focus on Core Web Vitals. |

### Dependencies
- `seo.ts` has existing JSON-LD builders -- extend with new functions
- robots.txt needs immediate typo fix

---

## 3. LLM Readability / Discoverability

### Context

LLMs increasingly surface website content in AI search (ChatGPT, Perplexity, Google AI Overviews). The llms.txt standard was proposed in 2024 by Jeremy Howard (Answer.AI). No major LLM company has officially committed to reading these files, but adoption is growing among documentation sites. For a data-driven site, machine-readable data is a natural fit.

### Table Stakes

| Feature | Legal Status | Why Expected | Complexity | Notes |
|---------|-------------|--------------|------------|-------|
| /llms.txt file | **[BEST PRACTICE]** | Emerging standard. Markdown file listing key pages. Low cost, high potential. | Low | Curated list: homepage, methodology, global safety, sample country pages. Follow spec: H1, blockquote summary, H2 sections. Static file in `public/`. |
| Semantic HTML audit | **[BEST PRACTICE]** | Proper heading hierarchy and landmarks improve LLM content extraction. | Low | Audit Astro templates for `<main>`, `<nav>`, `<article>`, `<section>`. Likely mostly correct. |
| AI crawler directives in robots.txt | **[BEST PRACTICE]** | Explicitly allow AI crawlers (GPTBot, ClaudeBot, etc.). Site is open data -- visibility is the goal. | Low | Add User-agent rules. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| /llms-full.txt auto-generated at build | Complete site content in single Markdown. Enables RAG pipelines to ingest all data in one request. | Medium | Build step: concatenate methodology + all 248 country summaries. ~50-100KB. |
| Static JSON data endpoint (/api/scores.json) | Machine-readable safety scores. Enables LLMs, researchers, developers to consume data. | Low-Medium | Pipeline already produces data. Expose subset as static file. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Blocking AI crawlers | Site is open data; visibility serves the mission | Explicitly allow all AI crawlers |
| Over-optimizing for single LLM | llms.txt is LLM-agnostic | Follow the standard spec |

### Dependencies
- robots.txt exists -- extend (and fix typo)
- Build pipeline produces JSON data -- expose subset
- All content rendered as static HTML (SSG)

---

## 4. Cookie Consent System

### Context

**This is the most critical architecture decision.** The site currently sets ZERO cookies. The ePrivacy Directive requires consent only for non-essential cookies. No cookies = no consent needed.

### Decision: Maintain Zero-Cookie Architecture

| Feature | Legal Status | Why Expected | Complexity | Notes |
|---------|-------------|--------------|------------|-------|
| NO cookie consent banner | **[REQUIRED approach]** -- banner NOT needed when no cookies set | ePrivacy Directive exempts sites with no non-essential cookies. Adding an unnecessary banner hurts UX and falsely signals tracking. | None | **Correct and recommended.** Every technology choice must preserve zero-cookie status. |
| Cookie audit documentation | **[BEST PRACTICE]** | Proof that no cookies are set. Useful if regulators inquire. | Low | Verify with browser DevTools. Document in privacy policy. |
| Privacy policy cookie statement | **[BEST PRACTICE]** | Proactive transparency: "This site does not use cookies." | Low | Single paragraph in privacy policy. |

### Conditional Features (only if architecture changes)

| Feature | Trigger Condition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cookie consent banner | ONLY if future feature introduces non-essential cookies | Medium | If ever needed: lightweight (~3KB JS), equal-prominence accept/reject per 2025 EU guidance. **Strongly recommend never triggering this.** |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Preemptive cookie consent banner | Legally unnecessary; UX damage; false tracking signal; JS bloat | Maintain zero-cookie architecture |
| Google Analytics | Sets 5+ cookies; requires consent; sends data to US (Schrems II) | Cloudflare Web Analytics (free, zero cookies) |
| YouTube/Vimeo embeds | Set tracking cookies; require consent | Self-host video or use privacy-enhanced embed modes |
| Social media widget buttons | Set third-party cookies; significant JS weight | Simple `<a href>` share links with pre-filled URLs |
| Google Fonts CDN | Transfers IP data (ruled personal data by German courts Jan 2022) | Self-host fonts or use system font stack |

### Dependencies
- **CRITICAL:** Analytics choice determines cookie status. CF Web Analytics = zero cookies.
- Every third-party integration must be audited for cookie behavior before inclusion.

---

## 5. Donation Platform

### Context

Free, open-source, ~10 EUR/month budget. No user accounts. Donations handled by external platforms -- no payment processing on-site.

### Table Stakes

| Feature | Legal Status | Why Expected | Complexity | Notes |
|---------|-------------|--------------|------------|-------|
| Dedicated donations page | **[BEST PRACTICE]** | Central place explaining what donations fund. | Medium | Multilingual (5 languages), ~20 new i18n keys. |
| Platform links (external) | **[BEST PRACTICE]** | Users need a way to donate. External links only. | Low | Buttons to GitHub Sponsors + Ko-fi. No server-side code. |
| Funding transparency | **[BEST PRACTICE]** | Open-source community expects transparency. | Low | "Donations cover: hosting (~X EUR/mo), domain (~Y EUR/yr)." |
| Footer donation link | **[BEST PRACTICE]** | Discoverable from any page. | Low | Small i18n addition to footer. |
| FUNDING.yml in repo | **[BEST PRACTICE]** | GitHub displays "Sponsor" button on repository. | Trivial | Single YAML file. |

### Platform Recommendation

| Platform | Fees | Recurring | One-time | Recommendation |
|----------|------|-----------|----------|----------------|
| **GitHub Sponsors** | 0% | Yes | Yes | **Primary.** Zero fees. Best for developer audience. |
| **Ko-fi** | 0% on donations | Yes | Yes | **Secondary.** Zero fees. No account needed to donate. Good for general audience. |
| Open Collective | ~10% | Yes | Yes | **Skip.** High fees. Overkill for small project. |
| Buy Me a Coffee | 5% | Yes | Yes | **Skip.** Ko-fi does same with zero fees. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sponsor acknowledgment section | Public "thank you" list. Encourages contributions. | Low | Manual or build-time generated. |
| Funding goal progress | Shows progress toward monthly costs. Visual motivator. | Low | Simple text/bar on donations page. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Paywalled content | Contradicts open-source mission; destroys SEO | All data free; donations voluntary |
| Ads / affiliate links | PROJECT.md out of scope; introduces cookies/consent | Revisit only if donations insufficient |
| Embedded payment forms | Could introduce cookies from payment providers; server-side complexity | External links only |
| Stripe/PayPal direct integration | PCI compliance, server code, maintenance | Use platforms that handle payments |

### Dependencies
- i18n system ready for new page
- Legal page structure exists
- No server-side code required

---

## 6. Privacy-Respecting Analytics

### Context

Need basic traffic insights without cookies and without compromising zero-consent architecture.

### Recommendation: Cloudflare Web Analytics

| Criterion | CF Web Analytics | Plausible Cloud | Umami Self-Host |
|-----------|-----------------|-----------------|-----------------|
| **Cost** | Free (CF Pages included) | $9+/month | Free (VPS ~$5/mo) |
| **Cookies** | None | None | None |
| **Personal data** | None | None | None |
| **Consent needed** | No | No | No |
| **Setup** | Auto-enabled Oct 2025 for CF free domains | Script tag | Deploy server |
| **Features** | Pageviews, paths, referrers, countries | Goals, funnels, UTM, events | Events, custom data |
| **Maintenance** | Zero | Zero (managed) | Ongoing |

**Use Cloudflare Web Analytics.** Zero cost, zero cookies, zero maintenance, zero consent requirements. Auto-enabled for free CF domains since October 2025 -- may already be active. Features (pageviews, top pages, referrers, geographic breakdown) are sufficient for an informational site.

**Upgrade path:** Plausible Cloud ($9/mo) if richer analytics needed later. Still cookie-free, EU-hosted.

### Table Stakes

| Feature | Legal Status | Why Expected | Complexity | Notes |
|---------|-------------|--------------|------------|-------|
| Basic pageview analytics | **[BEST PRACTICE]** | Understand traffic patterns, popular pages | Low | CF Web Analytics |
| Cookie-free implementation | **[REQUIRED to preserve no-consent]** | Must not introduce cookies | None | CF Web Analytics: no cookies, no localStorage, no fingerprinting |
| Privacy policy disclosure | **[BEST PRACTICE]** | Disclose CF Web Analytics usage | Low | Paragraph in privacy policy |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Google Analytics (GA4) | Cookies; consent banner; data to US | CF Web Analytics |
| Session recording (Hotjar, FullStory) | Personal data; consent; massive JS | Not needed for static content |
| Self-hosted analytics | VPS maintenance; exceeds budget | CF Web Analytics at zero cost |
| Multiple analytics tools | Diminishing returns; JS weight | Single tool sufficient |

### Dependencies
- Deployed on Cloudflare Pages -- CF Web Analytics is native
- May already be auto-enabled -- verify in dashboard
- Privacy policy should disclose

---

## 7. Production Hardening

### 7a. Security Headers

All via single `public/_headers` file for Cloudflare Pages.

| Feature | Legal Status | Complexity | Notes |
|---------|-------------|------------|-------|
| Content-Security-Policy (CSP) | **[BEST PRACTICE]** | Medium | D3 inline scripts/styles require CSP hashing. Use `astro-cloudflare-pages-headers` for auto-hashing. Most complex header. |
| Strict-Transport-Security (HSTS) | **[BEST PRACTICE]** | Low | `max-age=31536000; includeSubDomains; preload` |
| X-Content-Type-Options | **[BEST PRACTICE]** | Low | `nosniff` |
| X-Frame-Options | **[BEST PRACTICE]** | Low | `DENY` |
| Referrer-Policy | **[BEST PRACTICE]** | Low | `strict-origin-when-cross-origin` |
| Permissions-Policy | **[BEST PRACTICE]** | Low | `camera=(), microphone=(), geolocation=(), interest-cohort=()` |

### 7b. Error Pages

| Feature | Legal Status | Complexity | Notes |
|---------|-------------|------------|-------|
| Custom 404 page | **[BEST PRACTICE]** | Medium | Multilingual: detect language from URL prefix. Search suggestion + homepage link. Astro `src/pages/404.astro`. |
| Custom 5xx page | **[BEST PRACTICE]** | N/A | Requires CF Business plan or Workers on free tier. Accept CF default 5xx pages. |

### 7c. Accessibility (WCAG 2.1 AA)

EU European Accessibility Act (EAA) entered force June 2025. While a non-commercial informational site may not fall directly under EAA, WCAG 2.1 AA is the project's stated constraint.

| Feature | Legal Status | Complexity | Notes |
|---------|-------------|------------|-------|
| Skip navigation link | **[REQUIRED]** WCAG 2.4.1 | Low | Hidden `<a>` in Base.astro, visible on `:focus`. |
| Focus indicators | **[REQUIRED]** WCAG 2.4.7 | Low | Tailwind `focus-visible:ring-2` on all interactive elements. |
| Color contrast audit | **[REQUIRED]** WCAG 1.4.3 | Medium | 4.5:1 normal text, 3:1 large text. Check light + dark mode. |
| ARIA labels for charts/map | **[REQUIRED]** WCAG 1.1.1 | Medium | `role="img"` + `aria-label` on SVG. Data table alternative for screen readers. |
| Keyboard navigation | **[REQUIRED]** WCAG 2.1.1 | High | D3 map keyboard support is hardest item. Comparison dropdown needs keyboard. |
| Form labels | **[REQUIRED]** WCAG 1.3.1 | Low | Verify search/comparison inputs have `<label>` or `aria-label`. |
| Heading hierarchy | **[BEST PRACTICE]** | Low | One H1 per page, no skipped levels. |

### 7d. Caching and Performance

| Feature | Legal Status | Complexity | Notes |
|---------|-------------|------------|-------|
| Cache-Control headers | **[BEST PRACTICE]** | Low | Static assets: `max-age=31536000, immutable`. HTML: `max-age=3600`. In `_headers` file. |
| Asset fingerprinting | **[BEST PRACTICE]** | None | Astro already handles with hashed filenames. |
| Font loading optimization | **[BEST PRACTICE]** | Low | `font-display: swap` + preload if custom fonts used. |

---

## Feature Dependencies (Complete Map)

```
Zero-Cookie Architecture (PRESERVE -- foundation of legal compliance)
    |
    +--> Cloudflare Web Analytics (no cookies, free, auto-enabled)
    |       +--> Privacy policy disclosure
    |
    +--> No consent banner needed
    |
    +--> External-only donation links (no payment forms)

Security Headers (public/_headers -- single file)
    |
    +--> HSTS, X-Content-Type-Options, X-Frame-Options,
    |    Referrer-Policy, Permissions-Policy: all independent
    |
    +--> CSP: depends on D3 inline script/style audit
    |       +--> Consider astro-cloudflare-pages-headers integration
    |
    +--> Cache-Control: same _headers file

SEO Schema Extensions (extend seo.ts)
    |
    +--> BreadcrumbList: independent
    +--> Organization: independent
    +--> FAQPage: depends on methodology structure
    +--> Dataset: depends on public data format decision

LLM Readability
    |
    +--> /llms.txt: independent (static file)
    +--> /llms-full.txt: depends on build pipeline
    +--> robots.txt AI directives: independent
    +--> /api/scores.json: depends on data pipeline

Legal Pages
    |
    +--> Privacy policy: depends on analytics choice
    +--> Imprint: independent
    +--> Donation terms: depends on platform choice

Donations Page
    |
    +--> ~20 i18n keys x 5 languages
    +--> FUNDING.yml: independent

Custom 404 Page
    |
    +--> Language detection from URL path
    +--> Uses Base.astro layout

Accessibility
    |
    +--> Skip nav, focus indicators: Base.astro + CSS (do first)
    +--> ARIA labels: D3 component modifications
    +--> Color contrast: design token audit
    +--> Keyboard navigation: D3 refactoring (HIGHEST EFFORT, do last)
```

---

## MVP Recommendation

### Priority 1: Immediate Wins (trivial-to-low, high impact)

1. **robots.txt fix** -- sitemap URL typo actively hurting SEO
2. **Security headers** (`_headers` file) -- all except CSP, single file
3. **CF Web Analytics verification** -- likely auto-enabled; verify
4. **Skip navigation link** -- WCAG, ~10 lines in Base.astro
5. **Focus indicators audit** -- Tailwind `focus-visible` check
6. **FUNDING.yml** -- GitHub Sponsors + Ko-fi, 5 lines

### Priority 2: High-Value, Low-Medium Complexity

7. **Privacy policy page** -- expand legal page; disclose analytics; no-cookie statement
8. **BreadcrumbList schema + UI component** -- immediate SEO benefit
9. **Organization schema** -- add to homepage JSON-LD
10. **/llms.txt** -- static Markdown file
11. **Custom 404 page** -- multilingual, helpful navigation
12. **AI crawler directives in robots.txt**

### Priority 3: Medium Complexity, High Value

13. **Donations page** (5 languages) with GitHub Sponsors + Ko-fi
14. **CSP header with D3 inline hashing** -- most complex header
15. **ARIA labels for D3 charts and map** -- accessibility
16. **Color contrast audit** (light + dark mode)
17. **Form labels audit**
18. **/llms-full.txt auto-generation**

### Priority 4: Differentiators (defer if time-constrained)

19. **Dataset schema markup**
20. **FAQPage schema on methodology**
21. **Internal cross-linking strategy**
22. **Static JSON endpoint** (/api/scores.json)
23. **SpeakableSpecification schema**

### Defer Entirely

- **Cookie consent banner** -- not needed; preserve zero-cookie architecture
- **D3 map full keyboard navigation** -- highest effort a11y item; do after others
- **Google Analytics / session recording** -- contradicts privacy architecture
- **Self-hosted analytics** -- unnecessary given CF Web Analytics
- **Custom 5xx pages** -- requires CF Business plan

---

## Complexity Estimates

| Feature Group | Effort | Key Risk |
|---------------|--------|----------|
| robots.txt fix + AI directives | Trivial (0.5h) | None |
| Security headers (non-CSP) | Low (2h) | None |
| CSP with D3 hashing | Medium (4-8h) | D3 inline scripts may need refactoring |
| CF Web Analytics verification | Trivial (0.5h) | May need JS snippet if not auto-enabled |
| Privacy policy expansion | Low (2-4h) | Wording accuracy across 5 languages |
| BreadcrumbList + Org schema + UI | Low (3-4h) | None |
| /llms.txt + /llms-full.txt | Medium (3-5h) | Build pipeline integration for full txt |
| Custom 404 page | Medium (3-4h) | Language detection |
| Donations page (5 langs) | Medium (4-6h) | ~20 keys x 5 languages |
| Accessibility audit + fixes | Medium-High (8-12h) | D3 ARIA + keyboard is the long pole |
| Color contrast audit | Medium (3-4h) | May need design token adjustments |
| Dataset/FAQ schema | Low (2-3h) | None |
| **Total estimate** | **~35-55 hours** | CSP + accessibility are main risks |

---

## Sources

### Legal / GDPR / ePrivacy
- [GDPR Cookie Consent Requirements 2025](https://secureprivacy.ai/blog/gdpr-cookie-consent-requirements-2025) -- ePrivacy Directive withdrawal, current enforcement
- [Cloudflare ePrivacy Directive explainer](https://www.cloudflare.com/learning/privacy/what-is-eprivacy-directive/) -- cookie consent scope
- [GDPR.eu Cookies Guide](https://gdpr.eu/cookies/) -- when consent is / is not required
- [iubenda Cookies and GDPR](https://www.iubenda.com/en/help/5525-cookies-gdpr-requirements/) -- strictly necessary cookie exception
- [EU Cookie Compliance 2025](https://usercentrics.com/knowledge-hub/eu-cookie-compliance/) -- member state implementation
- [ICO Privacy Information Guide](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/) -- privacy disclosure requirements

### Analytics
- [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/) -- free, no cookies, no personal data
- [CF Web Analytics auto-enabled Oct 2025](https://x.com/Cloudflare/status/1968395474420871174) -- default for free domains
- [CF Web Analytics GDPR discussion](https://community.cloudflare.com/t/web-analytics-without-cookie-banner-gdpr-conform/238770) -- conformity without consent
- [Plausible vs Umami](https://vemetric.com/blog/plausible-vs-umami) -- upgrade path comparison

### SEO
- [Schema markup for travel websites](https://blackbearmedia.io/11-powerful-schema-markup-strategies-for-travel-websites/) -- BreadcrumbList, Dataset
- [FAQ Schema 2025-2026](https://searchengineland.com/faq-schema-rise-fall-seo-today-463993) -- Google restrictions
- [BreadcrumbList SEO impact](https://searchengineland.com/guide/seo-breadcrumbs) -- CTR data
- [Schema markup 2026](https://almcorp.com/blog/schema-markup-detailed-guide-2026-serp-visibility/) -- current practices
- [Google Structured Data docs](https://developers.google.com/search/docs/appearance/structured-data) -- official reference

### LLM Readability
- [llms.txt specification](https://llmstxt.org/) -- official standard
- [Semrush llms.txt analysis](https://www.semrush.com/blog/llms-txt/) -- adoption status
- [Yoast SEO llms.txt spec](https://developer.yoast.com/features/llms-txt/functional-specification/) -- format details
- [GitBook llms.txt guide](https://www.gitbook.com/blog/what-is-llms-txt) -- implementation

### Security Headers
- [Cloudflare Pages Headers docs](https://developers.cloudflare.com/pages/configuration/headers/) -- `_headers` file format
- [Astro CSP for CF Pages](https://jacob.earth/post/2024/astro-csp-headers-for-sri-with-cloudflare-pages/) -- CSP auto-hashing
- [astro-cloudflare-pages-headers](https://github.com/martinsilha/astro-cloudflare-pages-headers) -- integration
- [Cloudflare HSTS docs](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/http-strict-transport-security/) -- configuration

### Accessibility
- [WCAG 2.1 AA Checklist](https://accessible.org/wcag/) -- comprehensive checklist
- [WCAG 2.2 Compliance 2026](https://www.levelaccess.com/blog/wcag-2-2-aa-summary-and-checklist-for-website-owners/) -- current landscape
- [WebAIM WCAG 2 Checklist](https://webaim.org/standards/wcag/checklist) -- practical implementation

### Donations
- [GitHub Sponsors via OSC](https://docs.oscollective.org/campaigns-programs-and-partnerships/github-sponsors) -- zero-fee donations
- [Open Source Funding Guide](https://sealos.io/blog/funding-open-source/) -- platform comparison

---
*Feature research for: IsItSafeToTravel.com v2.0 -- Production Ready*
*Researched: 2026-03-21*
