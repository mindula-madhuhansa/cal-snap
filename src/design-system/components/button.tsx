import { Pressable, StyleSheet, View } from 'react-native';

import { minTouchTarget, radii, space } from '../theme';
import { AppText } from './app-text';
import { DISABLED_OPACITY, buttonVariantStyle, type ButtonVariant } from './button-variant';
import { Icon, type IconName } from './icon';

/**
 * The app's button (spec 0003, AC-3, AC-5, AC-6).
 *
 * Every word it shows arrives as a prop, and it is never shorter than the
 * touch target floor, so a screen cannot produce one that is hard to hit.
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

      return (
        <View style={styles.row}>
          {icon === undefined ? undefined : <Icon name={icon} size="sm" color={resolved.text} />}
          <AppText variant="h5" color={resolved.text} align="center">
            {label}
          </AppText>
        </View>
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
    borderRadius: radii.md,
  },
  block: {
    minHeight: minTouchTarget + space[1],
    paddingVertical: space[3],
  },
  fullWidth: {
    width: '100%',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
});
