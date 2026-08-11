# Design system

## Overview

The Nocturne look, as typed values, and the components built from them. Every colour, gradient,
space, radius, font, type step, motion duration, and shadow the app uses is defined once in
`theme.ts`, ported from the screenshots in `docs/design/`, so no screen ever invents a number;
every screen assembles from `components/` rather than from raw React Native primitives.

The design is **dark only**. It is one ground, not a light theme with a dark variant, so there is
no colour-scheme branch anywhere and `app.config.ts` pins `userInterfaceStyle` to `dark`.

`theme.ts` is the token source, and the colour role rule in its header comment is the contract
built on it: which values may carry a sentence, which may only carry a mark or a rule, and which
may only carry a decorative hairline. Every ratio in that table is measured, not estimated.

## Key files

| File                    | Owns                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `theme.ts`              | `colors`, `gradients`, `space`, `radii`, `fonts`, `type`, `motion`, `shadows`, `minTouchTarget`, `theme` |
| `use-app-fonts.ts`      | Loading the six Google font cuts, returning a loading, ready, or failed value                            |
| `scale-type-step.ts`    | `scaleTypeStep`, the one place the system font size setting is applied (capped at `type.fontScaleCap`)   |
| `min-touch-target.ts`   | `withMinTouchTarget`, the pure hit slop calculation behind the 44pt touch target floor                   |
| `intent-colors.ts`      | `intentColors`, resolving an intent (`over`/`notice`/`failure`/`success`) to its text/mark colour pair   |
| `motion-duration.ts`    | `motionDuration`, collapsing a duration to `motion.duration.instant` when reduce motion is on            |
| `use-reduced-motion.ts` | The hook every animated component reads; defaults to reduced until the OS answers                        |
| `haptics.ts`            | The one shared haptics helper (`selection`, `change`, `saved`); fire-and-forget, swallows failure        |
| `components/`           | The components, one file each, decision logic split into a pure `.ts` file with its test beside it       |

## Conventions

- Import tokens by name (`import { colors, space, type } from '@/design-system/theme'`). A raw
  hex, a pixel number, or a font family string anywhere else is a bug, and `eslint.config.js`
  enforces the first two: a raw hex or a font family string anywhere under `src/` outside
  `theme.ts` fails `npm run lint`. That rule bites in tests too, so assert against
  `fonts.monoRegular` rather than against the string `'JetBrainsMono_400Regular'`.
- Screens build from `components/`, never from React Native's `Text`, `Pressable`,
  `TouchableOpacity`, or `TextInput` directly. `eslint.config.js` blocks those imports inside
  `src/app/**`.
- Every token object is `as const`, so the values are literal types and cannot be reassigned.
- Type steps spread whole (`...type.body`) rather than being picked apart, so family, size, line
  height, and tracking always travel together.
- Font loading is a side effect, so it lives in `use-app-fonts.ts` at the edge and returns a
  result value rather than throwing. Everything else reads family names from `theme.fonts`.
- **Colour never carries a meaning on its own.** Every intent is drawn with a mark, a thick edge,
  or a fill as well as a hue, so the difference survives someone who cannot separate the two. The
  selected radio card is the clearest example: cyan edge, tinted ground, **and** a tick.
- **Three components say something, and they are not interchangeable.** `Notice` is an answer to
  something a person just pressed, so it is announced as an alert. `Callout` is standing copy that
  was there before anything was pressed, so it is read in document order and never interrupts.
  `ErrorState` is the whole-screen version. Using the announced one for standing copy makes a
  screen reader talk over itself on every render.

## Gotchas

- `space` is a plain 4 point grid. The 4.6 scale the previous theme used is gone.
- `lineHeight` is absolute in React Native, so every multiplier is already resolved to points in
  `type`. Do not multiply again.
- `type.h6` and `type.kicker` are the uppercase mono eyebrows, not heading sizes, and the
  uppercasing happens at the call site via the `uppercase` prop.
- `type.data` is the dense mono line under a title (`08:20 · P14 C58 F9`). It is mono so a column
  of figures lines up between rows; setting it in Outfit looks fine on one row and ragged on five.
- **`Field` owns the input's frame, not `TextInput`.** The design puts the label inside the
  rounded border, so the border belongs to the thing that knows about the label, the hint, and the
  error. `Field` also owns focus, and hands `onFocus`/`onBlur` down with the accessibility props;
  `fieldA11y` stays pure and knows nothing about them. A `TextInput` used outside a `Field` draws
  no border at all.
- **The primary button's gradient is a layer, not a background.** React Native cannot express a
  gradient as a colour, so `buttonVariantStyle` signals it with a `gradient` flag and the component
  draws an absolutely positioned `LinearGradient` under the label. That is also why `button.tsx`
  sets `overflow: 'hidden'`: Android does not clip an absolutely positioned child to its parent's
  border radius on its own.
- `ProgressRing`'s arc and `ProgressBar`'s fill are **decorative by default** and hidden from a
  screen reader, because they restate a figure that is already on screen in words. Pass
  `accessibilityLabel` to a bar only when the bar is the sole place the value appears.
- `shadows` carries both the iOS shadow parts and Android's `elevation`, because React Native
  needs both. Spread the whole step. On a ground this dark a drop shadow is nearly invisible, so a
  card is lifted with `surfaceRaised` and an edge instead; `shadows.glow` is the cyan bloom, and it
  belongs to the primary action alone.
- `minTouchTarget` is 44 points, the WCAG AA floor the root `AGENTS.md` makes the baseline. Every
  control in the set now clears it by size, which is why nothing currently calls
  `withMinTouchTarget`. It stays for the next control the design draws smaller than a finger.
- **`IconButton`'s `label` is required and never drawn.** A control with no visible words is
  invisible to a screen reader unless it is named, and a glyph is not a name.
- A `Notice`'s `children` sit **outside** its announced group on purpose. Anything inside an
  `accessible` view is swallowed by it on iOS, so a button placed in there would be unreachable to
  a screen reader. The same reasoning applies to any new grouped component.
- `Tag` sets its label in the uppercase mono step, which makes the visible text a poor thing to
  read aloud. Pass `accessibilityLabel` whenever the seen text is not a sentence; the sync marker's
  `·` is the live example.
- `CaptchaMount` exists only because Clerk's bot protection needs a raw `View` with
  `nativeID="clerk-captcha"`, which `eslint.config.js` forbids inside `src/app/**`. It draws
  nothing. It lives here so the lint rule stays intact rather than being weakened.
- Adding a native module here means a **new development build**. `expo-linear-gradient` and
  `react-native-svg` both arrived with this design, so a client built before it will not run the
  app.

## Agent skills

- [expo-native-ui](../../.agents/skills/expo-native-ui/): `expo/skills`, native feeling Expo
  screens, styling, media, animation, and visual effects.

## Related specs

- [0001. Stack and architecture](../../docs/specs/0001-stack-architecture/index.md), AC-4 and the
  theme module scaffold decision.
- [0003. Design system and UI foundation](../../docs/specs/0003-design-system-ui-foundation/index.md),
  the component set and the accessibility criteria. **Its Classical palette, 4.6 space scale, and
  "no red anywhere" rule were replaced by this design** and the spec is stale on all three; the
  criteria about contrast, font scaling, touch targets, and reduce motion still hold.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
