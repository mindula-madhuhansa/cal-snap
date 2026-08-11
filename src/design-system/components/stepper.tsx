import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '../haptics';
import { colors, radii, space } from '../theme';
import { AppText } from './app-text';
import { DISABLED_OPACITY } from './button-variant';
import { Icon } from './icon';

/**
 * Minus and plus around a value.
 *
 * One strip: two square buttons on the surface colour with the figure held
 * between them, matching the portion control the design draws. Each button is
 * a full touch target in its own right, so nothing here needs hit slop, and
 * the gap between them is what stops a tap landing on the wrong one.
 */

/** The two buttons, square and on the space scale. */
const BUTTON_SIZE = space[8] + space[3];

export type StepperProps = {
  readonly value: number;
  readonly onChange: (value: number) => void;
  readonly min?: number;
  readonly max?: number;
  /** Turns the value into what a person reads. The stepper does no formatting. */
  readonly format: (value: number) => string;
  /** How far one press moves the value. */
  readonly step?: number;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
};

export const Stepper = ({
  value,
  onChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  format,
  step = 1,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: StepperProps) => {
  const text = format(value);
  const canDecrease = value - step >= min;
  const canIncrease = value + step <= max;

  const move = (next: number) => {
    haptics.change();
    onChange(next);
  };

  return (
    <View
      // Read as one control with one value, rather than as two loose buttons
      // and a number that belongs to neither.
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityValue={{ text }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'increment' && canIncrease) {
          move(value + step);
        }

        if (event.nativeEvent.actionName === 'decrement' && canDecrease) {
          move(value - step);
        }
      }}
      style={styles.stepper}
      testID={testID}>
      <StepButton
        icon="minus"
        disabled={!canDecrease}
        onPress={() => move(value - step)}
        testID={testID === undefined ? undefined : `${testID}-decrement`}
      />
      <View style={styles.value}>
        <AppText variant="h3" align="center" numberOfLines={1}>
          {text}
        </AppText>
      </View>
      <StepButton
        icon="plus"
        disabled={!canIncrease}
        onPress={() => move(value + step)}
        testID={testID === undefined ? undefined : `${testID}-increment`}
      />
    </View>
  );
};

type StepButtonProps = {
  readonly icon: 'minus' | 'plus';
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly testID?: string;
};

const StepButton = ({ icon, disabled, onPress, testID }: StepButtonProps) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    // The two buttons are the parent's accessibility actions, so a screen
    // reader should not also meet them as separate elements.
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    testID={testID}
    style={({ pressed }) => [
      styles.button,
      { opacity: disabled ? DISABLED_OPACITY : 1 },
      pressed && !disabled ? { backgroundColor: colors.pressed.accent } : undefined,
    ]}>
    <Icon name={icon} size="md" color={colors.cyan} />
  </Pressable>
);

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    padding: space[1],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    backgroundColor: colors.wash.cyan,
  },
  value: {
    flex: 1,
  },
});
