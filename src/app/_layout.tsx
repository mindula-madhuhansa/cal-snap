import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importing this validates the app's configuration once, at startup, and
// throws loudly if a value is missing or malformed (spec 0001, AC-7b).
import '@/config/env';
import { useDatabase } from '@/db/use-database';
import { colors } from '@/design-system/theme';
import { useAppFonts } from '@/design-system/use-app-fonts';
import { StartupNotice } from '@/startup/startup-notice';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const fonts = useAppFonts();
  const database = useDatabase();

  const settled = fonts.kind !== 'loading' && database.kind !== 'opening';

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

  if (database.kind === 'failed') {
    return (
      <StartupNotice
        title="CalSnap could not open your diary"
        detail={`${database.message} Your meals are safe on this device; reopening the app usually fixes this.`}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
