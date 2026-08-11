import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/design-system/theme';

type StartupNoticeProps = {
  readonly title: string;
  readonly detail: string;
};

/**
 * Shown when the app cannot start: fonts that would not load, a database that
 * would not open. `AGENTS.md` asks that every failure a person can hit says
 * something honest, so this names what went wrong rather than hanging on a
 * splash screen forever.
 *
 * It deliberately uses no custom font, because a font failure is one of the
 * things it has to be able to report. That is also why it is the one screen
 * built from React Native's `Text` rather than from `AppText`: going through
 * the design system would apply a font family this screen cannot rely on.
 */
export const StartupNotice = ({ title, detail }: StartupNoticeProps) => (
  <View style={styles.container}>
    <Text accessibilityRole="header" style={styles.title}>
      {title}
    </Text>
    <Text style={styles.detail}>{detail}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[3],
    padding: space[6],
    backgroundColor: colors.bg,
  },
  title: {
    fontSize: type.h3.fontSize,
    lineHeight: type.h3.lineHeight,
    color: colors.text,
    textAlign: 'center',
  },
  detail: {
    fontSize: type.body.fontSize,
    lineHeight: type.body.lineHeight,
    // `textMuted` (7.20 on the ground), not `textDim` (3.83): this is 15
    // point body, so it owes 4.5:1, and of all the screens in the app this is
    // the one that has to stay readable.
    color: colors.textMuted,
    textAlign: 'center',
  },
});
