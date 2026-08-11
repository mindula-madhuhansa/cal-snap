import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouchTarget, radii, space } from '../theme';
import { AppText } from './app-text';
import { Icon, type IconName } from './icon';

/**
 * The tab bar.
 *
 * A mark over an uppercase mono label, with the current tab lit in cyan on a
 * tinted pill. Every tab takes an equal share of the width, so a third and a
 * fourth cost nothing to add.
 *
 * The current tab is signalled by the pill and by the mark's weight as well as
 * by colour, and the platform is told which one is selected, so the state does
 * not rest on hue alone.
 *
 * It lives here rather than in the route file because `src/app/**` is not
 * allowed to import React Native's `Text` or `Pressable` directly; the route
 * file hands this component to the navigator instead.
 */

/**
 * The mark for each route, by file name. A route with no entry here shows its
 * label alone rather than a wrong glyph.
 */
const marks: Readonly<Record<string, IconName>> = {
  index: 'today',
  scan: 'camera',
  settings: 'account',
};

export const TabBar = ({ state, descriptors, navigation, insets }: BottomTabBarProps) => (
  <View style={[styles.bar, { paddingBottom: insets.bottom + space[2] }]}>
    {state.routes.map((route, index) => {
      const descriptor = descriptors[route.key];
      const focused = state.index === index;
      const label = descriptor?.options.title ?? route.name;
      const mark = marks[route.name];

      const onPress = () => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });

        if (!focused && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      };

      return (
        <Pressable
          key={route.key}
          onPress={onPress}
          accessibilityRole="tab"
          accessibilityState={{ selected: focused }}
          accessibilityLabel={label}
          style={styles.tab}>
          <View style={[styles.pill, focused ? styles.pillActive : undefined]}>
            {mark === undefined ? undefined : (
              <Icon name={mark} size="md" color={focused ? colors.cyan : colors.textDim} />
            )}
          </View>
          <AppText variant="kicker" uppercase color={focused ? colors.cyan : colors.textDim}>
            {label}
          </AppText>
        </Pressable>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: space[2],
    paddingHorizontal: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: space[1],
    // The label alone is short, so the target is grown to the floor here
    // rather than with hit slop, which neighbouring tabs would overlap.
    minHeight: minTouchTarget,
    paddingTop: space[1],
  },
  pill: {
    paddingVertical: space[1],
    paddingHorizontal: space[4],
    borderRadius: radii.full,
    backgroundColor: 'transparent',
  },
  pillActive: {
    backgroundColor: colors.wash.cyan,
  },
});
