import { View } from 'react-native';

import { AppText } from '@/design-system/components/app-text';
import { Card } from '@/design-system/components/card';
import { Divider } from '@/design-system/components/divider';
import { ListRow } from '@/design-system/components/list-row';
import { Screen } from '@/design-system/components/screen';
import { colors } from '@/design-system/theme';

/**
 * The second tab proves that adding a file here adds a tab (spec 0001, AC-3),
 * and is now built from the design system like every other screen (spec 0003).
 *
 * The real settings screen arrives with the features that need it: the daily
 * target (feature 6), the account (feature 5), privacy and account deletion
 * (feature 10). Until then it says so plainly rather than showing controls
 * that do nothing.
 */

/** What will live here, listed so the screen reads as a plan rather than a gap. */
const COMING = [
  { key: 'target', title: 'Your daily target', subtitle: 'Arrives with onboarding' },
  { key: 'account', title: 'Account and sign in', subtitle: 'Arrives with cloud sync' },
  { key: 'privacy', title: 'Privacy, terms and deletion', subtitle: 'Arrives before release' },
] as const;

export default function SettingsScreen() {
  return (
    <Screen>
      <AppText variant="h1" heading>
        Settings
      </AppText>

      <Card title="Nothing to change yet">
        <AppText variant="bodySmall" color={colors.textSubtle}>
          There is no account, no target, and no data to manage until those features are built.
          Anything you could set here would be pretending.
        </AppText>
      </Card>

      <Divider />

      <AppText variant="kicker" color={colors.accentText} uppercase>
        Coming here
      </AppText>

      <View>
        {COMING.map((row, index) => (
          <ListRow
            key={row.key}
            title={row.title}
            subtitle={row.subtitle}
            last={index === COMING.length - 1}
          />
        ))}
      </View>
    </Screen>
  );
}
