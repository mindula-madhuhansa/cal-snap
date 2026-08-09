/**
 * Tone to colour pair, as a pure function (spec 0003, AC-16, AC-2).
 *
 * The three filled tones set their 800 ramp step on their 100 step, which
 * measures 9.30:1 and clears the floor comfortably. The outline tone is the
 * one that needs watching: its border may be `accent`, because a border only
 * owes 3:1, but its text may not, because text owes 4.5:1 at this size. It
 * gets `accentText` instead.
 */

import { colors } from '../theme';

export type TagTone = 'accent' | 'accent2' | 'neutral' | 'outline';

export type TagToneStyle = {
  readonly background: string;
  readonly text: string;
  readonly border: string;
};

export const tagToneStyle = (tone: TagTone): TagToneStyle => {
  switch (tone) {
    case 'accent':
      return {
        background: colors.accentRamp[100],
        text: colors.accentRamp[800],
        border: 'transparent',
      };
    case 'accent2':
      return {
        background: colors.accent2Ramp[100],
        text: colors.accent2Ramp[800],
        border: 'transparent',
      };
    case 'neutral':
      return {
        background: colors.neutral[100],
        text: colors.neutral[800],
        border: 'transparent',
      };
    case 'outline':
      return {
        background: 'transparent',
        text: colors.accentText,
        border: colors.accent,
      };
  }
};
