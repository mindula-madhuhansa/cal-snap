# Design system

## Overview

The Classical look, as typed values, and the seventeen components built from them (scope feature
4, Design system & UI foundation, done). Every colour, space, radius, font, type step, motion
duration, and shadow the app uses is defined once in `theme.ts`, ported from
`docs/design/classical.css`, so no screen ever invents a number; every screen assembles from
`components/` rather than from raw React Native primitives.

Design system: build every screen from `components/`, per `docs/design/design.md` (the type
scale, the colour role rule, spacing, motion, and every component's variants, states, props, and
accessibility contract). `theme.ts` is the token source; `design.md` is the contract built on it.

## Key files

| File                    | Owns                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `theme.ts`              | `colors`, `space`, `radii`, `fonts`, `type`, `motion`, `shadows`, `minTouchTarget`, `theme`                                   |
| `use-app-fonts.ts`      | Loading the four Google font cuts, returning a loading, ready, or failed value                                                |
| `scale-type-step.ts`    | `scaleTypeStep`, the one place the system font size setting is applied (capped at `type.fontScaleCap`)                        |
| `min-touch-target.ts`   | `withMinTouchTarget`, the pure hit slop calculation behind the 44pt touch target floor                                        |
| `intent-colors.ts`      | `intentColors`, resolving an intent (`over`/`notice`/`failure`) to its text/mark colour pair                                  |
| `motion-duration.ts`    | `motionDuration`, collapsing a duration to `motion.duration.instant` when reduce motion is on                                 |
| `use-reduced-motion.ts` | The hook every animated component reads; defaults to reduced until the OS answers                                             |
| `haptics.ts`            | The one shared haptics helper (`selection`, `change`, `saved`); fire-and-forget, swallows failure                             |
| `components/`           | The seventeen components plus the tab bar, one file each, decision logic split into a pure `.ts` file with its test beside it |

## Conventions

- Import tokens by name (`import { colors, space, type } from '@/design-system/theme'`). A raw
  hex, a pixel number, or a font family string anywhere else is a bug, and `eslint.config.js`
  enforces the first two: a raw hex or a font family string anywhere under `src/` outside
  `theme.ts` fails `npm run lint`.
- Screens build from `components/`, never from React Native's `Text`, `Pressable`,
  `TouchableOpacity`, or `TextInput` directly. `eslint.config.js` blocks those imports inside
  `src/app/**`.
- Every token object is `as const`, so the values are literal types and cannot be reassigned.
- Type steps spread whole (`...type.body`) rather than being picked apart, so family, size, line
  height, and tracking always travel together.
- Styling is React Native `StyleSheet` only. There is no styling library, and there is no dark
  variant: the design is one warm paper theme, and `app.config.ts` pins `userInterfaceStyle` to
  `light`.
- Font loading is a side effect, so it lives in `use-app-fonts.ts` at the edge and returns a
  result value rather than throwing. Everything else reads family names from `theme.fonts`.

## Gotchas

- CSS `color-mix(in srgb, X n%, transparent)` has no React Native equivalent, so those tokens are
  resolved to `rgba()` by the local `withAlpha` helper at module load.
- `space` is a 4.6 scale, not a 4 scale. The odd numbers (4.6, 9.2, 13.8) are the design's, kept
  exactly. Do not round them.
- `lineHeight` is absolute in React Native, so the CSS multipliers are already resolved to points
  in `type`. Do not multiply again.
- `type.h6` is the uppercase eyebrow, not a heading size, and the uppercasing happens at the call
  site via `textTransform`.
- The design retired bold. Semibold is the ceiling, and only four cuts exist: Cormorant Garamond
  400 and 600, Lora 400 and 600. Asking for any other weight silently falls back.
- `shadows` carries both the iOS shadow parts and Android's `elevation`, because React Native
  needs both. Spread the whole step.
- `minTouchTarget` is 44 points, the WCAG AA floor the root `AGENTS.md` makes the baseline. Any
  tappable thing measures at least this.

## Agent skills

- [expo-native-ui](../../.agents/skills/expo-native-ui/): `expo/skills`, native feeling Expo
  screens, styling, media, animation, and visual effects.

## Related specs

- [0001. Stack and architecture](../../docs/specs/0001-stack-architecture/index.md), AC-4 and the
  theme module scaffold decision.
- [0003. Design system and UI foundation](../../docs/specs/0003-design-system-ui-foundation/index.md),
  the component set, the colour role rule, and every acceptance criterion this area implements.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
