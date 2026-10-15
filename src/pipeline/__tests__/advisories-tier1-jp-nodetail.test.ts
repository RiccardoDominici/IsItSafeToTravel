import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { normalizeJpNoDetailLevel } from '../normalize/advisory-levels.js';
import { resolveJpCountryLevel } from '../fetchers/advisories-tier1.js';

/**
 * Regression coverage for the 2026-10-15 JP (MOFA) North Korea repair (advisory-outlier audit).
 *
 * A MOFA country page with NO `#kikendetail` block used to be read as "no advisory published ->
 * Level 1" unconditionally (parseJpKikenLevel's no-div branch). North Korea's page has no
 * numbered breakdown because its advisory sits OUTSIDE MOFA's 4-level system: a whole-territory
 * "渡航を自粛してください" (refrain from travelling), issued "目的のいかんを問わず" (regardless of
 * purpose). Production data of 2026-10-14 showed Japan at Level 1 "Exercise caution" for North
 * Korea while 10 of 18 governments say "do not travel".
 *
 * Fixtures are VERBATIM excerpts of the live anzen.mofa.go.jp pages fetched 2026-10-15
 * (pcinfectionspothazardinfo_035.html = North Korea, _170.html = France), trimmed to the
 * `kiken_unit` box plus enough surrounding markup to keep the real tag boundaries.
 */

const PRK_PAGE =
  '<li class="hazardContents">\n<div class="kiken_unit">\n    \n    \n    <p>●全土：<B><FONT COLOR=red>「渡航を自粛してください。」（2026年現在有効）</FONT></B><br><br>（2017年4月10日発出）<br><br>１　北朝鮮が核実験や弾道ミサイル発射を繰り返しています。<br><br>２　その一環として，人的往来の規制措置，具体的には我が国から北朝鮮への渡航自粛要請が含まれています。<br><br>３　つきましては，<a href="https://www.youtube.com/watch?v=ny_Lzd65ddU&feature=youtu.be">目的のいかんを問わず，北朝鮮への渡航は自粛してください。</a><br><br>（問い合わせ窓口）<br>○外務省領事サービスセンター<br>　電話：（外務省代表）03-3580-3311 （内線）2902，2903<br>\n</div>\n<div class="mapWrapDammy spBlock"></div>';

const FRA_PAGE =
  '<li class="hazardContents">\n<div class="kiken_unit">\n    \n        <p>現在、危険情報は出ておりません。</p>\n    \n    \n</div>\n<div class="mapWrapDammy spBlock"></div>';

describe('normalizeJpNoDetailLevel / resolveJpCountryLevel (JP/MOFA pages without a numbered breakdown)', () => {
  it('North Korea: whole-territory "渡航を自粛してください" (refrain from travelling, regardless of purpose) -> 4, not the old no-div default of 1', () => {
    assert.equal(normalizeJpNoDetailLevel(PRK_PAGE), 4);
    assert.equal(resolveJpCountryLevel(PRK_PAGE, '北朝鮮'), 4);
  });

  it('France: MOFA\'s own "現在、危険情報は出ておりません" (no danger information issued) -> 1', () => {
    assert.equal(normalizeJpNoDetailLevel(FRA_PAGE), 1);
    assert.equal(resolveJpCountryLevel(FRA_PAGE, 'フランス'), 1);
  });

  it('kiken_unit present but carrying neither the no-danger sentence nor a whole-territory statement -> null (never default to "safe")', () => {
    const html = '<div class="kiken_unit"><p>一部地域で治安が悪化しています。</p></div>';
    assert.equal(normalizeJpNoDetailLevel(html), null);
    assert.equal(resolveJpCountryLevel(html, 'テスト'), null);
  });

  it('unknown layout with no kiken_unit box at all -> null', () => {
    const html = '<html><body><div id="somethingElse">no hazard info here</div></body></html>';
    assert.equal(normalizeJpNoDetailLevel(html), null);
    assert.equal(resolveJpCountryLevel(html, 'テスト'), null);
  });

  it('a page WITH #kikendetail still goes through the numbered-breakdown path (normalizeJpRegionalLevel), not the kiken_unit box', () => {
    const html =
      '<div class="kiken_unit"><p>現在、危険情報が出ております。</p></div>' +
      '<div id="kikendetail"><div class="kiken_levels"><div class="kiken_level_base kiken_level_taihi">退避してください</div></div>' +
      '<a class="underline" href="/x.html">【危険レベル】<br>●ウクライナ全土<br>　レベル４：退避してください。渡航は止めてください。（退避勧告）（継続）<br><br>【ポイント】<br>●戦闘が継続しています。</a></div></div></div>';
    assert.equal(resolveJpCountryLevel(html, 'ウクライナ'), 4);
  });
});
