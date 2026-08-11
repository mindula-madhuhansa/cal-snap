import { describe, expect, it } from 'vitest';

import { colors } from '../theme';
import { tagToneStyle, type TagTone } from './tag-tone';

const ALL_TONES: readonly TagTone[] = [
  'accent',
  'accent2',
  'neutral',
  'outline',
  'success',
  'warning',
];

const FILLED_TONES: readonly TagTone[] = ['accent', 'accent2', 'neutral', 'success', 'warning'];

describe('tagToneStyle', () => {
  // A tag is set in the 10 point mono step, which is well under the 20 point
  // line, so it owes the full 4.5:1 and `textDim` (3.83) cannot carry it.
  it('never sets tag text in the value that misses the small-text floor', () => {
    for (const tone of ALL_TONES) {
      expect(tagToneStyle(tone).text).not.toBe(colors.textDim);
    }
  });

  it('gives every tone all three parts of its style', () => {
    for (const tone of ALL_TONES) {
      const style = tagToneStyle(tone);

      expect(style.background.length).toBeGreaterThan(0);
      expect(style.text.length).toBeGreaterThan(0);
      expect(style.border.length).toBeGreaterThan(0);
    }
  });

  // Each filled tone sets its own hue on a wash of that same hue. Because the
  // wash is nearly transparent, the pair measures within a hair of the hue's
  // ratio on the ground itself, which is 4.82:1 at worst.
  it('pairs each filled tone’s words with a wash of the same hue', () => {
    expect(tagToneStyle('accent')).toMatchObject({
      background: colors.wash.cyan,
      text: colors.cyan,
    });
    expect(tagToneStyle('accent2')).toMatchObject({
      background: colors.wash.violet,
      text: colors.violet,
    });
    expect(tagToneStyle('success')).toMatchObject({
      background: colors.wash.green,
      text: colors.green,
    });
    expect(tagToneStyle('warning')).toMatchObject({
      background: colors.wash.amber,
      text: colors.amber,
    });
    expect(tagToneStyle('neutral')).toMatchObject({
      background: colors.wash.neutral,
      text: colors.textMuted,
    });
  });

  // The outline tone has no fill, so its border is the only thing separating
  // it from whatever is behind it. It may never be the decorative rule colour.
  it('bounds the outline tone in the strong edge, never the decorative one', () => {
    expect(tagToneStyle('outline')).toEqual({
      background: 'transparent',
      text: colors.textMuted,
      border: colors.borderStrong,
    });
  });

  it('leaves every filled tone unbordered', () => {
    for (const tone of FILLED_TONES) {
      expect(tagToneStyle(tone).border).toBe('transparent');
    }
  });
});
