# Phase 6: SEO, Performance, and Launch - Research

**Researched:** 2026-03-19
**Domain:** SEO (structured data, meta tags, sitemap), mobile responsiveness, Lighthouse performance
**Confidence:** HIGH

## Summary

Phase 6 is a polish-and-verify phase on top of a well-structured Astro 6 SSG codebase. The foundations are strong: static generation is already in place, hreflang tags exist in Base.astro, the sitemap integration is installed, fontsource already uses `font-display: swap`, and Tailwind responsive classes are used throughout. The work centers on three domains: (1) adding JSON-LD structured data and Open Graph meta tags to Base.astro, (2) configuring the sitemap integration's i18n option and adding robots.txt, and (3) auditing/fixing mobile responsiveness and Lighthouse performance issues.

The codebase has zero client-side framework usage -- components use Astro's inline `<script>` tags rather than `client:` directives, which is good for performance. The D3/topojson map and Fuse.js search are the only significant client-side JS. The map loads topojson via `fetch('/world-topo.json')` which is already lazy by nature (only on homepage). Search data is serialized into a data attribute (248 countries), which is a potential performance concern on mobile.

**Primary recommendation:** Extend Base.astro with optional props for JSON-LD and OG tags, configure sitemap i18n, audit all pages with Lighthouse on mobile throttling, and fix any issues found. This is incremental work, not a rewrite.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Country pages: WebPage + Place JSON-LD schemas -- Place captures geographic/travel intent, WebPage for general SEO
- Homepage: WebSite schema with SearchAction -- enables Google sitelinks search box
- Methodology/legal pages: WebPage schema only
- JSON-LD injected in `<head>` via Base.astro or per-page frontmatter, rendered as `<script type="application/ld+json">`
- Country page Place schema includes: name, description, geo coordinates (if available), aggregateRating-style safety score presentation
- Open Graph tags on every page: og:title, og:description, og:image, og:url, og:type, og:locale
- Twitter card: summary_large_image on all pages
- Unique meta descriptions per country page: template-driven from score data
- OG image: static fallback image per page type (no dynamic generation)
- All meta tags added to Base.astro via optional props, with sensible defaults
- Configure `@astrojs/sitemap` integration with i18n option for hreflang annotations
- robots.txt: allow all, point to sitemap URL
- Mobile-first approach using existing Tailwind breakpoints (sm/md/lg/xl)
- Map: full-width with adjusted initial zoom level for mobile viewport
- Touch targets: minimum 44px for all interactive elements
- Search dropdown: full-width on mobile
- Country page: stack layout on mobile, side-by-side on desktop
- Header: hamburger menu (already exists via details/summary pattern)
- Typography: minimum 16px body text to prevent iOS zoom
- Font loading: `font-display: swap` with `<link rel="preload">` for Inter and DM Sans variable fonts
- Image optimization: use Astro `<Image>` component where applicable, serve WebP
- JS bundle: audit Fuse.js bundle size, consider lazy-load Search with `client:visible`
- D3/topojson map: verify lazy loading
- Target metrics: LCP < 2.5s, FID < 100ms, CLS < 0.1

### Claude's Discretion
- Exact JSON-LD field values and schema.org property mapping
- OG image dimensions and design (within branded constraints)
- robots.txt exact content
- Specific Lighthouse audit fixes beyond the identified areas
- Whether to add preconnect/prefetch hints
- Exact mobile breakpoint adjustments per component

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TECH-01 | Site is mobile-responsive with touch-friendly map interaction | Mobile audit patterns, Tailwind responsive utilities, touch target sizing, existing header mobile menu analysis |
| TECH-02 | All destination pages are statically generated for SEO (JSON-LD, meta tags, sitemap) | JSON-LD schema patterns, @astrojs/sitemap i18n config, OG tag implementation in Base.astro, unique meta description generation |
| TECH-04 | Lighthouse performance score 90+ on mobile | Font loading analysis (already swap), bundle audit patterns, image optimization, CLS prevention strategies |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| astro | 6.0.6 | Static site generator | Already the project framework |
| @astrojs/sitemap | 3.7.1 | XML sitemap generation with i18n | Already installed, needs i18n config |
| tailwindcss | 4.2.2 | Responsive design utilities | Already used project-wide |
| @fontsource-variable/inter | 5.2.8 | Font loading with swap | Already uses `font-display: swap` |
| @fontsource-variable/dm-sans | 5.2.8 | Font loading with swap | Already uses `font-display: swap` |

