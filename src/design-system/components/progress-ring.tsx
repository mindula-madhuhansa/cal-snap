import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors, gradients, space } from '../theme';

/**
 * The ring the day is read from.
 *
 * One arc, drawn from the top clockwise, filled with the brand gradient. The
 * figure at its centre is passed in rather than composed here, because the
 * ring is a shape and the number inside it is a `NumberText` with its own
 * honesty rules to keep.
 *
 * **The arc is decorative.** It repeats a figure that is already on screen in
 * words, so it is hidden from a screen reader; the announcement belongs to
 * whatever is rendered as `children`. A ring that announced itself as well
 * would say the same number twice.
 */

export type ProgressRingProps = {
  /** How far round the arc goes, as a fraction. Values outside 0 to 1 are clamped. */
  readonly progress: number;
  /** The ring's outer diameter, in points. */
  readonly size?: number;
  /** How thick the arc is drawn. */
  readonly thickness?: number;
  /** The figure and its label, drawn at the centre. */
  readonly children?: ReactNode;
  readonly testID?: string;
};

/**
 * The design's ring geometry. Snapped to the space scale so the component
 * carries no loose numbers: 224 across with a 12 point stroke on the Today and
 * result screens.
 */
const DEFAULT_SIZE = space[8] * 7;
const DEFAULT_THICKNESS = space[3];

/** Clamped, so a day well over target still draws a full ring rather than wrapping. */
const clamp = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 1);
};

export const ProgressRing = ({
  progress,
  size = DEFAULT_SIZE,
  thickness = DEFAULT_THICKNESS,
  children,
  testID,
}: ProgressRingProps) => {
  const fraction = clamp(progress);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const centre = size / 2;

  return (
    <View style={[styles.ring, { width: size, height: size }]} testID={testID}>
      <Svg
        width={size}
        height={size}
        // The arc restates a number the centre already gives in words.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Defs>
          <LinearGradient id="ringBrand" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={gradients.brandReversed[0]} />
            <Stop offset="1" stopColor={gradients.brandReversed[1]} />
          </LinearGradient>
        </Defs>

        {/* The track the arc runs in, so an empty ring still reads as a ring. */}
        <Circle
          cx={centre}
          cy={centre}
          r={radius}
          stroke={colors.border}
          strokeWidth={thickness}
          fill="none"
        />

        <Circle
          cx={centre}
          cy={centre}
          r={radius}
          stroke="url(#ringBrand)"
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          // Starts the arc at twelve o'clock rather than at three, which is
          // where SVG puts zero degrees. Set as the three separate props
          // rather than as a `transform` string, which react-native-svg parses
          // inconsistently across platforms.
          rotation={-90}
          originX={centre}
          originY={centre}
        />
      </Svg>

      <View style={styles.centre} pointerEvents="box-none">
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
  },
});
