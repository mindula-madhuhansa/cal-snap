import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '../theme';

/**
 * The ground every screen stands on.
 *
 * Owns the dark ground, the indigo haze the design paints behind the top of
 * every screen, the gutter, the scroll container, and the safe area. The top
 * inset is applied as content padding rather than as a margin on the
 * container, which is what lets content scroll up under the status bar the way
 * the design draws it, while still starting below the notch.
 */

export type ScreenProps = {
  readonly children: ReactNode;
  /** Scrolls by default. Turn it off for a screen that must fill exactly one page. */
  readonly scroll?: boolean;
  /** The side gutter. Turn it off for content that runs edge to edge. */
  readonly gutter?: boolean;
  /**
   * The haze behind the top of the screen. On by default, because every screen
   * in the design carries it; off for a screen that draws its own ground, like
   * the camera.
   */
  readonly glow?: boolean;
  readonly testID?: string;
};

/**
 * How far down the screen the haze reaches. The design fades it out about a
 * third of the way, well before any content it would tint.
 */
const GLOW_HEIGHT = '38%';

/** Decorative, and behind everything: a screen reader walks straight past it. */
const Glow = () => (
  <LinearGradient
    colors={[colors.glow.top, colors.glow.fade]}
    style={styles.glow}
    pointerEvents="none"
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  />
);

export const Screen = ({
  children,
  scroll = true,
  gutter = true,
  glow = true,
  testID,
}: ScreenProps) => {
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: insets.top + space[6],
    paddingBottom: insets.bottom + space[8],
    paddingHorizontal: gutter ? space[4] : 0,
  };

  if (!scroll) {
    return (
      <View style={styles.screen} testID={testID}>
        {glow ? <Glow /> : undefined}
        <View style={[styles.content, styles.fill, padding]}>{children}</View>
      </View>
    );
  }

  return (
    <View style={styles.screen} testID={testID}>
      {glow ? <Glow /> : undefined}
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.content, padding]}
        // The design's headings are large, so a bounce that reveals bare
        // ground under them would break the haze.
        contentInsetAdjustmentBehavior="never"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
  },
  glow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: GLOW_HEIGHT,
  },
  content: {
    gap: space[3],
  },
});
