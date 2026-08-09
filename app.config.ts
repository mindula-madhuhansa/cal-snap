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
  // Identity (Clerk) and the database (Supabase), spec 0004. All three are
  // public identifiers and safe to ship: the Clerk key names an instance, and
  // the Supabase key grants nothing on its own now that every policy requires
  // a valid Clerk token.
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  eas: {
    projectId: '04eafa92-d566-463e-8f26-df88822e4ad6',
  },
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
  owner: 'kdmindulamc',
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
    // Clerk's native sign in needs native code, so this feature can only run
    // on a development build, never in Expo Go (spec 0004, Consequences).
    '@clerk/expo',
    // Native Google sign in moved out of `@clerk/expo` in its version 4:
    // `@clerk/expo/google` is now a stub that throws unless this package and
    // its plugin are present. Spec 0004 AC-3 asks for the native sheet, not
    // the browser flow, so this is required rather than optional.
    '@clerk/expo-google-signin',
    // What Clerk's `tokenCache` stores the session token in: the iOS Keychain
    // and Android storage encrypted by the Keystore (spec 0004, security
    // model). App code never touches it directly, but the native module has
    // to be in the build or `@clerk/expo/token-cache` cannot resolve.
    'expo-secure-store',
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
