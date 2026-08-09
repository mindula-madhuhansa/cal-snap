import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, shadows, space } from '../theme';
import { AppText } from './app-text';

/**
 * A bordered block (spec 0003, AC-5).
 *
 * The design carries grouping with a hairline and a transparent ground rather
 * than with a raised white panel, so `elevation` is here for the rare case
 * that needs lifting off the page and stays `none` almost everywhere.
 */

export type CardElevation = 'none' | 'sm' | 'md' | 'lg';

export type CardProps = {
  readonly children: ReactNode;
  /** The small gold eyebrow above the title. */
  readonly kicker?: string;
  readonly title?: string;
  readonly elevation?: CardElevation;
  readonly testID?: string;
};

export const Card = ({ children, kicker, title, elevation = 'none', testID }: CardProps) => (
  <View
    style={[styles.card, elevation === 'none' ? undefined : shadows[elevation]]}
    testID={testID}>
    {kicker === undefined ? undefined : (
      // 10 point gold, so it is `accentText` rather than `accent`: the
      // brighter gold does not clear the floor at this size.
      <AppText variant="kicker" color={colors.accentText} uppercase>
        {kicker}
      </AppText>
    )}
    {title === undefined ? undefined : (
      <AppText variant="h4" heading>
        {title}
      </AppText>
    )}
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    // `.card`: transparent ground, hairline border, `--space-3` padding.
    gap: space[2],
    padding: space[3],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
    backgroundColor: 'transparent',
  },
});
