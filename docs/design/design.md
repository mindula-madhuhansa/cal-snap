# CalSnap design system

The Classical look, as the app really builds it. This file is the record: what
the system is, what each part may and may not do, and the contract every
component keeps. It is the companion to spec
[0003](../specs/0003-design-system-ui-foundation/index.md), which decided it.

**Where the values live.** Not here. Every colour, space, radius, font, type
step, motion duration, and the touch target floor are in
[`src/design-system/theme.ts`](../../src/design-system/theme.ts), defined once.
This file names the rules about them, so the two can never disagree about a
number. `classical.css` is the design's original source and `CalSnap.dc.html`
the canvas it was drawn on; both are reference now, not runtime.

## Character

Warm paper, one hue, and a lot of restraint. Cormorant Garamond for headings
and for every number, Lora for reading. Grouping is carried by hairlines and
space rather than by boxes and shadows. There is one theme, always light: the
app is a calm sheet of paper, and `app.config.ts` pins `userInterfaceStyle` to
`light` so the phone cannot make it otherwise.

Bold was retired in review. Semibold is the ceiling and only four cuts exist.

## Build mandate

- Screens are assembled from the components below and nothing else. A screen
  that reaches for React Native's `Text`, `Pressable`, `TouchableOpacity`, or
  `TextInput` fails `npm run lint`.
- No screen and no component contains a raw hex colour, a font family string,
  or an invented measurement. Every number resolves to `space`, `radii`,
  `type`, `motion`, `shadows`, or `minTouchTarget`. The first two are lint
  errors; the third is the review question to ask.
- Every word a person reads arrives as a prop. No component holds user facing
  English. The exception is spoken only, and listed under *Screen reader
  words* below.
- A health number that is uncertain says so, in one documented way, and says
  it out loud as well as on screen.

## Type

Eleven steps, in `theme.type`. Headings and every figure use Cormorant
Garamond; body copy, labels, and captions use Lora. `h6` and `kicker` are
eyebrows rather than heading sizes, and are uppercased at the call site through
`AppText`'s `uppercase` prop.

Spread a step whole. Family, size, line height, and tracking travel together,
and picking one out breaks the pairing.

**Scaling.** The system font size setting is applied in exactly one place, the
pure `scaleTypeStep(step, fontScale)`. Every `Text` in the system sets
`allowFontScaling={false}`, so the platform never scales on top of ours and the
size the function returns is the size that is drawn.

- Size, line height, and tracking scale together, so the ratios hold. Tracking
  scales because the CSS this came from expressed it in `em`.
- The multiplier is held between 1 and `type.fontScaleCap` (1.6). The floor is
  1 because the design already sits at the small end; the ceiling is 1.6
  because past it the long headings clip on a small phone.
- A missing or nonsense scale reads as 1.

## Colour, and the roles each value may play

One palette, kept exactly as drawn. What is new is where each value is allowed
to appear, because the warm gold and the lighter greys do not clear WCAG AA
everywhere. Ratios are measured against the paper ground `#f3f2f2`.

| Value | Ratio | May be used on |
| --- | --- | --- |
| `text` (ink) | 14.74 | anything |
| `accentText` | 5.97 | anything, including the 10 point kickers |
| `textSubtle` | 5.79 | anything |
| `textMuted` | 3.63 | text at 24 points or above only, so `h1`, `h2`, `h3` |
| `accent` | 3.02 | hairlines, rules, ring strokes, control borders, and text at 24 points or above |
| `divider` | 1.38 | decorative rules only, never a control's boundary on its own |
| `accentRamp[800]` on `accentRamp[100]` | 9.30 | the filled tag tones |
| `accentText` inside a gold border | 5.97 | the outline tag tone |

Two rules follow from the table and are worth stating on their own, because
they are the ones easy to break by accident:

1. **`accent` never carries small text.** Gold words below 24 points are always
   `accentText`. The canvas's 10 point gold eyebrows and its ink 50% meta rows
   moved accordingly; everything else is untouched.
2. **`divider` never bounds something tappable.** A control's visible boundary
   owes 3:1, so buttons, inputs, segmented strips, and the radio dot are
   bordered in `accent`. `divider` stays on rules and row separators.

