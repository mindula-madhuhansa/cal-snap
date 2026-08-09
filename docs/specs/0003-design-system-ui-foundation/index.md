# 0003. Design system and UI foundation for CalSnap

**Date**: 2026-08-09
**Status**: In Progress

## Summary

CalSnap already has the Classical look as raw values in `src/design-system/theme.ts`, but nothing built from them. This spec decides the layer above: a small set of typed React Native components that every screen is assembled from, plus the rules that keep them consistent. The big call is that the palette's warm gold and its muted greys do not meet the accessibility contrast floor the project made non negotiable, so each colour gets a role it is allowed to play rather than being retuned. The look survives, and every screen passes.

Scope is deliberately Release 1 sized. Seventeen components, no charts, no chat bubbles, no calorie ring. Two new packages (`@expo/vector-icons` and `expo-haptics`), a written record in `docs/design/design.md`, lint rules so the system cannot quietly rot, and the Today tab rebuilt from the components as proof.

## Requirements

**User stories**:

- As someone using CalSnap, I want every screen to look like it came from the same hand, so the app feels considered rather than assembled.
- As someone who has turned up my phone's font size, I want the app to grow with it and stay readable, rather than clipping or overlapping.
- As someone using a screen reader, I want numbers spoken as values with their units, and errors announced with the field they belong to.
- As someone acting on health numbers, I want an estimate to be visibly and audibly marked as an estimate.
- As the engineer building features 5 through 10, I want a component for every part I need, so I am never inventing a button under deadline.

**Acceptance criteria** (the contract, each criterion is IDed and independently checkable):

- **AC-1**: `docs/design/design.md` exists and defines the type scale, the colour roles, the spacing rules, the motion tokens, and every base component with its variants, its states, its props, and its accessibility contract.
- **AC-2**: Every foreground and background pairing the system permits meets WCAG AA: at least 4.5:1 for text below 24 points, and at least 3:1 for text at 24 points or above and for the visible boundary of an interactive control. Accent gold `#b68235` never carries text at any size below 24 points.
- **AC-3**: Every interactive component presents a tappable area of at least 44 by 44 points, whatever size it is drawn at.
- **AC-4**: All text responds to the system font size setting, scaling font size and line height together so their ratio holds, capped at 1.6 times, and no screen in the sample clips, overlaps, or truncates unintentionally at that cap.
- **AC-5**: The component set exists and covers what Release 1 needs: `Screen`, `AppText`, `NumberText`, `Button`, `Icon`, `Field`, `TextInput`, `SegmentedControl`, `RadioRow`, `Stepper`, `Card`, `Tag`, `ListRow`, `Divider`, `EmptyState`, `LoadingState`, `ErrorState`, plus the tab bar.
- **AC-6**: No component hardcodes user facing English. Every word a person reads arrives as a prop.
- **AC-7**: Numbers render with tabular figures, so a column of digits does not shift as values change, and carry a screen reader label that speaks the full value with its unit.
- **AC-8**: The system provides exactly one documented way to mark a health value as estimated, and that marking is announced as estimated to a screen reader, not only shown.
- **AC-9**: Motion durations and easing curves live in the theme, and every animated component falls back to an instant transition when the phone's reduce motion setting is on.
- **AC-10**: The tab bar renders Today, Snap, and Settings as typographic labels with a gold hairline above the active tab, and accepts a fourth tab without any relayout work.
- **AC-11**: Haptic feedback fires on a stepper change, a segmented control change, and a successful save, through one shared helper, and stays silent when the system has haptics disabled.
- **AC-12**: `Field` associates its label, its hint, and its error with its control, so a screen reader announces the error together with the input rather than as loose text.
- **AC-13**: ESLint fails the build on a raw hex colour or a font family string written anywhere outside `src/design-system/theme.ts`, and on importing `Text`, `Pressable`, `TouchableOpacity`, or `TextInput` directly from `react-native` inside `src/app/**`.
- **AC-14**: Every measurement inside every component resolves to a value from `space`, `radii`, `type`, `shadows`, or `minTouchTarget`. No component contains an invented number.
- **AC-15**: The Today tab is rebuilt using only these components, with sample data that is clearly labelled as sample, and no invented calorie number is presented as fact.
- **AC-16**: Each component's decision logic is a pure function covered by Vitest: variant to style, font scale to type step, hit area from drawn size, and intent to colour pair.