### Supporting (no new installs needed)
No new packages are required for this phase. All SEO work (JSON-LD, OG tags, meta descriptions) is pure HTML generation in Astro templates. The sitemap integration is already installed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual JSON-LD objects | astro-seo-schema npm package | Adds a dependency for simple `<script>` tags -- not worth it for this project's scope |
| Static OG images | Dynamic OG generation (satori) | User decided against this: exceeds budget constraint |
| schema-dts TypeScript types | Manual JSON-LD objects | Type safety is nice but 248 pages use the same template; manual is fine |

**Installation:**
```bash
# No new packages needed
```

## Architecture Patterns

### Recommended Changes to Existing Structure
```
src/
  layouts/
    Base.astro             # MODIFY: add JSON-LD, OG, Twitter card props
  lib/
    seo.ts                 # NEW: JSON-LD builders, meta description generator
  pages/
    en/country/[slug].astro  # MODIFY: pass SEO props to Base
    en/index.astro           # MODIFY: pass SEO props to Base
    en/methodology/index.astro  # MODIFY: pass SEO props to Base
    en/legal/index.astro        # MODIFY: pass SEO props to Base
    (same for it/ pages)
public/
  robots.txt               # NEW: allow all + sitemap URL
  og-homepage.png           # NEW: static OG image for homepage
  og-country.png            # NEW: static OG image for country pages
  og-default.png            # NEW: fallback OG image
```

### Pattern 1: JSON-LD via Base.astro Props

**What:** Pass a JSON-LD object as an optional prop to Base.astro, which serializes it in the `<head>`.
**When to use:** Every page that needs structured data (all of them).
**Example:**
```astro
---
// In Base.astro
interface Props {
  lang: Lang;
  title?: string;
  description?: string;
  jsonLd?: Record<string, unknown>;
  ogImage?: string;
  ogType?: string;
}

const { lang, title, description, jsonLd, ogImage, ogType } = Astro.props;
const resolvedOgImage = ogImage || '/og-default.png';
const resolvedOgType = ogType || 'website';
---

<head>
  <!-- existing head content -->

  <!-- Open Graph -->
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={pageDescription} />
  <meta property="og:image" content={new URL(resolvedOgImage, Astro.site).href} />
  <meta property="og:url" content={canonicalUrl.href} />
  <meta property="og:type" content={resolvedOgType} />
  <meta property="og:locale" content={lang === 'it' ? 'it_IT' : 'en_US'} />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={pageTitle} />
  <meta name="twitter:description" content={pageDescription} />
  <meta name="twitter:image" content={new URL(resolvedOgImage, Astro.site).href} />

  <!-- JSON-LD Structured Data -->
  {jsonLd && (
    <script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
  )}
</head>
```
Source: Astro docs pattern confirmed via multiple community implementations.

### Pattern 2: JSON-LD Builder Functions

