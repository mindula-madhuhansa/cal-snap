import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { gradients, minTouchTarget, shadows, space } from '../theme';
import { AppText } from './app-text';
import {
  DISABLED_OPACITY,
  PRESSED_GRADIENT_OPACITY,
  buttonVariantStyle,
  type ButtonVariant,
} from './button-variant';
import { Icon, type IconName } from './icon';

/**
 * The app's button.
 *
 * Every word it shows arrives as a prop, and it is never shorter than the
 * touch target floor, so a screen cannot produce one that is hard to hit.
 *
 * The primary variant is filled with the brand gradient, which React Native
 * cannot express as a background colour, so it is drawn as an absolutely
 * positioned layer under the label rather than as a style. Everything else
 * about the two paths is identical.
 */

export type ButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  /** `block` is the design's full width action at the foot of a screen. */
  readonly size?: 'regular' | 'block';
  readonly fullWidth?: boolean;
  readonly disabled?: boolean;
  /** A mark before the label. Decorative: the label already says what it does. */
  readonly icon?: IconName;
  /** A mark after the label, for a row that reads as "label ›". */
  readonly trailingIcon?: IconName;
  /** Extra context for a screen reader, when the label alone is not enough. */
  readonly accessibilityHint?: string;
  readonly testID?: string;
};

export const Button = ({
  label,
  onPress,
  variant = 'primary',
  size = 'regular',
  fullWidth = false,
  disabled = false,
  icon,
  trailingIcon,
  accessibilityHint,
  testID,
}: ButtonProps) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled }}
    testID={testID}
    style={({ pressed }) => {
      const resolved = buttonVariantStyle(variant, pressed && !disabled);

      return [
        styles.button,
        size === 'block' ? styles.block : undefined,
        fullWidth ? styles.fullWidth : undefined,
        // The bloom under the primary action, and nothing else.
        resolved.gradient && !disabled ? shadows.glow : undefined,
        {
          borderColor: resolved.border,
          backgroundColor: resolved.background,
          borderRadius: resolved.borderRadius,
          paddingHorizontal: resolved.paddingHorizontal,
          opacity: disabled ? DISABLED_OPACITY : 1,
        },
      ];
    }}>
    {({ pressed }) => {
      const resolved = buttonVariantStyle(variant, pressed && !disabled);
      const held = pressed && !disabled;

      return (
        <>
          {resolved.gradient ? (
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                StyleSheet.absoluteFill,
                styles.gradient,
                { borderRadius: resolved.borderRadius },
                held ? { opacity: PRESSED_GRADIENT_OPACITY } : undefined,
              ]}
            />
          ) : undefined}
          <View style={styles.row}>
            {icon === undefined ? undefined : <Icon name={icon} size="sm" color={resolved.text} />}
            <AppText variant="h5" color={resolved.text} align="center">
              {label}
            </AppText>
            {trailingIcon === undefined ? undefined : (
              <Icon name={trailingIcon} size="sm" color={resolved.text} />
            )}
          </View>
        </>
      );
    }}
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    // The floor, not a drawn height: a button is always at least this tall, so
    // it never needs hit slop of its own.
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[2],
    borderWidth: StyleSheet.hairlineWidth,
    // Keeps the gradient layer inside the pill on Android, which does not clip
    // an absolutely positioned child to its parent's radius on its own.
    overflow: 'hidden',
  },
  block: {
    minHeight: minTouchTarget + space[2],
    paddingVertical: space[3],
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    // Decorative fill. The label above it is what a screen reader reads.
    zIndex: -1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
});
