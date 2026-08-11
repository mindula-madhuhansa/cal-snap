import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '../haptics';
import { colors, minTouchTarget, radii, space } from '../theme';
import { AppText } from './app-text';

/**
 * A row of exclusive choices.
 *
 * One rounded strip on the surface colour, with the chosen option drawn as a
 * filled cyan pill inside it. The pill sits inside the option rather than
 * around it, so nothing shifts as the choice moves.
 *
 * The chosen option is filled, not merely tinted, so the difference is a shape
 * as well as a hue.
 */

export type SegmentedOption = {
  readonly value: string;
  readonly label: string;
};

export type SegmentedControlProps = {
  readonly options: readonly SegmentedOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly invalid?: boolean;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
};

export const SegmentedControl = ({
  options,
  value,
  onChange,
  invalid = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: SegmentedControlProps) => (
  <View
    accessibilityRole="radiogroup"
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    style={[
      styles.strip,
      { borderColor: invalid ? colors.intents.failure.mark : colors.borderStrong },
    ]}
    testID={testID}>
    {options.map((option) => {
      const selected = option.value === value;

      return (
        <Pressable
          key={option.value}
          onPress={() => {
            if (!selected) {
              haptics.selection();
              onChange(option.value);
            }
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected, checked: selected }}
          accessibilityLabel={option.label}
          style={({ pressed }) => [
            styles.option,
            selected ? styles.selected : undefined,
            pressed && !selected ? { backgroundColor: colors.pressed.neutral } : undefined,
          ]}>
          <AppText
            variant="h5"
            color={selected ? colors.textOnAccent : colors.textMuted}
            align="center"
            numberOfLines={1}>
            {option.label}
          </AppText>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    gap: space[1],
    padding: space[1],
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Each option is a full target in its own right, so no hit slop is handed
    // out and neighbouring options cannot steal each other's taps.
    minHeight: minTouchTarget - space[2],
    paddingHorizontal: space[2],
    paddingVertical: space[2],
    borderRadius: radii.full,
  },
  selected: {
    backgroundColor: colors.cyan,
  },
});