**What:** Helper functions in `src/lib/seo.ts` that construct schema.org JSON-LD objects for each page type.
**When to use:** Called in page frontmatter to generate the JSON-LD prop for Base.astro.
**Example:**
```typescript
// src/lib/seo.ts
export function buildCountryJsonLd(country: ScoredCountry, lang: Lang, canonicalUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': canonicalUrl,
        url: canonicalUrl,
        name: `${country.name[lang]} Safety Score`,
        description: buildCountryMetaDescription(country, lang),
        inLanguage: lang === 'it' ? 'it-IT' : 'en-US',
      },
      {
        '@type': 'Place',
        name: country.name[lang],
        description: `Safety information for ${country.name[lang]}`,
        // geo coordinates if available in country data
      },
    ],
  };
}

export function buildHomepageJsonLd(siteUrl: string, lang: Lang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'IsItSafeToTravel',
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/${lang}/country/{search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildCountryMetaDescription(country: ScoredCountry, lang: Lang): string {
  // Template-driven unique descriptions from score data
  // e.g. "Italy safety score: 7.2/10. Low crime risk, moderate health concerns. Updated daily from 3+ public sources."
}
```

### Pattern 3: Sitemap i18n Configuration

**What:** Configure @astrojs/sitemap with locale mapping for hreflang in the generated sitemap XML.
**When to use:** One-time config in astro.config.mjs.
**Example:**
```javascript
// astro.config.mjs
sitemap({
  i18n: {
    defaultLocale: 'en',
    locales: {
      en: 'en',
      it: 'it',
    },
  },
}),
```
Source: Official @astrojs/sitemap documentation.

### Anti-Patterns to Avoid
- **Hardcoded meta descriptions:** Do not use the same template string with just the country name swapped. Each description must reflect the actual score data (score value, risk categories) to be genuinely unique.
- **JSON-LD in page body:** Always place in `<head>` for best crawl efficiency. Google accepts both, but `<head>` is conventional.
- **Multiple JSON-LD scripts without @graph:** Use a single `<script>` with `@graph` array when a page has multiple schema types (WebPage + Place), rather than separate script tags.
- **Blocking font loads:** Never remove `font-display: swap` -- fontsource already defaults to it. Do not add `font-display: block` or `font-display: optional`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML sitemap generation | Custom sitemap builder | @astrojs/sitemap with i18n config | Handles all page discovery, locale mapping, proper XML formatting |
| Responsive breakpoints | Custom media queries | Tailwind sm/md/lg/xl classes | Already used everywhere, consistent behavior |
| Font loading strategy | Custom font loader JS | @fontsource-variable default behavior | Already uses swap, variable fonts, unicode-range subsetting |
| OG image generation | Satori/puppeteer pipeline | Static fallback images | User decision: exceeds budget, static images are sufficient |

**Key insight:** This phase should not introduce new tooling. The project has everything it needs; the work is configuration and template extension.

## Common Pitfalls

### Pitfall 1: CLS from Font Loading
**What goes wrong:** Font swap causes visible text reflow, penalizing CLS score.
**Why it happens:** System fallback font has different metrics than the custom font.
**How to avoid:** Fontsource already uses `font-display: swap` and variable fonts load as single files per unicode range. The key is to NOT add additional font preload links that cause double-loading. Verify with Lighthouse that CLS from fonts is acceptable (< 0.1).
**Warning signs:** CLS > 0.1 in Lighthouse, visible text jump on page load.

### Pitfall 2: Search Data Attribute Size on Mobile
**What goes wrong:** 248 countries with names and scores serialized as a JSON data attribute can be 15-30KB of inline HTML, slowing initial parse.
**Why it happens:** The Search component serializes all country data into `data-search` attribute.
**How to avoid:** Measure the actual size. If it is causing LCP issues, consider loading the search data from a static JSON file via fetch instead. However, for 248 small objects, this is likely fine -- verify with Lighthouse first.
**Warning signs:** Large DOM size warning in Lighthouse, slow TTI on mobile.

### Pitfall 3: Map Height on Mobile
**What goes wrong:** `calc(100vh - 8rem)` on the map container may leave very little space on mobile when browser chrome (address bar, toolbar) takes viewport height.
**Why it happens:** Mobile browsers have dynamic viewport heights (dvh vs vh).
**How to avoid:** Use `dvh` (dynamic viewport height) instead of `vh` for mobile, or test with real device dimensions. The `100dvh` unit accounts for browser chrome.
**Warning signs:** Map appears cut off on mobile Safari/Chrome, or scroll bouncing.

