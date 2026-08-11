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
 * The ground, written out rather than read from `src/design-system/theme.ts`.
 *
 * This is the one place in the repo allowed a raw hex, and it is not a choice:
 * Expo transpiles this file and requires the result before Metro or the
 * TypeScript path aliases exist, so an import of the theme cannot resolve. It
 * is the splash and icon ground, so it has to match `colors.bg`. If the ground
 * is ever retuned, this line changes with it.
 */
const GROUND = '#0a0c14';

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
  // The design is a single dark theme, with no light variant. Pinning this
  // stops the OS drawing light chrome (keyboards, sheets, the status bar)
  // around screens that are always dark.
  userInterfaceStyle: 'dark',
  backgroundColor: GROUND,
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.calsnap.app',
  },
  android: {
    package: 'com.calsnap.app',
    adaptiveIcon: {
      backgroundColor: GROUND,
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
    // What Clerk's `tokenCache` stores the session token in: the iOS Keychain
    // and Android storage encrypted by the Keystore (spec 0004, security
    // model). App code never touches it directly, but the native module has
    // to be in the build or `@clerk/expo/token-cache` cannot resolve.
    'expo-secure-store',
    // Snap a meal (spec 0007). Three packages are native code, so this feature
    // needs a **new development build**; a client built before it will not run.
    //
    // Only two are listed here. `expo-image-manipulator` ships no
    // `app.plugin.js`, so naming it makes Expo load the package's own entry
    // point as if it were a plugin, which throws before the config is even
    // read. It is autolinked from its Expo module definition and reaches the
    // build without an entry, which is what a plugin free native module does.
    //
    // The usage descriptions are not optional polish: a missing one is an App
    // Store rejection rather than a runtime error, and on both platforms it is
    // the sentence a person reads when the system asks. Each says why CalSnap
    // wants the permission, not what the permission is.
    [
      'expo-camera',
      {
        cameraPermission: 'CalSnap uses the camera to photograph your meal and read its nutrition.',
        // Video and the microphone are not used, so they are not asked for.
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'CalSnap opens your photo library so you can scan a meal you already photographed.',
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: GROUND,
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
