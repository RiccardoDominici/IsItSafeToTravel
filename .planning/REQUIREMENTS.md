# Requirements: IsItSafeToTravel

**Defined:** 2026-03-26
**Core Value:** Any traveler can instantly see how safe a destination is, backed by transparent, automatically-updated data from trusted public sources.

## v4.0 Requirements

Requirements for Global Advisory Sources Expansion. Each maps to roadmap phases.

### API Sources (Tier 1)

- [x] **API-01**: Pipeline fetches Germany advisory levels from Auswaertiges Amt REST API daily
- [x] **API-02**: Pipeline fetches Netherlands advisory levels from nederlandwereldwijd.nl JSON API daily
- [x] **API-03**: Pipeline fetches Japan advisory levels from MOFA XML open data daily
- [x] **API-04**: Pipeline fetches Slovakia advisory data from MZV open data portal daily

### Structured HTML Sources (Tier 2)

- [ ] **HTML-01**: Pipeline fetches France advisory levels from diplomatie.gouv.fr RSS/HTML daily
- [ ] **HTML-02**: Pipeline fetches New Zealand advisory levels from SafeTravel.govt.nz daily
- [ ] **HTML-03**: Pipeline fetches Ireland security ratings from DFA daily
- [ ] **HTML-04**: Pipeline fetches Finland advisory levels from um.fi daily
- [ ] **HTML-05**: Pipeline fetches Hong Kong OTA alert levels daily
- [ ] **HTML-06**: Pipeline fetches Brazil advisory levels from Itamaraty daily
- [ ] **HTML-07**: Pipeline fetches Austria advisory levels from BMEIA daily
- [ ] **HTML-08**: Pipeline fetches Philippines alert levels from DFA daily
- [ ] **HTML-09**: Pipeline fetches Belgium advisory levels from diplomatie.belgium.be daily
- [ ] **HTML-10**: Pipeline fetches Denmark advisory data from um.dk daily
- [ ] **HTML-11**: Pipeline fetches Singapore advisory notices from MFA daily
- [ ] **HTML-12**: Pipeline fetches Romania advisory data from MAE daily
- [ ] **HTML-13**: Pipeline fetches Serbia advisory levels from MFA daily
- [ ] **HTML-14**: Pipeline fetches Estonia advisory data from kriis.ee daily
- [ ] **HTML-15**: Pipeline fetches Croatia advisory data from MVEP daily
- [ ] **HTML-16**: Pipeline fetches Argentina advisory alerts from Cancilleria daily

### Complex Sources (Tier 3)

- [ ] **CPLX-01**: Pipeline fetches Italy advisory data from Viaggiare Sicuri daily
- [ ] **CPLX-02**: Pipeline fetches Spain advisory data from exteriores.gob.es daily
- [ ] **CPLX-03**: Pipeline fetches South Korea advisory levels from 0404.go.kr daily
- [ ] **CPLX-04**: Pipeline fetches Taiwan advisory levels from BOCA daily
- [ ] **CPLX-05**: Pipeline fetches China advisory data from cs.mfa.gov.cn daily
- [ ] **CPLX-06**: Pipeline fetches India advisory data from MEA daily
- [ ] **CPLX-07**: Pipeline fetches Switzerland advisory data from EDA daily
- [ ] **CPLX-08**: Pipeline fetches Sweden advisory data from regeringen.se daily
- [ ] **CPLX-09**: Pipeline fetches Norway advisory data from regjeringen.no daily
- [ ] **CPLX-10**: Pipeline fetches Poland advisory data from MSZ daily
- [ ] **CPLX-11**: Pipeline fetches Czech Republic advisory data from MZV daily
- [ ] **CPLX-12**: Pipeline fetches Hungary advisory data from KKM daily
- [ ] **CPLX-13**: Pipeline fetches Portugal advisory data from MNE daily

### Normalization & Scoring

- [x] **NORM-01**: All new sources normalize to unified 1-4 advisory level scale
- [ ] **NORM-02**: Scoring engine weights updated to include all new advisory sources in Conflict pillar
- [ ] **NORM-03**: Source-tiers.json updated with all new sources as signal tier

### Cleanup

- [x] **CLEAN-01**: WHO DONs fetcher and all references removed from pipeline and scoring
- [x] **CLEAN-02**: GDELT fetcher and all references removed from pipeline and scoring
- [x] **CLEAN-03**: Weights and normalization ranges updated after source removal

