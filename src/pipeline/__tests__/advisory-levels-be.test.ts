import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeBeLevel } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-26 BE (Belgium diplomatie.belgium.be) repair
 * (SOURCE-REPAIR-BRIEF.md, second pass). Production found South Sudan reporting level 1 despite
 * an active "leave the country" order; this is the fix, plus the calibration work that followed.
 *
 * Fixtures below are VERBATIM excerpts pulled from the live diplomatie.belgium.be per-country
 * "Sécurité générale" articles on 2026-09-26 (real `\n`-joined block text, matching what
 * fetchBeAdvisories actually hands to normalizeBeLevel — see extractBeArticleBlocks).
 *
 * Two real false positives were found and fixed during this repair by running the FIRST version
 * of the fix (see git history) against ALL 177 live BE country pages, not just a sample: China's
 * own "l'obligation de quitter le pays" (a drug-law VISA consequence) and Somalia's own
 * "côtes somaliennes" (a coastal/maritime reference whose adjective happens to contain "somalie"
 * as a literal prefix). Both are covered below as their own regression tests, not just fixed
 * silently — see the doc comment on normalizeBeLevel and on the `hasQuitter` check inside it for
 * the full reasoning.
 */

describe('normalizeBeLevel (BE/diplomatie.belgium.be "Sécurité générale" article)', () => {
  it('never guesses on too little content (rule 1: emit nothing, do not default to 1)', () => {
    assert.equal(normalizeBeLevel('', 'Test'), null);
    assert.equal(normalizeBeLevel('one\ntwo', 'Test'), null); // fewer than 3 blocks
  });

  it('South Sudan: "conseillé ... de quitter le Soudan du Sud" + "déconseillons d\'y retourner" -> Level 4, not 1 (the proven production bug)', () => {
    const text = [
      'Il est conseillé aux compatriotes de quitter le Soudan du Sud.',
      "compatriotes de quitter le Soudan du Sud. La situation sécuritaire au Soudan du Sud est actuellement très instable et pourrait rapidement se détériorer.",
      "Si vous êtes actuellement au Soudan du Sud, nous vous conseillons de quitter le pays le plus tôt possible tant qu'il y a encore des vols commerciaux.",
      "Si vous êtes en dehors du Soudan du Sud, nous vous déconseillons d’y retourner.",
      'Criminalité',
      'La mauvaise situation économique entraîne une augmentation de la criminalité, y compris à Juba.',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Soudan du Sud'), 4);
  });

  it('REGRESSION: Liberia\'s "voyager seul à l\'intérieur du pays" (a solo-travel manner tip, Liberia\'s own name never even mentioned in the sentence) must NOT escalate to Level 4 via the generic "interieur du pays" whole-country fallback', () => {
    const text = [
      'Depuis la fin de la guerre civile en 2003, la situation sécuritaire dans le pays s’est globalement améliorée et la mission de l\'ONU (MINUL) a pu quitter le pays en 2017.',
      'La situation sécuritaire au Liberia est actuellement sous contrôle mais reste fragile et instable. Les rassemblements peuvent rapidement devenir violents et doivent être évités, et ce dans tout le pays.',
      'Les voyages dans les zones frontalières avec la Côte d’Ivoire et la Sierra Leone sont déconseillés.',
      'Le taux de criminalité au Libéria est élevé et celle-ci s’accompagne souvent de violence.',
      "Il est très fortement déconseillé de déplacer ou voyager seul à l’intérieur du pays, et ce quel que soit le moment de la journée. Des attaques à main armée et des vols, à la tire et à l’intérieur des véhicules, sont possibles. Les déplacements après la tombée de la nuit sont à éviter, surtout à l’intérieur du pays.",
      "Il est conseillé d'avoir toujours sur soi une preuve de son identité avec photo.",
    ].join('\n');
    const level = normalizeBeLevel(text, 'Libéria');
    assert.notEqual(level, 4);
    // The border-zone "déconseillés" sentence and the elevated-crime-rate sentence both cap at 2 --
    // real content, correctly capped, not silently dropped to null either.
    assert.equal(level, 2);
  });

  it('the plain manner-qualifier words alone (no "interieur du pays" nearby) do not suppress a GENUINE whole-country confirmation -- "seul" appearing elsewhere in the same window must not veto a "tout le pays" match', () => {
    const text = [
      'Sécurité',
      "Il est fortement déconseillé de voyager seul la nuit dans les grandes villes. Par ailleurs, tout voyage dans le pays est actuellement déconseillé en raison de la guerre civile.",
      'Criminalité',
      'Autre bloc.',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Testland'), 3);
  });

  it('Niger: whole-country "tout voyage au Niger est déconseillé" -> Level 3 (plain "déconseillé", no strong intensifier -- unaffected by the repair, existing pattern)', () => {
    const text = ['Sécurité', 'En raison de la situation actuelle, tout voyage au Niger est déconseillé.', 'Autre bloc.'].join('\n');
    assert.equal(normalizeBeLevel(text, 'Niger'), 3);
  });

  it('North Korea: "Tous les voyages sont déconseillés" (bare "deconseill" stem, no special-cased blanket escalation needed) -> Level 3, whole-country-confirmed via "en Corée du Nord" one sentence back', () => {
    const text = [
      'Toujours valable le',
      "Il y a un risque élevé pour la sécurité des étrangers en Corée du Nord en raison de tensions géopolitiques. Tous les voyages sont déconseillés. Les étrangers peuvent être arrêtés, détenus ou expulsés.",
      'Sécurité / Incendies',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Corée du Nord'), 3);
  });

  it('REGRESSION: China\'s "l\'obligation de quitter le pays" (a drug-law VISA consequence, not a travel verdict) must NOT escalate to Level 4', () => {
    const text = [
      "La Chine applique une tolérance zéro à l'égard de la consommation de drogues et les contrôles sont de plus en plus stricts.",
      "Un test positif – que la consommation de drogue ait eu lieu en Chine ou auparavant dans un autre pays – peut entraîner une détention, une amende, l'annulation du visa ou l'obligation de quitter le pays dans un délai très court.",
      'Criminalité',
      'Le taux de criminalité est globalement bas.',
    ].join('\n');
    assert.notEqual(normalizeBeLevel(text, 'Chine'), 4);
  });

  it('REGRESSION: South Korea\'s "il est strictement interdit de quitter le groupe" (a guided-tour rule near the DMZ) must NOT escalate at all', () => {
    const text = [
      "Depuis la fin de la guerre de Corée en 1953, une zone démilitarisée (DMZ) a été établie entre la Corée du Nord et la Corée du Sud.",
      "La DMZ n’est accessible que dans un contexte organisé. Les visiteurs sont accompagnés par des militaires et il est strictement interdit de quitter le groupe.",
      'Criminalité',
      'Peu de cas de vols ont été rapportés.',
    ].join('\n');
    const level = normalizeBeLevel(text, 'Corée du Sud');
    assert.notEqual(level, 4);
    assert.notEqual(level, 3);
  });

  it('REGRESSION: Somalia\'s "côtes somaliennes" (Somalia\'s own adjective, a coastal/maritime reference) must not be confused with the country name "Somalie" via a bare substring match', () => {
    // "naviguer" only reaches LEVEL4_STRONG's whole-country check because it is now a TRAVEL_WORD;
    // this text is real evidence that the confirmation itself must be word-boundary-aware.
    const text = [
      'Le Centre et le Sud de la Somalie',
      "La menace posée par la piraterie au large des côtes somaliennes reste élevée. Il est fortement déconseillé de naviguer dans ces eaux.",
      'Recommandation particulière',
      'Autre bloc de contenu.',
    ].join('\n');
    assert.notEqual(normalizeBeLevel(text, 'Somalie'), 4);
  });

  it('Somalia\'s REAL "Tous les voyages ... sont strictement déconseillés" (Puntland-specific, a named sub-region) stays capped, never promotes the whole country', () => {
    const text = [
      'Puntland',
      "La situation sécuritaire au Puntland reste précaire. Une branche de l'État islamique (IS) est active dans la région de Bari. Tous les voyages, même d'ordre humanitaire, sont strictement déconseillés.",
      'Le Centre et le Sud de la Somalie',
      "De nombreuses parties du territoire demeurent sous l'autorité d'Al-Shabaab.",
    ].join('\n');
    assert.notEqual(normalizeBeLevel(text, 'Somalie'), 4);
  });

  it('UAE: region-scoped "il est déconseillé de naviguer vers ces îles" (disputed Abu Musa/Tunb) registers at its correctly-capped Level 2, not silently nothing', () => {
    const text = [
      'La vie quotidienne et l’espace public sont sûrs. Il y a relativement peu de criminalité aux EAU.',
      'Îles Abu Musa et Tunb',
      "Ces deux îles sont des territoires disputés entre les EAU et l'Iran. Il est déconseillé de naviguer vers ces îles.",
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Émirats Arabes Unis'), 2);
  });

  it('Bahrain: "il est possible de s\'y rendre en sécurité" -> Level 1', () => {
    const text = [
      'Sécurité',
      "Depuis la levée de l'état d'urgence, instauré suite aux évènements de 2011, la sécurité est globalement rétablie sur l'île de Bahreïn et il est possible de s'y rendre en sécurité.",
      'Criminalité',
      "Le taux de criminalité est relativement faible. Les précautions d'usage sont d'application.",
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Bahreïn'), 1);
  });

  it('Portugal: "il est généralement possible de voyager ... en toute sécurité" -> Level 1 (Belgium\'s reusable calm template)', () => {
    const text = [
      "À condition de respecter les précautions d'usage, il est généralement possible de voyager dans le Portugal en toute sécurité.",
      'Autre bloc.',
      'Criminalité',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Portugal'), 1);
  });

  it('Netherlands: "il n\'y a pas de risques particuliers" -> Level 1 (the most common template across the corpus)', () => {
    const text = ['Il n’y a pas de risques particuliers liés à visiter les Pays-Bas.', 'Menace terroriste', 'Autre bloc.'].join('\n');
    assert.equal(normalizeBeLevel(text, 'Pays-Bas'), 1);
  });

  it('Japan: "un des pays les plus sûrs du monde" -> Level 1', () => {
    const text = ['Escroqueries', "Le Japon est un des pays les plus sûrs du monde, mais il n'est pas exempt de tout danger.", 'Autre bloc.'].join('\n');
    assert.equal(normalizeBeLevel(text, 'Japon'), 1);
  });

  it('Cuba: a hedged "Cuba est un pays relativement sûr, la vigilance reste toutefois de mise" -> null, not a guessed 1 (repair 2026-09-26, per the SK precedent)', () => {
    const text = [
      'Criminalité',
      "Bien que Cuba soit un pays relativement sûr, la vigilance reste toutefois de mise. Soyez vigilants dans les endroits fréquentés par les touristes.",
      "Il est déconseillé de prendre des auto-stoppeurs avec vous.",
      'Autre bloc.',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Cuba'), null);
  });

  it('Italy: pure pickpocket/consular-admin boilerplate, no verdict verb and no calm phrase either -> null, not a guessed 1', () => {
    const text = [
      'Risque terroriste',
      "L'Italie, comme d'autres pays, peut être exposée à la menace terroriste.",
      'Criminalité',
      'Comme touriste en Italie, vous courrez le risque d’être la cible de pickpockets présents majoritairement dans les lieux touristiques.',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Italie'), null);
  });
});
