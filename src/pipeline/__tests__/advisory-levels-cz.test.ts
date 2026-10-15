import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeCzLevel } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-10-15 CZ (Czech MZV, mzv.gov.cz) repair -- the advisory-outlier
 * audit found 14 countries whose Czech level sat two or more levels from the other governments'
 * median; reading each live article showed 12 of them were this parser's vocabulary, not MZV (see
 * the section comment above normalizeCzLevel for the six root causes).
 *
 * Every fixture is a VERBATIM run of sentences (trimmed, never paraphrased) from the text
 * fetchCzAdvisories actually hands to normalizeCzLevel -- `$('article.article').first().text()`
 * of each warning article linked from the country's "Aktuální doporučení a varování" section,
 * whitespace-collapsed -- fetched live on 2026-10-15. Each one opens with the article's own
 * "<Title> Stále v platnosti: ... | Aktualizováno: ..." header, which the parser must ignore.
 * The level each test expects is the one MZV states for the country AS A WHOLE (whole-country
 * sentence or the "rest of the country" catch-all); warnings about named regions alone cap at 2,
 * as everywhere else in this file (DATA_REVISION 6 doctrine).
 */

const PRK = "KLDR: Doporučení k cestám Stále v platnosti: 15. 10. 2026 Publikováno: 12.01.2022 / 09:45 | Aktualizováno: 16.01.2024 / 14:32 Vzhledem k úplnému uzavření KLDR od ledna 2020 nelze do země cestovat. Velvyslanectví ČR v Pchjongjangu přerušilo svou činnost v březnu 2021. Z výše uvedených důvodů MZV ČR varuje občany ČR před cestami do Severní Koreje.";
const SSD = "Jižní Súdán: varování před cestami Stále v platnosti: 15. 10. 2026 Publikováno: 15.01.2025 / 15:15 | Aktualizováno: 21.07.2026 / 15:02 MZV ČR varuje před cestami do Jihosúdánské republiky z důvodu trvale zhoršené bezpečnostní situace a hrozby vypuknutí občanské války. Existuje vysoké riziko uzavření vzdušného prostoru bez předchozího varování.";
const MMR = "Foto: © Shutterstock Myanmar - zhoršená bezpečnostní situace Stále v platnosti: 15. 10. 2026 Publikováno: 20.03.2023 / 13:15 | Aktualizováno: 04.02.2026 / 17:32 MZV varuje před cestami do Myanmaru. V některých obvodech je stále zavedeno stanné právo. Je nutné mít na paměti, že v některých částech země platí zákaz nočního vycházení (někde již od 18:00 hod.).";
const IRN = "Írán: varování před cestami a výzva k opuštění země Stále v platnosti: 15. 10. 2026 Publikováno: 21.02.2023 / 12:15 | Aktualizováno: 24.03.2026 / 12:44 MZV ČR dlouhodobě varuje před cestami do Íránu a vyzývá občany k opuštění země. V souvislosti s US-IL vojenským zásahem proti Íránu MZV ČR důrazně varuje občany před cestami do země a české občany, kteří se v Íránu již nacházejí, vyzývá k okamžitému opuštění země. Vzhledem k tomu, že veškeré lety jsou již zrušeny, je zemi možné opustit přes pozemní hraniční přechody, které jsou zatím otevřené.";
const LBN = "Foto: © Shutterstock Libanon: varování před cestami a výzva k opuštění země Stále v platnosti: 15. 10. 2026 Publikováno: 01.03.2026 / 08:30 | Aktualizováno: 04.06.2026 / 15:27 Vzhledem k pokračujícímu ozbrojenému konfliktu na území Libanonu MZV ČR varuje před cestami do Libanonu a vyzývá občany ČR k opuštění země, a to s využitím dostupných komerčních letů. Varování před cestami je platné do všech částí Libanonu, vč. Bejrútu.";
const BLR = "Bělorusko: Zhoršení bezpečnostní situace Stále v platnosti: 15. 10. 2026 Publikováno: 27.02.2022 / 18:42 | Aktualizováno: 10.04.2025 / 14:21 S ohledem na probíhající vojenskou invazi Ruské federace a Běloruska na Ukrajinu a možnou hrozbu zhoršení bezpečnosti v zemi zejména pro občany států EU a NATO MZV ČR důrazně varuje před cestami na území Běloruska a vyzývá občany ČR k opuštění země. Bělorusko: Situace na bělorusko-ruské hranici Stále v platnosti: 15. 10. 2026 Publikováno: 01.09.2017 / 13:29 | Aktualizováno: 10.04.2025 / 14:19 Ministerstvo zahraničních věcí ČR upozorňuje, že ruská strana neumožňuje cizím státním příslušníkům vstup na území Ruské federace pozemní cestou (vlakem, autobusem, osobním autem či pěšky) přes bělorusko-ruskou hranici.";
const HTI = "Haiti: v zemi stále platí výjimečný stav, bezpečnostní situace se zhoršuje Stále v platnosti: 15. 10. 2026 Publikováno: 04.01.2022 / 15:54 | Aktualizováno: 30.05.2025 / 14:13 Vzhledem k eskalujícím střetům mezi místními gangy, kriminalitě a politické nestabilitě v zemi MZV ČR nadále varuje před jakýmikoliv cestami do země a vyzývá všechny občany ČR nacházející se na území Haiti, aby zemi urychleně opustili. V září 2024 byla platnost výjimečného stavu z provincie Ouest, kde se nachází hlavní město Port-au-Prince, rozšířena na celou zemi. Zachovávání výjimečného stavu je důsledkem rychle se zhoršující bezpečnostní situace zejména v metropolitní oblasti Port-au-Prince, ale i dalších městech a regionech.";
const MLI = "Mali: Varování před cestami Stále v platnosti: 15. 10. 2026 Publikováno: 25.10.2019 / 10:10 | Aktualizováno: 10.04.2025 / 13:46 MZV varuje před cestami do Mali a vyzývá k urychlenému opuštění země. Vzhledem k přítomnosti teroristických skupin a velkému riziku únosu nedoporučujeme cestovat do Mali a překračovat pozemní hranice s Mauritánií, Burkinou-Faso a Pobřežím slonoviny.";
const SOM = "Somálsko: varování před cestami Stále v platnosti: 15. 10. 2026 Publikováno: 15.01.2025 / 14:30 | Aktualizováno: 27.02.2026 / 15:23 MZV ČR varuje před cestami do Somálska. V celé zemi existuje vysoké riziko teroristických útoků, ozbrojených přepadení a únosů. Bezpečnostní situace v západní polovině autonomní oblasti Somaliland je obecně příznivější, nicméně i v této oblasti mohou cestovatelům hrozit vážná bezpečnostní rizika.";
const BFA = "Burkina Faso: upozornění na cesty Stále v platnosti: 15. 10. 2026 Publikováno: 07.02.2020 / 21:30 | Aktualizováno: 23.01.2025 / 15:42 Od státního převratu v lednu 2022, uskutečněného armádními složkami, je bezpečnostní situace v zemi velmi napjatá, především pak na severu, kde dochází k častým únosům a útokům ze strany ozbrojených teroristických skupin. MZV ČR doporučuje omezit cesty do Burkiny Faso jen na nezbytně nutné. MZV ČR explicitně varuje před cestováním do následujících provincií: Soum, Oudalan, Séno, Loroum, Yatenga, Sorou, Kossi, Kénédougou, Houet, Comoe, Gnagna, Yagha, Komandjari, Tapoa, Gourma, Koulpélogo a Kompienga.";
const NER = "Niger: bezpečnostní situace na severu a jihu země Stále v platnosti: 15. 10. 2026 Publikováno: 11.01.2022 / 14:18 | Aktualizováno: 11.04.2025 / 14:12 MZV ČR doporučuje zcela se vyhnout cestám do jižního Nigeru, do oblasti hraničících s Nigérií a Čadem. V oblasti probíhají vojenské operace proti teroristické skupině Boko Haram a hrozí zde zvýšené riziko teroristických útoků. MZV ČR doporučuje rovněž vyhnout se cestám do severní části Nigeru a do oblastí sousedících s Mali, Alžírskem a Libyí, kde hrozí zvýšené nebezpečí ze strany islámských radikálů. Existuje zde vysoké riziko únosů cizinců. Do ostatních částí země MZV ČR doporučuje omezit cesty jen na nezbytně nutné.";
const PAK = "Foto: © Shutterstock Pákistán: varování před cestami do některých oblastí Stále v platnosti: 15. 10. 2026 Publikováno: 29.05.2025 / 10:53 | Aktualizováno: 16.10.2025 / 16:30 MZV ČR varuje před cestami do všech příhraničních oblastí Pákistánu s Afghánistánem, do oblasti Kašmíru, příhraničních oblastí s Indií a do provincie Balúčistán. Do ostatních oblastí Pákistánu MZV ČR doporučuje cestovat jen ve zcela nezbytných případech.";
const PSE = "Palestinská autonomní území: varování před cestami Stále v platnosti: 15. 10. 2026 Publikováno: 11.10.2023 / 13:00 | Aktualizováno: 26.08.2026 / 10:21 Z důvodu dlouhodobě nestabilní bezpečnostní situace Ministerstvo zahraničních věcí varuje před cestami do severní části Západního břehu Jordánu a do ostatních částí Západního břehu Jordánu doporučuje cestovat jen ve zcela nezbytných případech. MZV ČR zároveň varuje před cestami do pásma Gazy, kde je situace vysoce riziková, a vyzývá k jeho opuštění. Západní břeh Jordánu MZV ČR doporučuje cestovat do oblasti Západního břehu Jordánu jen ve zcela nezbytných případech.";
const MNG = "Mongolsko: omezení pohybu v regionu Uvs Stále v platnosti: 15. 10. 2026 Publikováno: 18.06.2026 / 15:25 | Aktualizováno: 09.07.2026 / 07:39 Ministerstvo zahraničních věcí doporučuje cestovat do regionu Uvs v Mongolsku jen ve zcela nezbytných případech. MZV ČR proto doporučuje cestovat do regionu Uvs jen ve zcela nezbytných případech.";
const MDA = "Moldavsko: MZV ČR varuje před cestami do podněsterského regionu Moldavské republiky Stále v platnosti: 15. 10. 2026 Publikováno: 28.04.2022 / 13:35 | Aktualizováno: 11.04.2025 / 10:57 MZV ČR varuje v souvislosti s aktuální bezpečnostní situací před cestami do podněsterského regionu Moldavské republiky (tzv. „Podněsterské moldavské republiky“).";
const HKG_NOTICE = "Hongkong: doporučení k cestám Stále v platnosti: 15. 10. 2026 Publikováno: 10.07.2020 / 13:21 | Aktualizováno: 11.04.2025 / 09:46 MZV ČR informuje občany, že dnem 1. 7. 2020 nabyl v Hongkongu účinnosti Zákon o národní bezpečnosti („Law on Safeguarding the National Security Law“), na základě kterého mohou být uloženy vysoké tresty odnětí svobody za celou škálu široce definovaných trestných činů politické povahy. Jako porušení zákona může být považována nejen např. podpora nezávislosti HK, ale i uveřejňování příspěvků s politickým obsahem na sociálních sítích. V návaznosti na přijetí zákona může docházet k protestům a demonstracím.";
const HKG_ADVICE = "MZV ČR doporučuje občanům ČR pobývajícím v Hongkongu sledovat aktuální situaci a vyhýbat se případným shromážděním.";
const TUR = "Turecko: Aktuální bezpečnostní doporučení pro cesty Stále v platnosti: 15. 10. 2026 Publikováno: 08.02.2021 / 17:45 | Aktualizováno: 12.03.2026 / 12:39 Vzhledem k současnému vývoji v regionu a s ohledem na aktuální bezpečností situaci doporučuje MZV ČR při cestách do Turecka pečlivě zvážit cesty do velkých měst a do příhraničních oblastí Turecka se Sýrií, Irákem a Íránem, a dbát zvýšené opatrnosti. Zejména při cestách do Istanbulu, Ankary, Izmiru a dalších větších měst a do regionů při hranicích se Sýrií, Irákem a Íránem je nutno dbát zvýšené opatrnosti a vážit nezbytnost cesty do oblastí se silnou přítomností a operacemi tureckých ozbrojených sil.";
const MEX = "Foto: © Shutterstock Mexiko – bezpečnostní doporučení Stále v platnosti: 15. 10. 2026 Publikováno: 05.04.2023 / 17:09 | Aktualizováno: 12.10.2026 / 09:35 Ministerstvo zahraničních věcí ČR doporučuje českým občanům během pobytu v Mexiku dbát zvýšené opatrnosti. Do některých států se doporučuje cestovat pouze v nezbytných případech, a to zejména kvůli bezpečnostní situaci negativně ovlivněné násilím souvisejícím s činností drogových kartelů, na kterou MZV ČR dlouhodobě upozorňuje.";
const IND = "Indie: varování před cestami do indicko-pákistánských příhraničních oblastí Stále v platnosti: 15. 10. 2026 Publikováno: 07.05.2025 / 14:09 | Aktualizováno: 12.05.2025 / 09:07 V souvislosti s aktuálním bezpečnostním vývojem na indicko–pákistánské hranici a v sousedících oblastech (tzv. linie kontroly) MZV ČR varuje před cestami do indicko-pákistánských příhraničních oblastí. Varování před cestami je do oblasti Džammú a Kašmíru (včetně Pahalgamu, Gulmargu, Sonamargu, města Šrínagar a státní silnice Džammú - Šrínagar), z důvodu hrozby terorismu, ozbrojených střetů, občanských nepokojů a únosů.";

