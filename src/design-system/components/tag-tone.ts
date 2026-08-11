/**
 * Tone to colour pair, as a pure function.
 *
 * Every filled tone sets its own hue on a 12% wash of itself over the ground.
 * Because the hue is the text and the wash is nearly transparent, the pair
 * measures within a hair of that hue's ratio on the ground itself, which is
 * 4.82:1 at the worst (violet on the raised surface) and clears the floor for
 * the caption step a tag is set in.
 *
 * `outline` is the one to watch: it has no fill, so its border is doing the
 * work of separating it from whatever is behind it. Its border is therefore
 * `borderStrong` at minimum and a hue wherever the tone has one, never the
 * decorative `border`.
 */

import { colors } from '../theme';

export type TagTone = 'accent' | 'accent2' | 'neutral' | 'outline' | 'success' | 'warning';

export type TagToneStyle = {
  readonly background: string;
  readonly text: string;
  readonly border: string;
};

export const tagToneStyle = (tone: TagTone): TagToneStyle => {
  switch (tone) {
    case 'accent':
      return { background: colors.wash.cyan, text: colors.cyan, border: 'transparent' };
    case 'accent2':
      return { background: colors.wash.violet, text: colors.violet, border: 'transparent' };
    case 'neutral':
      return { background: colors.wash.neutral, text: colors.textMuted, border: 'transparent' };
    case 'success':
      return { background: colors.wash.green, text: colors.green, border: 'transparent' };
    case 'warning':
      return { background: colors.wash.amber, text: colors.amber, border: 'transparent' };
    case 'outline':
      return { background: 'transparent', text: colors.textMuted, border: colors.borderStrong };
  }
};
