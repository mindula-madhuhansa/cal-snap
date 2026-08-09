import { describe, expect, it } from 'vitest';

import { colors } from '../theme';
import { tagToneStyle, type TagTone } from './tag-tone';

const ALL_TONES: readonly TagTone[] = ['accent', 'accent2', 'neutral', 'outline'];

describe('tagToneStyle', () => {
  // covers: AC-2. A tag is 11 point, which is well under the 24 point line, so
  // it owes the full 4.5:1 and the brighter gold cannot carry it.
  it('never sets tag text in the brighter gold', () => {
    for (const tone of ALL_TONES) {
      expect(tagToneStyle(tone).text).not.toBe(colors.accent);
    }
  });

  // covers: AC-2. The filled tones pair the 800 step on the 100 step, which
  // measures 9.30:1.
  it('pairs the filled tones on one shared step of their ramps', () => {
    expect(tagToneStyle('accent')).toMatchObject({
      background: colors.accentRamp[100],
      text: colors.accentRamp[800],
    });
    expect(tagToneStyle('accent2')).toMatchObject({
      background: colors.accent2Ramp[100],
      text: colors.accent2Ramp[800],
    });
    expect(tagToneStyle('neutral')).toMatchObject({
      background: colors.neutral[100],
      text: colors.neutral[800],
    });
  });

  // covers: AC-2. The one tone where a border and its text take different
  // golds, because a border owes 3:1 and text owes 4.5:1.
  it('borders the outline tone in gold and sets its words in the deeper gold', () => {
    expect(tagToneStyle('outline')).toEqual({
      background: 'transparent',
      text: colors.accentText,
      border: colors.accent,
    });
  });

  it('leaves the filled tones unbordered', () => {
    expect(tagToneStyle('accent').border).toBe('transparent');
    expect(tagToneStyle('accent2').border).toBe('transparent');
    expect(tagToneStyle('neutral').border).toBe('transparent');
  });
});
