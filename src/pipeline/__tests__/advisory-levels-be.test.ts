import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import * as cheerio from 'cheerio';
import { normalizeBeLevel, isBeVerdictBlock } from '../normalize/advisory-levels.js';
import { findBeSecurityLink, findBeUpdateLink, extractBeArticleBlocks } from '../fetchers/advisories-tier2b.js';

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
    // 4 since 2026-10-15 (was 3): "tout voyage dans le pays ... déconseillé" is Belgium's top tier,
    // ALL travel advised against, with the country itself as the target -- see isBeAllTravelToCountry.
    // The point of this test is unchanged: "seul" elsewhere in the window does not veto it.
    assert.equal(normalizeBeLevel(text, 'Testland'), 4);
  });

  it('Niger: whole-country "tout voyage au Niger est déconseillé" -> Level 4 (ALL travel advised against, aimed at the country itself; was 3 before the 2026-10-15 repair)', () => {
    const text = ['Sécurité', 'En raison de la situation actuelle, tout voyage au Niger est déconseillé.', 'Autre bloc.'].join('\n');
    assert.equal(normalizeBeLevel(text, 'Niger'), 4);
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

/**
 * Regression coverage for the 2026-10-15 advisory-outlier audit. Belgium reported Yemen, Somalia,
 * Burkina Faso and the Central African Republic at 2 (median of the other governments: 4) and
 * Bahrain at 1 (median 3). Two causes:
 *  1. fetchBeAdvisories read only the "Sécurité générale" article. Belgium states its CURRENT
 *     verdict on the "Dernière mise à jour" page, and for Yemen, Somalia and Bahrain ONLY there.
 *  2. normalizeBeLevel read Belgium's top tier, "Tous les voyages ... sont déconseillés" (all
 *     travel), like its second tier "Les voyages non-essentiels ... sont déconseillés" (3), and
 *     never recognised the catch-all "Dans le reste du pays" as whole-country.
 * Fixtures are VERBATIM block texts (and trimmed markup) of the live diplomatie.belgium.be pages,
 * fetched 2026-10-15.
 */
describe('normalizeBeLevel + fetcher helpers -- latest-update page and the "all travel" tier', () => {
  it('finds the "Dernière mise à jour" link next to the "Sécurité générale" one on a real hub page (Yemen)', () => {
    const hub = cheerio.load(
      '<ul class="link-list">' +
        '<li><a href="/fr/pays/yemen/voyager-au-yemen-conseils-aux-voyageurs" class="link-list__item-link">Voyager au Yémen : Conseils aux voyageurs</a></li>' +
        '<li><a href="/fr/pays/yemen/voyager-au-yemen-conseils-aux-voyageurs/derniere-mise-jour-au-yemen" class="link-list__item-link">Dernière mise à jour au Yémen</a></li>' +
        '<li><a href="/fr/pays/yemen/voyager-au-yemen-conseils-aux-voyageurs/securite-generale-au-yemen" class="link-list__item-link">Sécurité générale au Yémen</a></li>' +
        '</ul>',
    );
    assert.equal(findBeUpdateLink(hub), '/fr/pays/yemen/voyager-au-yemen-conseils-aux-voyageurs/derniere-mise-jour-au-yemen');
    assert.equal(findBeSecurityLink(hub), '/fr/pays/yemen/voyager-au-yemen-conseils-aux-voyageurs/securite-generale-au-yemen');
  });

  // Yemen's real "Sécurité générale" article never advises against travel at all: only the update
  // page does. Background blocks verbatim (trimmed).
  const yemenSecurity = [
    'Toujours valable le',
    'Dernière mise à jour le 10 août 2026',
    'Le pays demeure fragmenté entre différentes autorités et forces armées. Les Houthis contrôlent notamment Sanaa et une grande partie du nord et de l’ouest du pays, tandis que d’autres parties du territoire sont contrôlées par le gouvernement internationalement reconnu et différentes forces locales.',
    'Les risques liés au terrorisme, aux enlèvements, aux détentions arbitraires, à la criminalité, aux mines et munitions non explosées ainsi qu’aux affrontements entre groupes armés restent élevés dans différentes parties du pays.',
    'Pour les personnes qui doivent néanmoins se rendre au Yémen pour des raisons professionnelles impératives, il est indispensable de disposer de mesures de sécurité professionnelles appropriées ainsi que de plans de contingence et d’évacuation. Il est vivement déconseillé d’emmener des membres de sa famille.',
  ];

  it('Yemen: the security article alone reads 2 -- the reason the update page must be read', () => {
    assert.equal(normalizeBeLevel(yemenSecurity.join('\n'), 'Yémen'), 2);
  });

  it('Yemen: verdict blocks of the real update article ("Tous les voyages au Yémen sont déconseillés ... quitter le pays") + the security article -> 4', () => {
    const updateArticle = cheerio.load(
      '<article class="node node--type-country-detailed node--view-mode-full node--sticky">' +
        '<h3 class="highlighted-text__title">Mise à jour sécurité</h3>' +
        '<div class="highlighted-text__content wysiwyg"><p><span><strong><span lang="FR-BE">Tous les voyages au Yémen sont déconseillés. Les compatriotes qui se trouvent au Yémen sont priés de quitter le pays dès que les conditions permettent de le faire en sécurité.</span></strong></span></p>' +
        '<p><span lang="FR-BE">La situation sécuritaire au Yémen reste extrêmement volatile et imprévisible. Le conflit interne demeure non résolu et les tensions régionales se sont fortement accrues au cours des dernières semaines.</span></p></div>' +
        '</article>',
    );
    const verdict = extractBeArticleBlocks(updateArticle).filter(isBeVerdictBlock);
    assert.deepEqual(verdict, [
      'Tous les voyages au Yémen sont déconseillés. Les compatriotes qui se trouvent au Yémen sont priés de quitter le pays dès que les conditions permettent de le faire en sécurité.',
    ]);
    assert.equal(normalizeBeLevel([...verdict, ...yemenSecurity].join('\n'), 'Yémen'), 4);
  });

  it('Somalia: "Tous les voyages vers et dans le pays sont déconseillés." -> 4', () => {
    const text = [
      'Tous les voyages vers et dans le pays sont déconseillés.',
      'Toujours valable le',
      'La situation sécuritaire est mauvaise et imprévisible dans l’ensemble du pays. Les attaques et affrontements sont réguliers et entrainent la mort de civils.',
      'Puntland',
      "Le Puntland est une région qui fonctionne de facto de manière autonome. L'armée du Puntland mène une offensive contre l'EI et Al-Shabaab. Tous les voyages, même d'ordre humanitaire, sont strictement déconseillés.",
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Somalie'), 4);
  });

  it('Burkina Faso: "Dans le reste du pays, tous les voyages sont déconseillés" is the catch-all -> 4 (the two named cities at "non-essential" stay regional)', () => {
    const text = [
      'Toujours valable le',
      'Niveau de sécurité',
      'Les voyages non-essentiels à Ouagadougou et à Bobo-Dioulasso sont déconseillés. Dans le reste du pays, tous les voyages sont déconseillés.',
      'La situation sécuritaire au Burkina Faso est mauvaise : certaines parties du territoire ne sont pas contrôlées par les forces gouvernementales et présentent un risque d’attaque terroriste et un risque d’enlèvement élevés.',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Burkina Faso'), 4);
  });

  it('Central African Republic: "Tous les voyages en République centrafricaine, à l’exception de Bangui, la capitale du pays, sont déconseillés" -> 4', () => {
    const text = [
      'Tous les voyages en République centrafricaine , à l’exception de Bangui, la capitale du pays, sont déconseillés .',
      'Les voyages non-essentiels à Bangui sont déconseillés.',
      'Hors Bangui',
      'Tous les voyages hors de Bangui sont déconseillés. Il est difficile de prêter toute forme d’assistance consulaire en dehors de Bangui et de sa périphérie immédiate en raison de la situation sécuritaire et de l’isolement géographique.',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'République centrafricaine'), 4);
  });

  it('Bahrain: the update page\'s "tous les voyages non-essentiels vers Bahreïn sont déconseillés" is the SECOND tier -> 3, and it outranks the security article\'s calm wording', () => {
    const text = [
      'Dans ce contexte, tous les voyages non-essentiels vers Bahreïn sont déconseillés pour le moment.',
      'Sécurité',
      "Depuis la levée de l’état d’urgence, instauré suite aux évènements de 2011, la sécurité est globalement rétablie sur l’île de Bahreïn et il est possible de s’y rendre en sécurité.",
      'Criminalité',
      "Le taux de criminalité est relativement faible. Les précautions d'usage sont d'application.",
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Bahreïn'), 3);
  });

  it('REGRESSION GUARD: Israel\'s page -- "Tous les voyages dans le reste du Territoire palestinien occupé sont vivement déconseillés" is about ANOTHER territory, Israel stays 3', () => {
    const text = [
      'Vu la situation sécuritaire volatile au Moyen-Orient, les voyages non-essentiels en Israël et à Jérusalem sont déconseillés.',
      'Il est également déconseillé d’effectuer tout les voyages non-essentiels à Bethléem, Ramallah et Jericho.',
      'Tous les voyages dans le reste du Territoire palestinien occupé sont vivement déconseillés.',
      'Tous les voyages dans la bande de Gaza sont déconseillés. Les déplacements vers Gaza ne sont d’ailleurs pas autorisés par les autorités israéliennes.',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Israël'), 3);
  });

  it('REGRESSION GUARD: Kosovo\'s "les voyages non essentiels vers les quatre communes dites du « Nord Kosovo » restent déconseillés" is regional (the country name sits inside the region\'s name) -> 2', () => {
    const text = [
      'Par conséquent, les voyages non essentiels vers les quatre communes dites du « Nord Kosovo » restent déconseillés (Mitrovica Nord, Zubin Potok, Zveçan et Leposavic). La vigilance reste de mise dans le reste du pays, en particulier dans les communes à majorité serbe.',
      'Sécurité',
      'Le Kosovo présente en général des conditions de sécurité satisfaisantes.',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Kosovo'), 2);
  });

  // The three guards below came out of the full 177-country before/after run of this repair: reading
  // the latest-update pages surfaced three pre-existing misreadings that would otherwise have shipped.
  it('REGRESSION GUARD: Venezuela\'s "Il est vivement déconseillé de quitter le Venezuela par voie terrestre" is advised AGAINST leaving by land (a route warning), not "leave the country" -> 3, not 4', () => {
    const text = [
      'Les voyages non essentiels vers le Venezuela sont déconseillés, notamment en raison des conséquences des tremblements de terre du 24 juin et du niveau de sécurité (voir ci-dessous).',
      'Tous les voyages vers les zones frontalières avec la Colombie et le Brésil sont déconseillés.',
      'Il est vivement déconseillé de quitter le Venezuela par voie terrestre en raison des risques sécuritaires. Enfin, les services ferroviaires sont temporairement interrompus.',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Venezuela'), 3);
  });

  it('REGRESSION GUARD: Papua New Guinea\'s "Les déplacements après la tombée de la nuit sont fortement déconseillés dans tout le pays" is a night-time manner tip, not a whole-country verdict -> 2, not 4', () => {
    const text = [
      'Les voyages non essentiels dans les régions suivantes sont déconseillés:',
      'Mount Hagen dans les Western Highlands',
      'Les déplacements après la tombée de la nuit sont fortement déconseillés dans tout le pays.',
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Papouasie-Nouvelle-Guinée'), 2);
  });

  it('REGRESSION GUARD: Mexico\'s "les États où les voyages non essentiels sont déconseillés" names some states, not Mexico as a whole -> 2, not 3', () => {
    const text = [
      'Conseils généraux',
      "La vigilance et de mise pour les voyages au Mexique. Bien que les voyages vers les États les plus touristiques (Quintana Roo, Yucatan et la ville de Mexico) se déroulent généralement sans problèmes majeurs, d'autres États souffrent d’une insécurité importante liée au crime organisé et à la délinquance qui en découle. Veuillez consulter la rubrique « Sécurité générale au Mexique » pour plus d’informations sur les États où une vigilance accrue est requise et sur les États où les voyages non essentiels sont déconseillés.",
      "L'ambassade de Belgique à Mexico (ville) est compétente pour l'assistance consulaire aux Belges au Mexique.",
    ].join('\n');
    assert.equal(normalizeBeLevel(text, 'Mexique'), 2);
  });

  it('isBeVerdictBlock keeps travel verdicts and drops the update page\'s seasonal notices (Italy\'s heat-wave tip)', () => {
    assert.equal(isBeVerdictBlock('Tous les voyages au Yémen sont déconseillés.'), true);
    assert.equal(isBeVerdictBlock('Il est conseillé aux compatriotes de quitter le Soudan du Sud.'), true);
    assert.equal(isBeVerdictBlock('Accordez une attention particulière aux personnes âgées, aux malades et aux autres personnes vulnérables.'), false);
    assert.equal(isBeVerdictBlock("À condition de respecter les précautions d’usage, il est généralement possible de voyager en Italie en toute sécurité."), false);
  });
});
