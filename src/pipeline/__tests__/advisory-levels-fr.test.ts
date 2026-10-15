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

/**
 * Regression coverage for the 2026-10-15 advisory-outlier audit: France's level for Niger, Bahrain
 * and Cuba sat two levels away from the other governments' median (Niger 2 vs 4, Bahrain and Cuba
 * 1 vs 3) although each page states a clear national verdict. Two wording gaps, both in
 * extractFrTerritoryLevel: (1) the country ITSELF named as the travel target ("Tout deplacement au
 * Niger est ...", "... de se rendre a Bahrein") was not a recognized whole-country statement --
 * only subject phrases like "l'ensemble du territoire" were; (2) the orange level only matched
 * "deconseille sauf raison imperative" with the two parts adjacent, never "deconseille aux
 * ressortissants francais, sauf pour des raisons imperatives," nor "les voyages non essentiels
 * ... sont deconseilles". Fixtures are VERBATIM excerpts of the live pages' `$('body').text()`
 * (accents kept -- extractFrTerritoryLevel folds them itself), fetched 2026-10-15 from
 * https://www.diplomatie.gouv.fr/fr/information-par-pays/<slug>/conseils-aux-voyageurs-securite.
 */
describe('extractFrTerritoryLevel (FR) -- country named as the travel target, orange-level wording', () => {
  it('Niger: "Tout déplacement au Niger est formellement déconseillé." -- 4, not the regional cap 2', () => {
    const text =
      'Zones de vigilance Dernière actualisation le 11/03/2026, information toujours valable à la date du jour Zones formellement déconseillées (en rouge) Tout déplacement au Niger est formellement déconseillé. Les ressortissants français au Niger sont appelés à la plus grande vigilance : il est essentiel de limiter les déplacements, de se tenir à l’écart de tout rassemblement et de se tenir régulièrement informés de la situation. Risques encourus';
    assert.equal(extractFrTerritoryLevel(text, 'Niger'), 4);
  });

  it('Bahrain: "Il est déconseillé aux ressortissants français, sauf pour des raisons impératives, de se rendre à Bahreïn." -- 3, not 1', () => {
    const text =
      'Zones de vigilance Dernière actualisation le 17/07/2026, information toujours valable à la date du jour Il est déconseillé aux ressortissants français, sauf pour des raisons impératives, de se rendre à Bahreïn. L’accès à l’extrême sud de l’île est interdit (zone militaire). Il est défendu d’emprunter les routes signalées par un panneau "private road". De manière générale, il est déconseillé de s’approcher de sites militaires. Risques encourus';
    assert.equal(extractFrTerritoryLevel(text, 'Bahreïn'), 3);
  });

  it('Kuwait: same national sentence, plus a formally-advised-against 5 km border strip -- the strip stays regional: 3, not 4', () => {
    const text =
      'Zones de vigilance Dernière actualisation le 17/07/2026, information toujours valable à la date du jour Il est déconseillé aux ressortissants français, sauf pour des raisons impératives, de se rendre au Koweït. En outre, il est formellement déconseillé de se rendre dans une zone de 5 km de large à la frontière avec l’Irak (hormis la localité dite d’Abdali Farms) et dans les îles de Warbah et de Boubiyan, qui font l’objet de missions de sécurisation des forces armées. Recommandations générales D’une façon générale, il est recommandé d’éviter tout rassemblement, ainsi que la proximité des lieux de culte. Risques encourus';
    assert.equal(extractFrTerritoryLevel(text, 'Koweït'), 3);
  });

  it('Cuba: "les voyages non essentiels vers l’île sont déconseillés" (the whole section) -- 3, not 1', () => {
    const text =
      'Zones de vigilance Dernière actualisation le 27/03/2026, information toujours valable à la date du jour Compte tenu de la crise énergétique à Cuba et de ses multiples répercussions, y compris pour les liaisons aériennes, les voyages non essentiels vers l’île sont déconseillés. Risques encourus';
    assert.equal(extractFrTerritoryLevel(text, 'Cuba'), 3);
  });

  it('Bangladesh: "Tout déplacement au Bangladesh est déconseillé sauf raison impérative" -- 3; the red Myanmar-border zone and "l’île de Saint-Martin" stay regional', () => {
    const text =
      'Zones de vigilance Dernière actualisation le 06/03/2026, information toujours valable à la date du jour Zones formellement déconseillées (rouge) Régions frontalières de la Birmanie Dans le contexte de tensions liées à l’afflux de réfugiés Rohingyas au Bangladesh, il est formellement déconseillé de se rendre dans les zones frontalières de la Birmanie, ainsi que l’île de Saint-Martin, sujettes aux trafics de drogues et d’êtres humains ainsi qu’à la piraterie maritime dans le golfe du Bengale. Zones déconseillées sauf raison impérative (orange) Tout déplacement au Bangladesh est déconseillé sauf raison impérative, du fait du risque terroriste. Le tourisme est donc à exclure. La région des Chittagong Hills Tracks (districts de Khagrachari, Rangamati et de Bandarban) est particulièrement déconseillée en raison de conflits récurrents entre différentes communautés. Risques encourus';
    assert.equal(extractFrTerritoryLevel(text, 'Bangladesh'), 3);
  });

  it('Azerbaijan: "La majeure partie du territoire azerbaïdjanais est placé en orange ... et reste déconseillée sauf raison impérative" -- 3; Karabakh and the Armenian border stay regional', () => {
    const text =
      'Zones de vigilance Dernière actualisation le 06/03/2026, information toujours valable à la date du jour Zones formellement déconseillées Ancien oblast autonome du Haut-Karabagh et anciens districts adjacents Il est formellement déconseillé aux citoyens français de se rendre dans la région de l’ancien oblast autonome du Haut-Karabagh et à ses abords (majeure partie des anciens districts adjacents). Zone frontalière avec l’Arménie Les zones frontalières avec l’Arménie (y compris dans la région du Nakhitchevan) sont formellement déconseillées en raison du risque d’affrontements armés et de la présence de nombreuses mines anti-personnel. Zones déconseillées sauf raison impérative La majeure partie du territoire azerbaïdjanais est placé en orange sur la carte des Conseils aux voyageurs et reste déconseillée sauf raison impérative. Les régions frontalières ci-après nécessitent également la plus grande vigilance. Zone frontalière avec l’Iran En raison de l’existence de trafics et de l’absence de signalisation claire, il est déconseillé aux voyageurs, sauf raison impérative, de se rendre à la frontière entre l’Azerbaïdjan et l’Iran, y compris au Nakhitchevan. Risques encourus';
    assert.equal(extractFrTerritoryLevel(text, 'Azerbaïdjan'), 3);
  });

  it('joint Israel/Palestine page: Israel’s own sentence gives Israël 3, and is NOT read as Palestine’s (which keeps the regional cap, 2)', () => {
    const text =
      'Zones de vigilance Dernière actualisation le 13/03/2026, information toujours valable à la date du jour Israël Il demeure déconseillé aux ressortissants français, sauf pour des raisons impératives, de se rendre en Israël. Il est en outre formellement déconseillé aux voyageurs de se rendre dans les régions suivantes : Frontières nord / Plateau du Golan Des tirs de roquettes ou des attaques de drones en provenance du Liban et de Syrie peuvent atteindre le nord d’Israël et le plateau du Golan (territoire occupé et annexé par Israël). Il est donc formellement déconseillé de se rendre sur le plateau du Golan et le long de la frontière avec le Liban. Palestine a) Cisjordanie Les déplacements en Cisjordanie sont déconseillés, sauf raison impérative, compte tenu de la situation sécuritaire depuis le 7 octobre 2023. b) Bande de Gaza Il demeure formellement déconseillé aux ressortissants français de se rendre dans la Bande de Gaza. Risques encourus';
    assert.equal(extractFrTerritoryLevel(text, 'Israël'), 3);
    assert.equal(extractFrTerritoryLevel(text, 'Palestine'), 2);
  });

  it('Uzbekistan: "Il est formellement déconseillé de se rendre en Afghanistan" is a cross-reference to ANOTHER country -- stays 2 (its own "l’ensemble du pays est placé en vigilance renforcée")', () => {
    const text =
      'Zones de vigilance Dernière actualisation le 11/03/2026, information toujours valable à la date du jour Zones formellement déconseillées La zone frontalière avec l’Afghanistan peut être le théâtre de tensions et d’incidents inopinés pouvant se transformer en affrontements. Les déplacements dans cette zone sont déconseillés (y compris dans la ville de Termez intra-muros, sauf raison impérative). Il est formellement déconseillé de se rendre en Afghanistan, pays figurant en rouge sur la carte sécuritaire (voir la fiche pays Afghanistan). Zones en vigilance renforcée En dehors des zones frontalières, l’ensemble du pays est placé en vigilance renforcée. La situation sécuritaire en Ouzbékistan est calme et le dispositif policier structuré. Risques encourus';
    assert.equal(extractFrTerritoryLevel(text, 'Ouzbékistan'), 2);
  });

  it('a country name that is only the PREFIX of the target ("Guinée" in "Guinée-Bissau") is not the page’s own country (synthetic guard)', () => {
    const text =
      'Zones de vigilance Dernière actualisation le 01/10/2026, information toujours valable à la date du jour Il est formellement déconseillé de se rendre en Guinée-Bissau. Le reste du pays est placé en vigilance normale. Risques encourus';
    assert.equal(extractFrTerritoryLevel(text, 'Guinée'), 1);
  });
});
