/**
 * Variant to style, as a pure function.
 *
 * Kept out of the component so it can be tested without a phone, and so the
 * colour role rule is checkable in one place: a label is never set in a value
 * below 4.5:1 on the ground it lands on, and a control's boundary is never
 * `border` (1.25 on the ground), which is a decorative rule and not an edge a
 * person can find.
 *
 * The primary action is the design's one gradient. It is signalled here with a
 * flag rather than with a colour, because a gradient is not something a style
 * object can hold; the component reads the flag and draws the stops from
 * `gradients.brand`.
 */

import { colors, radii, space } from '../theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export type ButtonVariantStyle = {
  /** The label colour. */
  readonly text: string;
  /** The border colour. `transparent` where the variant draws no boundary. */
  readonly border: string;
  /** The background, which is where the pressed tint lands. */
  readonly background: string;
  /** Whether the component should fill this button with the brand gradient. */
  readonly gradient: boolean;
  readonly paddingHorizontal: number;
  readonly borderRadius: number;
};

export const buttonVariantStyle = (
  variant: ButtonVariant,
  pressed: boolean,
): ButtonVariantStyle => {
  const shared = { borderRadius: radii.full, paddingHorizontal: space[6] } as const;

  switch (variant) {
    case 'primary':
      return {
        ...shared,
        // The ground itself, on cyan through violet. Worst point is the violet
        // end at 5.88:1.
        text: colors.textOnAccent,
        border: 'transparent',
        // Sits under the gradient, so it only shows while pressed, when the
        // component drops the gradient's opacity.
        background: 'transparent',
        gradient: true,
      };
    case 'secondary':
      return {
        ...shared,
        text: colors.text,
        border: colors.borderStrong,
        background: pressed ? colors.pressed.surface : colors.surface,
        gradient: false,
      };
    case 'ghost':
      return {
        ...shared,
        text: colors.cyan,
        border: 'transparent',
        background: pressed ? colors.pressed.ghost : 'transparent',
        gradient: false,
        paddingHorizontal: space[3],
      };
    case 'danger':
      return {
        ...shared,
        text: colors.red,
        border: 'transparent',
        background: pressed ? colors.wash.red : 'transparent',
        gradient: false,
      };
  }
};

/** How far a disabled button fades. */
export const DISABLED_OPACITY = 0.4;

/** How far the gradient fades while the primary action is held down. */
export const PRESSED_GRADIENT_OPACITY = 0.75;
