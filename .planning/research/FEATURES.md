# Feature Research

**Domain:** Travel safety information platform
**Researched:** 2026-03-19
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Interactive color-coded world map | Every competitor (Safeture, SafeTravy, Healix, GPI) has one. This IS the product. Users expect to see green/yellow/red countries at a glance. | HIGH | Core UI component. Needs performant rendering for 200+ countries with zoom. Use vector tiles or TopoJSON, not raster images. |
| Country-level safety score (numeric) | TravelSafe-Abroad uses 0-100, GeoSure uses their own scale, HelloSafe uses 0-100. Users expect a clear number. The project's 1-10 scale is simpler and more intuitive than 0-100. | MEDIUM | Must be prominently displayed. Color-code to match map. 1-10 is a good differentiator vs 0-100 -- easier to grasp. |
| Destination detail page with score breakdown | TravelSafe-Abroad shows 9 risk categories per country. Healix breaks into 8 sub-risk factors. Users want to understand WHY a score is what it is. | MEDIUM | Need category scores (crime, health, political stability, etc.) with individual ratings per category. This is the page that drives SEO traffic. |
| Search functionality | Every travel site has search. Users arrive with a destination in mind. SafeTravy, TravelSafe-Abroad all have prominent search bars. | LOW | Autocomplete with country/city names. Must be fast and forgiving of typos. Place it prominently on homepage above/alongside the map. |
| Mobile-responsive design | 60%+ of travel research happens on mobile. Baymard Institute identifies mobile UX as mandatory for travel sites. | MEDIUM | Map interaction on mobile is tricky. Consider list view as mobile default with map as secondary. Touch-friendly zoom and tap targets. |
| Source attribution and transparency | HelloSafe shifted to 100% public-data model specifically for transparency. Users and media cite these scores -- they need to trust the methodology. | LOW | Every data source listed with links. Methodology page explaining weights and formula. This builds credibility. |
| Government advisory integration | US State Dept, UK FCDO, and other government advisories are the baseline travelers check. TravelSafe-Abroad shows multiple government advisories per country. | MEDIUM | Aggregate advisories from 3-4 major governments. Show alongside the composite score for credibility cross-reference. |
| SEO-optimized destination pages | TravelSafe-Abroad ranks for "Is [country] safe to travel" queries. This is the primary organic traffic driver. | MEDIUM | Structured data (JSON-LD), meta tags, clean URLs (/country/united-kingdom), sitemap for 200+ pages. Static generation is ideal here. |
| Fast page load / performance | Travel info is often checked on the go, on slow connections. Google Core Web Vitals affect search ranking. | MEDIUM | Target Lighthouse 90+. Static generation helps. Lazy-load map tiles. Compress TopoJSON data. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Sub-national / regional safety drill-down | Most competitors show country-level only. Healix mentions "risk zones where local conditions differ from national level" but doesn't offer deep regional data. A country-level score misses critical nuances (e.g., southern Thailand vs Bangkok, northern vs southern Italy). | HIGH | This is the project's stated goal and strongest differentiator. Requires sub-national data sources (ACLED has geocoded conflict events). Start with regions/provinces, not neighborhoods -- GeoSure's 65,000 neighborhoods is overkill and requires paid data. |
| Formula transparency with adjustable weights | HelloSafe publishes methodology but scores are fixed. No competitor lets users see exactly how weights affect scores or understand the formula interactively. The project already plans full formula transparency. | MEDIUM | Show each factor (crime, conflict, health, governance, etc.) with its weight and how it contributes to the final score. Consider an interactive "what matters to you" slider as a v2 feature -- not MVP. |
| Multilingual from day one | Most competitors are English-only. SafeTravy and government sites offer limited i18n. A truly multilingual safety platform has almost no competition in non-English markets. | MEDIUM | English + Italian as stated. Use i18n framework from the start (next-intl or similar). Content translation for destination names, categories, and UI strings. Defer long-form content translation to v2. |
| Automated daily data pipeline | Most index sites update quarterly (Healix) or annually (GPI). TravelSafe-Abroad updates irregularly. Daily automated updates from public APIs create a freshness advantage. | HIGH | Core infrastructure differentiator. Fetch from ACLED, INFORM, GPI, WHO, government advisories. Cron job or scheduled function. Must handle API failures gracefully. |
| Historical score trends | GPI's interactive map shows 6 years of historical data with timeline playback. Most safety sites show only current state. Showing "is this country getting safer or more dangerous?" adds analytical depth. | MEDIUM | Store daily scores. Show sparkline or trend chart on detail pages. "Up 0.3 from last month" type indicators. Valuable for media citations and SEO (trending content). |
| Comparison tool | Healix offers side-by-side comparison. Most sites lack this. Travelers often compare 2-3 destinations before choosing. | LOW | Simple side-by-side table comparing scores across categories for 2-3 countries. Low effort, high user value. Good for "should I go to X or Y?" queries. |
| Category-specific safety scores for demographics | GeoSure is the only competitor with scores specifically for women travelers. TravelSafe-Abroad has a "Women Travelers" risk category. LGBTQ+ safety data exists from Equaldex and Gay Travel Index. This is high-value, underserved. | MEDIUM | Add "Women travelers" and "LGBTQ+ travelers" as dedicated sub-scores using Equaldex (open data) and women's safety indices. Avoid being the arbiter of social values -- cite data sources neutrally. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts and personalization | "Save favorite destinations", "get alerts for my trip" | Adds PII management, auth complexity, GDPR obligations, and maintenance burden. Zero budget means no room for user data infrastructure. Project explicitly scopes this out. | Browser localStorage for recent searches. No server-side user state. Bookmarkable URLs for sharing. |
| User-generated content / reviews | TravelSafe-Abroad has 78+ user reviews per country. "Crowdsource safety reports" | Moderation nightmare. Subjective reports skew data. Spam, racism, political bias. Travel Off Path notes even their user-sourced data requires "Mandatory 24-Hour Editorial Audit." Project explicitly scopes this out. | Data-driven scores from authoritative indices only. Link to external review sites (TripAdvisor, Reddit) for subjective experiences. |
| Real-time alerts / push notifications | SafeTravy sends "personalized alerts about armed conflicts, social tensions, adverse weather." Feels like a safety essential. | Requires notification infrastructure, real-time event processing, and creates liability risk ("why didn't you alert me?"). Daily updates are sufficient for a static information site. Project explicitly scopes this out. | Show "last updated" timestamp prominently. Include RSS feed for power users. Link to government alert subscription services. |
| Hotel/flight booking integration | Monetization opportunity. "One-stop shop for safe travel planning." | Turns an information tool into a travel agency. Conflicts with impartiality (do you rank destinations higher that have more hotel inventory?). Massive scope expansion. Project explicitly scopes this out. | Affiliate links as future monetization (v2+). Keep the product purely informational. |
| AI chatbot / assistant | SafeTravy has "Travy" AI assistant. GeoSure has AI Safety Assistant. Trendy feature. | Adds significant complexity, cost (LLM API calls), and hallucination risk for safety-critical information. A wrong AI answer about safety has real consequences. Near-zero budget cannot sustain API costs. | Well-structured destination pages with clear safety information answer 95% of user questions. Good search and navigation replace the need for a chatbot. |
| Native mobile app | "An app for checking safety on the go" | Doubles development effort. App store approval/maintenance. PWA or responsive web covers the use case. No offline need -- safety info should always be current. Project explicitly scopes this out. | PWA with offline caching of recently viewed destinations. Add to home screen capability. Responsive design that feels native. |
| Neighborhood-level granularity | GeoSure covers 65,000 neighborhoods. "Street-level safety data" | Requires paid/proprietary data sources. Free public indices operate at country or region level. Accuracy at neighborhood level is questionable without local data partnerships. | Start with country + major region/province level. This alone differentiates from most competitors. Add city-level for major cities where data exists (ACLED has city-level conflict data). |
| Editorially written safety guides | TravelSafe-Abroad has long-form "safety tips" per country. "Add travel advice content" | Requires content creation at scale (200+ countries). Goes stale. Creates editorial bias the project wants to avoid. | Auto-generated text from score data: "Crime risk is moderate due to [X data point]." Template-based descriptions that update with the data. |

