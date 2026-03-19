# Phase 1: Project Foundation - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Astro scaffold with i18n routing, Cloudflare deployment, and dev tooling. Delivers a deployable site skeleton with English + Italian locale routing, placeholder pages, and CI/CD pipeline. No content, no data, no map — just the foundation everything else builds on.

</domain>

<decisions>
## Implementation Decisions

### Visual identity
- Warm & inviting palette: warm neutrals, soft greens, earthy tones — travel magazine feel, not cold/institutional
- Colorblind-safe map gradient: blue → yellow → red (accessible to deuteranopia)
- Dark mode supported: system-preference detection + manual toggle
- Design system established in Phase 1 with Tailwind CSS custom theme tokens (colors, spacing, typography)

### i18n approach
- URL structure: translated slugs for maximum SEO — /en/italy vs /it/italia (Claude to implement best pattern for Astro)
- Root URL (/) auto-detects browser language, redirects to /en/ or /it/ accordingly
- Full translation scope: UI strings, country names, AND auto-generated safety descriptions all translated to Italian
- hreflang tags linking EN ↔ IT versions of every page

### Claude's Discretion
- Typography choice (humanist sans recommended given warm palette — but Claude picks final font pairing)
- Language switcher placement (header vs footer vs both)
- Dev tooling: package manager, linting setup, formatter
- CI/CD pipeline configuration for Cloudflare deployment
- Site structure: header/footer/nav layout for placeholder pages
- Astro project configuration and folder structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & requirements
- `.planning/PROJECT.md` — Core value, constraints (near-zero budget, Cloudflare hosting)
- `.planning/REQUIREMENTS.md` — TECH-03 (multilingual EN+IT), TECH-05 (free-tier Cloudflare)
- `.planning/config.json` — Workflow settings (YOLO mode, quality model profile)

### Research
- `.planning/research/STACK.md` — Technology recommendations: Astro (not Next.js), Tailwind CSS, Cloudflare Workers/Pages, next-intl alternative for Astro
- `.planning/research/ARCHITECTURE.md` — Architecture patterns, SSG approach, i18n routing design
- `.planning/research/PITFALLS.md` — i18n URL structure must be correct from day one, Cloudflare deployment considerations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- This phase establishes the foundation all subsequent phases build on
- i18n routing structure must support dynamic country pages (Phase 4)
- Tailwind theme tokens must include the map color scale (Phase 3)
- Cloudflare deployment pipeline must support static generation (Phase 6)

</code_context>

<specifics>
## Specific Ideas

- User wants the site to feel like a travel magazine (warm, inviting) not a government advisory (cold, institutional)
- Colorblind accessibility is a priority — the map gradient must work for everyone
- SEO is a top concern — URL structure decisions are driven by search engine optimization
- Full Italian translation is committed — not just UI strings but all content

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-project-foundation*
*Context gathered: 2026-03-19*
