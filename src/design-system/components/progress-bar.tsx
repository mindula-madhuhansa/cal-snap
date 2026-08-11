import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors, gradients, radii, space } from '../theme';

/**
 * A horizontal fill: the macro bars, the level bar, the confidence line.
 *
 * `tone` picks what the fill is drawn in. `brand` is the gradient, and every
 * other tone is one flat hue, because a macro bar has to be told apart from
 * the two beside it at a glance rather than read.
 *
 * The bar is decorative by default: it restates a figure the row beside it
 * already gives in words. Pass `accessibilityLabel` only when the bar is the
 * **only** place the value appears, in which case it announces itself as a
 * progress bar with a spoken value.
 */

export type ProgressBarTone = 'brand' | 'protein' | 'carbs' | 'fat' | 'neutral' | 'over';

export type ProgressBarProps = {
  /** How full the bar is, as a fraction. Values outside 0 to 1 are clamped. */
  readonly progress: number;
  readonly tone?: ProgressBarTone;
  /** How thick the bar is drawn. */
  readonly thickness?: number;
  /**
   * What a screen reader should say. Omit it for a bar that sits beside its own
   * figure, which is the usual case: the figure already says it.
   */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
};

const DEFAULT_THICKNESS = space[2];

const toneFills: Readonly<Record<Exclude<ProgressBarTone, 'brand'>, string>> = {
  protein: colors.macros.protein,
  carbs: colors.macros.carbs,
  fat: colors.macros.fat,
  neutral: colors.textDim,
  over: colors.amber,
};

const clamp = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
};

export const ProgressBar = ({
  progress,
  tone = 'brand',
  thickness = DEFAULT_THICKNESS,
  accessibilityLabel,
  testID,
}: ProgressBarProps) => {
  const fraction = clamp(progress);
  const decorative = accessibilityLabel === undefined;

  // Percent rather than flex, so a bar at zero draws nothing at all instead of
  // the hairline a `flex: 0` child can still round up to.
  const fill = { width: `${fraction * 100}%` } as const;

  return (
    <View
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'progressbar'}
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={decorative ? undefined : { min: 0, max: 100, now: fraction * 100 }}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
      style={[styles.track, { height: thickness, borderRadius: thickness }]}
      testID={testID}>
      {tone === 'brand' ? (
        <LinearGradient
          colors={gradients.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fill, fill, { borderRadius: thickness }]}
        />
      ) : (
        <View
          style={[styles.fill, fill, { borderRadius: thickness, backgroundColor: toneFills[tone] }]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: colors.border,
    borderRadius: radii.full,
  },
  fill: {
    height: '100%',
  },
});
