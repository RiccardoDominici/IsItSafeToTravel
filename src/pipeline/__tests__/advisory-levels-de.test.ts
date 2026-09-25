import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeDeContentText, normalizeDeLevel } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-25 DE (Auswaertiges Amt) review
 * (SOURCE-REPAIR-BRIEF.md). Audit finding: the bulk /opendata/travelwarning
 * feed's warning/partialWarning/situationWarning/situationPartWarning
 * booleans are not a complete signal — situationWarning/situationPartWarning
 * were true for 0/200 countries on 2026-09-25 (dead fields), and even
 * warning/partialWarning under-report AA's informal "Von Reisen ... wird
 * (dringend) abgeraten" tier, which only exists as prose in the per-country
 * `/opendata/travelwarning/{contentId}` "content" field.
 *
 * Fixtures below are VERBATIM excerpts (safe tag boundaries) pulled from
 * that live endpoint on 2026-09-25, covering all 8 countries named in the
 * source-repair brief (ISR, PRK, JOR, KWT, BHR, CUB, QAT, OMN) plus 4 more
 * found by the same method (BDI, COG, MDA, GEO — "and others" in the brief)
 * and 4 regression controls (LBN, AFG cross-check the escalation logic;
 * MOZ, CIV confirm existing partialWarning=true countries do not change).
 */