## Feature Dependencies

```
[Data Pipeline (fetch + compute scores)]
    |
    +--requires--> [Score Algorithm + Weights]
    |                   |
    |                   +--feeds--> [Country Detail Page (score breakdown)]
    |                   |
    |                   +--feeds--> [Interactive Map (color coding)]
    |
    +--feeds--> [Search Index (country/region names + scores)]
                    |
                    +--feeds--> [Search Autocomplete]

[Interactive Map]
    +--click/zoom--> [Country Detail Page]
    +--zoom deeper--> [Regional Drill-down] --requires--> [Sub-national Data Sources]

[Multilingual Support (i18n framework)]
    +--applies to--> [Map Labels]
    +--applies to--> [Detail Page Content]
    +--applies to--> [Search Autocomplete]
    +--applies to--> [UI Strings]

[SEO Optimization]
    +--requires--> [Static Page Generation]
    +--requires--> [Country Detail Pages]
    +--requires--> [Sitemap Generation]

[Historical Trends]
    +--requires--> [Data Pipeline (running over time)]
    +--requires--> [Score Storage (time-series)]

[Comparison Tool]
    +--requires--> [Country Detail Page (reusable score components)]

[Demographic-Specific Scores]
    +--requires--> [Score Algorithm] (additional data dimensions)
    +--requires--> [Country Detail Page] (additional score sections)
```

