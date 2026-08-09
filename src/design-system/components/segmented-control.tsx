import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '../haptics';
import { colors, minTouchTarget, radii, space } from '../theme';
import { AppText } from './app-text';

/**
 * A row of exclusive choices (spec 0003, AC-3, AC-5, AC-11, AC-12).
 *
 * The design's `.seg`: one bordered strip, hairlines between the options, and
 * a gold inset ring around the chosen one. The ring is drawn inside the option
 * rather than as an outer border so nothing shifts when the choice moves.
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
    style={[styles.strip, { borderColor: invalid ? colors.intents.failure.mark : colors.accent }]}
    testID={testID}>
    {options.map((option, index) => {
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
            index === 0 ? undefined : styles.divided,
            selected ? styles.selected : undefined,
            pressed && !selected ? { backgroundColor: colors.pressed.neutral } : undefined,
          ]}>
          <AppText
            variant="bodySmall"
            color={selected ? colors.accentText : colors.text}
            align="center">
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
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    // Each option is a full target in its own right, so no hit slop is handed
    // out and neighbouring options cannot steal each other's taps.
    minHeight: minTouchTarget,
    paddingHorizontal: space[2],
    paddingVertical: space[2],
  },
  divided: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.accent,
  },
  selected: {
    // `.seg-opt:has(input:checked) { box-shadow: inset 0 0 0 1px accent }`,
    // drawn as an inner border so the strip's outline never moves.
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accent,
    borderRadius: radii.sm,
  },
});
