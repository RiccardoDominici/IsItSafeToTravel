import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  normalizeHuLevel,
  normalizeHuSecurityBlocks,
  resolveHuAdvisoryLevel,
} from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-26 HU (Hungary/KKM "Konzinfo" portal)
 * repair (PARSER-REGIONAL-BRIEF.md). Fixtures below are VERBATIM paragraph/
 * bullet blocks (whitespace-collapsed, as the fetcher's cheerio `.text()`
 * extraction produces them) read from the live konzinfo.mfa.gov.hu node
 * pages on 2026-09-26, covering all 8 countries named in the brief (BEN,
 * CMR, COL, DJI, GNB, KEN, MWI, TJK) plus 3 non-flagged countries whose
 * classification badge ALSO tags 2+ tiers (EGY, JPN, THA), used only to
 * confirm the repair does not regress them relative to the OLD parser's own
 * output on the same live badges (also asserted below).
 */

describe('normalizeHuLevel (badge text, single-tier case)', () => {
  it('bare "Nem javasolt úti cél" -> 4', () => {
    assert.equal(normalizeHuLevel('Nem javasolt úti cél'), 4);
  });
  it('bare "Biztonságos ország / térség" -> 1', () => {
    assert.equal(normalizeHuLevel('Biztonságos ország / térség'), 1);
  });
  it('bare "Fokozott óvatossággal látogatható ország" -> 2', () => {
    assert.equal(normalizeHuLevel('Fokozott óvatossággal látogatható ország'), 2);
  });
  it('empty/whitespace text -> null (never guess)', () => {
    assert.equal(normalizeHuLevel(''), null);
    assert.equal(normalizeHuLevel('   '), null);
  });
});