### Dependency Notes

- **Everything requires the Data Pipeline first:** No map, no detail pages, no search without computed scores. The pipeline is the foundation.
- **Interactive Map requires Score Algorithm:** Map colors derive from computed scores. Build scoring before visualization.
- **Regional Drill-down requires Sub-national Data:** Country-level can launch first. Regional data (ACLED, sub-national indices) adds complexity and should be a separate phase.
- **Historical Trends require time:** You need the pipeline running for weeks/months before trends become meaningful. Build the storage early, display later.
- **i18n must be baked in from the start:** Retrofitting i18n is painful. Set up the framework in phase 1 even if only English ships first.
- **Comparison Tool is cheap once Detail Pages exist:** It reuses score components, so build it after detail pages are solid.

## MVP Definition

### Launch With (v1)

Minimum viable product -- what's needed to validate the concept and start ranking in search.

- [ ] **Data pipeline (country-level)** -- Fetch from 3-4 public indices (GPI, INFORM Risk Index, government advisories), compute composite 1-10 scores for 200+ countries
- [ ] **Interactive world map** -- Color-coded by safety score, click to navigate to country detail
- [ ] **Country detail pages (200+)** -- Score breakdown by category (crime, conflict, health, governance), source citations, methodology explanation
- [ ] **Search with autocomplete** -- Find any country instantly
- [ ] **SEO foundation** -- Static generation, structured data, sitemap, meta tags
- [ ] **Mobile-responsive layout** -- Map + detail pages work on all screen sizes
- [ ] **i18n framework** -- Set up with English; Italian ready to plug in
- [ ] **Source attribution page** -- Full methodology and data source documentation

### Add After Validation (v1.x)

Features to add once core is working and traffic starts flowing.

- [ ] **Italian language support** -- Translate UI strings and auto-generated content once i18n framework proven
- [ ] **Regional drill-down** -- Sub-national scores for countries with significant regional variation, starting with ACLED conflict data overlay
- [ ] **Historical trend indicators** -- "Getting safer/more dangerous" sparklines on detail pages (needs weeks of stored data)
- [ ] **Comparison tool** -- Side-by-side country comparison (reuses detail page components)
- [ ] **Government advisory aggregation** -- Show US, UK, EU advisories alongside composite score
- [ ] **Demographic-specific scores** -- Women and LGBTQ+ safety sub-scores using Equaldex and similar open data

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **City-level pages** -- For major cities where data exists, significant data sourcing effort
- [ ] **Interactive weight adjustment** -- "What matters to you?" sliders that recompute scores client-side
- [ ] **Additional languages** -- Spanish, French, German, etc. based on traffic analytics
- [ ] **RSS/API for score data** -- Let others consume scores programmatically
- [ ] **Embeddable map widget** -- Let travel blogs embed the safety map
- [ ] **Email digest** -- Weekly summary of score changes for subscribed destinations (no accounts needed -- email-only)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Data pipeline + score computation | HIGH | HIGH | P1 |
| Interactive world map | HIGH | HIGH | P1 |
| Country detail pages | HIGH | MEDIUM | P1 |
| Search with autocomplete | HIGH | LOW | P1 |
| SEO (static gen, structured data) | HIGH | MEDIUM | P1 |
| Mobile-responsive design | HIGH | MEDIUM | P1 |
| Source attribution / methodology | MEDIUM | LOW | P1 |
| i18n framework setup | MEDIUM | LOW | P1 |
| Italian language | MEDIUM | MEDIUM | P2 |
| Regional drill-down | HIGH | HIGH | P2 |
| Historical trends | MEDIUM | LOW | P2 |
| Comparison tool | MEDIUM | LOW | P2 |
| Government advisory integration | MEDIUM | MEDIUM | P2 |
| Demographic-specific scores | MEDIUM | MEDIUM | P2 |
| City-level pages | MEDIUM | HIGH | P3 |
| Interactive weight sliders | LOW | MEDIUM | P3 |
| Additional languages | MEDIUM | MEDIUM | P3 |
| Embeddable widget | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | TravelSafe-Abroad | SafeTravy | GeoSure | Safeture | Healix/IntlSOS | Our Approach |
|---------|-------------------|-----------|---------|----------|----------------|--------------|
| Safety score | 0-100 index | Color categories | Proprietary scale | Risk levels | Risk ratings (5 levels) | 1-10 scale (simpler, more intuitive) |
| Map | No interactive map | Color-coded world map | In-app map | Annual static risk map PDF + interactive | Interactive map | Interactive, zoomable, always-on |
| Score breakdown | 9 risk categories | By risk type | 7 categories + demographics | Multi-domain | 8 sub-risk factors | Category breakdown with transparent weights |
| Regional data | City-level scores (limited) | Country-level | Neighborhood (65k) | Country + city | Country + zones | Country + region drill-down (free data) |
| Update frequency | Irregular | Monthly + real-time weather | Real-time | Quarterly map, ongoing alerts | Quarterly + ad-hoc | Daily automated |
| Methodology transparency | Formula described on About page | Not detailed | Proprietary/"AI-enhanced" | Not public | "Tested methodology" but proprietary | Fully transparent: every weight, every source |
| Multilingual | English only | Limited | English only | English (enterprise) | English (enterprise) | English + Italian, expandable |
| Price | Free (ad-supported) | Free | Freemium (app) | Enterprise SaaS | Enterprise SaaS | Free, no ads (v1) |
| User content | Reviews/comments | No | No | No | No | No (data-driven only) |
| Demographic scores | Women travelers category | No | Women + at-risk demographics | No | No | Women + LGBTQ+ (v1.x using open data) |
| Historical trends | No | No | No | Year-over-year in annual report | Year-over-year comparison | Daily trend data (v1.x) |
| Government advisories | Shows US/CA/AU advisories | No | No | Integrates advisories | Integrates advisories | Aggregate multiple government advisories |