**Intents.** There is no red in this palette, and none was added. A state is
said with a pair instead: `text` for the words, `mark` for the rule, border, or
dot beside them. `over` is the day's target exceeded, and is calm on purpose.
`notice` wants attention without anything being wrong. `failure` is a real
error, carried by full strength ink and a deep gold rule rather than by hue.
Resolve a pair through `intentColors(intent)`.

**Pressed.** `colors.pressed` holds the three `:active` tints, one per button
variant. There is no hover state; this is a touch only app.

## Space

`theme.space`, a scale 4.6 apart rather than 4. The odd numbers are the
design's and are kept exactly. Round the canvas's whole pixels to the nearest
step rather than writing the pixel: the radio dot is `space[3]`, not 15.

Two spacing rules with teeth:

- `Screen` owns the gutter (`space[6]`) and the safe area. Screens do not apply
  insets themselves.
- Adjacent tappables keep at least `space[2]` between their drawn edges. Where
  two grown hit areas would still overlap, grow the drawn control instead of
  the slop, because slop is not clipped by the parent and an overlap means a
  tap lands on the wrong sibling.

## Motion

`theme.motion`: `duration` (`instant`, `fast`, `base`, `slow`), `loop`
(`sweep`, `pulse`), and `easing`, stored as cubic bezier control points rather
than as built `Easing` objects so the theme stays free of any React Native
import.

**Reduce motion is not optional.** Every animated component resolves its
duration through `motionDuration(duration, reduced)`, which returns
`instant` whenever the phone has asked for less motion. `useReducedMotion()`
reports `true` until the platform's asynchronous query answers, so somebody who
asked for less motion never sees an un-reduced frame. The price is that the
first transition after a cold launch is instant for everyone.

## Touch targets

`minTouchTarget` is 44 points, and it is a floor rather than a size. Most
components reach it by being drawn that tall. Where the design draws something
smaller on purpose, the drawn size stays and `withMinTouchTarget(width, height)`
returns the hit slop that grows what a finger can hit. A control already at or
over 44 in an axis gets no slop in that axis.

## Marking an estimate

There is exactly one way, and no second way in a figure or in prose: render the
value through `NumberText` with `estimated`. It shows an approximately sign
before the figure and appends "estimated" to what a screen reader says. A
health number a person acts on must not lose its caveat on the way to their
ear, which is why the marking is spoken as a word rather than left to a glyph
the reader may skip.

## Screen reader words

Three English words are hardcoded, and only these three. They are heard, never
read, and each exists so a value cannot lose its meaning out loud:

| Word | Where | Why |
| --- | --- | --- |
| `estimated` | `NumberText` | An estimate must announce itself as one. |
| `required` | `field-a11y.ts` | A required field must announce itself as one. |
| `error` | `field-a11y.ts` | Prefixes the message, so a fault is named as a fault. |

Everything else a person reads or hears comes from a prop.

## The components

All in [`src/design-system/components/`](../../src/design-system/components/),
one file each, named exports, decision logic split into a pure `.ts` file with
its test beside it. States are shared: `default`, `pressed` (a `colors.pressed`
tint), `disabled` (opacity 0.45), and for inputs `error` (the `failure`
intent).

### Layout and text

| Component | Props | Contract |
| --- | --- | --- |
| `Screen` | `children`, `scroll?`, `gutter?` | Owns the paper ground, the gutter, the scroll container, and the safe area, applied as content padding so content still scrolls under the status bar. |
| `AppText` | `variant?`, `color?`, `uppercase?`, `align?`, `numberOfLines?`, `heading?`, `accessibilityLabel?` | The only text primitive. Applies `scaleTypeStep`. `heading` sets the header role. Deliberately has no `style` prop, so a screen cannot invent a measurement through it. |
| `NumberText` | `value`, `unit`, `spoken?`, `estimated?`, `size?`, `color?` | Heading face, tabular figures. Speaks value plus unit, derived from what is on screen so the two cannot drift; `spoken` overrides when the default reads badly. Does no formatting. |
| `Divider` | `inset?` | A hairline in `colors.divider`. Decorative, hidden from screen readers, never a control's boundary. |
| `Card` | `children`, `kicker?`, `title?`, `elevation?` | Transparent ground, hairline border. `kicker` is set in `accentText`. |
| `Tag` | `label`, `tone?` | Four tones through `tagToneStyle`. Not tappable by design: a tag says what something is. |
| `ListRow` | `title`, `subtitle?`, `leading?`, `trailing?`, `onPress?`, `accessibilityHint?`, `last?` | The row the app is mostly made of. With `onPress` it is a button to a screen reader and reads title and subtitle as one label. Bottom hairline unless `last`. |
| `Icon` | `name`, `size?`, `color?`, `accessibilityLabel?` | Feather behind a closed union; the only file importing the icon set. Sizes come from the type scale. Decorative and hidden unless given a label. |
| tab bar | `TabBar`, wired in `(tabs)/_layout.tsx` | Typographic labels, a gold hairline above the active tab, equal width tabs so a fourth costs no relayout. The rule is always rendered so switching tabs never changes the bar's height. |

