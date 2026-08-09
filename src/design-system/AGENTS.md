# Design system

## Overview

The Classical look, as typed values. Every colour, space, radius, font, type step, and shadow the
app uses is defined here once, ported from `docs/design/classical.css`, so no screen ever invents
a number. This area owns the raw tokens only; the components built from them are scope feature 4
(Design system & UI foundation).

## Key files

| File               | Owns                                                                              |
| ------------------ | --------------------------------------------------------------------------------- |
| `theme.ts`         | `colors`, `space`, `radii`, `fonts`, `type`, `shadows`, `minTouchTarget`, `theme` |
| `use-app-fonts.ts` | Loading the four Google font cuts, returning a loading, ready, or failed value    |

## Conventions

- Import tokens by name (`import { colors, space, type } from '@/design-system/theme'`). A raw
  hex, a pixel number, or a font family string anywhere else is a bug.
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

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
