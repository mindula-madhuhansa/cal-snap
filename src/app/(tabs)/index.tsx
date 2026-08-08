import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { env } from '@/config/env';
import { latestVersion } from '@/db/migrations';
import { colors, radii, space, type } from '@/design-system/theme';

/**
 * The scaffold's sample screen (spec 0001, AC-4): built only from theme
 * values, so it proves the Classical fonts, colours, and spacing are really
 * loaded on both platforms.
 *
 * The real Today screen is scope feature 9. This one deliberately shows no
 * calorie numbers at all: `AGENTS.md` asks that health numbers are never
 * presented as fact when they are not, and invented ones would be exactly
 * that.
 */
export default function TodayScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space[8] }]}>
      <Text style={styles.kicker}>CalSnap</Text>
      <Text accessibilityRole="header" style={styles.title}>
        The scaffold is standing
      </Text>
      <Text style={styles.body}>
        Everything below is read from the design tokens, so if it looks right, the theme is really
        loaded. The Today screen itself comes later.
      </Text>

      <View style={styles.rule} />

      <View style={styles.rows}>
        <StatusRow label="Configuration" value={env.appEnv} />
        <StatusRow label="Local database" value={`schema version ${latestVersion}`} />
        <StatusRow label="Next up" value="Design system & UI foundation" />
      </View>

      <View style={styles.rule} />

      <Text style={styles.caption}>
        Add a file to `src/app/(tabs)` and it becomes a tab. Nothing here is product yet.
      </Text>
    </ScrollView>
  );
}

type StatusRowProps = {
  readonly label: string;
  readonly value: string;
};

const StatusRow = ({ label, value }: StatusRowProps) => (
  <View accessible accessibilityLabel={`${label}: ${value}`} style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: space[6],
    paddingBottom: space[8],
    gap: space[3],
  },
  kicker: {
    ...type.kicker,
    color: colors.accent,
    textTransform: 'uppercase',
  },
  title: {
    ...type.h1,
    color: colors.text,
  },
  body: {
    ...type.body,
    color: colors.textMuted,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginVertical: space[4],
  },
  rows: {
    gap: space[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
  rowLabel: {
    ...type.bodySmall,
    color: colors.textSubtle,
    flexShrink: 1,
  },
  rowValue: {
    ...type.h5,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  caption: {
    ...type.caption,
    color: colors.textMuted,
    borderRadius: radii.sm,
  },
});
