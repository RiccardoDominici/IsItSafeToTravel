# Phase 16: Production Foundation - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver production-ready configuration: security headers (_headers file), robots.txt fixes + AI crawler directives, /llms.txt for LLM discoverability, Cloudflare Web Analytics verification, FUNDING.yml, and cache-control headers. Pure additive config — no existing code logic changed.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure phase.

Key notes from research:
- Domain in robots.txt and astro.config.mjs is "isitsafetotravels.com" — verify if this is correct or a typo (PROJECT.md says "IsItSafeToTravel.com" without the 's')
- HSTS should start with max-age=86400, NOT preload (per pitfalls research)
- Security headers go in public/_headers file (Cloudflare Pages format)
- CSP is deferred to Phase 20 (too complex for this phase, depends on all inline scripts being stable)
- Cloudflare Web Analytics may already be auto-enabled — verify in dashboard is user's task

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `public/robots.txt` — exists, needs fixing (domain typo + AI crawler directives)
- `src/layouts/Base.astro` — global layout, has inline dark mode script (is:inline)
- `astro.config.mjs` — site URL configured here, affects all canonical/hreflang/sitemap URLs

### Established Patterns
- Static files in `public/` served as-is by Cloudflare Pages
- No `_headers` file exists yet — will be new
- No `_redirects` file exists yet

### Integration Points
- `public/_headers` — new file, applies to all Cloudflare Pages responses
- `public/llms.txt` — new static file
- `public/robots.txt` — modify existing
- `.github/FUNDING.yml` — new file for GitHub Sponsors button

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow research recommendations from SUMMARY.md.

</specifics>

<deferred>
## Deferred Ideas

- CSP implementation → Phase 20
- Root URL server-side redirect → Phase 18 (SEO Enhancement)
- Analytics script tag in Base.astro → only if CF Web Analytics is NOT auto-injected

</deferred>
