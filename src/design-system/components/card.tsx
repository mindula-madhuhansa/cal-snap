import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, shadows, space } from '../theme';
import { AppText } from './app-text';

/**
 * A filled block.
 *
 * The design carries grouping with a raised surface and a soft edge rather
 * than with a hairline on bare ground, so a card is a real panel here. `tone`
 * picks which ground it sits on; `elevation` is for the rare card that has to
 * float above the rest.
 */

export type CardElevation = 'none' | 'sm' | 'md' | 'lg';

/**
 * `surface` is the ordinary card. `raised` is a card inside a card. `outline`
 * draws an edge over the ground with no fill, for a block that groups without
 * claiming weight.
 */
export type CardTone = 'surface' | 'raised' | 'outline';

export type CardProps = {
  readonly children: ReactNode;
  /** The small uppercase mono eyebrow above the title. */
  readonly kicker?: string;
  readonly title?: string;
  readonly tone?: CardTone;
  readonly elevation?: CardElevation;
  /** Runs edge to edge inside the card, for a card that holds its own rows. */
  readonly flush?: boolean;
  readonly testID?: string;
};

const toneStyles: Readonly<Record<CardTone, { backgroundColor: string; borderColor: string }>> = {
  surface: { backgroundColor: colors.surface, borderColor: colors.border },
  raised: { backgroundColor: colors.surfaceRaised, borderColor: colors.borderStrong },
  outline: { backgroundColor: 'transparent', borderColor: colors.borderStrong },
};

export const Card = ({
  children,
  kicker,
  title,
  tone = 'surface',
  elevation = 'none',
  flush = false,
  testID,
}: CardProps) => (
  <View
    style={[
      styles.card,
      toneStyles[tone],
      flush ? styles.flush : undefined,
      elevation === 'none' ? undefined : shadows[elevation],
    ]}
    testID={testID}>
    {kicker === undefined ? undefined : (
      <AppText variant="kicker" color={colors.textDim} uppercase>
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
    gap: space[2],
    padding: space[4],
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  flush: {
    paddingVertical: space[1],
    paddingHorizontal: space[4],
  },
});