const COD = "Konžská demokratická republika: varování před cestami a výzva k opuštění země Stále v platnosti: 15. 10. 2026 Publikováno: 01.10.2026 / 15:28 | Aktualizováno: 01.10.2026 / 19:14 S ohledem na dlouhodobě výrazně zhoršenou bezpečnostní situaci, vážné riziko další eskalace konfliktu, jakož i aktuálnímu šíření eboly Ministerstvo zahraničních věcí varuje před cestami do Konžské demokratické republiky a vyzývá české občany, kteří se tam případně nacházejí, k jejímu urychlenému opuštění. Ozbrojené boje na východě mají v současné době bezpečnostní dopady i na další části země, včetně hlavního města Kinshasy.";
const CUB = "Kuba: varování před cestami Stále v platnosti: 15. 10. 2026 Publikováno: 16.06.2026 / 19:45 | Aktualizováno: 16.06.2026 / 19:59 Ministerstvo zahraničních věcí varuje před cestami na Kubu, a to vzhledem ke kritické situaci v zásobování energiemi, jejímž důsledkem jsou mj. nedostatek pohonných hmot, dlouhodobé výpadky elektřiny, velmi omezené zásobování a služby vč. oblasti zdravotnictví a dopravy, jakož i vzhledem k narůstající kriminalitě a nepokojům.";
const RUS = "Foto: na Ruská federace: Zhoršení bezpečnosti, možnosti odjezdu ze země Stále v platnosti: 15. 10. 2026 Publikováno: 03.10.2022 / 15:15 | Aktualizováno: 11.04.2025 / 12:40 S ohledem na probíhající vojenskou invazi Ruské federace na Ukrajinu a možnou hrozbu zhoršení bezpečnosti v zemi, zejména pro občany států EU a NATO, MZV ČR důrazně varuje před cestami na území Ruské federace. MZV ČR vyzývá občany ČR k opuštění země.";
const VEN = "Venezuela: varování před cestami do některých oblastí Stále v platnosti: 15. 10. 2026 Publikováno: 21.03.2023 / 10:15 | Aktualizováno: 26.06.2026 / 12:13 Ministerstvo zahraničních věcí varuje před cestami do pohraničních oblastí Venezuely s Kolumbií a do států Amazonas, Apure, Táchira a Bolívar. Do ostatních oblastí země MZV ČR doporučuje cestovat pouze ve zcela nezbytných případech.";