## Decision

**Chosen option**: Option 1: Port the canvas into a small typed component set, with colour governed by role.

Build seventeen components in `src/design-system/components/`, one file each with its test beside it, from the existing `docs/design/classical.css` tokens and the `CalSnap.dc.html` canvas. Keep every colour value exactly as it is, and govern where each may be used so the whole system clears WCAG AA. Add the two packages the components genuinely need, enforce the rules in ESLint, and record the whole thing in `docs/design/design.md`.

**Implementation skills**: `expo-native-ui` (`expo/skills`, `.agents/skills/expo-native-ui/`) · `expo-react-native-performance` (installed at user level, not in this repo)

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

This feature persists nothing. It reads no table, writes no row, and adds no migration. Its model is the component contract below, plus a small set of additions to `src/design-system/theme.ts`.

Token additions (`theme.ts`), all resolved from values already present:

| Token group | Addition | Value | Why |
|---|---|---|---|
| `colors` | `accentText` | `accentRamp[700]` `#7d5411` | The only gold permitted on text. 5.97:1 on paper. |
| `colors.intents` | `over` | text `accentRamp[700]`, mark `accent` | The day's target exceeded. Calm, never red. |
| `colors.intents` | `notice` | text `textSubtle`, mark `accent` | Something wants attention but is not an error. |
| `colors.intents` | `failure` | text `text` (ink), mark `accentRamp[700]` | A genuine error. Signalled by words and a rule, not by hue. |
| `colors.pressed` | `accent`, `neutral`, `ghost` | `rgba` of accent 22%, ink 14%, accent 18% | The CSS `:active` tints, resolved for React Native. |
| `motion.duration` | `instant`, `fast`, `base`, `slow` | `0`, `160`, `600`, `700` | `base` is the canvas's macro bars, `slow` its ring. |
| `motion.loop` | `sweep`, `pulse` | `2400`, `1200` | The canvas's scan rotation and its typing pulse. |
| `motion.easing` | `standard`, `linear` | `bezier(0.4, 0, 0.2, 1)`, linear | The canvas's ring curve, and the sweep. |
| `type` | `fontScaleCap` | `1.6` | The ceiling `scaleTypeStep` applies. |

**The colour role rule** (the load bearing part of AC-2). Measured against the paper ground `#f3f2f2`:

| Value | Ratio | Permitted on |
|---|---|---|
| `text` ink `#201f1d` | 14.74 | anything |
| `accentText` `#7d5411` | 5.97 | anything, including 10 point kickers |
| `textSubtle` (ink 70%) | 5.79 | anything |
| `textMuted` (ink 55%) | 3.63 | text at 24 points or above only (`h1`, `h2`, `h3`) |
| `accent` `#b68235` | 3.02 | hairlines, rules, ring strokes, control borders, and text at 24 points or above only |
| `divider` (ink 16%) | 1.38 | decorative rules only, never a control boundary on its own |
| `accentRamp[800]` on `accentRamp[100]` | 9.30 | the filled tag tones |
| `accentText` on paper, inside a gold hairline border | 5.97 | the outline tag tone. Its border may be `accent`, its text may not |

The practical effect: the canvas's 10 point gold eyebrows and its ink 50% meta rows move to `accentText` and `textSubtle`. Every other pixel stays.

**State transitions**:

No entity state machine. Each interactive component has the same four visual states, defined once and shared: `default`, `pressed` (the `colors.pressed` tint), `disabled` (opacity 0.45, matching `.btn:disabled`), and, for inputs, `error` (the `failure` intent). There is no hover state; this is a touch only app.

