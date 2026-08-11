import { StyleSheet, View } from 'react-native';

import { colors, radii, space } from '../theme';
import { AppText } from './app-text';

/**
 * A short ordered list with the position drawn in a tinted chip: what happens
 * next, on the way in.
 *
 * Each row is announced as one phrase including its position, because "1" and
 * the sentence beside it read as two unrelated fragments otherwise.
 */

export type NumberedListProps = {
  /** The steps, in order. The position shown is the index plus one. */
  readonly items: readonly string[];
  readonly testID?: string;
};

/** The chips cycle through the palette in order, so no two neighbours match. */
const chipTints = [
  { wash: colors.wash.cyan, text: colors.cyan },
  { wash: colors.wash.violet, text: colors.violet },
  { wash: colors.wash.green, text: colors.green },
] as const;

export const NumberedList = ({ items, testID }: NumberedListProps) => (
  <View style={styles.list} testID={testID}>
    {items.map((item, index) => {
      const tint = chipTints[index % chipTints.length] ?? chipTints[0];

      return (
        <View
          key={item}
          accessible
          accessibilityLabel={`Step ${index + 1}. ${item}`}
          style={styles.row}>
          <View style={[styles.chip, { backgroundColor: tint.wash }]}>
            <AppText variant="kicker" color={tint.text}>
              {String(index + 1)}
            </AppText>
          </View>
          <View style={styles.text}>
            <AppText variant="bodySmall" color={colors.textMuted}>
              {item}
            </AppText>
          </View>
        </View>
      );
    })}
  </View>
);

const CHIP_SIZE = space[6];

const styles = StyleSheet.create({
  list: {
    gap: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  chip: {
    width: CHIP_SIZE,
    height: CHIP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
});
