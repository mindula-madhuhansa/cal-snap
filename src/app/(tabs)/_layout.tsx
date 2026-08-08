import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet } from 'react-native';

import { colors, fonts, minTouchTarget, space, type } from '@/design-system/theme';

/**
 * The tab bar. Routing is file based, so adding a file in this directory adds
 * a tab (spec 0001, AC-3).
 *
 * The JavaScript tab bar is used rather than the native one because the
 * Classical design's bar is hairline and typographic, and a native bar cannot
 * be made to look like it. The finished bar, with the design's icons, is
 * scope feature 4's job; this is the plain themed version it replaces.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.divider,
          borderTopWidth: StyleSheet.hairlineWidth,
          minHeight: minTouchTarget + space[3],
        },
        tabBarLabelStyle: {
          fontFamily: fonts.headingSemiBold,
          fontSize: type.h6.fontSize,
          letterSpacing: type.h6.letterSpacing,
        },
        tabBarIconStyle: { display: 'none' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
