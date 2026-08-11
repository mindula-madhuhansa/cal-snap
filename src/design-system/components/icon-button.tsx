import { Pressable, StyleSheet } from 'react-native';

import { colors, minTouchTarget, radii, space } from '../theme';
import { DISABLED_OPACITY } from './button-variant';
import { Icon, type IconName } from './icon';

/**
 * A square control with a mark and no words: the way back at the top of a
 * question, and anything else the design draws as a glyph alone.
 *
 * **`label` is required and is never drawn.** A control with no visible words
 * is invisible to a screen reader unless it is named, and a glyph is not a
 * name. This is the one component where the label exists purely to be heard.
 */

export type IconButtonProps = {
  readonly icon: IconName;
  /** What this does, in words. Not drawn; spoken. */
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly accessibilityHint?: string;
  readonly testID?: string;
};

/** Square, and already past the touch target floor, so it needs no hit slop. */
const SIZE = minTouchTarget;

export const IconButton = ({
  icon,
  label,
  onPress,
  disabled = false,
  accessibilityHint,
  testID,
}: IconButtonProps) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ disabled }}
    testID={testID}
    style={({ pressed }) => [
      styles.button,
      { opacity: disabled ? DISABLED_OPACITY : 1 },
      pressed && !disabled ? { backgroundColor: colors.pressed.surface } : undefined,
    ]}>
    <Icon name={icon} size="md" color={colors.text} />
  </Pressable>
);

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    // A control's boundary owes 3:1, so never the decorative `border`.
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: space[2],
  },
});