describe('normalizeDeContentText (DE/AA per-country content)', () => {
  it('Afghanistan: bare "Vor Reisen nach Afghanistan wird gewarnt" -> Level 4 (cross-checks warning=true)', () => {
    const html =
      '<h2>Aktuelles</h2><p><strong>Vor Reisen nach Afghanistan wird gewarnt.</strong><br/><strong>Deutsche Staatsangehörige werden aufgefordert, Afghanistan zu verlassen. </strong></p>';
    assert.equal(normalizeDeContentText(html, 'Afghanistan'), 4);
  });

  it('Israel: no whole-country "gewarnt" (Gaza/West Bank Reisewarnung is regional), but "andere Landesteile Israels ... wird abgeraten" catch-all -> Level 3, not 4', () => {
    const html =
      '<h2>Aktuelles</h2><p><span><strong>Vor Reisen in den Gazastreifen und in das Westjordanland (mit Ausnahme von Ost-Jerusalem) wird gewarnt.</strong></span></p><p><span><strong>Von Reisen in das Gebiet um den Gazastreifen (sogenannter „Gaza-Envelope“) sowie in den Norden Israels (nördlich der Straße 85 und deren Verlängerung) wird dringend abgeraten. </strong></span><br/><span><strong>Von Reisen in andere Landesteile Israels sowie nach Ost-Jerusalem wird abgeraten.</strong></span></p>';
    assert.equal(normalizeDeContentText(html, 'Israel'), 3);
  });

  it('Jordan: regional "Grenzgebiet"/"Nordosten"/"Grenzregion" sentence alone would be Level 2, but the "andere Landesteile Jordaniens" catch-all raises it to Level 3', () => {
    const html =
      '<h2>Aktuelles</h2><p><strong>Von Reisen in das unmittelbare syrisch-jordanische Grenzgebiet sowie in den Nordosten des Landes und in die Grenzregion zu Irak wird dringend abgeraten.</strong></p><p><strong>Von nicht notwendigen Reisen in andere Landesteile Jordaniens wird abgeraten.</strong></p>';
    assert.equal(normalizeDeContentText(html, 'Jordanien'), 3);
  });

  it('North Korea: bare "in die Demokratische Volksrepublik Korea wird dringend abgeraten" -> Level 3 (no formal Reisewarnung exists for it, warning=false)', () => {
    const html =
      '<h2>Sicherheit</h2><p><strong>Von Reisen in die Demokratische Volksrepublik Korea wird dringend abgeraten.</strong></p>';
    // countryName carries the parenthetical alias exactly as the live API returns it.
    assert.equal(normalizeDeContentText(html, 'Demokratische Volksrepublik Korea (Nordkorea)'), 3);
  });

  it('Kuwait: bare "Von Reisen nach Kuwait wird dringend abgeraten" -> Level 3, and the later "Sicherheitslage in der Region" paragraph (about the whole Gulf, not Kuwait alone) does not interfere', () => {
    const html =
      '<h2>Aktuelles</h2><p><span><strong>Von Reisen nach Kuwait wird dringend abgeraten.</strong></span></p><h3><span>Sicherheitslage in der Region</span></h3><p><span>Die Sicherheitslage in der Region ist volatil; das Risiko der Ausweitung der Kampfhandlungen sowie Sperrungen des Flugverkehrs bleibt bestehen, auch für Kuwait.</span></p>';
    assert.equal(normalizeDeContentText(html, 'Kuwait'), 3);
  });

  it('Bahrain: bare "Von Reisen nach Bahrain wird dringend abgeraten" -> Level 3', () => {
    const html =
      '<h2>Aktuelles</h2><p><strong>Von Reisen nach Bahrain wird dringend abgeraten.</strong></p><h3><span>Sicherheitslage in der Region</span></h3><p><span>Die Sicherheitslage in der Region ist volatil.</span></p>';
    assert.equal(normalizeDeContentText(html, 'Bahrain'), 3);
  });

  it('Cuba: "wird derzeit dringend abgeraten" (adverb inserted between country and verb) -> Level 3', () => {
    const html =
      '<h2>Aktuelles</h2><p><span><strong>Von Reisen nach Kuba wird derzeit dringend abgeraten.</strong></span></p><h3><em>Energiekrise</em></h3><p>Kuba sieht sich einer akuten Energiekrise gegenüber.</p>';
    assert.equal(normalizeDeContentText(html, 'Kuba'), 3);
  });

  it('Qatar: bare "Von Reisen nach Katar wird abgeraten" (no "dringend") -> Level 3 (brief does not distinguish dringend-intensity)', () => {
    const html =
      '<h2>Aktuelles</h2><p><span><strong>Von Reisen nach Katar wird abgeraten.</strong></span></p><h3>Sicherheitslage in der Region</h3><p><span>Die Sicherheitslage in der Region ist volatil, auch für Katar.</span></p>';
    assert.equal(normalizeDeContentText(html, 'Katar'), 3);
  });

  it('Oman: "Exklave Musandam" + "Grenzregion zu Jemen" only, no catch-all -> Level 2, NOT 3 (partial/sub-national must stay <= 2)', () => {
    const html =
      '<h2>Aktuelles</h2><p><span><strong>Von Reisen in die Exklave Musandam an der Straße von Hormuz und in die unmittelbare Grenzregion zu Jemen wird abgeraten.</strong></span></p><h3><span>Sicherheitslage in der Region</span></h3><p>Die Sicherheitslage in der Region ist volatil, auch für Oman.</p>';
    assert.equal(normalizeDeContentText(html, 'Oman'), 2);
  });

  it('Moldova: "Von Reisen nach Transnistrien wird abgeraten" is short and has no conjunction (looks structurally like a bare whole-country hit) but does NOT name Moldova -> Level 2, not 3', () => {
    const html =
      '<h2>Sicherheit</h2><p><strong>Von Reisen nach Transnistrien wird abgeraten.</strong></p><h3>Terrorismus</h3><p>Die innenpolitische Lage in der Republik Moldau ist stabil.</p>';
    assert.equal(normalizeDeContentText(html, 'Republik Moldau'), 2);
  });

  it('Burundi: long, comma/"sowie"-joined named-province description -> Level 2, not 3 (no catch-all, no bare country match)', () => {
    const html =
      '<h2>Aktuelles</h2><p><strong>Von nicht notwendigen Reisen in den nördlichen Teil der neuen Provinz Bujumbura (ehemalige Provinzen Cibitoke und Bubanza sowie Kommunen Mpanda, Bubanza, Bukinanyana, Cibitoke und Mugina) sowie in den nördlichen Bereich des Kibira-Nationalparks, insbesondere nördlich und östlich der RN 10 (Strecke von Rugombo bis Kayanza), wird dringend abgeraten. </strong></p>';
    assert.equal(normalizeDeContentText(html, 'Burundi'), 2);
  });

  it('Georgia: "Von Reisen nach Abchasien, Südossetien und ... wird dringend abgeraten" names breakaway regions, not Georgia itself -> Level 2, not 3', () => {
    const html =
      '<h2>Aktuelles</h2><p><strong>Von Reisen nach Abchasien, Südossetien und in die unmittelbare Nähe der Konfliktregionen wird dringend abgeraten.</strong></p><h3><em>Versicherungspflicht seit 1. Januar 2026</em></h3><p>Seit 1. Januar 2026 muss bei Einreise nach Georgien eine Auslandskrankenversicherung nachgewiesen werden.</p>';
    assert.equal(normalizeDeContentText(html, 'Georgien'), 2);
  });

  it('Congo-Brazzaville: the only "wird abgeraten" sentences on the page are about drone/equipment use, not travel -> Level 1 (the "Reise" filter rejects them)', () => {
    const html =
      '<p>Von ihrer Nutzung wird abgeraten.</p><p>Stromausfälle auch in Großstädten sind keine Seltenheit.</p><p>Vom Mitführen von Drohnen wird abgeraten, ihr Betrieb ist genehmigungspflichtig.</p>';
    assert.equal(normalizeDeContentText(html, 'Republik Kongo'), 1);
  });

  it('empty/absent content -> Level 1 (nothing to escalate from)', () => {
    assert.equal(normalizeDeContentText('', 'Somalia'), 1);
    assert.equal(normalizeDeContentText(undefined as unknown as string, 'Somalia'), 1);
  });

  it('Mozambique: existing partialWarning=true (Teilreisewarnung) case has no catch-all -> text level stays 2, does not regress', () => {
    const html =
      '<h2>Sicherheit - Teilreisewarnung</h2><p>Siehe Aktuelles</p><p>Vor Reisen in die Provinz Cabo Delgado, in alle Distrikte, außer Pemba, Provinz Nampula, in die Distrikte Memba und Erati, Provinz Niassa, in die Distrikte Mecula und Marrupa, wird gewarnt.</p>';
    assert.equal(normalizeDeContentText(html, 'Mosambik'), 2);
  });

  it("Côte d'Ivoire: existing partialWarning=true case (border-region only) has no catch-all -> text level stays 2, does not regress", () => {
    const html =
      "<h2>Sicherheit - Teilreisewarnung</h2><p>Vor Reisen in das Grenzgebiet im Nordosten des Landes, einschließlich des Comoé-Nationalparks und der Stadt Bouna, wird gewarnt.</p><p>Von nicht erforderlichen Reisen in die unmittelbaren Grenzgebiete zu Mali und Burkina Faso wird abgeraten.</p>";
    assert.equal(normalizeDeContentText(html, "Côte d'Ivoire"), 2);
  });

  it('Lebanon: NEW finding — has its own "andere Landesteile Libanons ... wird dringend abgeraten" catch-all -> Level 3, escalating above its existing partialWarning=true (Level 2)', () => {
    const html =
      '<h2>Aktuelles</h2><p><strong>Vor Reisen in den Süden Libanons (alle Gebiete südlich der Küstenortschaft Jiyeh), die Bekaa-Ebene, das Gouvernorat Baalbek-Hermel, das Grenzgebiet zu Syrien, alle palästinensischen Flüchtlingslager sowie die südlichen Vororte von Beirut (siehe Sicherheit) wird gewarnt. </strong></p><p><strong>Von Reisen in andere Landesteile Libanons wird dringend abgeraten.</strong></p>';
    assert.equal(normalizeDeContentText(html, 'Libanon'), 3);
  });

  // --- Full-200-country re-run findings (2026-09-25): a first version of
  // normalizeDeContentText passed all of the above but broke on 4 more
  // countries only visible once every DE page was checked, not just the
  // originally-flagged ones. Kept as permanent regressions.

  it('Serbia: "Von einer Einreise nach Serbien mit einem Fahrzeug ohne gültige Hauptuntersuchung... wird abgeraten" is a vehicle-inspection/document rule, not a safety statement -> Level 1, not 3 (bare /reise/i substring-matched "Einreise" in the first version of this function)', () => {
    const html =
      '<p><strong>Von einer Einreise nach Serbien mit einem Fahrzeug ohne gültige Hauptuntersuchung HU (auch „TÜV“ genannt) wird abgeraten.</strong></p><p><strong>Von der Einreise mit einem einmal als verloren oder gestohlen gemeldeten Ausweisdokument wird dringend abgeraten.</strong></p>';
    assert.equal(normalizeDeContentText(html, 'Serbien'), 1);
  });

  it('Hungary: "Von der Einreise mit deutschen Kurzzeitkennzeichen wird abgeraten" is a license-plate rule, not a safety statement -> Level 1, not 2', () => {
    const html =
      '<p>Von der Einreise mit deutschen Kurzzeitkennzeichen („gelbe Kennzeichen“) wird abgeraten, auch wenn die ungarischen Polizeidienststellen angewiesen wurden, die Einreise zu gestatten.</p>';
    assert.equal(normalizeDeContentText(html, 'Ungarn'), 1);
  });

  it('Bulgaria: "Ausreise mit einem als gestohlen/verloren gemeldeten... Reisedokument wird abgeraten" is a consular document tip, not a safety statement -> Level 1, not 2', () => {
    const html =
      '<p>Ausreise mit einem als gestohlen/verloren gemeldeten und wiederaufgefundenen Reisedokument wird abgeraten.</p>';
    assert.equal(normalizeDeContentText(html, 'Bulgarien'), 1);
  });

  it('UAE: "Von nicht notwendigen Reisen in die Vereinigten Arabischen Emirate wird abgeraten" — declined multi-word name ("Vereinigten Arabischen" vs. countryName\'s nominative "Vereinigte Arabische") still matches as whole-country -> Level 3, not 2', () => {
    const html =
      '<p><strong>Von nicht notwendigen Reisen in die Vereinigten Arabischen Emirate wird abgeraten.</strong></p>';
    assert.equal(normalizeDeContentText(html, 'Vereinigte Arabische Emirate'), 3);
  });

  it('Saudi Arabia: border-zone sentences are regional, but "alle weiteren Regionen Saudi-Arabiens wird abgeraten" is the "rest of the country" idiom with "Regionen" instead of "Landesteile" -> Level 3', () => {
    const html =
      '<p><strong>Vor Reisen in das Grenzgebiet zu Jemen in den Provinzen Nadschran, Asir und Dschazan (30 km Abstand zur Grenze) wird gewarnt.</strong></p><p><strong>Von Reisen in die erweiterte Grenzregion zu Jemen in einem Abstand zur Grenze von etwa 100 km, einschließlich der Städte Abha und Khamis Muschait, wird dringend abgeraten.</strong></p><p><strong>Von nicht notwendigen Reisen in alle weiteren Regionen Saudi-Arabiens wird abgeraten.</strong></p>';
    assert.equal(normalizeDeContentText(html, 'Saudi-Arabien'), 3);
  });

  it('Japan: a period-less "</h2><p>" boundary between an unrelated "Teilreisewarnung" heading and the real Fukushima sentence must not merge into one "sentence" -> Level 1 (the actual sentence is about staying/"Aufenthalte" in an evacuated area, not phrased with "Reise" at all; the heading\'s "Teilreisewarnung" contained "reise" as a bare substring and inflated this to Level 2 before the block-boundary fix). The PIPELINE still ends up at Level 2 for Japan via the existing partialWarning=true boolean (see the combined-formula describe block) — this only tests the text half in isolation.', () => {
    const html =
      '<h2>Sicherheit - Teilreisewarnung</h2><p><strong>Vor Aufenthalten in von der japanischen Regierung ausgewiesenen evakuierten Gebieten</strong> um das Kernkraftwerk Fukushima Daiichi I im Nordosten der Insel Honshu <strong>wird gewarnt</strong>.</p>';
    assert.equal(normalizeDeContentText(html, 'Japan'), 1);
  });

  it('Philippines: "andere Regionen VON MINDANAO" matches the "rest of the country" idiom textually, but Mindanao is one island group, not the Philippines itself -> Level 2, not 3 (matchesRestOfCountry must reject a catch-all re-scoped to a named sub-region)', () => {
    const html =
      '<p><strong>Vor Reisen in folgende Regionen oder Gebiete wird gewarnt</strong>, und von nicht erforderlichen Reisen in andere Regionen von Mindanao und in der Mindanao-See wird abgeraten, mit Ausnahme von Davao City sowie der Inseln Camiguin, Dinagat und Siargao.</p>';
    assert.equal(normalizeDeContentText(html, 'Philippinen'), 2);
  });

  it('Chad: "alle weiteren Regionen und Provinzen Tschads" — "Provinzen" (a DE_REGIONAL_WORDS term) appears right after the catch-all as a second enumerated category, not a re-scope to one specific other region -> Level 3, not 2', () => {
    const html =
      '<p><strong>Von nicht notwendigen Reisen in alle weiteren Regionen und Provinzen Tschads, einschließlich der Hauptstadt N’Djamena, wird abgeraten.</strong></p>';
    assert.equal(normalizeDeContentText(html, 'Tschad'), 3);
  });

  it("DR Congo: \"übrigen Landesteile der Demokratischen Republik Kongo\" (country's own name after the catch-all, no 'von <other place>') -> Level 3", () => {
    const html =
      '<p><strong>Von nicht notwendigen Reisen in die übrigen Landesteile der Demokratischen Republik Kongo, einschließlich der Hauptstadt Kinshasa, wird abgeraten.</strong></p>';
    assert.equal(normalizeDeContentText(html, 'Demokratische Republik Kongo'), 3);
  });
});

