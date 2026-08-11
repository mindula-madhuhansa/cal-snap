import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '../haptics';
import { colors, minTouchTarget, radii, space } from '../theme';
import { AppText } from './app-text';
import { Icon } from './icon';

/**
 * One choice, drawn as a card.
 *
 * The design uses these for the longer questions, where a segmented strip
 * would squeeze the labels. Each option is its own bordered block: a mark on
 * the left, the choice and its detail in the middle, and room at the end for a
 * figure.
 *
 * The chosen one is signalled three ways at once, not by hue alone: a cyan
 * edge, a tinted ground, and a tick in the mark. That is what keeps it legible
 * to someone who cannot separate cyan from the border it replaces.
 */

export type RadioRowProps = {
  readonly label: string;
  /** The detail line under the label. Set in the mono data step. */
  readonly subtitle?: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
  /** A figure or mark at the end of the row. */
  readonly trailing?: ReactNode;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
};

/** The mark on the left: a ring, or a filled disc with a tick once chosen. */
const MARK_SIZE = space[6];

export const RadioRow = ({
  label,
  subtitle,
  selected,
  onSelect,
  trailing,
  accessibilityLabel,
  accessibilityHint,
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
      selected ? styles.rowSelected : undefined,
      pressed && !selected ? { backgroundColor: colors.pressed.surface } : undefined,
    ]}>
    <View style={[styles.mark, selected ? styles.markSelected : undefined]}>
      {selected ? <Icon name="check" size="sm" color={colors.textOnAccent} /> : undefined}
    </View>

    <View style={styles.text}>
      <AppText variant="h5">{label}</AppText>
      {subtitle === undefined ? undefined : (
        <AppText variant="data" color={colors.textMuted}>
          {subtitle}
        </AppText>
      )}
    </View>

    {trailing === undefined ? undefined : <View style={styles.trailing}>{trailing}</View>}
  </Pressable>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    padding: space[3],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    // A control's boundary owes 3:1, so never the decorative `border`.
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    // The whole card is the target, so the small mark needs no hit slop.
    minHeight: minTouchTarget,
  },
  rowSelected: {
    borderColor: colors.cyan,
    backgroundColor: colors.wash.cyan,
  },
  mark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  markSelected: {
    borderColor: colors.cyan,
    backgroundColor: colors.cyan,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: space[1],
  },
  trailing: {
    alignItems: 'flex-end',
  },
});
