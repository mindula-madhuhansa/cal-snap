import { useAuth, useUser } from '@clerk/expo';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useAccount, useDraining } from '@/account/session';
import { signOutSafely } from '@/account/sign-out';
import { createSupabaseClient } from '@/account/supabase';
import { createSupabaseTransport } from '@/account/supabase-transport';
import { asSqlDatabase } from '@/db/client';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Divider } from '@/design-system/components/divider';
import { ListRow } from '@/design-system/components/list-row';
import { Screen } from '@/design-system/components/screen';
import { colors } from '@/design-system/theme';

/**
 * Settings, which for now is the account (spec 0004, AC-11, AC-14).
 *
 * The daily target (feature 6) and privacy and deletion (feature 10) arrive
 * later; until then this screen says so rather than showing controls that do
 * nothing.
 */

/** What will live here, listed so the screen reads as a plan rather than a gap. */
const COMING = [
  { key: 'target', title: 'Your daily target', subtitle: 'Arrives with onboarding' },
  { key: 'privacy', title: 'Privacy, terms and deletion', subtitle: 'Arrives before release' },
] as const;

export default function SettingsScreen() {
  const { user, isLoaded } = useUser();
  const { signOut, getToken } = useAuth();
  const account = useAccount();
  const { recheck } = useDraining();
  const [pending, setPending] = useState<number | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  // AC-14. The email lives in Clerk and is deliberately not copied into
  // `profiles`: one source of truth, and no contact detail on a health row.
  const email = isLoaded ? (user?.primaryEmailAddress?.emailAddress ?? 'Signed in') : 'Signed in';

  const transport = useMemo(
    () => createSupabaseTransport(createSupabaseClient((...args) => getToken(...args))),
    // `getToken` is a new function on every render, so depending on it would
    // rebuild the client every time. The one built on the first render reads
    // the current token per request anyway, which is the point of the callback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const runSignOut = (force: boolean) => (): void => {
    if (account.kind !== 'ready') return;
    setBusy(true);

    void (async () => {
      // AC-11. Push first, then remove the file. Nothing is kept for
      // convenience: on a shared phone the alternative is a full health
      // record sitting on disk after someone signs out.
      const result = await signOutSafely({
        userId: account.userId,
        db: asSqlDatabase(account.db),
        close: () => account.db.closeAsync(),
        transport,
        force,
      });

      if (result.kind === 'pending') {
        setPending(result.meals);
        setBusy(false);
        return;
      }

      // AC-11b. On `draining` the Clerk session is deliberately kept: it is
      // the only thing that can still push those meals, and it ends the moment
      // they land. The phone looks signed out either way, because the account
      // provider refuses to open a draining account's file.
      if (result.kind === 'removed') await signOut();
      // Either way the app has to stop showing this diary now, so the startup
      // sequence runs again and lands on the sign in screen.
      recheck();

      setBusy(false);
    })();
  };

  return (
    <Screen>
      <AppText variant="h1" heading>
        Settings
      </AppText>

      <AppText variant="kicker" color={colors.accentText} uppercase>
        Account
      </AppText>

      <View>
        <ListRow title={email} subtitle="Signed in" last />
      </View>

      {pending === undefined ? (
        <Button
          label="Sign out"
          onPress={runSignOut(false)}
          disabled={busy || account.kind !== 'ready'}
          fullWidth
          accessibilityHint="Signs you out and removes your diary from this phone"
          testID="sign-out"
        />
      ) : (
        <View>
          {/* AC-11: meals, not rows. One meal with four items is "1 meal". */}
          <AppText variant="body">
            {pending === 1
              ? '1 meal has not reached your account yet.'
              : `${pending} meals have not reached your account yet.`}
          </AppText>
          <AppText variant="caption" color={colors.textSubtle}>
            Waiting keeps them. Signing out anyway removes this diary from the phone.
          </AppText>
          <Button
            label="Wait and try later"
            onPress={() => setPending(undefined)}
            disabled={busy}
            fullWidth
          />
          <Button
            label="Sign out anyway"
            variant="ghost"
            onPress={runSignOut(true)}
            disabled={busy}
            fullWidth
            accessibilityHint="Signs out and removes this diary from the phone, including the meals that have not been saved to your account"
            testID="sign-out-anyway"
          />
        </View>
      )}

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
