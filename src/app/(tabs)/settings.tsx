import { useAuth, useUser } from '@clerk/expo';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { useAccount, useDraining } from '@/account/session';
import { signOutSafely } from '@/account/sign-out';
import { actionForSignOut } from '@/account/sign-out-outcome';
import { createSupabaseClient } from '@/account/supabase';
import { createSupabaseTransport } from '@/account/supabase-transport';
import { asSqlDatabase } from '@/db/client';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { ListRow } from '@/design-system/components/list-row';
import { Notice } from '@/design-system/components/notice';
import { Screen } from '@/design-system/components/screen';
import { colors } from '@/design-system/theme';
import { GoalSection } from '@/onboarding/goal-section';

/**
 * Settings, which for now is the goal and the account (spec 0004, AC-11,
 * AC-14).
 *
 * Privacy and deletion (feature 10) arrive later; until then this screen says
 * so rather than showing controls that do nothing.
 */

/** What will live here, listed so the screen reads as a plan rather than a gap. */
const COMING = [
  { key: 'privacy', title: 'Privacy & terms', subtitle: 'Arrives before release' },
  { key: 'delete', title: 'Delete my account', subtitle: 'Arrives before release' },
] as const;

export default function SettingsScreen() {
  const { user, isLoaded } = useUser();
  const { signOut, getToken } = useAuth();
  const account = useAccount();
  const { recheck } = useDraining();
  const [pending, setPending] = useState<number | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);
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
    setFailure(undefined);

    void (async () => {
      try {
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

        // Every outcome goes through one exhaustive decision, so a new one can
        // never quietly take somebody else's branch again. See
        // `sign-out-outcome.ts` for what each means.
        const action = actionForSignOut(result);

        if (action.askAbout !== undefined) setPending(action.askAbout);
        if (action.message !== undefined) setFailure(action.message);
        // AC-11b. `endClerkSession` is false while draining on purpose: that
        // session is the only thing that can still push the owed meals.
        if (action.endClerkSession) await signOut();
        if (action.recheck) recheck();
      } catch (error) {
        // Signing out is a privacy action, so it is the last place a thrown
        // value may disappear. Nothing here is expected to throw; if it does,
        // the person still gets a sentence rather than a button that did
        // nothing (AC-12).
        setFailure(
          `Signing out did not finish, so your diary is still on this phone. ${
            error instanceof Error ? error.message : 'Please try again.'
          }`,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <Screen>
      <AppText variant="h1" heading>
        Settings
      </AppText>

      {/* Spec 0006, AC-12. Only once the account is ready, because it reads
          the per account database file. */}
      {account.kind === 'ready' ? (
        <GoalSection db={account.db} userId={account.userId} />
      ) : undefined}

      <AppText variant="kicker" color={colors.cyan} uppercase heading>
        Account
      </AppText>

      <Card flush>
        <ListRow title={email} subtitle="Signed in" />
        {COMING.map((row, index) => (
          <ListRow
            key={row.key}
            title={row.title}
            subtitle={row.subtitle}
            destructive={row.key === 'delete'}
            last={index === COMING.length - 1}
          />
        ))}
      </Card>

      {/*
        AC-11, AC-12. The removal failed, so the diary is still on this phone
        and nothing will retry on its own. On a shared phone that is the one
        thing a person must not be left guessing about: they pressed sign out,
        and if they hand the device over believing it worked, their whole
        health record goes with it.
      */}
      {failure === undefined ? undefined : <Notice message={failure} testID="sign-out-failed" />}

      {pending === undefined ? (
        <Button
          label="Sign out"
          variant="secondary"
          onPress={runSignOut(false)}
          disabled={busy || account.kind !== 'ready'}
          fullWidth
          accessibilityHint="Signs you out and removes your diary from this phone"
          testID="sign-out"
        />
      ) : (
        <View>
          {/* AC-11, AC-16: meals, not rows (one meal with four items is "1
              meal"), and announced, because this appears only after the sign
              out button was pressed and is the answer to it. */}
          <Notice
            message={`${
              pending === 1
                ? '1 meal has not reached your account yet.'
                : `${pending} meals have not reached your account yet.`
            } Waiting keeps them. Signing out anyway removes this diary from the phone.`}
          />
          <Button
            label="Wait and try later"
            onPress={() => setPending(undefined)}
            disabled={busy}
            fullWidth
          />
          <Button
            label="Sign out anyway"
            variant="danger"
            onPress={runSignOut(true)}
            disabled={busy}
            fullWidth
            accessibilityHint="Signs out and removes this diary from the phone, including the meals that have not been saved to your account"
            testID="sign-out-anyway"
          />
        </View>
      )}

      <AppText variant="caption" color={colors.textDim} align="center">
        Signing out pushes anything unsaved, then clears the diary off this phone.
      </AppText>
    </Screen>
  );
}
