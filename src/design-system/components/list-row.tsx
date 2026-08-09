import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouchTarget, space } from '../theme';
import { AppText } from './app-text';

/**
 * The row the app is mostly made of (spec 0003, AC-3, AC-5).
 *
 * The day's record, search results, activities, and settings are all this
 * component. It is a plain row when there is no `onPress`, and a real button
 * to a screen reader when there is.
 */

export type ListRowProps = {
  readonly title: string;
  readonly subtitle?: string;
  /** A thumbnail or mark at the start of the row. */
  readonly leading?: ReactNode;
  /** A figure or mark at the end. Usually a `NumberText`. */
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  /** Extra context for a screen reader, when title and subtitle are not enough. */
  readonly accessibilityHint?: string;
  /** Hides the bottom rule, for the last row in a group. */
  readonly last?: boolean;
  readonly testID?: string;
};

export const ListRow = ({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  accessibilityHint,
  last = false,
  testID,
}: ListRowProps) => {
  const content = (
    <>
      {leading === undefined ? undefined : <View style={styles.leading}>{leading}</View>}
      <View style={styles.text}>
        <AppText variant="h4" numberOfLines={1}>
          {title}
        </AppText>
        {subtitle === undefined ? undefined : (
          <AppText variant="caption" color={colors.textSubtle} numberOfLines={2}>
            {subtitle}
          </AppText>
        )}
      </View>
      {trailing === undefined ? undefined : <View style={styles.trailing}>{trailing}</View>}
    </>
  );

  if (onPress === undefined) {
    return (
      <View style={[styles.row, last ? undefined : styles.ruled]} testID={testID}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      // Read as one thing rather than as three loose fragments.
      accessibilityLabel={subtitle === undefined ? title : `${title}, ${subtitle}`}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        last ? undefined : styles.ruled,
        pressed ? { backgroundColor: colors.pressed.neutral } : undefined,
      ]}>
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[3],
    // The whole row is the target, so it clears the floor without hit slop.
    minHeight: minTouchTarget,
  },
  ruled: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  leading: {
    justifyContent: 'center',
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
