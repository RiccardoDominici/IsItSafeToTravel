import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeSkSecurityText } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-25 SK (Slovakia MZV) repair
 * (SOURCE-REPAIR-BRIEF.md), in two passes.
 *
 * Pass 1 (same day, earlier): the old normalizeSkLevel matched literal ASCII
 * "stupen" and so never matched the real field, which always spells the word
 * "stupeň" (U+0148 ň) — this silently defaulted every country to Level 1.
 *
 * Pass 2 (this file's later cases): the first production run of the Pass-1
 * fix found 139 countries STILL permanently on Level 1, because Priority 5
 * (the branch below the digit/opustiť/opatrnosť checks) was an unconditional
 * fallback rather than a real classification — including countries whose own
 * MZV text describes serious instability (South Sudan, Haiti), a plain
 * whole-country "does not recommend travel" (Myanmar), or MZV's OWN "Level 2"
 * phrase, "zvážiť nevyhnutnosť cestovania" (Niger/Chad/Ethiopia/Jordan). Fixed
 * by (a) scanning for a whole-country "neodporúča ... cestov(ať/anie) do/na"
 * clause, guarded against region/border/city scoping and the Thailand
 * insurance false-positive, and (b) requiring an AFFIRMATIVE calm statement
 * for Level 1 instead of defaulting to it. Both passes surfaced the same
 * underlying trap repeatedly: JS's ASCII-only \w and \b silently fail to
 * cross or bound on Slovak diacritics (ň, ú, á, ž, ť...) — several cases below
 * (Belarus/"nestabilná", South Sudan/"žiadne", Myanmar/"cestovať") exist
 * because a first version of the Pass-2 patterns fell into this exact trap
 * and a failing test against the real excerpt is what caught it.
 *
 * Fixtures below are VERBATIM excerpts (safe tag boundaries, not paraphrased)
 * pulled from the live `staty-sveta-podmienky-cestovania-a-pobytu` CKAN
 * package on 2026-09-25, one per classification branch. The false-positive
 * controls (France, Thailand, Nigeria, Mauritania) are the reason a naive
 * keyword search is not safe for this source — see the exact same excerpts
 * and reasoning in the doc comments above normalizeSkSecurityText and
 * scanSkWholeCountryAvoidTravel.
 */

describe('normalizeSkSecurityText (SK/MZV per-country page)', () => {
  it('never guesses on an empty/absent field (rule 1: emit nothing, do not default to 1)', () => {
    assert.equal(normalizeSkSecurityText(null), null);
    assert.equal(normalizeSkSecurityText(undefined), null);
    assert.equal(normalizeSkSecurityText(''), null);
    assert.equal(normalizeSkSecurityText('   \n\t  '), null);
  });

  it('Afghanistan: explicit "4. stupeň" inside an <a> anchor -> Level 4', () => {
    const html =
      '<div class="govuk-inset-text">\n<p>Pre Afganistan platí <a href="https://www.mzv.sk/sk/web/teheran/pressreleasedetail?p_p_id=sk_mzv_portal_pressrelease_detail_portlet_PressReleaseDetailPortlet&amp;p_p_lifecycle=0&amp;groupId=10182&amp;articleId=4880681" target="_blank" title="Oznamy a upozornenia pred cestou pre Afganistan">4. stupeň cestovného odporúčania</a> – odporúčanie opustiť krajinu.</p>\n</div>\n\n<p><strong>Pret';
    assert.equal(normalizeSkSecurityText(html), 4);
  });

  it('Egypt: explicit "3. stupeň" inside a nested <a><strong> -> Level 3 (not downgraded by the "do určitých oblastí" partial-scope wording)', () => {
    const html =
      '<p>Pre Egypt platí <a href="https://www.mzv.sk/sk/web/kahira/pressreleasedetail?p_p_id=sk_mzv_portal_pressrelease_detail_portlet_PressReleaseDetailPortlet&amp;p_p_lifecycle=0&amp;groupId=10182&amp;articleId=12582105" target="_blank" title="Cestovné odporúčanie pre Egypt na webovej stránke Ministerstva zahraničných vecí a európskych záležitostí Slovenskej republiky">stupeň cestovného odporúčania <strong>3. stupeň – odporúčanie necestovať do určitých oblastí</strong></a>.</p>';
    assert.equal(normalizeSkSecurityText(html), 3);
  });

  it('Lebanon: a level CHANGE narrated old-then-new ("4. stupeň ... sa mení na 3. stupeň") -> takes the LAST digit (3), not the first', () => {
    const html =
      '<h3>Zmena odporúčania</h3>\n\n<p>4. stupeň – <strong>odporúčanie opustiť krajinu sa mení na 3. stupeň odporúčania – necestovať alebo necestovať do určitých oblastí.</strong></p>\n\n<p> </p>\n\n<h3>Bezpečnostná a soci';
    assert.equal(normalizeSkSecurityText(html), 3);
  });

  it('Ukraine: no explicit digit, but "opustiť územie Ukrajiny" (leave the territory) -> Level 4', () => {
    const html =
      '<p>Ministerstvo zahraničných vecí a európskych záležitostí Slovenskej republiky <a href="https://www.mzv.sk/sk/web/kyjev/pressreleasedetail?p_p_id=sk_mzv_portal_pressrelease_detail_portlet_PressReleaseDetailPortlet&amp;p_p_lifecycle=0&amp;groupId=10182&amp;articleId=4795548" target="_blank" title="Cestovné odporúčanie pre Ukrajinu na webovej stránke Ministerstva zahraničných vecí a európskych záležitostí Slovenskej republiky">naďalej odporúča občanom Slovenskej republiky <strong>bezodkladne opustiť územie Ukrajiny</strong> a <strong>vyhnúť sa cestovaniu na Ukrajinu</strong>.</a></p>';
    assert.equal(normalizeSkSecurityText(html), 4);
  });

  it('Israel: whole-country "tieto územia opustiť" -> Level 4, and a LATER incident-instruction "opustite vozidlo" (leave the vehicle) does not change or break the result', () => {
    const html =
      '<div class="govuk-inset-text">\n<p>V dôsledku <strong>vojnového konfliktu na Blízkom východe</strong> pretrváva <strong>mimoriadna bezpečnostná situácia na celom území Izraela a Palestíny</strong>. Vzhľadom na <strong>nepredvídateľný vývoj</strong> ministerstvo občanom Slovenskej republiky <strong>odporúča tieto územia opustiť</strong>.</p>\n</div>\n\n<p>Na odchod môžete využiť <strong>dostupné letecké spojenia z Tel Avivu</strong> alebo <strong>pozemné hraničné priechody s Jordánskom a Egyptom</strong>.</p>\n\n<p>Raketovým útokom zvyčajne predchádza siréna; zastavte, opustite vozidlo a presuňte sa do krytu.</p>';
    assert.equal(normalizeSkSecurityText(html), 4);
  });

  it('France: "zachovávajte zvýšenú opatrnosť" -> Level 2, and does NOT escalate to 4 via the unrelated "opustite miesto ohrozenia" (leave the SCENE, not the country) incident advice', () => {
    const html =
      '<p>Vo Francúzsku naďalej pretrváva <strong>riziko teroristických útokov</strong>. Bezpečnostné riziká sa môžu týkať aj miest, ktoré bežne navštevujú zahraniční turisti.</p>\n\n<p> </p>\n\n<h3>Stupeň varovania a bezpečnostné opatrenia</h3>\n\n<p><a href="https://www.sgdsn.gouv.fr/vigipirate" target="_blank" title="Francúzsky bezpečnostný plán Vigipirate – SGDSN">Francúzsky bezpečnostný plán <span lang="fr">Vigipirate</span></a> je aktuálne nastavený na stupeň <strong>zvýšená ostražitosť (<span lang="fr">vigilance renforcée</span>)</strong>, ktorý predstavuje stredný z troch stupňov varovania pred teroristickou hrozbou.</p>\n\n<p>zachovávajte zvýšenú opatrnosť na verejnosti, najmä na frekventovaných miestach.</p>\n\n<p>V prípade vážneho bezpečnostného incidentu: ak je to možné, opustite miesto ohrozenia, ukryte sa na bezpečnom mieste.</p>';
    assert.equal(normalizeSkSecurityText(html), 2);
  });

  it('Mexico: "odporúčame dodržiavať zvýšenú opatrnosť" -> Level 2', () => {
    const html =
      '<p>Mexiko patrí medzi krajiny s <strong>vysokým bezpečnostným rizikom</strong>, preto odporúčame dodržiavať zvýšenú opatrnosť počas celého pobytu.</p>\n\n<p><strong>Kriminalita v Mexiku je veľmi vysoká.</strong></p>\n\n<p>V prípade turistov prevažujú najmä krádeže';
    assert.equal(normalizeSkSecurityText(html), 2);
  });

  it('Kenya: "zvýšenú opatrnosť počas pobytu" survives an &nbsp; between words -> Level 2', () => {
    const html =
      '<p>Veľvyslanectvo Slovenskej republiky v&nbsp;Nairobi v súvislosti s <strong>dlhodobo pretrvávajúcou hrozbou teroristických útokov,</strong> rizikom výskytu nepokojov a možnými demonštráciami v&nbsp;Keni odporúča slovenským občanom <strong>zvýšenú opatrnosť počas pobytu v&nbsp;krajine.</strong></p>\n\n<p>Odporúčame zvážiť nevyhnutnosť cestovania aleb';
    assert.equal(normalizeSkSecurityText(html), 2);
  });

  it('Italy: informational crime-prevention tips, no degree and no caution recommendation -> Level 1', () => {
    const html =
      '<h3>Kriminalita</h3>\n\n<p>V Taliansku sa najčastejšie vyskytuje <strong>drobná kriminalita</strong>, najmä <strong>vreckové krádeže</strong> a krádeže z motorových vozidiel.</p>\n\n<p>Zvýšenú pozornosť venujte ochrane osobných vecí najmä na:</p>\n\n<ul>\n\t<li><strong>vlakových staniciach</strong> a vo vlakoch</li>\n\t<li><strong>v metre a mestskej doprave</strong></li>\n\t<li><strong>letiskách</strong></li>\n</ul>';
    assert.equal(normalizeSkSecurityText(html), 1);
  });

  it('Japan: no advisory language at all, purely informational -> Level 1', () => {
    const html =
      '<h3>Kriminalita</h3>\n\n<p>Vo všeobecnosti je Japonsko považované za <strong>veľmi bezpečnú krajinu</strong> s nízkou úrovňou kriminality takmer vo všetkých oblastiach, nielen na vidieku, ale aj v mestách.</p>\n\n<p> </p>\n\n<h3>Prírodné riziká</h3>\n\n<p>Krajina sa nachádza v seizmicky aktívnej zóne s rizikom zemetrasení, cunami a tajfúnov.</p>';
    assert.equal(normalizeSkSecurityText(html), 1);
  });

  it('Thailand: "neodporúča cestovať ... BEZ cestovného poistenia" is an insurance reminder, not a travel warning -> not 3/4, and NOT a false Level 1 either (repair 2026-09-25: Priority 5 no longer defaults to 1 on an unmatched notice)', () => {
    const html =
      '<p>Veľvyslanectvo Slovenskej republiky v Bangkoku <strong>neodporúča cestovať do Thajska bez cestovného poistenia</strong>, ktoré pokrýva všetky zdravotné náklady, náklady na stratu alebo odcudzenie osobných vecí alebo škodu spôsobenú iným osobám.</p>\n\n<p>V prípade, že nemáte dostatok finančných prostriedkov na zaplatenie zdravotnej starostlivosti, nemusí byť zdravotná starostlivosť poskytnutá.</p>';
    // Before the 2026-09-25 repair this asserted Level 1 (the old catch-all default). This short
    // excerpt carries no whole-country avoid-travel clause (correctly guarded by
    // SK_INSURANCE_GUARD) AND no affirmative calm statement either, so the honest answer is now
    // null -- verified against the REAL live Thailand page too (2026-09-25, ~9100 characters,
    // deep-south provinces region-scoped, no country-wide "neodporúča" or calm phrase anywhere),
    // which resolves the same way end to end.
    assert.equal(normalizeSkSecurityText(html), null);
  });

  it('Nicaragua: region-specific caution advice without a whole-country degree or caution statement -> null, not a false Level 1 (repair 2026-09-25)', () => {
    const html =
      '<p>Úroveň kriminality v Nikarague je nižšia ako v ostatných krajinách Strednej Ameriky, avšak stále je dôležité dodržiavať základné bezpečnostné pravidlá.</p>\n\n<p><strong>Vyhýbajte sa cestám do odľahlých oblastí na severe</strong> (Nueva Segovia, Madriz, Estelí, Jinotega, Matagalpa, Boaco) a do oblastí atlantických departementov.</p>';
    // "lower than neighbouring countries" is a RELATIVE claim, not an affirmative "this country is
    // calm" statement (SK_CALM_PATTERNS correctly does not treat it as one), and the only concrete
    // instruction here ("avoid trips to remote northern areas") is region-scoped. Before the repair
    // this landed on 1 by default; it should now emit nothing rather than guess.
    assert.equal(normalizeSkSecurityText(html), null);
  });

  // --- Repair 2026-09-25 (SOURCE-REPAIR-BRIEF): second-pass sample. Production found 139
  // countries permanently on Level 1 because Priority 5 used to be an unconditional fallback --
  // including these, whose OWN MZV text describes something well past "no specific warning".
  // Fixtures are VERBATIM excerpts pulled from the live opendata.mzv.sk datastore, 2026-09-25.

  it('South Sudan: "Dôrazne sa neodporúča žiadne cestovanie do Južného Sudánu" -> Level 4 (whole country, "žiadne" = no travel whatsoever)', () => {
    const html =
      'Bezpečnostná situácia v Južnom Sudáne zostáva nestabilná. Dôrazne sa neodporúča žiadne cestovanie do Južného Sudánu, ak sa však rozhodnete cestovať, mali by ste sa uistiť, že ste dôkladne zvážili hrozbu a zaviedli primerané opatrenia v prípade potreby.';
    assert.equal(normalizeSkSecurityText(html), 4);
  });

  it('Haiti: "Cestovanie na Haiti sa absolútne neodporúča, a to z akéhokoľvek dôvodu" -> Level 4 (topicalized word order, declined "akéhokoľvek")', () => {
    const html =
      'Cestovanie na Haiti sa absolútne neodporúča, a to z akéhokoľvek dôvodu. V dôsledku zrážok medzi ozbrojenými gangmi a národnou políciou sú prítomní občania vyzvaní, aby zostali doma.';
    assert.equal(normalizeSkSecurityText(html), 4);
  });

  it('Myanmar: plain "neodporúča cestovať do Mjanmarska" (no "žiadne/akékoľvek" qualifier) -> Level 3, not 4', () => {
    const html =
      'Slovenské veľvyslanectvo v Bangkoku neodporúča cestovať do Mjanmarska vzhľadom na pretrvávajúci vnútorný konflikt v krajine a časté ozbrojené strety, ktoré majú za následok zranenia, poškodenia majetku a straty na životoch aj civilného obyvateľstva.';
    assert.equal(normalizeSkSecurityText(html), 3);
  });

  it('Mauritania: "sa neodporúča cestovať do oblastí na východe Mauritánie" is region-scoped -> does not promote past null (caps at 2 territory, no whole-country trigger here)', () => {
    const html =
      'Bezpečnostná situácia v Mauritánii je poznačená zvýšenou teroristickou hrozbou v celom regióne Západnej Afriky. Z uvedených dôvodov sa neodporúča cestovať do oblastí na východe Mauritánie a pri hranici so Západnou Saharou.';
    assert.equal(normalizeSkSecurityText(html), null);
  });

  it('Nigeria: "neodporúčame cestovať miestnou verejnou dopravou" is a transport-MODE caveat, not a destination clause -> does not fire the whole-country scan', () => {
    const html =
      'Kvôli možnosti ozbrojených prepadov a krádeží neodporúčame cestovať miestnou verejnou dopravou. V prípade zdravotných problémov odporúčame navštíviť súkromné kliniky.';
    assert.equal(normalizeSkSecurityText(html), null);
  });

  it('Niger/Chad/Ethiopia family: "odporúča(me) zvážiť nevyhnutnosť cestovania" (MZV\'s own Level-2 phrase) applied to the whole country -> Level 2', () => {
    const html =
      'Pre ostatné oblasti krajiny ministerstvo odporúča slovenským občanom zvážiť nevyhnutnosť cestovania. V týchto oblastiach hrozí nebezpečenstvo teroristických útokov a únosov.';
    assert.equal(normalizeSkSecurityText(html), 2);
  });

  it('Belarus: "je vo všeobecnosti stabilná" -> Level 1, and is NOT confused with "nestabilná" (Burkina Faso/South Sudan/Haiti/DR Congo all describe their OWN situation as "nestabilná" and must stay unmatched by this pattern)', () => {
    const html =
      'Bezpečnostná situácia v Bielorusku je vo všeobecnosti stabilná. Úroveň bežnej kriminality nepredstavuje výrazné bezpečnostné riziko pre miestne obyvateľstvo ani pre cudzincov.';
    assert.equal(normalizeSkSecurityText(html), 1);
    const nestabilnaOnly = 'Bezpečnostná situácia v krajine zostáva nestabilná, vysoká kriminalita, únosy či hrozba teroristických útokov.';
    assert.equal(normalizeSkSecurityText(nestabilnaOnly), null);
  });

  it('Cuba (SK/MZV, distinct from Spain\'s own Cuba text): "nie sú známe žiadne závažnejšie bezpečnostné riziká" -> Level 1', () => {
    const html =
      'Na Kube nie sú známe žiadne závažnejšie bezpečnostné riziká, vyskytujú sa však drobné krádeže obzvlášť na turisticky frekventovaných miestach.';
    assert.equal(normalizeSkSecurityText(html), 1);
  });

  it('Qatar: "patrí medzi štáty s najvyššou úrovňou bezpečnosti na svete" -> Level 1 despite a generic, unrealized terrorism-risk disclaimer in the same notice', () => {
    const html =
      'Katar patrí medzi štáty s najvyššou úrovňou bezpečnosti na svete. Napriek tomu nie je možné vylúčiť všeobecné nebezpečenstvo teroristických útokov, a to aj proti cudzincom.';
    assert.equal(normalizeSkSecurityText(html), 1);
  });

  it('Saudi Arabia: a real, specific (if unrealized) terrorism/rocket-attack acknowledgment with no whole-country "neodporúča" and no calm phrase -> null, not a guessed 1', () => {
    const html =
      'Vo všeobecnosti nemožno vylúčiť riziko teroristických útokov, a to ani voči cudzincom. Existuje aj riziko raketových a dronových útokov, pričom väčšina z nich je zachytená ešte pred dopadom. Miera kriminality je nízka, avšak ku krádežiam môže dochádzať predovšetkým na preplnených miestach.';
    assert.equal(normalizeSkSecurityText(html), null);
  });
});