### Controls

| Component | Props | Contract |
| --- | --- | --- |
| `Button` | `label`, `onPress`, `variant?`, `size?`, `fullWidth?`, `disabled?`, `icon?`, `accessibilityHint?` | `primary` is gold words in a gold border, `secondary` ink in a bounded edge, `ghost` gold words with no border. Never shorter than 44. Style resolved by the pure `buttonVariantStyle`. |
| `Field` | `label`, `children: (a11y) => ReactNode`, `hint?`, `error?`, `required?` | Renders label, hint, and error, and hands a typed `FieldA11y` to its child to spread onto the control. A render prop, so the relationship is visible in the code rather than smuggled in by cloning. The seen hint and error are hidden from screen readers, because the control's own label already carries them. |
| `TextInput` | `value`, `onChangeText`, `placeholder?`, `invalid?`, `multiline?`, `keyboardType?`, `editable?`, plus `FieldA11y` | Gold hairline border at rest (the contrast floor, not the CSS's `divider`), deeper gold on focus so nothing in the layout moves, `failure` mark when invalid. Gold caret. At least 44 tall. |
| `SegmentedControl` | `options`, `value`, `onChange`, `invalid?`, plus `FieldA11y` | A radio group. Gold inner ring on the chosen option, drawn inside so the strip's outline never moves. Each option is a full target in its own right. Fires a selection haptic. |
| `RadioRow` | `label`, `selected`, `onSelect`, `trailing?`, `last?`, plus `FieldA11y` | A ring with a filled centre, drawn small; the row around it is the target. Fires a selection haptic. |
| `Stepper` | `value`, `onChange`, `min?`, `max?`, `format`, `step?`, plus `FieldA11y` | Minus and plus drawn small and grown to 44 by `withMinTouchTarget`. Reads as one adjustable control with one value, with increment and decrement as accessibility actions, rather than as two loose buttons. Fires a change haptic. Does no formatting. |

### States

| Component | Props | Contract |
| --- | --- | --- |
| `EmptyState` | `title`, `body`, `action?` | A heading and one honest line. No illustration. |
| `LoadingState` | `message` | A gold line that breathes under one sentence. Announced as a busy progress indicator. Honours reduce motion by sitting still at full strength. |
| `ErrorState` | `title`, `body`, `onRetry?`, `retryLabel?` | The `failure` intent: plain words and a rule, then a retry. |

## Haptics

One helper, `haptics`, with three moments and no more: `selection` for a
choice, `change` for a value moving a step, `saved` for a save that worked.
Every call is fire and forget and swallows its own failure, so a phone with
feedback disabled, a simulator with no motor, or an unsupported platform is
silence rather than a crash. A nicety must not be able to break a save.

## What the lint rules enforce

In `eslint.config.js`, so the system holds without anyone policing it:

- No raw hex colour anywhere under `src/` except `theme.ts`.
- No font family string anywhere under `src/` except `theme.ts`.
- No `Text`, `Pressable`, `TouchableOpacity`, or `TextInput` imported from
  `react-native` inside `src/app/**`.

`app.config.ts` is the one file outside `src/` carrying the paper hex, in a
named `PAPER` constant with the reason beside it: Expo transpiles and requires
that file before Metro or the path aliases exist, so it cannot import the
theme.

## What is not enforced

The contrast rule holds by review and by this document, not by a test. Nothing
mechanical stops a future screen pairing `accent` with 12 point text; the pure
functions above are tested for it wherever a colour choice passes through them,
which covers buttons, tags, and intents, but not a colour written straight onto
an `AppText`. Worth revisiting if the palette is ever retuned.

Components are not rendered in tests. The suite covers the pure decision logic;
how the result looks rests on `/check verify` on a real phone.