describe('normalizeDeLevel + normalizeDeContentText combined (the actual fetcher formula: Math.max of both)', () => {
  it('Lebanon: partialWarning=true (boolean level 2) combined with the text-derived catch-all (level 3) -> final Level 3', () => {
    const boolLevel = normalizeDeLevel({
      warning: false,
      partialWarning: true,
      situationWarning: false,
      situationPartWarning: false,
    });
    const textLevel = normalizeDeContentText(
      '<p><strong>Von Reisen in andere Landesteile Libanons wird dringend abgeraten.</strong></p>',
      'Libanon',
    );
    assert.equal(Math.max(boolLevel, textLevel), 3);
  });

  it('Afghanistan: warning=true (boolean level 4) combined with matching text (level 4) -> final Level 4, text never downgrades a true boolean', () => {
    const boolLevel = normalizeDeLevel({
      warning: true,
      partialWarning: false,
      situationWarning: false,
      situationPartWarning: false,
    });
    // Even if the content fetch failed and text came back as the empty-content default (1),
    // the boolean alone must still carry the country at Level 4.
    const textLevel = normalizeDeContentText('', 'Afghanistan');
    assert.equal(Math.max(boolLevel, textLevel), 4);
  });

  it('Japan: partialWarning=true (boolean level 2, the Fukushima Teilreisewarnung) combined with text level 1 (the Fukushima sentence itself is not phrased with "Reise") -> final Level 2. This is the CI hard-gate (data-pipeline.yml fails the whole run if JPN.de > 2) — must stay exactly 2, never 3 or 4.', () => {
    const boolLevel = normalizeDeLevel({
      warning: false,
      partialWarning: true,
      situationWarning: false,
      situationPartWarning: false,
    });
    const textLevel = normalizeDeContentText(
      '<h2>Sicherheit - Teilreisewarnung</h2><p><strong>Vor Aufenthalten in von der japanischen Regierung ausgewiesenen evakuierten Gebieten</strong> um das Kernkraftwerk Fukushima Daiichi I im Nordosten der Insel Honshu <strong>wird gewarnt</strong>.</p>',
      'Japan',
    );
    assert.equal(Math.max(boolLevel, textLevel), 2);
  });
});
