/**
 * Variant to style, as a pure function (spec 0003, AC-16).
 *
 * Kept out of the component so it can be tested without a phone, and so the
 * colour role rule is checkable in one place: a button's label is never
 * `accent` (3.02 against paper, below the 4.5 floor for small text) and its
 * border is never `divider` (1.38, below the 3 floor for a control's visible
 * boundary). Primary reads as gold because its border is gold; its words are
 * the deeper `accentText`.
 */

import { colors, radii, space } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export type ButtonVariantStyle = {
  /** The label colour. */
  readonly text: string;
  /** The border colour. `transparent` where the variant draws no boundary. */
  readonly border: string;
  /** The background, which is where the pressed tint lands. */
  readonly background: string;
  readonly paddingHorizontal: number;
  readonly borderRadius: number;
};

/** `.btn` padding: `var(--space-2) calc(var(--space-3) * 1.2)`. */
const HORIZONTAL_PADDING = Math.round(space[3] * 1.2 * 100) / 100;

export const buttonVariantStyle = (
  variant: ButtonVariant,
  pressed: boolean,
): ButtonVariantStyle => {
  const shared = { borderRadius: radii.md, paddingHorizontal: HORIZONTAL_PADDING } as const;

  switch (variant) {
    case 'primary':
      return {
        ...shared,
        text: colors.accentText,
        border: colors.accent,
        background: pressed ? colors.pressed.accent : 'transparent',
      };
    case 'secondary':
      return {
        ...shared,
        text: colors.text,
        // The CSS draws this in `divider`, which does not clear the 3:1 floor
        // a control's boundary needs. `accent` is the value the role rule
        // permits for a control border, and it keeps the hairline feel.
        border: colors.accent,
        background: pressed ? colors.pressed.neutral : 'transparent',
      };
    case 'ghost':
      return {
        ...shared,
        text: colors.accentText,
        border: 'transparent',
        // `.btn-ghost` pulls its side padding in to `--space-1`.
        paddingHorizontal: space[1],
        background: pressed ? colors.pressed.ghost : 'transparent',
      };
  }
};

/** `.btn:disabled { opacity: 0.45 }`. */
export const DISABLED_OPACITY = 0.45;
