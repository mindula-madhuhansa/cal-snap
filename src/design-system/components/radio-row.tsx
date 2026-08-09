import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '../haptics';
import { colors, minTouchTarget, radii, space } from '../theme';
import { AppText } from './app-text';

/**
 * One choice on its own line (spec 0003, AC-3, AC-5, AC-11, AC-12).
 *
 * The design uses these for the longer onboarding questions, where a
 * segmented strip would squeeze the labels. The dot is drawn small, as
 * designed; the row around it is the target.
 */

/**
 * `.radio .dot`. The canvas draws it at 15 across; the space scale is 4.6
 * apart, so it snaps to `space[3]` (13.8) rather than carrying a loose number,
 * and the filled centre is a step and a half inside that.
 */
const DOT_SIZE = space[3];
const DOT_FILL = space[1] * 1.5;

export type RadioRowProps = {
  readonly label: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
  /** A figure or mark at the end of the row. */
  readonly trailing?: ReactNode;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly last?: boolean;
  readonly testID?: string;
};

export const RadioRow = ({
  label,
  selected,
  onSelect,
  trailing,
  accessibilityLabel,
  accessibilityHint,
  last = false,
  testID,
}: RadioRowProps) => (
  <Pressable
    onPress={() => {
      if (!selected) {
        haptics.selection();
        onSelect();
      }
    }}
    accessibilityRole="radio"
    accessibilityState={{ selected, checked: selected }}
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    testID={testID}
    style={({ pressed }) => [
      styles.row,
      last ? undefined : styles.ruled,
      pressed ? { backgroundColor: colors.pressed.neutral } : undefined,
    ]}>
    {/* A ring with a filled centre, which is what the CSS's inset shadow
        draws. Two views, because React Native cannot put two rings on one. */}
    <View style={styles.dot}>{selected ? <View style={styles.dotFill} /> : undefined}</View>
    <AppText variant="bodySmall">{label}</AppText>
    {trailing === undefined ? undefined : <View style={styles.trailing}>{trailing}</View>}
  </Pressable>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[3],
    // The whole row is tappable and already clears the floor, so the small dot
    // needs no hit slop of its own.
    minHeight: minTouchTarget,
  },
  ruled: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    // A control's boundary owes 3:1, which is exactly what `accent` gives.
    borderColor: colors.accent,
  },
  dotFill: {
    width: DOT_FILL,
    height: DOT_FILL,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  trailing: {
    marginLeft: 'auto',
  },
});
