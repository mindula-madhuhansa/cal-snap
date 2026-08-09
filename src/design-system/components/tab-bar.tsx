import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouchTarget, space } from '../theme';
import { AppText } from './app-text';

/**
 * The tab bar (spec 0003, AC-10).
 *
 * Typographic rather than iconographic: the design marks the current tab with
 * a gold hairline above its label, not with a filled glyph. Every tab takes an
 * equal share of the width, so a fourth one costs nothing to add.
 *
 * It lives here rather than in the route file because `src/app/**` is not
 * allowed to import React Native's `Text` or `Pressable` directly; the route
 * file hands this component to the navigator instead.
 */

export const TabBar = ({ state, descriptors, navigation, insets }: BottomTabBarProps) => (
  <View style={[styles.bar, { paddingBottom: insets.bottom + space[2] }]}>
    {state.routes.map((route, index) => {
      const descriptor = descriptors[route.key];
      const focused = state.index === index;
      const label = descriptor?.options.title ?? route.name;

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
          {/* The mark for the current tab. Always rendered, so switching tabs
              never changes the height of the bar. */}
          <View style={[styles.rule, focused ? styles.ruleActive : undefined]} />
          <AppText variant="h5" color={focused ? colors.accentText : colors.textSubtle}>
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
    borderTopColor: colors.divider,
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
  rule: {
    height: StyleSheet.hairlineWidth,
    width: space[8],
    backgroundColor: 'transparent',
  },
  ruleActive: {
    backgroundColor: colors.accent,
  },
});
