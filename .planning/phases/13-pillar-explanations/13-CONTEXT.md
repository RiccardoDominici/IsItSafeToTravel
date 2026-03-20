# Phase 13: Pillar Explanations - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Add expandable `<details>/<summary>` sections for each of the 5 safety pillars (conflict, crime, health, governance, environment) on the methodology page. Each section explains what the pillar measures, its data sources, and what scores mean for travelers. Available in EN and IT.

</domain>

<decisions>
## Implementation Decisions

### Content Structure
- Use native HTML `<details>/<summary>` for expandable sections — no JavaScript needed, accessible by default
- Place explanations in the existing methodology page, within or after the current "Category Weights" section
- Each pillar section includes: what it measures, key indicators, data sources, and what low/high scores mean for travelers

### Claude's Discretion
- Exact wording and content of pillar explanations (must be factually accurate based on weights.json indicators)
- Styling of `<details>/<summary>` elements (should match existing Tailwind design)
- Whether to create a reusable component or inline directly in methodology pages
- Italian translations of pillar explanation text

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/pages/en/methodology/index.astro` (122 lines) — existing methodology page with pillar weights table
- `src/pages/it/metodologia/index.astro` — Italian mirror
- `src/i18n/ui.ts` — translation system with existing `country.pillar.*` keys and `methodology.*` keys
- `src/pipeline/config/weights.json` — pillar weights (conflict 25%, crime 20%, health 20%, governance 20%, environment 15%) and indicator mappings

### Established Patterns
- Pillar names: conflict, crime, health, governance, environment (from PillarName type)
- Translation keys use dot notation: `methodology.indicator.gpi_overall`
- Methodology page already lists indicators per pillar in a table format

### Integration Points
- Methodology page linked from nav/footer
- Pillar names used consistently via i18n keys across country detail and comparison pages

</code_context>

<specifics>
## Specific Ideas

User requested: "inserisci la spiegazione dei parametri nella sezione metodologia" — explanations go in the methodology section.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>
