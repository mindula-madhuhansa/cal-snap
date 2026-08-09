import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/design-system/components/tab-bar';

/**
 * The tab bar. Routing is file based, so adding a file in this directory adds
 * a tab (spec 0001, AC-3), and the bar lays a fourth one out without any
 * change here (spec 0003, AC-10).
 *
 * The JavaScript tab bar is used rather than the native one because the
 * Classical design's bar is hairline and typographic, and a native bar cannot
 * be made to look like it. The drawing itself lives in the design system, so
 * this file stays routing and nothing else.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
