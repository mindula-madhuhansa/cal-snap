import { ClerkProvider } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountProvider, useAccount } from '@/account/session';
import { SyncProvider } from '@/account/sync';
// Importing this validates the app's configuration once, at startup, and
// throws loudly if a value is missing or malformed (spec 0001, AC-7b).
import { env } from '@/config/env';
import { LoadingState } from '@/design-system/components/loading-state';
import { colors } from '@/design-system/theme';
import { useAppFonts } from '@/design-system/use-app-fonts';
import { StartupNotice } from '@/startup/startup-notice';

void SplashScreen.preventAutoHideAsync();

/**
 * The startup gate (spec 0004, AC-4, AC-5, AC-6).
 *
 * Fonts load alongside; everything else is the strict sequence owned by
 * `AccountProvider` (Clerk answers, then the file opens, then the profile is
 * pulled, then routing happens once). The splash screen lifts only when both
 * halves have settled, so a signed in person never sees the sign in screen
 * flash past on the way to Today.
 */
const Gate = () => {
  const fonts = useAppFonts();
  const account = useAccount();

  const settled = fonts.kind !== 'loading' && account.kind !== 'loading';

  useEffect(() => {
    if (settled) {
      void SplashScreen.hideAsync();
    }
  }, [settled]);

  if (!settled) {
    return null;
  }

  if (fonts.kind === 'failed') {
    return (
      <StartupNotice
        title="CalSnap could not load its fonts"
        detail={`${fonts.message} Closing and reopening the app usually fixes this.`}
      />
    );
  }

  if (account.kind === 'failed') {
    return (
      <StartupNotice
        title="CalSnap could not open your diary"
        detail={`${account.message} Your meals are safe on this device; reopening the app usually fixes this.`}
      />
    );
  }

  // AC-9. Only ever seen on a device that has no local file for this account
  // yet, which is the fresh phone case. A later launch passes straight
  // through without rendering this at all.
  if (account.kind === 'restoring') {
    return <LoadingState message="Getting your diary from your account" />;
  }

  // AC-5. While signed out, the sign in screen is the only route that exists.
  // This is a guard on what is *mounted*, not a redirect, so there is no deep
  // link and no back gesture that can reach a screen behind it.
  const signedOut = account.kind === 'signed-out';
  const onboarding = account.kind === 'ready' && account.destination.kind === 'onboarding';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      {signedOut ? (
        <Stack.Screen name="sign-in" />
      ) : onboarding ? (
        <Stack.Screen name="onboarding" />
      ) : (
        <Stack.Screen name="(tabs)" />
      )}
    </Stack>
  );
};

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <AccountProvider>
            {/* Sync sits inside the account so it can see the open file, and
                outside the gate so a draining account keeps retrying while the
                sign in screen is showing (AC-10, AC-11b). */}
            <SyncProvider>
              <Gate />
            </SyncProvider>
          </AccountProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}