const COL = "Kolumbie: Aktuální doporučení na cesty Stále v platnosti: 15. 10. 2026 Publikováno: 16.11.2021 / 12:30 | Aktualizováno: 10.04.2025 / 13:38 Ministerstvo zahraničních věcí ČR doporučuje českým občanům dbát během pobytu v Kolumbii zvýšené opatrnosti a do vybraných příhraničních a odlehlých oblastí doporučuje cestovat jen ve zcela nezbytných případech a výhradně s certifikovaným průvodcem. Mezi nejrizikovější oblasti kolumbijského území dlouhodobě patří hranice s Venezuelou (zejména oblast Catatumbo v departmentu Norte de Santander a department Arauca a příhraniční zóny departmentů La Guajira, Cesar, Vichada a Guainía), hranice s Ekvádorem (departmenty Nariño a Putumayo), pacifické pobřeží (departmenty Chocó, Valle del Cauca, Cauca a Nariño) a odlehlé oblasti departmentů Bolívar, Guaviare, Meta a Caquetá. Na uvedených územích Ministerstvo zahraničních věcí doporučuje cestovat výhradně s certifikovaným průvodcem a pouze do turistických destinací, mimo ně jen ve zcela nezbytných případech.";

describe('normalizeCzLevel -- whole-country "do not travel" (level 4)', () => {
  it('KLDR: "MZV ČR varuje občany ČR před cestami do Severní Koreje" (verb form; was 1 via the old default)', () => {
    assert.equal(normalizeCzLevel(PRK), 4);
  });

  it('Jižní Súdán: "MZV ČR varuje před cestami do Jihosúdánské republiky" (was 1)', () => {
    assert.equal(normalizeCzLevel(SSD), 4);
  });

  it('Myanmar: "MZV varuje před cestami do Myanmaru" -- later "v některých částech země" curfew notes do not scope it (was 2)', () => {
    assert.equal(normalizeCzLevel(MMR), 4);
  });

  it('Írán: "důrazně varuje občany před cestami do země ... vyzývá k okamžitému opuštění země" (was 2)', () => {
    assert.equal(normalizeCzLevel(IRN), 4);
  });

  it('Libanon: "varuje před cestami do Libanonu a vyzývá občany ČR k opuštění země"; "do všech částí Libanonu" is not regional (was 2)', () => {
    assert.equal(normalizeCzLevel(LBN), 4);
  });

  it('Bělorusko: "důrazně varuje před cestami na území Běloruska a vyzývá občany ČR k opuštění země", plus a second (border-crossing) article (was 2)', () => {
    assert.equal(normalizeCzLevel(BLR), 4);
  });

  it('Haiti: "varuje před jakýmikoliv cestami do země ... aby zemi urychleně opustili" (was 2)', () => {
    assert.equal(normalizeCzLevel(HTI), 4);
  });

  it('Mali: "MZV varuje před cestami do Mali a vyzývá k urychlenému opuštění země" (was 2)', () => {
    assert.equal(normalizeCzLevel(MLI), 4);
  });

  it('Somálsko: "MZV ČR varuje před cestami do Somálska" -- the calmer Somaliland note does not scope it (was 2)', () => {
    assert.equal(normalizeCzLevel(SOM), 4);
  });

  it('Kongo (Kinshasa): "Ministerstvo zahraničních věcí varuje před cestami do Konžské demokratické republiky" -- "zahraničních" (foreign) is not the border stem "hranič-" (was 2)', () => {
    assert.equal(normalizeCzLevel(COD), 4);
  });

  it('Kuba: "varuje před cestami NA Kubu" (was 2)', () => {
    assert.equal(normalizeCzLevel(CUB), 4);
  });

  it('Rusko: "důrazně varuje před cestami na území Ruské federace" + "vyzývá občany ČR k opuštění země" (was 2)', () => {
    assert.equal(normalizeCzLevel(RUS), 4);
  });
});

