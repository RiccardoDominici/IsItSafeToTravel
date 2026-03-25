# Phase 27: SEO & AI Search Optimization - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement 14 SEO and AI search optimization fixes to maximize visibility in Google Search and AI chatbot citations (ChatGPT, Perplexity, Google AI Overviews, Copilot). All changes must remain dynamic — site rebuilds daily with fresh pipeline data.

CRITICAL fixes (high impact):
1. Add og:image to all pages (dynamic per country, 1200x630px)
2. Add `<lastmod>` to all sitemap URLs (daily updates)
3. Round safety scores in meta descriptions (7.4 not 7.406320589270102)
4. Fix llms.txt country URLs (use ISO codes /ita/ not /italy/)
5. Add dateModified/datePublished to all JSON-LD schemas
6. Ensure all language variants of key pages are in sitemap

IMPORTANT fixes (medium impact):
7. Add About page with author bio and credentials for E-E-A-T (all 5 languages)
8. Add Author/Person schema to JSON-LD on all pages
9. Add static HTML tables for country pillar data (crawlable without JS)
10. Fix FAQ schema to use natural language questions
11. Add static country listing on homepage (crawlable links)
12. Add preload hints for critical fonts/CSS
13. Complete Organization schema (logo, sameAs, foundingDate)
14. Add meta robots max-snippet:-1 directive to all pages

</domain>

<decisions>
## Implementation Decisions

### OG Image Strategy
- Generate OG images at build time using SVG-to-PNG via `@resvg/resvg-js` — zero runtime cost
- Country OG images show: country name + score + color-coded badge + site branding (1200x630px)
- Non-country pages (homepage, methodology, legal, compare, about, global-safety) use one generic branded OG image with page title

### About Page & E-E-A-T
- About page includes: author bio (Riccardo Dominici), project mission, data source overview, open-source mention, contact info
- About page linked from both footer and header navigation
- Author credentials tone: factual & concise ("Independent developer and data analyst" style)
- About page available in all 5 languages

### Homepage Country Listing & Static Tables
- Homepage country listing: collapsed `<details>` element with alphabetical list of all 248 countries — crawlable HTML but doesn't clutter UI
- Country page static tables: all 5 pillar scores + overall score + risk level in a simple HTML table
- Static table placed inside PillarBreakdown component, before the D3 chart — visible to all users

### Claude's Discretion
- Exact SVG template design for OG images
- Preload strategy (which fonts/CSS to preload)
- Specific wording of FAQ natural language questions
- Organization schema social links (sameAs) — use GitHub repo URL
- About page layout and styling details
- Static country listing sort order within alphabet sections

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/seo.ts` — all JSON-LD builders (WebPage, Organization, FAQ, Breadcrumb, Country, Homepage, GlobalSafety)
- `src/layouts/Base.astro` — central layout with meta tags, OG, hreflang, JSON-LD injection
- `src/i18n/ui.ts` — translation keys for all 5 languages
- `src/i18n/utils.ts` — `useTranslations()`, `getAlternateLinks()`, `getLocalizedPath()`
- `src/components/country/PillarBreakdown.astro` — pillar chart component (target for static table)
- `src/components/Header.astro` / `Footer.astro` — navigation components
- `astro.config.mjs` — sitemap integration with i18n config
- `public/robots.txt` — already allows AI crawlers
- `public/llms.txt` — exists but has incorrect URLs

### Established Patterns
- SSG with `export const prerender = true` on all pages
- JSON-LD via `jsonLd` prop passed to Base.astro
- Route translations in i18n/ui.ts (country→paese→pais→pays→pais)
- Country data from `loadLatestScores()` which reads `public/scores.json`
- All 5 language variants share same component code, differ by `lang` param
- Pillar data: `country.pillars` array with `{name, score, partial}` objects
- Score is on 0-1 scale internally, displayed as ×10 for 1-10 scale

### Integration Points
- New About page: needs route in all 5 languages, nav links in Header+Footer, translation keys
- OG image generation: build-time script or Astro integration, referenced via `ogImage` prop in Base.astro
- Sitemap lastmod: requires custom sitemap config or Astro sitemap plugin options
- Static table: inside PillarBreakdown.astro, uses same `pillars` prop
- Meta robots: add to Base.astro `<head>`
- Preload hints: add to Base.astro `<head>`

</code_context>

<specifics>
## Specific Ideas

- Score rounding: use `toFixed(1)` in `buildCountryMetaDescription()` for the overall score (pillar scores already use toFixed(1))
- llms.txt: change `/en/country/italy/` to `/en/country/ita/` format matching actual routes
- FAQ questions: change "Conflict (30%)" to "What does the Conflict category measure?" pattern
- dateModified: use build timestamp or data file modification date (dynamic per daily rebuild)
- Organization schema: add `logo` (favicon.svg URL), `sameAs` ([GitHub repo URL]), `foundingDate` (2026)
- About page route translations: en→about, it→chi-siamo, es→acerca-de, fr→a-propos, pt→sobre

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
