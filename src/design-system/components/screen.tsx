import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space } from '../theme';

/**
 * The ground every screen stands on (spec 0003, AC-5, AC-14).
 *
 * Owns the paper background, the gutter, the scroll container, and the safe
 * area. The top inset is applied as content padding rather than as a margin on
 * the container, which is what lets content scroll up under the status bar the
 * way the design draws it, while still starting below the notch.
 */

export type ScreenProps = {
  readonly children: ReactNode;
  /** Scrolls by default. Turn it off for a screen that must fill exactly one page. */
  readonly scroll?: boolean;
  /** The side gutter. Turn it off for content that runs edge to edge. */
  readonly gutter?: boolean;
  readonly testID?: string;
};

export const Screen = ({ children, scroll = true, gutter = true, testID }: ScreenProps) => {
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: insets.top + space[8],
    paddingBottom: insets.bottom + space[8],
    paddingHorizontal: gutter ? space[6] : 0,
  };

  if (!scroll) {
    return (
      <View style={[styles.screen, styles.content, padding]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, padding]}
      // The design's headings are large, so a bounce that reveals bare white
      // under them would break the paper ground.
      contentInsetAdjustmentBehavior="never"
      keyboardShouldPersistTaps="handled"
      testID={testID}>
      {children}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    gap: space[3],
  },
});