describe('normalizeCzLevel -- whole-country / catch-all "only essential travel" (level 3)', () => {
  it('Burkina Faso: "omezit cesty do Burkiny Faso jen NA nezbytně nutné" is 3; the province list stays regional, not 4 (was 2)', () => {
    assert.equal(normalizeCzLevel(BFA), 3);
  });

  it('Niger: "Do ostatních částí země ... omezit cesty jen na nezbytně nutné" is the rest-of-country catch-all (was 2)', () => {
    assert.equal(normalizeCzLevel(NER), 3);
  });

  it('Venezuela: "Do ostatních oblastí země ... pouze ve zcela nezbytných případech" is the catch-all; border areas and named states stay regional (was 2)', () => {
    assert.equal(normalizeCzLevel(VEN), 3);
  });

  it('Pákistán: "Do ostatních oblastí Pákistánu ... jen ve zcela nezbytných případech" is the catch-all; border/Balúčistán warnings stay regional (was 2)', () => {
    assert.equal(normalizeCzLevel(PAK), 3);
  });

  it('Palestina: the title "varování před cestami" is ignored; north West Bank and Gaza are regional, "a do ostatních částí Západního břehu ... jen ve zcela nezbytných případech" is the catch-all (was 2)', () => {
    assert.equal(normalizeCzLevel(PSE), 3);
  });
});

