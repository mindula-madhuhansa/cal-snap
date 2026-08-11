import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/design-system/components/tab-bar';

/**
 * The tab bar. Routing is file based, so adding a file in this directory adds
 * a tab (spec 0001, AC-3), and the bar lays a third and fourth one out without
 * any change here. A new tab needs a mark adding to `marks` in
 * `@/design-system/components/tab-bar`, or it shows its label alone.
 *
 * The JavaScript tab bar is used rather than the native one because the
 * design's bar is a tinted pill under a mark on a dark ground, and a native
 * bar cannot be made to look like it. The drawing itself lives in the design
 * system, so this file stays routing and nothing else.
 */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="settings" options={{ title: 'You' }} />
    </Tabs>
  );
}
