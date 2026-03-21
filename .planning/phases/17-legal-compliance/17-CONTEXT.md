# Phase 17: Legal Compliance - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand existing legal pages with privacy policy and imprint sections. Create local-only legal research document. Existing legal pages in 5 languages have disclaimer content — extend with privacy policy (zero-cookie documentation, CF Web Analytics disclosure) and operator identification.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — content/legal phase.

Key constraints:
- Extend existing legal page (don't create separate privacy/imprint pages)
- Add new i18n keys for privacy and imprint sections in all 5 languages
- Legal research document goes to .legal-research/ (add to .gitignore)
- Privacy policy must document: no cookies, no personal data, CF Web Analytics (cookie-free), localStorage for theme only
- Imprint must have placeholder operator info (user will fill in actual details)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/en/legal/index.astro` — existing legal page template (5 sections + last_updated)
- `src/i18n/ui.ts` — ~17 legal.* keys per language already
- Same page structure in it/note-legali, es/terminos-legales, fr/mentions-legales, pt/termos-legais

### Established Patterns
- All text via i18n keys: legal.sectionN_title / legal.sectionN_text
- Simple section structure: h2 + p per section
- Footer link already points to legal page

### Integration Points
- `src/i18n/ui.ts` — add new keys for privacy + imprint sections
- `src/pages/*/legal/index.astro` (all 5 langs) — add new sections
- `.gitignore` — add .legal-research/

</code_context>

<specifics>
## Specific Ideas

No specific requirements — follow research recommendations.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
