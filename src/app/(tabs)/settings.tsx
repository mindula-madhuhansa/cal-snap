import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space, type } from '@/design-system/theme';

/**
 * The second tab exists to prove that adding a file here adds a tab (spec
 * 0001, AC-3). The real settings screen arrives with the features that need
 * it: the daily target (feature 6), privacy and account deletion (feature 10).
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space[8] }]}>
      <Text accessibilityRole="header" style={styles.title}>
        Settings
      </Text>
      <Text style={styles.body}>
        Nothing to change yet. Your target, your account, and privacy live here once those features
        are built.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: space[6],
    gap: space[3],
  },
  title: {
    ...type.h2,
    color: colors.text,
  },
  body: {
    ...type.body,
    color: colors.textMuted,
  },
});
