# Routes

## Overview

Every screen in the app, laid out as files. Expo Router builds the navigation tree from this
directory, so the folder structure is the navigation structure. The root layout is also where the
app's startup gates live: configuration, fonts, and the local database all have to settle before
any screen renders.

## Key files

| File                  | Owns                                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `_layout.tsx`         | Startup gating, the splash screen, providers, and the root stack                                                            |
| `sign-in.tsx`         | The combined door: one email field, then a password or an emailed code                                                      |
| `onboarding.tsx`      | The onboarding destination. A placeholder until scope feature 6 builds it                                                   |
| `(tabs)/_layout.tsx`  | The tab bar and its theming                                                                                                 |
| `(tabs)/index.tsx`    | The Today tab, built from the design system with labelled sample data; the real one, reading a real day, is scope feature 9 |
| `(tabs)/settings.tsx` | The Settings tab: the signed in email, and signing out                                                                      |

## Conventions

- Adding a file under `(tabs)/` adds a tab. Register it in `(tabs)/_layout.tsx` to give it a title
  and ordering.
- Route files **must** use a default export. This is Expo Router's contract, not a style choice, so
  it is the one documented exception to the root `AGENTS.md` rule of named exports only, and
  `eslint.config.js` turns `import/no-default-export` off for `src/app/**` to allow it. Everywhere
  else in `src/`, named exports still.
- Typed routes are on (`experiments.typedRoutes` in `app.config.ts`), so route strings are checked.
  Regenerate types by running the dev server if a new route is not recognised.
- Screens build from `@/design-system/components` (`Screen`, `AppText`, `Button`, and the rest),
  never from React Native's `Text`, `Pressable`, `TouchableOpacity`, or `TextInput` directly;
  `eslint.config.js` fails the build on a direct import of any of those four inside `src/app/**`.
  No literal colour, space, or type value either; everything resolves through the components to
  `@/design-system/theme`.
- A screen that can fail at startup shows `StartupNotice` with an honest message rather than
  hanging on the splash screen.

## Gotchas

- The JavaScript tab bar (`expo-router/js-tabs`) is used rather than the native one, because the
  Classical design's bar is hairline and typographic and a native bar cannot be made to look like
  it. Switching to native tabs would lose the design.
- `_layout.tsx` imports `@/config/env` for its side effect. That import is what validates the
  environment at startup and throws loudly on a bad value, so do not remove it as unused.
- The splash screen is held manually (`preventAutoHideAsync`, then `hideAsync` once fonts and the
  account have both settled). Any new startup gate has to join that `settled` check, or the splash
  will hide too early.
- **The account half of that gate is a sequence, not a race**: Clerk answers, then the per account
  database file opens, then the `profiles` row is pulled, then routing happens once. Only fonts may
  load alongside. `AccountProvider` owns it, and implementing it as parallel flags fails silently by
  opening no file or the wrong one. See [src/account/AGENTS.md](../account/AGENTS.md).
- While signed out, the sign in screen is the only screen **mounted**, not merely the target of a
  redirect. That is what makes a deep link and a back gesture unable to reach a diary, so keep the
  guard on what the stack renders rather than turning it into a redirect.
- Safe area insets are applied by the `Screen` component (`@/design-system/components/screen`),
  not per screen with a local `useSafeAreaInsets` call. `Screen` applies the top inset as content
  padding rather than a margin, so content still scrolls under the status bar the way the design
  draws it.
- The tab bar is typographic, not iconographic: `(tabs)/_layout.tsx` hands a custom `tabBar` prop
  (`TabBar` from `@/design-system/components/tab-bar`) to `expo-router/js-tabs`, which draws a gold
  hairline above the active tab's label. Adding a `Tabs.Screen` entry adds a tab with no relayout
  work.

## Agent skills

- [expo-native-ui](../../.agents/skills/expo-native-ui/): `expo/skills`, native feeling Expo
  screens, controls, animation, and layout.
- [expo-data-fetching](../../.agents/skills/expo-data-fetching/): `expo/skills`, network requests,
  caching, and Expo Router data loaders, for when screens start reading real data.

## Related specs

- [0001. Stack and architecture](../../docs/specs/0001-stack-architecture/index.md), AC-1, AC-3,
  and AC-4.
- [0003. Design system and UI foundation](../../docs/specs/0003-design-system-ui-foundation/index.md),
  the typographic tab bar (AC-10) and the Today tab rebuilt from the component set (AC-15).

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