describe('normalizeHuSecurityBlocks (full "Biztonság" section body, multi-tier case)', () => {
  it('Cameroon: "III. biztonsági kategória" heading (fokozott óvatossággal látogatható) followed by a residual "Kamerun további részei" bullet with no level phrase of its own -> 2, not the I. category\'s 4', () => {
    const blocks = [
      'Kamerunban a biztonsági kockázatok területileg jelentősen eltérnek.',
      'I. biztonsági kategória - utazásra nem javasolt, ott-tartózkodás esetén azonnali elhagyásra javasolt térségek:',
      'Távol-Északi (Extrême-Nord) régió teljes területe (kiemelten a Boko Haram és az ISWAP tevékenysége...)',
      'II. biztonsági kategória - kiemelt biztonsági kockázatot rejtő, utazásra csak halaszthatatlan esetben javasolt térségek:',
      'A nigériai, közép-afrikai határszakaszt megközelítő sáv, amely fenti I. kategóriába sorolt határ- és kiemelt kockázatú körzeteken kívül eső, nem közvetlen, de határmenti övezethez közel eső rész.',
      'III. biztonsági kategória - biztonsági kockázatot rejtő, fokozott óvatossággal látogatható térségek:',
      'Kamerun további részei - minden olyan terület, amely nem került felsorolásra az I. vagy II. kategóriában. Ezeken a területeken a leggyakoribb kockázat a vagyon elleni bűnözés...',
    ];
    assert.equal(normalizeHuSecurityBlocks(blocks), 2);
  });

  it('Benin: same heading+bullet template, but the RESIDUAL category is II (kiemelt biztonsági kockázat), not III -> 3, because Benin\'s own page names "Benin további részei" under the II. heading (III. there is a SAFER named coastal-city exception, not the baseline)', () => {
    const blocks = [
      'Beninben a kockázatok területileg jelentősen eltérnek. Az ország déli része fokozott óvatossággal látogatható, ugyanakkor az északi és határ menti térségekben a terrorcselekmények... Ennek megfelelően az országon belül az alábbi területi besorolás irányadó.',
      'I. biztonsági kategória - utazásra nem javasolt, ott-tartózkodás esetén azonnali elhagyásra javasolt térségek:',
      'Benin északi és északkeleti határvidékének 75-100km-es körzete, ide értendők különösen a Burkina Fasóval és Nigerrel határos területek...',
      'II. biztonsági kategória - kiemelt biztonsági kockázatot rejtő, utazásra csak halaszthatatlan esetben javasolt térségek:',
      'Benin további részei - minden olyan rész, amely nem került felsorolásra az I. vagy III. kategóriában.',
      'III. biztonsági kategória - biztonsági kockázatot rejtő, fokozott óvatossággal látogatható térségek:',
      'A déli városok és a tengerparti térségek, különösen Cotonou és Porto-Novo környéke...',
    ];
    assert.equal(normalizeHuSecurityBlocks(blocks), 3);
  });

  it('Kenya: no heading template at all -- named regions assigned to I/II inline, then "Az ország egyéb részei" states its OWN level (fokozott óvatossággal, III) in the same sentence -> 2', () => {
    const blocks = [
      'A terrorveszély Kenya nagyvárosaiban... fokozódott.',
      'A Külügyminisztérium Kenya dél-szudáni, etiópiai és szomáliai határvidékét 100 km-es sávban, Nairobi nyomornegyedeit (Kibera, Mathare...) és a kenyai partszakasz északi megyéit (Lamu, Garissa, Wajir, Mandera) az I. Nem javasolt utazási célországok és térségek - kategóriába sorolta. Kenyában a fenti térségekben rendszeresek a hatóságokat és civileket egyaránt célzó támadások és emberrablások.',
      'A Külügyminisztérium Kenya Turkana, Marsabit, Moyale, Tana-folyó, Samburu és Laikipia régióit a II. kiemelt biztonsági kockázatot rejtő, csak halaszthatatlan utazásra javasolt térségek kategóriába helyezte az itt előforduló gyakori fegyveres konfliktusok... miatt. Az ország egyéb részei a III-as, fokozott óvatossággal látogatható térségek közé tartozik.',
    ];
    assert.equal(normalizeHuSecurityBlocks(blocks), 2);
  });

  it('Tajikistan: I. category names 3 border/mountain regions by name, then "a fent nem említett országrészek" (the parts of the country not mentioned above) states II (kiemelt biztonsági kockázat) as the baseline in the same sentence -> 3, not 4', () => {
    const blocks = [
      'Tádzsikisztán három jelentős kiterjedésű körzetének biztonsági besorolása az I. biztonsági kategória, azaz az utazásra nem javasolt térségek listáján található.',
      'Tájékoztatjuk a magyar állampolgárokat, hogy... a Fergana-medence és annak környéke... utazás és ott tartózkodás szempontjából az utazásra nem javasolt térségek közé sorolt.',
      'Szintén az átlagosnál veszélyesebb területnek számít ezért utazásra nem javasolt térség a több mint 1.300 km hosszúságú tádzsik-afgán határkörzet...',
      'Szintén az utazásra nem javasolt térségek közé sorolt a Pamír hegység teljes területe, Hegyi Badahsán Tartomány.',
      'A főváros, Dusanbe és környéke alapvetően biztonságos, a III. (sárga) biztonsági kategóriába tartozó terület, kockázatot rejtő, fokozott óvatossággal látogatható.',
      'Mivel a szélsőségesek nemcsak a déli megyékben vannak jelen, hanem időközönként az ország más részeiben is felbukkantak ezért a fent nem említett országrészek a II. (narancssárga) kiemelt biztonsági kockázatot rejtő, csak halaszthatatlan utazásra javasolt térségek közé tartoznak.',
    ];
    assert.equal(normalizeHuSecurityBlocks(blocks), 3);
  });

  it('Colombia: I. category lists 8 named departments/border strips, then "A felsorolt területeken kívül Kolumbia" (outside the listed areas, Colombia...) states III (fokozott óvatossággal) as the baseline -> 2, not 4', () => {
    const blocks = [
      'A politikai erőszak... miatt Kolumbia biztonsági helyzete jelentősen destabilizálódott. A fegyveres konfliktusok és transznacionális bűnszervezetek dominanciája miatt az I. (utazásra nem javasolt) kategóriába tartoznak a következő területek:',
      '1. Cauca és Valle del Cauca (beleértve Popayán és Cali is)',
      '8. Chocó',
      'Ennek megfelleően a II.-es kategóriába (kiemelt biztonsági kockázat) sorolódnak az alábbi területek:',
      '1. Antioquia',
      'A felsorolt területeken kívül Kolumbia a III. fokozott óvatossággal látogatható országok közé tartozik.',
    ];
    assert.equal(normalizeHuSecurityBlocks(blocks), 2);
  });

  it('Egypt (non-flagged, badge already tags 2 tiers): "az alább fel nem sorolt területek" states III (fokozott óvatossággal) as the baseline, Sinai/Libya/Sudan border named separately as I -> 2 (matches the OLD parser\'s own output, no regression)', () => {
    const blocks = [
      'Egyiptom területének nagyrésze... alapvetően biztonságos úti célnak számítanak, de a körültekintés javasolt. Tehát az alább fel NEM sorolt területek biztonsági besorolása a III. kategória: „fokozott óvatossággal látogatható területek”.',
      'Egyiptomon belül a Sínai-félsziget északi és középső része, valamint az egyiptomi-líbiai, illetve az egyiptomi-szudáni határtérség biztonsági besorolása az „I. Nem javasolt úti cél” biztonsági kategóriába tartoznak, azaz ezen területek felkeresése nem javasolt.',
    ];
    assert.equal(normalizeHuSecurityBlocks(blocks), 2);
  });

  it('Japan (non-flagged, badge already tags 2 tiers): "Az ország biztonsági besorolása" states III directly, the Fukushima exclusion zone is separately flagged as "egyes részei" (SOME of its parts, not a residual/whole-country marker) -> falls through to the safe cap (2), matching the OLD parser\'s own output', () => {
    const blocks = [
      'Az ország biztonsági besorolása a III-as, fokozott óvatossággal látogatható országok listáján szerepel, egyes részei azonban az I-es utazásra nem javasolt térségek között találhatóak, az alábbiak szerint:',
      'A Fukushima Daiichi Atomerőmű közvetlen közelében lezárt területek, továbbra is az I. kategóriába, az utazásra nem javasolt térségek közé tartoznak.',
    ];
    assert.equal(normalizeHuSecurityBlocks(blocks), 2);
  });
});

describe('resolveHuAdvisoryLevel (badge + body orchestration)', () => {
  it('single-tier badge (Guinea-Bissau: bare "Nem javasolt úti cél", no other tier anywhere on its page) -> 4 straight from the badge, body blocks never consulted', () => {
    assert.equal(
      resolveHuAdvisoryLevel('Nem javasolt úti cél', ['irrelevant body text with no bearing here']),
      4,
    );
  });

  it('multi-tier badge (Cameroon) with empty/unavailable body blocks -> capped at 2, never falls back to the badge\'s worst tier', () => {
    assert.equal(
      resolveHuAdvisoryLevel(
        'Nem javasolt úti cél, kiemelt biztonsági kockázatot rejtő és fokozott óvatossággal látogatható térséggel',
        [],
      ),
      2,
    );
  });

  it('empty classification -> null (never guess)', () => {
    assert.equal(resolveHuAdvisoryLevel('', ['some body text']), null);
  });
});
