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
 * things it has to be able to report.
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
    color: colors.textMuted,
    textAlign: 'center',
  },
});
