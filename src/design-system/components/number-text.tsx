import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { scaleTypeStep } from '../scale-type-step';
import { colors, space, type } from '../theme';

/**
 * Every health number a person reads (spec 0003, AC-7, AC-8).
 *
 * Two jobs beyond looking right. First, tabular figures: a calorie total that
 * ticks up must not shuffle sideways as its digits change. Second, honesty: an
 * estimate is marked as an estimate both on screen and out loud, and this is
 * the only way the system says it.
 */

/** The heading steps a figure may be set at. Numbers always use the heading face. */
export type NumberSize = 'h1' | 'h2' | 'h3' | 'h4' | 'h5';

export type NumberTextProps = {
  /** The figure, already formatted for display. This component does no formatting. */
  readonly value: string;
  /** The unit, shown beside the figure and spoken after it. */
  readonly unit: string;
  /** Overrides the spoken label, for when the default reads badly aloud. */
  readonly spoken?: string;
  /** Marks the figure as an estimate rather than a measured fact. */
  readonly estimated?: boolean;
  readonly size?: NumberSize;
  readonly color?: string;
  readonly testID?: string;
};

/**
 * The one marking for an estimate. Shown as the approximately sign, spoken as
 * the word, because a screen reader announces the glyph inconsistently or not
 * at all, and a number a person acts on must not lose its caveat on the way to
 * their ear.
 */
const ESTIMATE_PREFIX = '≈';
const ESTIMATE_SPOKEN = 'estimated';

export const NumberText = ({
  value,
  unit,
  spoken,
  estimated = false,
  size = 'h4',
  color = colors.text,
  testID,
}: NumberTextProps) => {
  const { fontScale } = useWindowDimensions();
  const figureStep = scaleTypeStep(type[size], fontScale);
  const unitStep = scaleTypeStep(type.kicker, fontScale);

  // Derived from what is on screen rather than passed in beside it, so the two
  // cannot drift apart as a screen is edited.
  const base = spoken ?? `${value} ${unit}`;
  const label = estimated ? `${base}, ${ESTIMATE_SPOKEN}` : base;

  return (
    <View accessible accessibilityLabel={label} style={styles.row} testID={testID}>
      <Text allowFontScaling={false} style={[figureStep, styles.figure, { color }]}>
        {estimated ? `${ESTIMATE_PREFIX}${value}` : value}
      </Text>
      <Text allowFontScaling={false} style={[unitStep, styles.unit]}>
        {unit}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[1],
  },
  figure: {
    // A column of figures must not shift as its digits change.
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textSubtle,
    textTransform: 'uppercase',
  },
});
