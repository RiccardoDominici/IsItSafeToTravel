import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { extractFrTerritoryLevel } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-26 FR (France diplomatie.gouv.fr) regional-promotion
 * repair (isitsafetotravel.org-audit/2026-09-25/PARSER-REGIONAL-BRIEF.md). Georgia, Kazakhstan
 * and Kenya were found promoted to a whole-country Level 4/kept at a wrong level by a fixed
 * +-120 CHARACTER window around a whole-country subject phrase, which bled across sentence and
 * section boundaries. The repair replaces the window with section-heading tracking
 * (levelNearWholeCountryMatch), a same-sentence copula requirement (hasLevelAssertionVerb) and
 * a same-country check (namesAnotherCountry). Fixtures are VERBATIM `$('body').text()` excerpts
 * from the live per-country "Conseils aux voyageurs - Securite" pages, fetched 2026-09-26 (only
 * the "Zones de vigilance ... Derniere actualisation le ..." preamble needs to be present --
 * extractFrTerritoryLevel locates the section itself).
 */

describe('extractFrTerritoryLevel (FR/diplomatie.gouv.fr) -- regional-promotion repair', () => {
  it('never guesses when the "Zones de vigilance" marker is absent (rule 1: emit nothing, do not default to 1)', () => {
    assert.equal(extractFrTerritoryLevel('une page sans cette section du tout', 'Andorre'), null);
  });

  it('Georgia: the level-4 phrase is about RUSSIA (mentioned only for border context), not Georgia -- 2, not 4', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 05/03/2026, information toujours valable a la date du jour Zones formellement deconseillees (en rouge sur la carte securitaire) Les deplacements sont formellement deconseilles en Abkhazie et en Ossetie du sud qui echappent au controle du pouvoir central. Le point de passage de Lars qui relie les villes de Kazbegi - Stepantsminda (Georgie) et Vladikavkaz (Russie) est le seul point de passage terrestre entre la Georgie et la Russie. Dans le contexte de la guerre d'agression menee par la Russie en Ukraine, il est toutefois formellement deconseille de se rendre dans l'ensemble du territoire de la Russie. Zone en vigilance renforcee (en jaune sur la carte securitaire) L'ensemble du pays, dont la capitale Tbilissi, ne posent pas de problemes de securite majeurs, meme si la delinquance ordinaire (vols, cambriolages) n'epargne pas la Georgie. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Georgie'), 2);
  });

  it('Kazakhstan: "il est formellement deconseille" is about a specific nuclear-test zone, not "le reste du pays" that follows in the next sentence -- 2, not 4', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 10/03/2026, information toujours valable a la date du jour Zones formellement deconseillees A la suite de multiples experiences nucleaires sovietiques menees dans la region, les zones au sud de Kourtchatov et de Semipalatinsk presentent un taux de radioactivite particulierement eleve. Il est formellement deconseille de s'y rendre. Zones de vigilance renforcee Le reste du pays est place en zone de vigilance renforcee. Les zones suivantes font l'objet de restrictions a la circulation des ressortissants etrangers. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Kazakhstan'), 2);
  });

  it('Kenya: "le reste du territoire" trails an "a l\'exception des zones formellement deconseillees" clause -- those excepted zones must not leak in -- 2, not 4', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 25/09/2026, information toujours valable a la date du jour Zones formellement deconseillees (rouge) Il est formellement deconseille de sejourner a la frontiere entre le Kenya et la Somalie. Zones deconseillees sauf raison imperative (orange) Les regions excentrees des comtes West Pokot, Turkana, Marsabit et Isiolo sont deconseillees sauf raison imperative. Zones en vigilance renforcee (jaune) A l'exception des zones formellement deconseillees et deconseillees sauf raison imperative, le reste du territoire kenyan est place en vigilance renforcee. Les iles de Lamu et de Manda sont placees en vigilance renforcee. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Kenya'), 2);
  });

  it('Germany: a one-line page with no section heading at all -- copula trails the phrase in the same sentence -- 1', () => {
    const text =
      'Zones de vigilance Derniere actualisation le 18/03/2026, information toujours valable a la date du jour Le territoire allemand est place en vigilance normale. Risques encourus';
    assert.equal(extractFrTerritoryLevel(text, 'Allemagne'), 1);
  });

  it('Switzerland: same one-line shape, "l\'ensemble du territoire" alternative -- 1', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 13/03/2026, information toujours valable a la date du jour L'ensemble du territoire suisse est place en zone de vigilance normale. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Suisse'), 1);
  });

  it('Russia: the whole-country phrase is the OBJECT of "se rendre dans", copula ("il EST deconseille") comes BEFORE it, and it names itself -- 4', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 09/03/2026, information toujours valable a la date du jour Il est formellement deconseille de se rendre dans l'ensemble du territoire de la Russie, quel qu'en soit le motif. Les ressortissants francais encore presents en Russie sont invites a la plus grande prudence. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Russie'), 4);
  });

  it('Sudan: same object-embedded construction as Russia -- 4', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 20/09/2026, information toujours valable a la date du jour Il est formellement deconseille de se rendre dans l'ensemble du territoire soudanais, y compris a Khartoum et a Port-Soudan. Le pays est depuis plusieurs annees en proie a un conflit arme. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Soudan'), 4);
  });

  it('Iran: the level trails in the NEXT sentence ("il est donc formellement deconseille"), reached only because the match\'s own sentence already uses colour vocabulary ("place en rouge") -- 4', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 09/03/2026, information toujours valable a la date du jour Risques et recommandations associees L'ensemble du territoire iranien est place en rouge sur la carte des conseils aux voyageurs. Il est donc formellement deconseille aux ressortissants francais, y compris binationaux, de se rendre en Iran, quel qu'en soit le motif. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Iran'), 4);
  });

  it('DR Congo: a general tourism caution ("les voyages touristiques sont deconseilles sur l\'ensemble du territoire") uses none of France\'s four colour keywords and must NOT borrow a later, unrelated paragraph\'s level -- falls to the country\'s own explicit "le reste du pays" statement (3), not 4', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 12/03/2026, information toujours valable a la date du jour Les voyages touristiques sont deconseilles sur l'ensemble du territoire. Bien que le pays compte plusieurs parcs nationaux inscrits au patrimoine mondial de l'UNESCO, les conditions de securite ne sont pas reunies. Zones formellement deconseillees (en rouge) Il convient d'eviter de se rendre, quel qu'en soit le motif, dans l'est du pays (Nord et Sud Kivu), en raison de la rebellion du M23. Zones deconseillees sauf raison imperative (en orange) En raison de l'instabilite politique et de l'insecurite generale, le reste du pays est place en zone deconseillee sauf raison imperative. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Republique democratique du Congo'), 3);
  });

  it('Lebanon: "il est deconseille, sauf raison imperative, de se rendre dans le reste du territoire" is a direct whole-country-remainder statement -- 3', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 13/03/2026, information toujours valable a la date du jour Zones formellement deconseillees (en rouge sur la carte) Dans le Liban-Nord, au nord de la route reliant Abdeh a Mechmech. Les camps palestiniens et leurs abords, sur l'ensemble du territoire. Il est rappele que l'acces a ces camps est interdit par les autorites libanaises. Zones deconseillees sauf raison imperative (en orange sur la carte) Compte tenu de la degradation de la situation securitaire regionale, il est deconseille, sauf raison imperative, de se rendre dans le reste du territoire. Au nord-Liban : dans le triangle delimite par Tripoli au sud. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Liban'), 3);
  });

  it('Saudi Arabia: "(pays formellement deconseille)" inside a parenthetical about IRAQ must not attach to Saudi Arabia\'s own "reste du territoire est en vigilance renforcee" (same sentence, trailing keyword wins) -- 2', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 15/09/2026, information toujours valable a la date du jour Zones formellement deconseillees (en rouge sur la carte securitaire) L'ensemble de la zone frontaliere avec le Yemen. Zones deconseillees sauf raison imperative (en orange sur la carte securitaire) L'ensemble de la zone frontaliere avec l'Irak. Compte tenu de l'instabilite securitaire en Irak (pays formellement deconseille), il est recommande de limiter les deplacements dans cette zone frontaliere aux raisons imperatives. Le reste du territoire est en vigilance renforcee (en jaune sur la carte securitaire). Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Arabie saoudite'), 2);
  });

  it('USA: "comme dans l\'ensemble du territoire" is a location aside with no copula/level anywhere nearby, and the page has no colour keyword at all -- 1, never guessed as a match', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 05/03/2026, information toujours valable a la date du jour Les Etats-Unis d'Amerique sont parmi les pays les plus surs. Zone Est Boston : comme dans l'ensemble du territoire, le risque de violence lie aux armes a feu et a la criminalite existe dans certains secteurs localises. Par consequent, il est recommande d'eviter de circuler seul, a pied et de nuit, dans certaines parties de Dorchester. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Etats-Unis'), 1);
  });

  it('Myanmar: same "reste du territoire" direct-assertion shape as Lebanon -- 3', () => {
    const text =
      "Zones de vigilance Derniere actualisation le 04/03/2026, information toujours valable a la date du jour Zones formellement deconseillees (en rouge sur la carte) Il est formellement deconseille de se rendre dans l'Etat Kachin. Zones deconseillees sauf raison imperative (en orange sur la carte) Compte tenu de la situation securitaire depuis le coup d'Etat du 1er fevrier 2021, il est deconseille, sauf raison imperative, de se rendre dans le reste du territoire. Pour tout deplacement dans ces zones, il est conseille de privilegier la voie aerienne. Risques encourus";
    assert.equal(extractFrTerritoryLevel(text, 'Birmanie'), 3);
  });
});
