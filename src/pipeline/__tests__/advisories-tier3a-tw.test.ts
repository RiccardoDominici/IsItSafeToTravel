import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseTwListingRows, resolveTwCountryLevel } from '../fetchers/advisories-tier3a.js';

/**
 * Regression coverage for the 2026-09-26 TW (BOCA) regional-promotion repair
 * (PARSER-REGIONAL-BRIEF.md). BOCA's list page is one `<tr>` per PUBLISHED ALERT, not one
 * per country: most countries have a single "bare" row (region column = just the country's
 * own name) stating the overall colour, but some also carry extra rows scoped to a named
 * sub-region whose colour can be WORSE. The old parser concatenated every element's text
 * with its closest ancestor's and grepped for "紅色"/"red" anywhere in that blob, so a
 * country whose OWN row is yellow/orange still got reported as Red the moment ANY row
 * mentioning it also carried a worse regional colour.
 *
 * Fixtures below are VERBATIM `<tr>` blocks (safe boundaries) pulled from the live
 * sp-trwa-list-1.html page on 2026-09-26: Israel (bare Yellow + a Red Israel-Lebanon
 * border-only row -- the clearest real case of the bug: the OLD parser reported Israel as
 * Red for the whole country), Cameroon (bare Red + a Red regional row -- confirms the fix
 * does NOT change an already-correct whole-country Red), and Myanmar (bare Orange + a Red
 * regional row + a THIRD row that is an EXPLICIT catch-all naming the capital Naypyidaw and
 * Yangon Region as Yellow -- the explicit "the rest of the country" statement must win over
 * the bare row, mirroring the JP/NZ repairs' doctrine).
 */

const TABLE = (trs: string) => `<table><tbody>${trs}</tbody></table>`;

const ISRAEL_BARE_TR =
  '<tr><td data-title="國家"><a href="/sp-trwa-content-3101-a726d-1.html" title="以色列 Israel" id="Israel">以色列 Israel</a></td>' +
  '<td data-title="國家地區">以色列 Israel</td>' +
  '<td data-title="最新警示分級"><span class="square yellowblock"></span>第二級：黃色注意</td></tr>';

const ISRAEL_REGIONAL_TR =
  '<tr><td data-title="國家"><a href="/sp-trwa-content-3058-b964f-1.html" title="以色列－黎巴嫩邊界地區 " id="Israel">以色列 Israel</a></td>' +
  '<td data-title="國家地區">以色列－黎巴嫩邊界地區 </td>' +
  '<td data-title="最新警示分級"><span class="square redblock"></span>第四級：紅色儘速離境</td></tr>';

const CAMEROON_BARE_TR =
  '<tr><td data-title="國家"><a href="/sp-trwa-content-3105-70f1e-1.html" title="喀麥隆 Republic of Cameroon" id="Cameroon">喀麥隆 Cameroon</a></td>' +
  '<td data-title="國家地區">喀麥隆 Republic of Cameroon</td>' +
  '<td data-title="最新警示分級"><span class="square redblock"></span>第四級：紅色儘速離境</td></tr>';

const CAMEROON_REGIONAL_TR =
  '<tr><td data-title="國家"><a href="/sp-trwa-content-3106-0f2ac-1.html" title="喀麥隆 - 北部極北省..." id="Cameroon">喀麥隆 Cameroon</a></td>' +
  '<td data-title="國家地區">喀麥隆 - 北部極北省、北省及東省接近中非地區、西北省、西南省(包括Bakassi半島) Republic of Cameroon - Extreme Nord、Nord、Adamaoua、Est、Bakassi de Sud-Ouest</td>' +
  '<td data-title="最新警示分級"><span class="square redblock"></span>第四級：紅色儘速離境</td></tr>';

const MYANMAR_BARE_TR =
  '<tr><td data-title="國家"><a href="/sp-trwa-content-3084-0c9f8-1.html" title="緬甸 Myanmar" id="Myanmar">緬甸 Myanmar</a></td>' +
  '<td data-title="國家地區">緬甸 Myanmar</td>' +
  '<td data-title="最新警示分級"><span class="square orangeblock"></span>第三級：橙色避免前往</td></tr>';

const MYANMAR_REGIONAL_RED_TR =
  '<tr><td data-title="國家"><a href="/sp-trwa-content-3085-16987-1.html" title="克欽邦..." id="Myanmar">緬甸 Myanmar</a></td>' +
  '<td data-title="國家地區">克欽邦（Kachin State）、欽邦（Chin State）、實皆省（Sagaing Region）、若開邦（Rakhine State）仰光-曼德勒快速道路以東地區 </td>' +
  '<td data-title="最新警示分級"><span class="square redblock"></span>第四級：紅色儘速離境</td></tr>';

const MYANMAR_CATCHALL_TR =
  '<tr><td data-title="國家"><a href="/sp-trwa-content-3086-66372-1.html" title="緬甸仰光省..." id="Myanmar">緬甸 Myanmar</a></td>' +
  '<td data-title="國家地區">緬甸仰光省(Yangon Region)、奈比都（Nay Pyi Taw）以及其它列示第三級（避免前往）及第四級（儘速離境）以外地區 </td>' +
  '<td data-title="最新警示分級"><span class="square yellowblock"></span>第二級：黃色注意</td></tr>';