describe('normalizeCzLevel -- regional-only warnings cap at 2', () => {
  it('Mongolsko: "cestovat do regionu Uvs ... jen ve zcela nezbytných případech" is one aimag, not the country (was 3)', () => {
    assert.equal(normalizeCzLevel(MNG), 2);
  });

  it('Moldavsko: "varuje ... před cestami do podněsterského regionu" (Transnistria) is regional (was 1)', () => {
    assert.equal(normalizeCzLevel(MDA), 2);
  });

  it('Kolumbie: "Na uvedených územích ... jen ve zcela nezbytných případech" refers back to the listed departments -- regional; the country-wide advice is "zvýšené opatrnosti" (was 3)', () => {
    assert.equal(normalizeCzLevel(COL), 2);
  });

  it('unchanged controls: Turecko (big cities + border areas), Mexiko ("Do některých států ..."), Indie (border areas, Kašmír) stay 2', () => {
    assert.equal(normalizeCzLevel(TUR), 2);
    assert.equal(normalizeCzLevel(MEX), 2);
    assert.equal(normalizeCzLevel(IND), 2);
  });
});

describe('normalizeCzLevel -- level 1 is never a fallback', () => {
  it('Hongkong: the National Security Law notice with no advice at all is unclassifiable -> null, not 1', () => {
    assert.equal(normalizeCzLevel(HKG_NOTICE), null);
  });

  it('Hongkong: the full article\'s "vyhýbat se případným shromážděním" (avoid gatherings) is caution -> 2', () => {
    assert.equal(normalizeCzLevel(`${HKG_NOTICE} ${HKG_ADVICE}`), 2);
  });

  it('empty text -> null', () => {
    assert.equal(normalizeCzLevel(''), null);
    assert.equal(normalizeCzLevel('   '), null);
  });
});