### Pitfall 4: Sitemap Not Including All Country Pages
**What goes wrong:** Dynamic routes (`[slug].astro`) might not all appear in the sitemap.
**Why it happens:** Misunderstanding of how @astrojs/sitemap discovers pages -- it uses the build output, so all statically generated pages ARE included automatically.
**How to avoid:** This is actually a non-issue for SSG. All pages from `getStaticPaths` are built and included. Just verify after build.
**Warning signs:** Run `astro build` and check `dist/sitemap-*.xml`.

### Pitfall 5: OG Image Absolute URLs
**What goes wrong:** Social media crawlers cannot resolve relative OG image paths.
**Why it happens:** OG image URLs must be absolute (https://...), not relative (/og-image.png).
**How to avoid:** Always construct absolute URLs using `new URL(path, Astro.site).href`. The `Astro.site` is already configured as `https://isitsafetotravel.com`.
**Warning signs:** Social media preview shows no image.

### Pitfall 6: Duplicate Meta Descriptions Across Locales
**What goes wrong:** EN and IT pages have the same meta description because it is only generated in English.
**Why it happens:** Meta description template not localized.
**How to avoid:** Use the translation system and localized country names when building meta descriptions. The `country.name[lang]` pattern is already established.
**Warning signs:** Google Search Console reports duplicate descriptions.

## Code Examples

### Unique Meta Description Generator
```typescript
// src/lib/seo.ts
import type { ScoredCountry } from '../pipeline/types';
import type { Lang } from '../i18n/ui';

const templates = {
  en: (c: ScoredCountry) => {
    const riskLevel = c.score >= 7 ? 'low risk' : c.score >= 4 ? 'moderate risk' : 'high risk';
    return `${c.name.en} safety score: ${c.score.toFixed(1)}/10. Overall ${riskLevel} destination. Category breakdown, travel advisories, and trend data from 3+ public sources.`;
  },
  it: (c: ScoredCountry) => {
    const riskLevel = c.score >= 7 ? 'rischio basso' : c.score >= 4 ? 'rischio moderato' : 'rischio alto';
    return `Punteggio di sicurezza ${c.name.it}: ${c.score.toFixed(1)}/10. Destinazione a ${riskLevel}. Analisi per categorie, avvisi di viaggio e dati da 3+ fonti pubbliche.`;
  },
};

export function buildCountryMetaDescription(country: ScoredCountry, lang: Lang): string {
  return templates[lang](country);
}
```

### robots.txt
```
# robots.txt for isitsafetotravel.com
User-agent: *
Allow: /

Sitemap: https://isitsafetotravel.com/sitemap-index.xml
```

### OG Tags in Base.astro Head
```astro
<!-- Open Graph -->
<meta property="og:title" content={pageTitle} />
<meta property="og:description" content={pageDescription} />
<meta property="og:image" content={new URL(ogImage || '/og-default.png', Astro.site).href} />
<meta property="og:url" content={canonicalUrl.href} />
<meta property="og:type" content={ogType || 'website'} />
<meta property="og:locale" content={lang === 'it' ? 'it_IT' : 'en_US'} />
<meta property="og:site_name" content="IsItSafeToTravel" />

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={pageTitle} />
<meta name="twitter:description" content={pageDescription} />
<meta name="twitter:image" content={new URL(ogImage || '/og-default.png', Astro.site).href} />
```

### Country Page with JSON-LD
```astro
---
// In [slug].astro
import { buildCountryJsonLd, buildCountryMetaDescription } from '../../../lib/seo';

const description = buildCountryMetaDescription(country, lang);
const canonicalUrl = new URL(Astro.url.pathname, Astro.site).href;
const jsonLd = buildCountryJsonLd(country, lang, canonicalUrl);
---
<Base
  lang={lang}
  title={`${country.name[lang]} - ${t('country.score_label')}`}
  description={description}
  jsonLd={jsonLd}
  ogImage="/og-country.png"
  ogType="website"
>
```

### Homepage with WebSite Schema + SearchAction
```typescript
export function buildHomepageJsonLd(siteUrl: string, lang: Lang) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'IsItSafeToTravel',
    url: siteUrl,
    description: lang === 'it'
      ? 'Scopri quanto e sicura la tua destinazione di viaggio'
      : 'Find out how safe your travel destination is',
    inLanguage: lang === 'it' ? 'it' : 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/${lang}/country/{search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `100vh` for full-height mobile | `100dvh` (dynamic viewport height) | CSS spec 2022, wide support 2023+ | Prevents mobile browser chrome from cutting off content |
| Multiple JSON-LD script tags | Single script with `@graph` | Google recommendation 2023+ | Cleaner, establishes entity relationships |
| `font-display: auto` | `font-display: swap` (fontsource default) | Fontsource adopted 2022+ | Already in place -- no change needed |
| `preload` for all fonts | Selective preload for critical subset only | Performance best practice 2024+ | Only preload latin subset; other unicode ranges load on demand |
| Twitter `twitter:` meta tags | Twitter now reads `og:` tags as fallback | Twitter/X change 2023 | Still include both for maximum compatibility |

**Deprecated/outdated:**
- `@astrojs/tailwind`: Incompatible with Astro 6 + Tailwind 4; project correctly uses `@tailwindcss/vite` instead
- `output: hybrid` in Astro config: Deprecated in Astro 6; project correctly uses default static output

## Open Questions

1. **World topojson file size**
   - What we know: `world-topo.json` is served from `/public/` and fetched on homepage load
   - What's unclear: Its exact file size and whether it should be gzipped/brotli-compressed at the CDN level
   - Recommendation: Check file size during implementation; Cloudflare Pages compresses automatically, so this is likely fine. If > 500KB, consider simplifying geometry.

2. **Fuse.js bundle contribution**
   - What we know: Fuse.js 7.1.0 is imported in the Search component's inline script
   - What's unclear: Whether Astro/Vite tree-shakes unused Fuse.js features or ships the full library
   - Recommendation: Check the built JS bundle size. Fuse.js is ~15KB minified+gzipped, which is acceptable. If Lighthouse flags it, consider dynamic import.

3. **OG Image Design**
   - What we know: Static fallback images needed per page type (homepage, country, default)
   - What's unclear: Who creates these images and what dimensions/design
   - Recommendation: Use 1200x630px (standard OG dimensions). Create simple branded cards with the site name and a visual element. Can be created with any image editor or even an SVG.

## Sources

### Primary (HIGH confidence)
- @astrojs/sitemap official docs (https://docs.astro.build/en/guides/integrations-guide/sitemap/) - i18n configuration API verified
- Fontsource Inter package (local node_modules) - confirmed `font-display: swap` default
- Astro official docs (https://docs.astro.build/en/guides/fonts/) - font optimization guidance
- Project source code (Base.astro, astro.config.mjs, SafetyMap.astro, Search.astro, Header.astro) - current state verified

### Secondary (MEDIUM confidence)
- Schema.org Place type (https://schema.org/Place) - property definitions
- Schema.org WebSite type with SearchAction - Google sitelinks search box pattern
- Multiple Astro community implementations of JSON-LD (stephen-lunt.dev, cemkiray.com, timeaton.dev) - confirmed pattern consistency

### Tertiary (LOW confidence)
- Dynamic viewport height (dvh) browser support -- need to verify current support level, though widely supported since 2023

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already installed and verified, no new dependencies
- Architecture: HIGH - extending existing Base.astro pattern with optional props is straightforward and well-documented
- Pitfalls: HIGH - based on direct code inspection of current components and known Lighthouse audit patterns
- JSON-LD schemas: MEDIUM - schema.org types are stable but exact Google rich result eligibility for Place + safety data is unverified

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no fast-moving dependencies)
