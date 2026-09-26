import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { scoreToColor, readableTextColor, badgeColors } from '../colors.js';

// Independent (not shared with the implementation) WCAG contrast helpers, so
// these tests actually verify the math rather than just re-running it.
function parseRgb(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
    ];
  }
  const parts = color.match(/\d+/g);
  if (!parts || parts.length < 3) throw new Error(`Unparseable color: ${color}`);
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(colorA: string, colorB: string): number {
  const l1 = relLuminance(parseRgb(colorA));
  const l2 = relLuminance(parseRgb(colorB));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// --- COLOR-01: readableTextColor always picks the higher-contrast option ---

describe('COLOR-01: readableTextColor picks whichever of white/#1c1917 has more contrast', () => {
  it('picks dark text for the level-4 advisory red (#ef4444) -- white only reaches 3.76:1', () => {
    const fg = readableTextColor('#ef4444');
    assert.equal(fg, '#1c1917');
    assert.ok(contrastRatio(fg, '#ef4444') >= 4.5, 'must clear AA for small text');
  });

  it('picks dark text for the moderate-band yellow (#d4b83c)', () => {
    assert.equal(readableTextColor('#d4b83c'), '#1c1917');
  });

  it('picks white text for the danger red anchor (#9e3a2a)', () => {
    assert.equal(readableTextColor('#9e3a2a'), '#ffffff');
  });

  it('picks the higher-contrast (still imperfect) option for the safe blue anchor (#4a7fbf) -- neither reaches 4.5:1 (4.13 white / 4.23 dark), this is exactly badgeColors\' dead zone', () => {
    assert.equal(readableTextColor('#4a7fbf'), '#1c1917');
  });
});

// --- COLOR-02: badgeColors guarantees AA for every small score chip ---

describe('COLOR-02: badgeColors(score) reaches >=4.5:1 across the whole 1.0-10.0 range', () => {
  it('every 0.1 step from 1.0 to 10.0 passes 4.5:1 between bg and fg', () => {
    const failures: string[] = [];
    for (let s = 1.0; s <= 10.0 + 1e-9; s += 0.1) {
      const score = Math.round(s * 10) / 10; // avoid float drift (1.0+0.1+0.1... )
      const { bg, fg } = badgeColors(score);
      const ratio = contrastRatio(bg, fg);
      if (ratio < 4.5) {
        failures.push(`score=${score} bg=${bg} fg=${fg} ratio=${ratio.toFixed(3)}`);
      }
    }
    assert.equal(
      failures.length,
      0,
      `${failures.length} score(s) failed AA (4.5:1):\n${failures.join('\n')}`
    );
  });

  it('does not touch the background when the original gradient colour already passes (score=1, deep danger red)', () => {
    const { bg } = badgeColors(1);
    assert.equal(bg.replace(/\s/g, ''), scoreToColor(1).startsWith('#') ? `rgb(${parseRgb(scoreToColor(1)).join(',')})` : scoreToColor(1).replace(/\s/g, ''));
  });

  it('does not touch the background when the original gradient colour already passes (score=6.5, moderate yellow anchor -- dark text already reaches 8.9:1)', () => {
    const { bg } = badgeColors(6.5);
    const original = scoreToColor(6.5);
    assert.equal(parseRgb(bg).join(','), parseRgb(original).join(','));
  });

  it('the safe blue anchor itself is inside the dead zone (score>=8.7, including the clamped 8.9-10 tail) and also needs darkening', () => {
    const original = scoreToColor(10);
    const originalWorstRatio = Math.max(
      contrastRatio(original, '#ffffff'),
      contrastRatio(original, '#1c1917')
    );
    assert.ok(originalWorstRatio < 4.5, 'fixture assumption: SAFE_HEX itself must fail both text options');

    const { bg, fg } = badgeColors(10);
    assert.notEqual(parseRgb(bg).join(','), parseRgb(original).join(','));
    assert.ok(contrastRatio(bg, fg) >= 4.5);
  });

  it('darkens the background for a score in the known dead zone (~4.7-4.8), where the unmodified gradient fails both white and dark text', () => {
    const original = scoreToColor(4.76);
    const originalWorstRatio = Math.max(
      contrastRatio(original, '#ffffff'),
      contrastRatio(original, '#1c1917')
    );
    assert.ok(originalWorstRatio < 4.5, 'fixture assumption: the unmodified gradient must actually fail here');

    const { bg, fg } = badgeColors(4.76);
    assert.notEqual(parseRgb(bg).join(','), parseRgb(original).join(','), 'background must have been darkened');
    assert.ok(contrastRatio(bg, fg) >= 4.5);
  });

  it('always returns white as fg once it had to darken the background (darkening only ever helps white, never dark text)', () => {
    const { bg, fg } = badgeColors(4.76);
    assert.equal(fg, '#ffffff');
    assert.ok(contrastRatio(bg, '#ffffff') >= 4.5);
  });
});
