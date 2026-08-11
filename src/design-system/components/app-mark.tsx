import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { colors, gradients, radii, space } from '../theme';

/**
 * The app's mark: a rounded gradient tile with an open ring cut into it.
 *
 * A lens, drawn plainly. It is the one piece of decoration in the design, so
 * it is hidden from a screen reader entirely; the screen it sits on always
 * says the app's name in words underneath.
 */

export type AppMarkProps = {
  /** The tile's side, in points. */
  readonly size?: number;
  readonly testID?: string;
};

const DEFAULT_SIZE = space[8] * 2.5;

/** The ring inside the tile, as fractions of the tile. */
const RING_RATIO = 0.44;
const RING_STROKE_RATIO = 0.055;

export const AppMark = ({ size = DEFAULT_SIZE, testID }: AppMarkProps) => {
  const ring = size * RING_RATIO;
  const stroke = Math.max(size * RING_STROKE_RATIO, StyleSheet.hairlineWidth);

  return (
    <LinearGradient
      colors={gradients.brand}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.tile, { width: size, height: size, borderRadius: size / 4 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID={testID}>
      <View
        style={{
          width: ring,
          height: ring,
          borderRadius: radii.full,
          borderWidth: stroke,
          borderColor: colors.bg,
        }}
      />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
