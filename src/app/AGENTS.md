# Routes

## Overview

Every screen in the app, laid out as files. Expo Router builds the navigation tree from this
directory, so the folder structure is the navigation structure. The root layout is also where the
app's startup gates live: configuration, fonts, and the local database all have to settle before
any screen renders.

## Key files

| File                  | Owns                                                                  |
| --------------------- | --------------------------------------------------------------------- |
| `_layout.tsx`         | Startup gating, the splash screen, providers, and the root stack      |
| `(tabs)/_layout.tsx`  | The tab bar and its theming                                           |
| `(tabs)/index.tsx`    | The Today tab (scaffold placeholder; the real one is scope feature 9) |
| `(tabs)/settings.tsx` | The Settings tab (scaffold placeholder)                               |

## Conventions

- Adding a file under `(tabs)/` adds a tab. Register it in `(tabs)/_layout.tsx` to give it a title
  and ordering.
- Route files **must** use a default export. This is Expo Router's contract, not a style choice, so
  it is the one documented exception to the root `AGENTS.md` rule of named exports only, and
  `eslint.config.js` turns `import/no-default-export` off for `src/app/**` to allow it. Everywhere
  else in `src/`, named exports still.
- Typed routes are on (`experiments.typedRoutes` in `app.config.ts`), so route strings are checked.
  Regenerate types by running the dev server if a new route is not recognised.
- Screens read every colour, space, and type step from `@/design-system/theme`. No literal values.
- A screen that can fail at startup shows `StartupNotice` with an honest message rather than
  hanging on the splash screen.

## Gotchas

- The JavaScript tab bar (`expo-router/js-tabs`) is used rather than the native one, because the
  Classical design's bar is hairline and typographic and a native bar cannot be made to look like
  it. Switching to native tabs would lose the design.
- `_layout.tsx` imports `@/config/env` for its side effect. That import is what validates the
  environment at startup and throws loudly on a bad value, so do not remove it as unused.
- The splash screen is held manually (`preventAutoHideAsync`, then `hideAsync` once fonts and the
  database have both settled). Any new startup gate has to join that `settled` check, or the splash
  will hide too early.
- Safe area insets are applied per screen with `useSafeAreaInsets`, not by a wrapper, because the
  design's screens scroll under the status bar.
- The tab bar hides icons for now (`tabBarIconStyle: { display: 'none' }`). The finished bar with
  the design's icons is scope feature 4.

## Agent skills

- [expo-native-ui](../../.agents/skills/expo-native-ui/): `expo/skills`, native feeling Expo
  screens, controls, animation, and layout.
- [expo-data-fetching](../../.agents/skills/expo-data-fetching/): `expo/skills`, network requests,
  caching, and Expo Router data loaders, for when screens start reading real data.

## Related specs

- [0001. Stack and architecture](../../docs/specs/0001-stack-architecture/index.md), AC-1, AC-3,
  and AC-4.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
