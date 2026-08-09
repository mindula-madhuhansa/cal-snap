import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * Every `EXPO_PUBLIC_` variable enters the app here and nowhere else, so there
 * is one list of what the app reads from the environment. `src/config/env.ts`
 * parses and validates this at startup.
 *
 * Nothing secret belongs here: `extra` ships inside the installed app. The
 * Anthropic API key lives only in the Supabase edge function's environment
 * (spec 0001, "The secret boundary").
 */
const extra = {
  appEnv: process.env.EXPO_PUBLIC_APP_ENV,
} as const;

/**
 * The paper ground, written out rather than read from `src/design-system/theme.ts`.
 *
 * This is the one place in the repo allowed a raw hex, and it is not a choice:
 * Expo transpiles this file and requires the result before Metro or the
 * TypeScript path aliases exist, so an import of the theme cannot resolve. It
 * is the splash and icon ground, so it has to match `colors.bg`. If the paper
 * is ever retuned, this line changes with it.
 */
const PAPER = '#f3f2f2';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'CalSnap',
  slug: 'calsnap',
  version: '1.0.0',
  // CalSnap is a phone app. Web is not a target, and leaving it on invites
  // dependencies that only exist to keep a browser build working.
  platforms: ['ios', 'android'],
  orientation: 'portrait',
  scheme: 'calsnap',
  icon: './assets/images/icon.png',
  // The Classical design is a single warm paper theme, with no dark variant.
  userInterfaceStyle: 'light',
  backgroundColor: PAPER,
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.calsnap.app',
  },
  android: {
    package: 'com.calsnap.app',
    adaptiveIcon: {
      backgroundColor: PAPER,
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    'expo-status-bar',
    [
      'expo-splash-screen',
      {
        backgroundColor: PAPER,
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra,
});
