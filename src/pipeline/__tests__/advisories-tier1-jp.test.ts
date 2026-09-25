import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseJpKikenLevel } from '../fetchers/advisories-tier1.js';

/**
 * Regression coverage for the 2026-09-25 JP (MOFA) follow-up fix
 * (team-lead review of the SK/DE source-repair work): parseJpKikenLevel used
 * to return Level 1 both when a country genuinely has no hazard advisory
 * AND when the #kikendetail div exists but no recognized kiken_level_* class
 * could be found inside it — collapsing "couldn't parse" into "safe" is the
 * same false "no contraindications" failure mode the SK/DE repairs exist to
 * remove. It must now return null (never guess) for the second case; the
 * caller (fetchJpAdvisories) skips the country entirely on null, the same
 * way it already skips on a failed fetch.
 */

describe('parseJpKikenLevel (JP/MOFA hazard-level scoping)', () => {
  it('no #kikendetail div at all -> Level 1 (genuinely no advisory published, e.g. USA/FRA/GBR)', () => {
    const html = '<html><body><div id="somethingElse">no hazard info here</div></body></html>';
    assert.equal(parseJpKikenLevel(html), 1);
  });

  it('#kikendetail present with a single kiken_level_taihi (Level 4) region -> 4', () => {
    const html =
      '<div id="kikendetail"><div class="kiken_levels"><div class="kiken_level_base kiken_level_taihi">退避してください</div></div></div>';
    assert.equal(parseJpKikenLevel(html), 4);
  });

  it('#kikendetail present with multiple regions -> takes the MAX across them (kentou=2 and enki=3 -> 3)', () => {
    const html =
      '<div id="kikendetail">' +
      '<div class="kiken_levels"><div class="kiken_level_base kiken_level_kentou">検討してください</div></div>' +
      '<div class="kiken_levels"><div class="kiken_level_base kiken_level_enki">延期してください</div></div>' +
      '</div>';
    assert.equal(parseJpKikenLevel(html), 3);
  });

  it('#kikendetail present but with NO recognized kiken_level_* class inside -> null, NOT Level 1 (this is the bug fix: MOFA published a hazard block we failed to parse, e.g. a markup change or an unknown class name)', () => {
    const html =
      '<div id="kikendetail"><div class="kiken_levels"><p>some future markup we do not recognize</p></div></div>';
    assert.equal(parseJpKikenLevel(html), null);
  });

  it('#kikendetail present but genuinely empty (no regional blocks at all) -> null, NOT Level 1', () => {
    const html = '<div id="kikendetail"></div>';
    assert.equal(parseJpKikenLevel(html), null);
  });

  it('a kiken_level_* class OUTSIDE #kikendetail (elsewhere on the page) is not picked up — the window closes at the first triple </div> after the div opens', () => {
    const html =
      '<div id="kikendetail"><div class="kiken_levels"><div class="kiken_level_base kiken_level_chuui">十分注意してください</div></div></div>' +
      '<div id="unrelated-section"><span class="kiken_level_taihi">this must not leak in</span></div>';
    assert.equal(parseJpKikenLevel(html), 1);
  });
});
