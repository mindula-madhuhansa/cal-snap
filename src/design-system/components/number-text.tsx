import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { scaleTypeStep } from '../scale-type-step';
import { colors, space, type } from '../theme';

/**
 * Every health number a person reads.
 *
 * Two jobs beyond looking right. First, tabular figures: a calorie total that
 * ticks up must not shuffle sideways as its digits change. Second, honesty: an
 * estimate is marked as an estimate both on screen and out loud, and this is
 * the only way the system says it.
 */

/** The steps a figure may be set at. Numbers always use the heading face. */
export type NumberSize = 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5';

/** Where the unit sits relative to the figure. */
export type NumberLayout = 'inline' | 'stacked';

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
  /**
   * `stacked` puts the unit under the figure as an uppercase mono label, which
   * is how the design draws the one number a screen is built around.
   */
  readonly layout?: NumberLayout;
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
  layout = 'inline',
  color = colors.text,
  testID,
}: NumberTextProps) => {
  const { fontScale } = useWindowDimensions();
  const figureStep = scaleTypeStep(type[size], fontScale);
  const unitStep = scaleTypeStep(layout === 'stacked' ? type.kicker : type.caption, fontScale);

  // Derived from what is on screen rather than passed in beside it, so the two
  // cannot drift apart as a screen is edited.
  const base = spoken ?? `${value} ${unit}`;
  const label = estimated ? `${base}, ${ESTIMATE_SPOKEN}` : base;

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={layout === 'stacked' ? styles.column : styles.row}
      testID={testID}>
      <Text allowFontScaling={false} style={[figureStep, styles.figure, { color }]}>
        {estimated ? `${ESTIMATE_PREFIX}${value}` : value}
      </Text>
      <Text
        allowFontScaling={false}
        style={[unitStep, styles.unit, layout === 'stacked' ? styles.unitStacked : undefined]}>
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
  column: {
    alignItems: 'center',
    gap: space[1],
  },
  figure: {
    // A column of figures must not shift as its digits change.
    fontVariant: ['tabular-nums'],
  },
  unit: {
    color: colors.textMuted,
  },
  unitStacked: {
    color: colors.textDim,
    textTransform: 'uppercase',
  },
});
