import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeJpRegionalLevel } from '../normalize/advisory-levels.js';

/**
 * Regression coverage for the 2026-09-26 JP (MOFA) regional-promotion repair
 * (PARSER-REGIONAL-BRIEF.md). parseJpKikenLevel (advisories-tier1.ts) reads the
 * `.kiken_levels` CSS-class legend and takes the MAX across whatever levels are present on
 * the page — correct for THAT function's own purpose (a discovery-anchor sanity check that
 * the scrape hit the right page and enumerated its classes), but wrong as the country's
 * advisory level: a single named border strip or separatist enclave turned the WHOLE
 * COUNTRY into a "do not travel" (verified live 2026-09-26; see PARSER-REGIONAL-BRIEF's
 * evidence table — ARM AZE CMR DZA IND KEN TUR all flagged at Level 4 against a peer
 * median <= 2). normalizeJpRegionalLevel parses the actual free-text region breakdown (the
 * `<a class="underline">` link inside `#kikendetail` — the ONLY place that pairs a region
 * NAME with its level) and applies the project's standing doctrine: a sub-national entry
 * never promotes the country above Level 2, unless the country's own catch-all/main-area
 * statement is already higher.
 *
 * Fixtures below are VERBATIM excerpts (safe tag boundaries, wrapped in the same
 * `<div id="kikendetail">...</div></div></div>` shape parseJpKikenLevel's own tests use)
 * pulled from the live anzen.mofa.go.jp pages on 2026-09-26: the 5 flagged countries this
 * agent repaired (ARM, AZE was spot-identical in shape to ARM so only ARM is fixtured, CMR,
 * DZA, IND, KEN, TUR — see the full country list in the commit body), 2 that must STAY at
 * Level 4 (UKR: genuine bare "whole territory" statement; IRQ: the country's own catch-all
 * IS Level 4), 1 that corrects a DIFFERENT direction (RUS: catch-all is Level 3, not
 * capped to 2, since 3 already exceeds the regional-cap ceiling), and 2 that isolate the
 * "possessively-scoped" guard specifically (ETH: a SINGLE named province's own "the above-
 * excluded area" must not count as country-wide; MRT: same guard against a MULTI-province
 * enumeration) — both found only by the full 205-country sweep (a throwaway harness, not
 * committed), not from the original flagged list.
 */

const KIKENDETAIL_WRAP = (inner: string) => `<div id="kikendetail">${inner}</div></div></div>`;