describe('normalizeCzLevel -- manner tips are not a country verdict', () => {
  // VERBATIM sentence from MZV's own Kenya travel page ("Specifika, bezpečnostní situace,
  // doporučení turistům", fetched 2026-10-15): the same "nedoporučuje ... cestovat" wording that
  // means "do not travel" elsewhere, but about HOW to travel (by car, after dark).
  it('"Nedoporučuje se cestovat autem po setmění" -> not 4 (nothing else to classify -> null)', () => {
    assert.equal(normalizeCzLevel("Nedoporučuje se cestovat autem po setmění ."), null);
  });
});

describe('normalizeCzLevel -- a lifted warning is not a warning', () => {
  // SYNTHETIC (built from MZV's own wording, not a live page): no current article lifts a warning,
  // but the broadened "varování před cestami" pattern must not read one that does as level 4.
  it('"MZV ČR ruší varování před cestami do země" -> not 4', () => {
    const lifted =
      'MZV ČR ruší varování před cestami do země. Doporučujeme dbát zvýšené opatrnosti a sledovat místní média.';
    assert.equal(normalizeCzLevel(lifted), 2);
  });

  // SYNTHETIC, same caveat: MZV tells people who STAY to keep "připravený plán opuštění země"
  // (Bělorusko/Rusko, verbatim fragment) -- with an advisory verb in front it must still not read
  // as a call to leave.
  it('"doporučuje mít připravený plán opuštění země" (a contingency plan) -> not 4', () => {
    const plan = 'MZV ČR doporučuje dbát zvýšené opatrnosti a mít připravený plán opuštění země pro případ nouze.';
    assert.equal(normalizeCzLevel(plan), 2);
  });
});
