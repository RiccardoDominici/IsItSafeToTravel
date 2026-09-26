import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeAtLevel, extractAtRestOfCountryLevel } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-26 AT (Austria/BMEIA) repair
 * (PARSER-REGIONAL-BRIEF.md).
 *
 * `normalizeAtLevel` fixtures below are the REAL `security` / `securityPartial`
 * pairs read from the live `bmeiaCountrySecurityInfos` JS object on
 * bmeia.gv.at/reise-services/reisewarnungen, 2026-09-26.
 *
 * `extractAtRestOfCountryLevel` fixtures are VERBATIM excerpts (HTML tags
 * collapsed to spaces, as the fetcher's own extraction produces) from the
 * live per-country detail pages, covering all 3 "rest of the country" idioms
 * BMEIA uses plus the 2 countries confirmed to have none at all.
 */

describe('normalizeAtLevel', () => {
  it('securityPartial=1 with a known rest-of-country level -> uses it directly, even when higher than 2 (Pakistan: regional 4 on the Line of Control, but "im Rest des Landes" is 3)', () => {
    assert.equal(normalizeAtLevel({ security: 4, securityPartial: 1 }, 3), 3);
  });

  it('securityPartial=1 with no resolvable rest-of-country level -> capped at 2, never guessed up to the regional peak (Chad: capital=3, border=4, no residual statement found)', () => {
    assert.equal(normalizeAtLevel({ security: 4, securityPartial: 1 }, null), 2);
    assert.equal(normalizeAtLevel({ security: 4, securityPartial: 1 }, undefined), 2);
  });

  it('securityPartial=1, rest-of-country resolves to 1 (Georgia/Armenia/Kosovo: calm outside a named conflict/border area) -> 1, not capped up to 2', () => {
    assert.equal(normalizeAtLevel({ security: 3, securityPartial: 1 }, 1), 1);
  });

  it('securityPartial=0 (genuine whole-country level, e.g. Haiti/Syria/Afghanistan) -> the raw level, rest-of-country param ignored', () => {
    assert.equal(normalizeAtLevel({ security: 4, securityPartial: 0 }, 1), 4);
  });

  it('clamps out-of-range security values into 1-4', () => {
    assert.equal(normalizeAtLevel({ security: 5, securityPartial: 0 }), 4);
    assert.equal(normalizeAtLevel({ security: 0, securityPartial: 0 }), 1);
  });
});

describe('extractAtRestOfCountryLevel', () => {
  it('"(Sicherheitsstufe 2) im Rest des Landes" (Turkey: real page text) -> 2', () => {
    const html =
      '<p>Regionale Reisewarnung Sicherheitsstufe 4 (von 4) gilt für Reisen in Gebiete die sich weniger als 10 km von der syrischen, der irakischen oder der iranischen Grenze entfernt befinden.</p><p>Sicherheitsrisiko Sicherheitsstufe 2 (von 4) gilt im Rest des Landes.</p>';
    assert.equal(extractAtRestOfCountryLevel(html), 2);
  });

  it('"Hohes Sicherheitsrisiko Sicherheitsstufe 3 (von 4) gilt im Rest des Landes" (Pakistan: real page text, regional 4 is only the Line of Control) -> 3, not the 2 a blanket cap would give', () => {
    const html =
      '<p>Regionale Reisewarnung Sicherheitsstufe 4 gilt vor allem entlang der Waffenstillstandslinie "Line of Control".</p><p>Hohes Sicherheitsrisiko Sicherheitsstufe 3 (von 4) gilt im Rest des Landes.</p>';
    assert.equal(extractAtRestOfCountryLevel(html), 3);
  });

  it('"(Sicherheitsstufe 3) für die restlichen Landesteile Israels" (Israel: real page text) -> 3', () => {
    const html =
      '<p>Regionale Reisewarnung (Sicherheitsstufe 4) für den Norden Israels (nördlich der Straße 85 und deren Verlängerung). Hohes Sicherheitsrisiko (Sicherheitsstufe 3) für die restlichen Landesteile Israels.</p>';
    assert.equal(extractAtRestOfCountryLevel(html), 3);
  });

  it('"(Sicherheitsstufe 3) gilt in den restlichen Regionen" (Russia: real page text) -> 3', () => {
    const html =
      '<p>Regionale Reisewarnung Sicherheitsstufe 4 (von 4) gilt für die an die Ukraine angrenzenden Verwaltungsgebiete. Hohes Sicherheitsrisiko (Sicherheitsstufe 3) gilt in den restlichen Regionen.</p>';
    assert.equal(extractAtRestOfCountryLevel(html), 3);
  });

  it('"(Sicherheitsstufe 2) in Addis Abeba und in den übrigen Landesteilen" (Ethiopia: real page text) -> 2', () => {
    const html =
      '<p>Regionale Reisewarnung (Sicherheitsstufe 4) für Amhara, Tigray und das Grenzgebiet des Regionalstaates Afar zu Eritrea.</p><p>Sicherheitsrisiko (Sicherheitsstufe 2) in Addis Abeba und in den übrigen Landesteilen.</p>';
    assert.equal(extractAtRestOfCountryLevel(html), 2);
  });

  it('no residual idiom anywhere (Chad: real page text -- capital and border regions named, nothing stated for the remainder) -> null, never guessed', () => {
    const html =
      '<p>(Sicherheitsstufe 4) Vor Reisen außerhalb der Hauptstadt wird aufgrund erheblicher Anschlags- und Entführungsrisiken gewarnt!</p><p>(Sicherheitsstufe 3) Von Reisen nach N\'Djamena wird aufgrund der hohen Anschlagsgefahr abgeraten.</p>';
    assert.equal(extractAtRestOfCountryLevel(html), null);
  });

  it('no residual idiom anywhere (Palestine: real page text -- Gaza and West Bank hotspots named, no separate "rest" statement) -> null', () => {
    const html =
      '<p>Regionale Reisewarnung Sicherheitsstufe 4 (von 4) gilt für den gesamten Gazastreifen.</p><p>Hohes Sicherheitsrisiko Sicherheitsstufe 3 (von 4) für Ostjerusalem, Ramallah, Betlehem, Jericho, das Jordan-Tal und die Küstenregion am Toten Meer.</p>';
    assert.equal(extractAtRestOfCountryLevel(html), null);
  });
});