describe('parseTwListingRows (TW/BOCA structured table extraction)', () => {
  it('parses each real <tr> into a (id, region, level) row via the data-title columns and CSS colour class, not free text', () => {
    const rows = parseTwListingRows(TABLE(ISRAEL_BARE_TR + ISRAEL_REGIONAL_TR));
    assert.equal(rows.length, 2);
    assert.deepEqual(rows[0], { id: 'Israel', region: '以色列 Israel', level: 2, href: '/sp-trwa-content-3101-a726d-1.html' });
    assert.equal(rows[1].level, 4);
    assert.equal(rows[1].region, '以色列－黎巴嫩邊界地區');
  });
});

describe('resolveTwCountryLevel (whole-country vs. regional colour doctrine)', () => {
  it('Israel: bare row is Yellow (2), a separate Israel-Lebanon BORDER-ONLY row is Red (4) -- the old bug reported Israel as Red for the whole country; the fix must use the bare row', () => {
    const rows = parseTwListingRows(TABLE(ISRAEL_BARE_TR + ISRAEL_REGIONAL_TR));
    assert.equal(resolveTwCountryLevel(rows), 2);
  });

  it('Israel row order reversed still resolves to 2 (position is a fallback signal, not required to be first for this specific case since the regional row is excluded by content too)', () => {
    const rows = parseTwListingRows(TABLE(ISRAEL_REGIONAL_TR + ISRAEL_BARE_TR));
    assert.equal(resolveTwCountryLevel(rows), 2);
  });

  it('Cameroon: bare row is ALREADY Red (4), confirming the fix does not change an already-correct genuine whole-country Red just because a second regional row exists', () => {
    const rows = parseTwListingRows(TABLE(CAMEROON_BARE_TR + CAMEROON_REGIONAL_TR));
    assert.equal(resolveTwCountryLevel(rows), 4);
  });

  it('Myanmar: bare row is Orange (3), a regional row is Red (4), but an EXPLICIT catch-all naming the capital Naypyidaw and Yangon Region ("...以外地區" = "areas other than those listed as Level 3/4") is Yellow (2) -- the catch-all wins over the bare row, same doctrine as JP/NZ', () => {
    const rows = parseTwListingRows(TABLE(MYANMAR_BARE_TR + MYANMAR_REGIONAL_RED_TR + MYANMAR_CATCHALL_TR));
    assert.equal(resolveTwCountryLevel(rows), 2);
  });

  it('a single bare row (Afghanistan-style: one row, no sub-regions) just reports its own level', () => {
    const AFG_TR =
      '<tr><td data-title="國家"><a href="/x.html" title="阿富汗 Afghanistan" id="Afghanistan">阿富汗 Afghanistan</a></td>' +
      '<td data-title="國家地區">阿富汗 Afghanistan</td>' +
      '<td data-title="最新警示分級"><span class="square redblock"></span>第四級：紅色儘速離境</td></tr>';
    const rows = parseTwListingRows(TABLE(AFG_TR));
    assert.equal(resolveTwCountryLevel(rows), 4);
  });

  it('all-regional rows with no bare/catch-all entry but AGREEING levels still resolve (Palestine-style: only "West Bank"/"Gaza Strip", BOCA never publishes a unified bare entry)', () => {
    const WEST_BANK_TR =
      '<tr><td data-title="國家"><a href="/x.html" title="約旦河西岸地區" id="Palestine">約旦河西岸地區</a></td>' +
      '<td data-title="國家地區">約旦河西岸地區 The West Bank</td>' +
      '<td data-title="最新警示分級"><span class="square redblock"></span>第四級：紅色儘速離境</td></tr>';
    const GAZA_TR =
      '<tr><td data-title="國家"><a href="/x.html" title="加薩走廊" id="Palestine">加薩走廊</a></td>' +
      '<td data-title="國家地區">加薩走廊</td>' +
      '<td data-title="最新警示分級"><span class="square redblock"></span>第四級：紅色儘速離境</td></tr>';
    const rows = parseTwListingRows(TABLE(WEST_BANK_TR + GAZA_TR));
    assert.equal(resolveTwCountryLevel(rows), 4);
  });

  it('all-regional rows with no bare/catch-all entry and DIFFERING levels resolve to null -- never guessed', () => {
    const rows = parseTwListingRows(
      TABLE(
        '<tr><td data-title="國家"><a href="/x.html" title="X" id="Test">測試 Test</a></td>' +
          '<td data-title="國家地區">測試北部邊境地區</td>' +
          '<td data-title="最新警示分級"><span class="square redblock"></span>第四級</td></tr>' +
          '<tr><td data-title="國家"><a href="/x.html" title="X" id="Test">測試 Test</a></td>' +
          '<td data-title="國家地區">測試南部邊境地區</td>' +
          '<td data-title="最新警示分級"><span class="square orangeblock"></span>第三級</td></tr>',
      ),
    );
    assert.equal(resolveTwCountryLevel(rows), null);
  });

  it('a row with an unrecognized colour class is excluded, never guessed', () => {
    const rows = parseTwListingRows(
      TABLE(
        '<tr><td data-title="國家"><a href="/x.html" title="X" id="Test">測試</a></td>' +
          '<td data-title="國家地區">測試</td>' +
          '<td data-title="最新警示分級"><span class="square purpleblock"></span>?</td></tr>',
      ),
    );
    assert.equal(rows[0].level, null);
    assert.equal(resolveTwCountryLevel(rows), null);
  });
});