### Competitive Positioning

The market has two tiers:
1. **Enterprise (Safeture, International SOS, Healix):** Expensive, B2B, comprehensive but inaccessible to individual travelers
2. **Consumer (TravelSafe-Abroad, SafeTravy, GeoSure):** Free or freemium, but each has significant gaps

**IsItSafeToTravel.com fills the gap** by being:
- **More transparent** than anyone (full methodology disclosure vs proprietary "algorithms")
- **More frequently updated** than free competitors (daily vs quarterly/irregular)
- **More granular** than most free tools (regional drill-down vs country-only)
- **Simpler** than enterprise tools (no account, no app download, just a URL)
- **Multilingual** where competitors are English-only

The closest competitor is TravelSafe-Abroad, which has strong SEO but lacks an interactive map, has irregular updates, and relies partly on user-generated reviews. The project can directly compete on "Is [country] safe?" search queries with better data freshness and visualization.

## Sources

- [Safeture Features](https://safeture.com/features/) - Enterprise travel risk platform features
- [Safeture Risk Map 2026](https://www.safeture.com/risk-maps-2026/) - Annual risk map methodology
- [GeoSure](https://geosure.ai) - Neighborhood-level safety scores with demographic-specific ratings
- [GeoSure Individuals](https://geosure.ai/individuals) - Consumer safety score features
- [SafeTravy Maps](https://www.safetravy.com/maps/travel-and-maps) - Free travel safety map platform
- [TravelSafe-Abroad](https://www.travelsafe-abroad.com/) - Country safety index with user reviews
- [TravelSafe-Abroad Countries Index](https://www.travelsafe-abroad.com/countries/) - 0-100 safety ranking methodology
- [Healix Risk Map 2026](https://healix.com/international/reports/risk-radar-26/risk-map-2026) - Interactive security risk map
- [International SOS Risk Outlook](https://www.internationalsos.com/risk-outlook) - Enterprise risk assessment platform
- [HelloSafe Safety Index](https://hellosafe.com/travel-insurance/safest-countries-in-the-world) - Public-data transparency model
- [Vision of Humanity GPI Map](https://www.visionofhumanity.org/maps/) - Global Peace Index interactive visualization
- [Equaldex](https://www.equaldex.com/) - LGBTQ+ rights open data by country
- [Safety Index](https://safetyindex.net/travelsafetyindex.html) - Multi-pillar safety scoring methodology
- [Travel Off Path Safety Index](https://www.traveloffpath.com/dashboard/safety-index) - Real-time user-sourced safety ratings
- [Baymard Institute Travel UX](https://baymard.com/blog/travel-site-ux-best-practices) - Travel site UX best practices research

---
*Feature research for: Travel safety information platform*
*Researched: 2026-03-19*