describe('normalizeJpRegionalLevel (JP/MOFA whole-country vs. regional scoping)', () => {
  it('Armenia: Level-4 border strip with Azerbaijan + a Level-2 buffer zone (naming "Syunik province\'s ENTIRE area", not Armenia\'s) is capped at 2 by the explicit "the area other than the above, INCLUDING CAPITAL YEREVAN" catch-all (itself Level 1)', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/info/pchazardspecificinfo_2025T061.html">【危険レベル】<br>●アゼルバイジャンとの国境周辺地域（ナヒチェバン自治共和国との国境地域を含む。）<br>　レベル4：退避してください。渡航は止めてください（退避勧告）（継続）<br>●シュニク州全域及びアララト州、ゲガルクニク州、ヴァヨツ・ゾル州、タヴシュ州のレベル４地域と接する地域<br>　レベル2：不要不急の渡航は止めてください。（継続）<br>●アララト州、ゲガルクニク州、ヴァヨツ・ゾル州、タヴシュ州のレベル４、レベル２以外の地域<br>　レベル1：十分注意してください。（引下げ）<br>●上記以外の地域（首都エレバンを含む。）<br>　レベル1：十分注意してください。（継続）<br><br>【ポイント】<br>●紛争解決と和平に向けて一定の成果が見られています。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'アルメニア', 4), 2);
  });

  it('Cameroon: Level-4 Far North province + a "上記を除く地域" (the area excluding the above) catch-all at Level 1 -> capped at 2, not 4', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/x.html">【危険レベル】<br>●極北州<br>　レベル４：退避してください。渡航は止めてください。（退避勧告）（継続）<br>●中央アフリカ国境地帯、北部州のナイジェリア国境地帯及びチャド国境地帯、英語圏（北西州及び南西州）<br>　レベル３：渡航は止めてください。（渡航中止勧告）（継続）<br>●北部州（ナイジェリア国境地帯及びチャド国境地帯を除く）、アダマワ州のナイジェリア国境地帯、西部州の北西州との州境地帯<br>　レベル２：不要不急の渡航は止めてください。（継続）<br>●上記を除く地域<br>　レベル１：十分注意してください。（継続）<br><br>【ポイント】<br>●極北州では武装勢力の越境活動が継続しています。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'カメルーン', 4), 2);
  });

  it('India: nested "・" sub-items (Jammu & Kashmir group) reach Level 4 at the LoC border, but the top-level "above-excluded, INCLUDING major cities Delhi/Kolkata/Chennai/Mumbai/Bengaluru" catch-all is Level 1 -> capped at 2', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/x.html">【危険レベル】<br>●ジャンム・カシミール準州及びラダック連邦直轄領<br>・管理ライン（LoC）付近<br>　レベル4：退避してください。渡航は止めてください。（退避勧告）（継続）<br>・ジャンム・カシミール準州（スリナガル及びその近郊、管理ライン(LoC)付近、ラダック連邦直轄領を除く地域）<br>　レベル3：渡航は止めてください。（渡航中止勧告）（継続）<br>●上記以外のインド全域（デリー、コルカタ、チェンナイ、ムンバイ、ベンガルールなどの大都市を含む地域）<br>　レベル1：十分注意してください。（継続）<br><br>【ポイント】<br>●大都市では警戒が呼びかけられています。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'インド', 4), 2);
  });

  it('Turkey: NO explicit "the rest of the country" phrase anywhere -- the lowest published entry (Istanbul + 16 named provinces, Level 1) is the implicit whole-country baseline (MIN across all entries), capped at 2 by the Syria-border Level 4 strip', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/x.html">【危険レベル】<br>●シリアとの国境地帯<br>レベル4：退避してください。渡航は止めてください。（退避勧告）（継続）<br>●ディヤルバクル県及びイラクとの国境地帯 <br>レベル3：渡航は止めてください。（渡航中止勧告）（継続）<br>●ハッカーリ県、シュルナク県、ハタイ県、キリス県、ガジアンテプ県、シャンルウルファ県、マルディン県の一部（シリア又はイラクとの国境地帯を除く）<br>レベル2：不要不急の渡航は止めてください。（継続）<br>●イスタンブール県、東部11県（トゥンジェリ、エラズー、ビンギョル、ムシュ、ビトリス、ヴァン、ウードゥル、カルス、アール、エルズルム、エルジンジャン）及び南東部5県（バトマン、シールト、アドゥヤマンの全域（継続）<br>ガジアンテプ、シャンルウルファの県都以北（引き下げ）<br>レベル1：十分注意してください。<br><br>【ポイント】<br>●イスタンブールでもテロ事件が発生しています。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'トルコ', 4), 2);
  });

  it('Russia: the "the area OTHER THAN the Ukraine-border-strip, INCLUDING MOSCOW" catch-all is Level 3, which already exceeds the Level-2 regional-cap ceiling -> stays 3, is NOT raised to the border strip\'s own Level 4', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/x.html">【危険レベル】<br>●ウクライナとの国境周辺地域<br>レベル4：退避してください。渡航は止めてください。（退避勧告）（継続）<br><br>●ウクライナとの国境周辺地域を除く地域（モスクワ市を含む）<br>レベル3：渡航は止めてください。（渡航中止勧告）（継続：ただし書きの修正）<br>ただし、真にやむを得ない事情がある場合には渡航・滞在することは妨げません。<br><br>【ポイント】<br>●上記を除く地域（モスクワ市を含む）の危険レベル３を継続します。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'ロシア', 4), 3);
  });

  it('Iraq: the country\'s own catch-all ("上記以外の地域" = the area other than the above) IS Level 4 -- a genuine whole-country "do not travel" that must NOT be capped down just because 8 named southeastern provinces were downgraded to 3', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/x.html">【危険レベル】<br>●南東部８県（バービル県、カルバラー県、ナジャフ県、ディーワニーヤ（カーディシーヤ）県、バスラ県、ムサンナー県、ズィーカール県、ミーサーン県）<br>レベル３：渡航は止めてください。（渡航中止勧告）《引き下げ》<br>　ただし、真にやむを得ない事情がある場合には、レベル３地域へ渡航・滞在することは妨げません。<br><br>●上記以外の地域<br>レベル４：退避してください。渡航は止めてください。（退避勧告）《継続》<br><br>【ポイント】<br>●イラクへの渡航は止めてください。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'イラク', 4), 4);
  });

  it('Ukraine: a single bare "ウクライナ全土" (all of Ukraine) entry at Level 4 -- genuinely whole-country, and the narrow business-travel exception PROCEDURE for Kyiv/Lviv (still requiring advance MOFA approval) does not create a separate lower-level region', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/x.html">【危険レベル】<br>●ウクライナ全土<br>レベル4：退避してください。渡航は止めてください。《継続》<br>（注）<br>ただし、真にやむを得ない事情でキーウ市及び同市周辺並びにリヴィウ州に渡航する必要がある場合には、事前に外務省窓口に相談してください。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'ウクライナ', 4), 4);
  });

  it('Pakistan: "KP province\'s [the area other than what is designated Level 3/2 BELOW]" is possessively scoped to that ONE province via a LONG unpunctuated relative clause (not a short, 0-gap "の" like Ethiopia\'s) -- still not the whole country; the true catch-all is "Islamabad Capital Territory, Lahore-inclusive Punjab, ..., Karachi-inclusive Sindh" at Level 2, capped at 2 by the Afghan-border/former-FATA/Quetta Level-4 zones', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/x.html">【危険度】<br>●アフガニスタンとの国境周辺地帯、ハイバル・パフトゥンハー州（KP州）の以下レベル３及びレベル２で指定した以外の地域、旧連邦直轄部族地域(旧FATA)全域、インドとの管理ライン（LoC）等周辺地帯、及びバロチスタン州クエッタ市<br>レベル４：退避を勧告します。渡航は止めてください。（退避勧告）《継続》<br>●バロチスタン州全域（アフガニスタンとの国境周辺地帯、クエッタ市、デラ・ブグディ郡及びコールー郡を除く）<br>レベル３：渡航は止めて下さい。（渡航中止勧告）《引き上げ》<br>●イスラマバード首都圏、ラホール市を含むパンジャーブ州、カラチ市を含むシンド州（ジャコババード郡を除く）<br>レベル２：不要不急の渡航は止めてください。《継続》<br><br>【ポイント】<br>●バロチスタン州の情勢は不安定です。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'パキスタン', 4), 2);
  });

  it('Ethiopia: "Afar province\'s the-above-excluded area" is possessively scoped to ONE named province (not the whole country) despite containing "上記以外の" -- the true catch-all is "首都アディスアベバを含む上記以外の地域" (capital Addis Ababa included), Level 1, capped at 2 by the Level-4 border zones', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/x.html">【危険レベル】<br>●エリトリア、ソマリア、スーダン、南スーダンとの国境地帯、ティグライ州西部地区及びアムハラ州との州境地帯<br>　レベル4：退避してください。渡航は止めてください。（退避勧告）（継続）<br>●ティグライ州メケレ市及びシレ市<br>　レベル3：渡航は止めてください。（渡航中止勧告）（引き上げ）<br>●アファール州の上記以外の地域、オロミア州ボレナ地区（ケニアとの国境地帯を除く）、東西ハラルゲ地区<br>　レベル2：不要不急の渡航は止めてください。（継続）<br>●首都アディスアベバを含む上記以外の地域<br>　レベル1：十分注意してください。（継続）<br><br>【ポイント】<br>●ティグライ州で政治的緊張が高まっています。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'エチオピア', 4), 2);
  });

  it('Mauritania: "上記を除くティリス・ゼムール州(...)、アドラール州東部(...)、タガント州、アッサバ州、ホード・エルガルビ州及びホード・エッシャルギ州" is possessively scoped to that 6-province ENUMERATION (not the whole country) despite starting with "上記を除く" -- the true catch-all is "首都ヌアクショットを含む上記以外の地域" (capital Nouakchott included), Level 1, capped at 2', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/x.html">【危険レベル】<br>●マリ及びアルジェリアとの国境地帯全域並びに西サハラ地域東部との一部国境地帯<br>　レベル4：退避してください。渡航は止めてください。（退避勧告）《継続》<br>●上記を除くティリス・ゼムール州（ズエラット以南の幹線道路沿いを除く地域）、アドラール州東部（ワダンから東側地域）、タガント州、アッサバ州、ホード・エルガルビ州及びホード・エッシャルギ州<br>　レベル3：渡航は止めてください。（渡航中止勧告）《継続》<br>●首都ヌアクショットを含む上記以外の地域<br>　レベル1：十分注意してください。（十分注意）《継続》<br><br>【ポイント】<br>●武装集団の活動が活性化しています。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'モーリタニア', 4), 2);
  });

  it('no #kikendetail div at all -> falls back to legendMaxLevel unchanged (the caller already resolved this to Level 1 for a genuinely advisory-free country)', () => {
    const html = '<html><body><div id="somethingElse">no hazard info here</div></body></html>';
    assert.equal(normalizeJpRegionalLevel(html, 'フランス', 1), 1);
  });

  it('#kikendetail present but with no <a class="underline"> link -> falls back to legendMaxLevel (never guess a DIFFERENT value than the legend already established)', () => {
    const html = KIKENDETAIL_WRAP('<div class="kiken_levels"><div class="kiken_level_base kiken_level_kentou">検討してください</div></div>');
    assert.equal(normalizeJpRegionalLevel(html, 'バーレーン', 2), 2);
  });

  it('link present but no "レベルN" statement anywhere (Madagascar\'s real page: pure prose about a political crisis, no numeric level at all) -> falls back to legendMaxLevel, since there is no regional-vs-whole ambiguity to resolve without any parsed entries', () => {
    const html = KIKENDETAIL_WRAP(
      '<a class="underline" href="/x.html">●2025年9月末から10月上旬にかけて、首都アンタナナリボを中心にデモが発生しました。<br>●貧困に起因する強盗、スリ、ひったくりが多発しており、注意が必要です。</a>',
    );
    assert.equal(normalizeJpRegionalLevel(html, 'マダガスカル', 1), 1);
  });
});
