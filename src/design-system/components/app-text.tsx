import type { ReactNode } from 'react';
import { Text, useWindowDimensions } from 'react-native';

import { scaleTypeStep } from '../scale-type-step';
import { colors, type TypeVariant, type } from '../theme';

/**
 * The only text primitive in the app (spec 0003, AC-4, AC-6).
 *
 * Screens never import `Text` from React Native; ESLint stops them. Going
 * through here is what guarantees three things at once: the type step comes
 * from the scale, the system font size setting is applied exactly once, and
 * the colour comes from a token rather than from a hex somebody typed.
 *
 * There is deliberately no `style` prop. A screen that could pass one could
 * invent a measurement, and AC-14 says no component contains an invented
 * number. Anything a screen genuinely needs arrives as a named prop instead.
 */

export type AppTextProps = {
  /** Which step of the type scale. Defaults to body copy. */
  readonly variant?: TypeVariant;
  /** A colour token. Must clear the contrast floor for the variant's size. */
  readonly color?: string;
  readonly children: ReactNode;
  /** Uppercase, for the eyebrow steps (`h6`, `kicker`) the design sets that way. */
  readonly uppercase?: boolean;
  readonly align?: 'left' | 'center' | 'right';
  readonly numberOfLines?: number;
  /** Marks this as a heading for a screen reader. */
  readonly heading?: boolean;
  /** Overrides what a screen reader says, when the visible text reads badly aloud. */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
};

export const AppText = ({
  variant = 'body',
  color = colors.text,
  children,
  uppercase = false,
  align,
  numberOfLines,
  heading = false,
  accessibilityLabel,
  testID,
}: AppTextProps) => {
  const { fontScale } = useWindowDimensions();
  const step = scaleTypeStep(type[variant], fontScale);

  return (
    <Text
      // Scaling happens once, in `scaleTypeStep`. Letting the platform scale on
      // top of that would compound the two and blow past the cap.
      allowFontScaling={false}
      accessibilityRole={heading ? 'header' : undefined}
      accessibilityLabel={accessibilityLabel}
      numberOfLines={numberOfLines}
      testID={testID}
      style={[
        step,
        { color },
        uppercase ? { textTransform: 'uppercase' } : undefined,
        align === undefined ? undefined : { textAlign: align },
      ]}>
      {children}
    </Text>
  );
};