### CI/CD

- [ ] **CI-01**: GitHub Actions workflow fetches all new advisory sources daily
- [ ] **CI-02**: Staggered fetching to respect rate limits across 30+ sources
- [ ] **CI-03**: Graceful degradation: individual source failures don't block pipeline

### Documentation

- [ ] **DOC-01**: Methodology page updated with all new sources in all 5 languages
- [ ] **DOC-02**: Country detail pages show advisory info from new sources
- [ ] **DOC-03**: Sources page lists all new government advisory sources

### Calibration & Validation

- [ ] **CAL-01**: Research-based reference score (1-10) established for each country via global safety perception analysis
- [ ] **CAL-02**: Compare site scores vs reference scores, compute per-country delta and global mean deviation
- [ ] **CAL-03**: Identify systematic bias patterns (by region, risk level, geopolitical bloc)
- [ ] **CAL-04**: Propose weight balancing options based on deviation analysis

## Future Requirements

### Personalization
- **PERS-01**: User can select home country to weight advisory from their government
- **PERS-02**: Score adjusts based on traveler's nationality (visa requirements, diplomatic relations)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Advisory sources from countries without structured systems (Turkey, UAE, Qatar, Saudi Arabia, Egypt, Kenya, etc.) | Only issue ad-hoc crisis alerts, no per-country advisory data to fetch |
| Real-time advisory change notifications | Daily batch updates sufficient per project constraints |
| Machine translation of advisory text | Only need level/rating, not full text translation |
| Advisory text display on country pages | Only numeric level integrated into scoring; text advisory would need UX redesign |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CLEAN-01 | Phase 28 | Complete |
| CLEAN-02 | Phase 28 | Complete |
| CLEAN-03 | Phase 28 | Complete |
| API-01 | Phase 29 | Complete |
| API-02 | Phase 29 | Complete |
| API-03 | Phase 29 | Complete |
| API-04 | Phase 29 | Complete |
| NORM-01 | Phase 29 | Complete |
| HTML-01 | Phase 30 | Pending |
| HTML-02 | Phase 30 | Pending |
| HTML-03 | Phase 30 | Pending |
| HTML-04 | Phase 30 | Pending |
| HTML-05 | Phase 30 | Pending |
| HTML-06 | Phase 30 | Pending |
| HTML-07 | Phase 30 | Pending |
| HTML-08 | Phase 30 | Pending |
| HTML-09 | Phase 31 | Pending |
| HTML-10 | Phase 31 | Pending |
| HTML-11 | Phase 31 | Pending |
| HTML-12 | Phase 31 | Pending |
| HTML-13 | Phase 31 | Pending |
| HTML-14 | Phase 31 | Pending |
| HTML-15 | Phase 31 | Pending |
| HTML-16 | Phase 31 | Pending |
| CPLX-01 | Phase 32 | Pending |
| CPLX-02 | Phase 32 | Pending |
| CPLX-03 | Phase 32 | Pending |
| CPLX-04 | Phase 32 | Pending |
| CPLX-05 | Phase 32 | Pending |
| CPLX-06 | Phase 32 | Pending |
| CPLX-07 | Phase 33 | Pending |
| CPLX-08 | Phase 33 | Pending |
| CPLX-09 | Phase 33 | Pending |
| CPLX-10 | Phase 33 | Pending |
| CPLX-11 | Phase 33 | Pending |
| CPLX-12 | Phase 33 | Pending |
| CPLX-13 | Phase 33 | Pending |
| NORM-02 | Phase 34 | Pending |
| NORM-03 | Phase 34 | Pending |
| CI-01 | Phase 35 | Pending |
| CI-02 | Phase 35 | Pending |
| CI-03 | Phase 35 | Pending |
| DOC-01 | Phase 36 | Pending |
| DOC-02 | Phase 36 | Pending |
| DOC-03 | Phase 36 | Pending |
| CAL-01 | Phase 37 | Pending |
| CAL-02 | Phase 37 | Pending |
| CAL-03 | Phase 37 | Pending |
| CAL-04 | Phase 37 | Pending |

**Coverage:**
- v4.0 requirements: 49 total
- Mapped to phases: 49
- Unmapped: 0

---
*Requirements defined: 2026-03-26*
*Last updated: 2026-03-26 after roadmap creation*