**API surface** (the component contract, this feature's interface):

| Component | Key props | Notes |
|---|---|---|
| `Screen` | `children`, `scroll?`, `gutter?` | Owns the paper background, the `space[6]` gutter, the scroll container, and the top inset applied as content padding so content still scrolls under the status bar. |
| `AppText` | `variant: keyof typeof type`, `color?`, `children` | The only text primitive. Applies `scaleTypeStep`, and sets `allowFontScaling={false}` on the React Native `Text` beneath it so the platform does not scale a second time. |
| `NumberText` | `value: string`, `unit: string`, `spoken?: string`, `estimated?`, `size?` | Heading face, `fontVariant: ['tabular-nums']`, and `allowFontScaling={false}` as above. The spoken label defaults to `value` plus `unit`, so it cannot drift from what is on screen; `spoken` overrides only when the default reads badly. `estimated` prefixes an approximately sign and appends "estimated" to the spoken label. |
| `Button` | `label`, `onPress`, `variant: 'primary' \| 'secondary' \| 'ghost'`, `size?`, `fullWidth?`, `disabled?`, `icon?` | Wraps `withMinTouchTarget`. `accessibilityRole="button"`. |
| `Icon` | `name: IconName`, `size?`, `color?` | Feather, behind a union of the marks we allow. Nothing else imports `@expo/vector-icons`. |
| `Field` | `label`, `children: (a11y: FieldA11y) => ReactNode`, `hint?`, `error?`, `required?` | Renders the label, the hint, and the error, and computes a typed `FieldA11y` (`accessibilityLabel`, `accessibilityHint`, `accessibilityInvalid`) that the caller spreads onto the control. A render prop rather than `cloneElement`, so the relationship is explicit and survives strict types, and the props land directly on the control rather than relying on `accessibilityLabelledBy`, whose Android support is uneven. |
| `TextInput` | `value`, `onChangeText`, `placeholder?`, `invalid?`, `multiline?`, plus `FieldA11y` | Hairline border, gold caret, gold border on focus. Minimum height 44. |
| `SegmentedControl` | `options`, `value`, `onChange`, plus `FieldA11y` | The canvas's `.seg`. Gold inset ring on the selected option. Fires a light haptic. |
| `RadioRow` | `label`, `selected`, `onSelect`, `trailing?`, plus `FieldA11y` | The 15 point dot drawn as the canvas has it, hit area expanded to 44. |
| `Stepper` | `value`, `onChange`, `min?`, `max?`, `format`, plus `FieldA11y` | The minus and plus pair. 30 by 28 as drawn, 44 tappable. Light haptic per change. |
| `Card` | `children`, `kicker?`, `title?`, `elevation?` | Hairline bordered, transparent ground. |
| `Tag` | `label`, `tone: 'accent' \| 'accent2' \| 'neutral' \| 'outline'` | The four tag classes. Filled tones use the 100 and 800 ramp steps (9.30:1). The outline tone borders in `accent` and sets its text in `accentText`, never in `accent`. |
| `ListRow` | `title`, `subtitle?`, `trailing?`, `onPress?`, `leading?` | The row used by Today's record, search results, activities, and settings. Bottom hairline. |
| `Divider` | `inset?` | `StyleSheet.hairlineWidth` in `colors.divider`. |
| `EmptyState` | `title`, `body`, `action?` | A heading plus one honest line. No illustration. |
| `LoadingState` | `message` | A quiet gold pulse on a short line, matching the canvas's "reading your day". Honours reduce motion. |
| `ErrorState` | `title`, `body`, `onRetry?` | The `failure` intent. Plain words, then a retry. |
| tab bar | `(tabs)/_layout.tsx` | Typographic labels in the heading face, a gold hairline above the active tab, icons stay hidden. |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| `AppText` renders | the font scale multiplier | `useWindowDimensions().fontScale` from `react-native`, passed through the pure `scaleTypeStep(step, fontScale)` which caps at `type.fontScaleCap`. The React Native `Text` beneath has `allowFontScaling={false}`, so this is the only place the scale is applied |
| `Screen` renders | the top and bottom safe area insets | `useSafeAreaInsets()` from `react-native-safe-area-context`, already a dependency and already used in `(tabs)/index.tsx` |
| any animated component | whether motion is reduced | `AccessibilityInfo.isReduceMotionEnabled()` plus its change subscription, behind `useReducedMotion()`. The query is asynchronous, so the hook returns reduced until it resolves: someone who asked for less motion never sees an un-reduced frame, and the cost is that the very first transition after launch is instant for everyone |
| `NumberText` renders | the spoken value | derived from the caller's `value` and `unit` props, so it cannot drift from what is on screen. The optional `spoken` prop overrides it. The component does not format the number; formatting helpers are deliberately out of scope and enrolled as a follow up |
| `NumberText` renders | the estimated marking | the caller's `estimated` prop, which feature 7 will drive from the scan's confidence |
| `Field` renders | the label, hint, and error relationship | computed by `Field` into a typed `FieldA11y` object and handed to the caller's render prop, which spreads it onto the control |
| any tappable control | its hit area | the pure `withMinTouchTarget(width, height)`, from the control's drawn size and `minTouchTarget` |
| tab bar renders | which tab is active | Expo Router's navigation state in `(tabs)/_layout.tsx` |
| any pressed control | the pressed tint | `colors.pressed`, resolved once in `theme.ts` from the CSS `:active` percentages |
| `Icon` renders | the glyph | the `IconName` union in `icon.tsx`, mapped to Feather names |
| haptics helper fires | whether feedback happens | `expo-haptics`, which is a no operation when the system has haptics disabled; the helper swallows any failure rather than throwing |
| any component | every colour, space, radius, type step | `src/design-system/theme.ts`, enforced by the AC-13 lint rules |

**Key invariants**:

- No raw hex colour, font family string, or bare measurement exists outside `src/design-system/theme.ts`.
- `colors.accent` never carries text below 24 points. `colors.accentText` is the only gold on small text.
- Every tappable element measures at least `minTouchTarget` (44) points in both axes, however small it is drawn.
- Adjacent tappables keep at least `space[2]` (9.2 points) between their drawn edges. Where two expanded hit areas would still overlap, the drawn control grows rather than the slop, so no tap can be captured by the wrong sibling.
- No component contains a user facing English word.
- The font scale multiplier never exceeds `type.fontScaleCap`, and scaling always applies to `fontSize` and `lineHeight` together.
- `allowFontScaling` is `false` on every React Native `Text` in the system. Scaling happens once, in `scaleTypeStep`, and never twice.
- When reduce motion is on, every duration resolves to `motion.duration.instant`. Until the reduce motion query resolves, treat it as on.
- Every health value that is an estimate renders through `NumberText` with `estimated`. There is no second way to say it, in a figure or in prose.
- Spacing snaps to the `space` scale. The canvas's round pixels round to the nearest step.

**Security model**:

Not applicable. This feature reads and writes no data, has no network surface, no authentication, and no authorisation. The one rule with teeth is the honesty requirement in the project's `AGENTS.md`: a health number that is uncertain must say so. AC-8 turns that from a principle into a component, and AC-15 keeps invented calorie numbers off the sample screen.

**Configuration required**:

No new environment variables and no credentials. Two new runtime dependencies:

- `@expo/vector-icons`: the Feather set, added as a direct dependency rather than relied on transitively through `expo`.
- `expo-haptics`: the shared feedback helper.

**Critical test scenarios**:

- Happy path: the rebuilt Today tab renders end to end from the component set alone, on iOS and Android, and reads as a finished screen, verifies **AC-15**, **AC-5**.
- Contrast: every permitted foreground and background pairing is checked against its threshold and passes, verifies **AC-2**.
- Font scale: `scaleTypeStep` returns proportional size and line height at 1.0, at 1.6, and at 3.0 where it must clamp to 1.6; the Today tab is inspected at the phone's maximum setting with nothing clipped, and the rendered size is confirmed to match the computed one rather than being scaled twice, verifies **AC-4**.
- Touch target: `withMinTouchTarget(width, height)` returns a hit area of at least 44 in both axes for a control drawn 30 by 28, 26 by 26, and 15 by 15, and returns zero slop for one already 48 by 48, verifies **AC-3**.
- Accessibility: with a screen reader on, a calorie figure is spoken with its unit, an estimated figure is spoken as estimated, and a field error is announced with its input rather than as loose text, verifies **AC-7**, **AC-8**, **AC-12**.
- Reduce motion: with the setting on, `LoadingState` and every animated component resolve to an instant transition, verifies **AC-9**.
- Failure case: haptics on a device with feedback disabled stays silent and does not throw, verifies **AC-11**.
- Enforcement: a raw hex in a screen file and a direct `Text` import from `react-native` in `src/app/` each fail `npm run lint`, verifies **AC-13**.

## Build plan

Ordered by the project's Skateboard approach: get the thinnest complete system standing under a real screen first, then thicken it, then make it impossible to drift from. Each slice leaves the app shippable.

**Slice 1: the thinnest system, standing under a real screen**

1. Extend `src/design-system/theme.ts` with `accentText`, `colors.intents`, `colors.pressed`, the `motion` group, and `type.fontScaleCap`, and write the colour role rule as a comment beside the values, satisfies **AC-2**, **AC-9**
2. Build the type spine: the pure `scaleTypeStep(step, fontScale)`, then `AppText`, then `NumberText` with tabular figures, the derived spoken label, and the estimated treatment. Both set `allowFontScaling={false}` on the React Native `Text` beneath, so the platform never scales on top of ours, satisfies **AC-4**, **AC-7**, **AC-8**
3. Build `Screen`, owning the background, the gutter, the scroll container, and the top inset as content padding so content still scrolls under the status bar, satisfies **AC-5**, **AC-14**
4. Build the pure `withMinTouchTarget(width, height)`, then `Icon` (Feather behind the `IconName` union) and `Button` on top of it, satisfies **AC-3**, **AC-5**
5. Build `Divider`, `ListRow`, `Card`, and `Tag`, satisfies **AC-5**
6. Rebuild `(tabs)/_layout.tsx` as the typographic bar with the gold active hairline, taking a variable number of tabs, satisfies **AC-10**
7. Rebuild the Today tab from these components only, with clearly marked sample data and no invented calorie numbers, satisfies **AC-15**, **AC-6**

**Slice 2: thicken it to what Release 1 needs**

8. Add `expo-haptics` and the shared feedback helper, silent when the system disables it, satisfies **AC-11**
9. Build `Stepper` on the helper and `withMinTouchTarget`, satisfies **AC-3**, **AC-5**, **AC-11**
10. Build `Field` with its typed `FieldA11y` render prop, then `TextInput`, `SegmentedControl`, and `RadioRow` accepting it, satisfies **AC-5**, **AC-12**
11. Build `EmptyState`, `LoadingState`, and `ErrorState`, all taking their copy from props, satisfies **AC-5**, **AC-6**
12. Add `useReducedMotion()`, defaulting to reduced until the asynchronous query resolves, and make `LoadingState` and every animated component honour it, satisfies **AC-9**

**Slice 3: make it hold**

13. Add the ESLint rules: `no-restricted-imports` for `react-native` primitives inside `src/app/**`, and `no-restricted-syntax` for hex literals and font family strings outside `theme.ts`, satisfies **AC-13**, **AC-14**
14. Cover every pure function in Vitest: `scaleTypeStep`, `withMinTouchTarget`, variant to style resolution, and intent to colour pair, satisfies **AC-16**
15. Write `docs/design/design.md` in full: type, colour roles with their measured ratios, spacing, motion, the estimated value rule, the adjacent tappable spacing rule, and every component with its variants, states, props, and accessibility contract, satisfies **AC-1**, **AC-8**
16. Sweep the set: confirm every pairing passes its threshold, every tappable measures 44 with no overlapping hit areas, and no component holds an English word, satisfies **AC-2**, **AC-3**, **AC-6**, **AC-14**

## Consequences

**Positive**:

- Features 5 through 10 stop making design decisions. Each one assembles from a set that already exists, which is the whole point of doing this before Release 1 rather than after.
- The accessibility baseline stops being an aspiration in `AGENTS.md` and becomes a property of the components. A screen built from them passes without its author thinking about it.
- The Today screen exists as a layout after slice 1, so feature 9 shrinks to wiring real data in and adding the ring.
- Nothing about the visual language changes. Every colour value in `theme.ts` survives untouched; only the rules about where each may appear are new.
- The lint rules mean the system holds without anyone policing it, which matches how the project already turned its `AGENTS.md` rules into checks.

**Negative / tradeoffs**:

- The canvas's small gold eyebrows and its lightest grey meta rows get visibly darker. It is a small change repeated on every screen, and it is the price of the AA floor.
- Two more dependencies to keep in step with the Expo SDK. Both are first party, so the cost is low but not zero.
- The Today tab is rebuilt without the calorie ring, so the app's focal screen is visibly incomplete at its focal point until feature 9 lands.
- The `Screen` component contradicts a convention `src/app/AGENTS.md` currently records. The note has to be updated, and until it is, the two disagree.
- The contrast rule in AC-2 is enforced by review and by the design.md record, not by a test. Nothing mechanical stops a future screen pairing gold with 12 point text.
- Components cannot be rendered in a test with the current setup, so the visual result rests entirely on `/check verify` on a real phone.
- No red anywhere means feature 10's account deletion has no colour signal for a destructive action. It has to carry that weight with a confirmation step and explicit wording instead.
- `Field` takes a function as its children rather than plain elements. It is explicit and it types cleanly, and it is slightly more to write than the usual form markup.

**Neutral**:

- Spacing shifts by two or three points against the canvas in several places, because the drawing used round pixels and the scale is 4.6 apart. Invisible in use, and it keeps the scale meaningful.
- Icons are available across the app but the tab bar stays typographic, so the Feather set earns its place only from slice 2 onward.
- `shadows` in `theme.ts` remains almost unused, since this design carries elevation with hairlines.
- Because reduce motion is assumed on until the system answers, the very first transition after a cold launch is instant for everyone. Nobody will notice it, and it is the safe direction to be wrong in.

## Follow-up

- [ ] Number formatting (thousands separators, kcal and gram units, rounding to the nearest 10) is shared logic with no home. Features 6, 8, and 9 will each need it, and `NumberText` deliberately does not do it. Decide where it lives before feature 6 starts.
- [ ] The calorie ring is out of scope here, so the rebuilt Today tab is incomplete at its focal point. Confirm feature 9 owns both the ring and the `react-native-svg` dependency it needs.
- [ ] The `.plate` photograph treatment in `classical.css` uses a sepia CSS filter, which has no React Native equivalent. Feature 7 or 8 needs a decision on how a meal photo is framed.
- [ ] `src/app/AGENTS.md` records that safe area insets are applied per screen and never by a wrapper. The `Screen` component changes that deliberately; the note needs updating when it lands.
- [ ] A rendering test setup (React Native Testing Library plus a widened Vitest pattern) was considered and deferred. Revisit once a screen has behaviour worth asserting rather than only appearance.
- [ ] An automated contrast test was offered and not taken. AC-2 currently holds by review. Worth reconsidering if the palette is ever retuned.
- [ ] `theme.ts` names `accent2` as `#ac803e`, but `docs/design/README.md` calls `#7d5411` the deeper shade for emphasis, and the canvas uses `#7d5411`. Reconcile the naming when `accentText` lands, so there is one obvious answer to "which is the deeper gold".
- [ ] `expo-react-native-performance` is installed at user level and is not referenced in this repo's `AGENTS.md`. If its conventions govern how these components are written, they belong in `src/design-system/AGENTS.md`, not in root.
