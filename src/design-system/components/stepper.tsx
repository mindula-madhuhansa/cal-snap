import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '../haptics';
import { withMinTouchTarget } from '../min-touch-target';
import { colors, radii, space } from '../theme';
import { AppText } from './app-text';
import { DISABLED_OPACITY } from './button-variant';
import { Icon } from './icon';

/**
 * Minus and plus around a value (spec 0003, AC-3, AC-5, AC-11).
 *
 * This is the component the touch target rule was written for. The design
 * draws the two buttons small, and they stay small; `withMinTouchTarget` grows
 * what a finger can hit without changing what the eye sees.
 */

/**
 * The canvas draws these 30 by 28. Snapped to the space scale, which is what
 * keeps the system free of loose numbers, they come out a fraction wider and
 * within half a point of the drawing.
 */
const BUTTON_WIDTH = space[6] + space[1];
const BUTTON_HEIGHT = space[6];

const hitSlop = withMinTouchTarget(BUTTON_WIDTH, BUTTON_HEIGHT);

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
        <AppText variant="h5" align="center">
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
    hitSlop={hitSlop}
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
    <Icon name={icon} size="md" color={colors.accentText} />
  </Pressable>
);

const styles = StyleSheet.create({
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    // The two grown hit areas meet exactly at the value between them, so this
    // gap is what stops a tap landing on the wrong one.
    gap: space[2],
  },
  button: {
    width: BUTTON_WIDTH,
    height: BUTTON_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    borderRadius: radii.md,
  },
  value: {
    minWidth: space[8],
  },
});
