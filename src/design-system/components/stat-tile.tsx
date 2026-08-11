import { StyleSheet, View } from 'react-native';

import { colors, radii, space } from '../theme';
import { AppText } from './app-text';

/**
 * One labelled figure in a box: the three macro tiles under the target, the
 * average and the difference on a week.
 *
 * The whole tile is announced as a single phrase, because "protein" and "121
 * grams" read as two unrelated fragments when a screen reader meets them
 * separately.
 */

export type StatTileTone = 'neutral' | 'protein' | 'carbs' | 'fat' | 'positive' | 'over';

export type StatTileProps = {
  /** The uppercase mono label above the figure. */
  readonly label: string;
  /** The figure, already formatted. This component does no formatting. */
  readonly value: string;
  /** The unit, set small beside the figure. */
  readonly unit?: string;
  readonly tone?: StatTileTone;
  /**
   * What a screen reader says instead of the drawn label and figure. Use it
   * whenever the seen text is an abbreviation rather than a sentence.
   */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
};

type Tone = { readonly accent: string; readonly wash: string; readonly figure: string };

const tones: Readonly<Record<StatTileTone, Tone>> = {
  neutral: { accent: colors.textDim, wash: colors.wash.neutral, figure: colors.text },
  protein: { accent: colors.macros.protein, wash: colors.wash.green, figure: colors.text },
  carbs: { accent: colors.macros.carbs, wash: colors.wash.violet, figure: colors.text },
  fat: { accent: colors.macros.fat, wash: colors.wash.coral, figure: colors.text },
  positive: { accent: colors.green, wash: colors.wash.green, figure: colors.green },
  over: { accent: colors.amber, wash: colors.wash.amber, figure: colors.amber },
};

export const StatTile = ({
  label,
  value,
  unit,
  tone = 'neutral',
  accessibilityLabel,
  testID,
}: StatTileProps) => {
  const resolved = tones[tone];
  const spoken = accessibilityLabel ?? `${label}, ${value}${unit === undefined ? '' : ` ${unit}`}`;

  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={[styles.tile, { backgroundColor: resolved.wash }]}
      testID={testID}>
      <AppText variant="kicker" color={resolved.accent} uppercase>
        {label}
      </AppText>
      <View style={styles.figure}>
        <AppText variant="h2" color={resolved.figure}>
          {value}
        </AppText>
        {unit === undefined ? undefined : (
          <AppText variant="caption" color={colors.textMuted}>
            {unit}
          </AppText>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    gap: space[1],
    paddingVertical: space[3],
    paddingHorizontal: space[3],
    borderRadius: radii.md,
  },
  figure: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space[1],
  },
});
