# Phase 15: Spanish Language - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add Spanish (ES) as the third language. Update i18n config, add ~190 translation keys, add 248 Spanish country names, create all page files under /es/, update pipeline types. Language switcher and hreflang tags auto-generate from the languages object.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — mechanical language addition phase. The i18n system is fully generic and handles any number of languages. Key decisions:
- Spanish route slugs (e.g., pais, comparar, seguridad-global, metodologia, terminos-legales)
- Spanish translation quality and tone (match existing formal but accessible style)
- CountryEntry type change approach (add `es` field directly vs Record<Lang, string>)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/i18n/ui.ts` — languages object, routes config, ~190 translation keys per locale
- `src/i18n/utils.ts` — `getAlternateLinks()`, `getLocalizedPath()` auto-generate for all locales
- `src/components/LanguageSwitcher.astro` — iterates `languages` object, auto-includes new locales
- `src/layouts/Base.astro` — hreflang tags auto-generated from languages
- `astro.config.mjs` — locales array + sitemap i18n config

### Files to Create
- `src/pages/es/index.astro` — homepage
- `src/pages/es/pais/[slug].astro` — country detail
- `src/pages/es/comparar.astro` — compare page
- `src/pages/es/seguridad-global.astro` — global safety
- `src/pages/es/metodologia/index.astro` — methodology
- `src/pages/es/terminos-legales/index.astro` — legal

### Files to Modify
- `astro.config.mjs` — add 'es' to locales
- `src/i18n/ui.ts` — add es: 'Español', routes.es, ui.es (190 keys)
- `src/pipeline/types.ts` — CountryEntry.name add `es: string`
- `src/pipeline/config/countries.ts` — 248 Spanish country names

### Integration Points
- Language switcher auto-includes new locales from languages object
- hreflang tags auto-generated from getAlternateLinks()
- Sitemap i18n config in astro.config.mjs needs 'es' entry
- Client-side locale detection in compare.astro uses ternary for en/it — needs es case

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard i18n expansion following existing EN/IT pattern.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
