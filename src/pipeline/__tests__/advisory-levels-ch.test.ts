import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeChAssessment } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-26 CH (Switzerland EDA) repair
 * (SOURCE-REPAIR-BRIEF.md). The old fetcher scraped a travel-advice LISTING
 * page that no longer exists (Nuxt rebuild); the new fetcher reads the site's
 * own structured "reisehinweise" JSON API instead (see fetchChAdvisories in
 * advisories-tier3b.ts), which exposes an `advice_against` enum directly.
 *
 * The 'none' branch is the one case the enum does NOT settle on its own:
 * checked live against all 104 'none'-classified countries 2026-09-26, only
 * 74 carry the FDFA's fixed calm-country phrase ("Reisen nach/in X
 * gelten/gilt grundsätzlich als sicher"); the other 30 -- North Korea, South
 * Africa, Zimbabwe, Algeria... -- describe real elevated-caution conditions
 * with no safety claim at all. Fixtures below for that branch are VERBATIM
 * excerpts (HTML-stripped) from the live API 2026-09-26.
 */

describe('normalizeChAssessment (CH/eda.admin.ch "reisehinweise" API)', () => {
  it('hasTravelAdvice=false -> null regardless of adviceAgainst (rule 1: "no specific advisory published" is not a safety statement, e.g. Andorra/San Marino/Vatican)', () => {
    assert.equal(
      normalizeChAssessment({ adviceAgainst: 'none', hasTravelAdvice: false, assessmentText: '' }),
      null,
    );
    // Even a stray 'general'/'tourists'/'regional' value must not leak through when the flag is false.
    assert.equal(
      normalizeChAssessment({ adviceAgainst: 'general', hasTravelAdvice: false, assessmentText: '' }),
      null,
    );
  });

  it("adviceAgainst='general' -> 4 (whole-country advise-against-all-travel, e.g. Afghanistan/Syria/Ukraine)", () => {
    assert.equal(
      normalizeChAssessment({ adviceAgainst: 'general', hasTravelAdvice: true, assessmentText: 'irrelevant' }),
      4,
    );
  });

  it("adviceAgainst='tourists' -> 3 (our own level-3 definition verbatim: \"Von touristischen ... nicht dringenden Reisen ... wird abgeraten\", e.g. Israel/Myanmar/Venezuela)", () => {
    assert.equal(
      normalizeChAssessment({ adviceAgainst: 'tourists', hasTravelAdvice: true, assessmentText: 'irrelevant' }),
      3,
    );
  });

  it("adviceAgainst='regional' -> 2 unconditionally, even if the text itself reads severely (repair brief rule 2: partial/sub-national warnings never promote a whole country above 2)", () => {
    const severeRegionalText =
      'Im Norden des Landes herrscht Bürgerkrieg. Von Reisen in diese Gebiete wird dringend abgeraten. Zahlreiche bewaffnete Gruppen sind aktiv.';
    assert.equal(
      normalizeChAssessment({ adviceAgainst: 'regional', hasTravelAdvice: true, assessmentText: severeRegionalText }),
      2,
    );
  });

  it("adviceAgainst='none' + Japan's real \"Reisen nach Japan gelten grundsätzlich als sicher\" -> 1", () => {
    const text =
      'Reisen nach Japan gelten grundsätzlich als sicher. Die angespannte Lage auf der koreanischen Halbinsel kann sich auch auf Japan auswirken.';
    assert.equal(normalizeChAssessment({ adviceAgainst: 'none', hasTravelAdvice: true, assessmentText: text }), 1);
  });

  it("adviceAgainst='none' + singular \"gilt grundsätzlich als sicher\" phrasing -> 1", () => {
    const text = 'Reisen in das Fürstentum gilt grundsätzlich als sicher.';
    assert.equal(normalizeChAssessment({ adviceAgainst: 'none', hasTravelAdvice: true, assessmentText: text }), 1);
  });

  it('ASCII-folded "grundsaetzlich" (no umlaut) still matches -> 1 (resilience against encoding variance)', () => {
    const text = 'Reisen nach Kanada gelten grundsaetzlich als sicher.';
    assert.equal(normalizeChAssessment({ adviceAgainst: 'none', hasTravelAdvice: true, assessmentText: text }), 1);
  });

  it('REGRESSION: North Korea\'s real \'none\'-classified text has NO safety claim -> 2, not a guessed 1', () => {
    const text =
      'Die Spannungen auf der koreanischen Halbinsel sind hoch. Bestimmte Ereignisse wie Raketentests und Militärmanöver können die Sicherheitslage kurzfristig beeinflussen. In Nordkorea sind ausschliesslich geführte und durch das staatliche Reisebüro organisierte Reisen möglich.';
    assert.equal(normalizeChAssessment({ adviceAgainst: 'none', hasTravelAdvice: true, assessmentText: text }), 2);
  });

  it("REGRESSION: South Africa's real 'none'-classified text (\"grosse Aufmerksamkeit ... Sicherheit\") -> 2, not 1", () => {
    const text =
      'Der persönlichen Sicherheit ist grosse Aufmerksamkeit zu schenken. Die Lage wird geprägt durch politische, soziale und wirtschaftliche Spannungen.';
    assert.equal(normalizeChAssessment({ adviceAgainst: 'none', hasTravelAdvice: true, assessmentText: text }), 2);
  });

  it("adviceAgainst='none' with empty/unreadable assessment text -> 2, never guessed as 1", () => {
    assert.equal(normalizeChAssessment({ adviceAgainst: 'none', hasTravelAdvice: true, assessmentText: '' }), 2);
  });

  it('unrecognised adviceAgainst value (future API change) -> null, never guessed', () => {
    assert.equal(
      normalizeChAssessment({ adviceAgainst: 'some-new-category', hasTravelAdvice: true, assessmentText: 'x' }),
      null,
    );
  });
});
