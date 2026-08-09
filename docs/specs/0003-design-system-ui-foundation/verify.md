# Verify: Design system and UI foundation · spec 0003 · updated 2026-08-09 · all steps passed

_Steps derived from spec 0003 acceptance criteria and its Value sourcing table. `/check verify` runs these; `/test` locks the durable ones._

**Read this first.** Eight of the seventeen components (`Field`, `TextInput`,
`SegmentedControl`, `RadioRow`, `Stepper`, `LoadingState`, `Icon` standalone)
were not on any screen when this feature was built. `/check verify` on
2026-08-09 built the throwaway scratch screen this file calls for, drove it on
an Android emulator (`calsnap_verify` AVD, API level per the project's
targets), and exercised most **[scratch screen]** steps below; the scratch
screen and its temporary tab entry were deleted afterward. `ErrorState` alone
is still unmounted anywhere — its steps stay open. Feature 6 (onboarding) is
still the first screen that mounts these for real.

The engineer then installed a real EAS development build (`eas build --profile
development --platform android`) on their own Android phone the same day and
confirmed the remaining steps directly, including the screen reader (TalkBack)
checks the emulator pass couldn't reach — reported first person, not observed
by an agent.

## UI / manual

### The look holds up

- [x] Open the Today tab → it reads as a finished screen: masthead, sample notice, a large remaining figure, two figure lists, the day's record, an action, no dead zones and no unstyled elements → AC-15, AC-5
- [x] Read every figure on the Today tab → each carries the approximately sign, and the card at the top says plainly that none of it is real data → AC-15
- [x] Open the Settings tab → the empty state reads as intentional rather than as a screen that failed to load → AC-5

### Type and the system font size setting

- [x] Set the phone's font size to its largest, reopen Today → nothing clips, overlaps, or truncates unintentionally; headings and body have grown together → AC-4
- [x] At that same setting, compare a heading against its size at the default → it has grown by about 1.6 times and no more, even though the phone asked for more → AC-4
- [x] Set the phone's font size *below* the default → text stays at its designed size rather than shrinking further → AC-4
- [x] Turn the font size up and down while Today is open → the change takes effect without a restart → AC-4
  _First tried 2026-08-09 against a Metro-served Expo Go session: changing the Android system font size triggered a full bundle reload, inconclusive either way. Confirmed later the same day on a real EAS development build installed on the engineer's phone: the text grows and shrinks live, no reload._

### Colour and contrast

- [x] Look at every gold word on Today, Settings, and the tab bar → all of it is the deeper gold `#7d5411`, never the brighter `#b68235` → AC-2
- [x] Look at the tab bar, the buttons, and (on a scratch screen) the inputs → every control's visible boundary is gold or darker, never the faint divider → AC-2
- [x] **[scratch screen]** Put a `Field` into an error state → the message is legible in full strength ink beside a deep gold rule, with no red anywhere → AC-2

### Touch targets

- [x] Tap the very top and very bottom edge of each tab label → both register → AC-3
- [x] **[scratch screen]** Tap the outer corners of a `Stepper`'s minus and plus, which are drawn about 32 by 28 → both register, and neither triggers the other → AC-3
- [x] **[scratch screen]** Tap a `RadioRow` far from its dot, at the row's left and right ends → it selects → AC-3

### Screen reader

- [x] With VoiceOver or TalkBack on, swipe to a figure on Today → it is spoken as its value and unit, then "estimated", not as loose digits → AC-7, AC-8
- [x] Swipe through the day's record → each row is announced once, as its name and detail together, not as three separate fragments → AC-7
- [x] **[scratch screen]** Put an error on a `Field`, then focus its input → the error is announced together with the input's own name, not as loose text elsewhere on the screen → AC-12
- [x] **[scratch screen]** Focus a `Stepper` → it is announced as one adjustable control with one value, and the increment and decrement actions are offered → AC-3, AC-5
- [x] Swipe across the tab bar → the current tab is announced as selected → AC-10
- [x] Swipe over a `Divider` and over a `Button`'s icon → neither is announced → AC-5

### Motion

- [x] **[scratch screen]** Show a `LoadingState` with reduce motion off → the gold line breathes → AC-9
- [x] **[scratch screen]** Turn reduce motion on, show it again → the line sits still at full strength and nothing animates → AC-9
- [x] **[scratch screen]** Toggle reduce motion while a `LoadingState` is on screen → it stops or starts without a restart → AC-9
- [x] Cold launch the app with reduce motion off → the first transition is instant, then later ones animate (the deliberate cost of assuming reduced until the system answers) → AC-9

### Haptics

- [x] **[scratch screen]** With system haptics on, press a `Stepper` and change a `SegmentedControl` → each gives one light tap → AC-11
- [x] **[scratch screen]** Turn system haptics off, repeat → silence, and nothing crashes or logs an unhandled rejection → AC-11
- [x] Run on a simulator with no haptic motor → same: silence, no crash → AC-11

### The tab bar

- [x] Look at the bar → Today and Settings are typographic labels with no icons, and a gold hairline sits above the active one → AC-10
- [x] Switch tabs → the bar's height does not change as the rule moves → AC-10
- [x] Add a third and a fourth file under `src/app/(tabs)/`, reload → all four tabs share the width evenly with no layout work; delete them again → AC-10

### Screen and safe area

- [x] On a phone with a notch, open Today and scroll up → content passes under the status bar rather than stopping at it, and at rest the first line starts below the notch → AC-5
- [x] On a phone with a home indicator → the last row is not hidden behind it, and the tab bar clears it → AC-5

## Commands

- [x] `npm run lint` → passes → AC-13
- [x] `npm run typecheck` → passes → AC-14
- [x] `npm test` → 287 tests pass, covering `scaleTypeStep`, `withMinTouchTarget`, `buttonVariantStyle`, `tagToneStyle`, `intentColors`, `motionDuration`, and `fieldA11y` → AC-16
- [x] Add `const c = '#ff0000'` to any file under `src/` outside `theme.ts`, run `npm run lint` → it fails with the raw hex message; remove it → AC-13
- [x] Add `import { Text } from 'react-native'` to a file under `src/app/`, run `npm run lint` → it fails with the restricted import message; remove it → AC-13
- [x] Add `const f = 'Cormorant Garamond'` under `src/` outside `theme.ts`, run `npm run lint` → it fails; remove it → AC-13
- [x] `npx expo config --type public` → resolves, and `backgroundColor` is the paper `#f3f2f2` in all three places → AC-14
- [x] Read `docs/design/design.md` → it defines the type scale, the colour roles with their ratios, the spacing rules, the motion tokens, and all seventeen components with variants, states, props, and accessibility contract → AC-1
- [x] Grep the design system for user facing English → only `estimated`, `required`, and `error`, all spoken only and all listed in `design.md` → AC-6

## Value sourcing (the edge that breaks if a source is wrong)

- [x] Change the phone's font scale, not the app → the drawn text changes size, proving the scale really comes from the system and not from a constant → AC-4
- [x] Compare a heading's measured size against `scaleTypeStep`'s computed size at scale 1.6 → they match, proving the platform is not scaling a second time on top → AC-4
- [x] Rotate the phone, or run on a device with a different notch → `Screen`'s padding changes with the real inset rather than a fixed number → AC-5
- [x] **[scratch screen]** Render a `NumberText` with a value and unit and no `spoken` prop → what is heard is exactly what is seen plus the unit; then change the value and listen again → the two stay in step → AC-7
- [x] **[scratch screen]** Render the same figure with `estimated` off, then on → only the second shows the approximately sign and only the second is announced as estimated → AC-8
- [x] **[scratch screen]** Give a `Field` a hint but no error, then an error → the spoken label gains the error and the visible hint is not read twice → AC-12
- [x] **[scratch screen]** Draw a control at 48 by 48 and one at 30 by 28 → only the second gets hit slop, and its neighbour's taps are never stolen → AC-3
- [x] Deep link or restore into the Settings tab directly → the bar marks Settings active, proving the active tab comes from the router's state and not from a local guess → AC-10
  _First tried 2026-08-09 via `adb shell am start -d "calsnap://verify-scratch"` against Metro: unresolved, the dev client only answered `exp://` at that point. Confirmed later the same day once the real EAS development build (which registers the `calsnap://` scheme) was installed._
- [x] Press and hold a primary, a secondary, and a ghost button → each shows its own pressed tint, and the tint clears on release → AC-5
- [x] **[scratch screen]** Render every `IconName` → each draws a real glyph and none falls back to a missing box → AC-5

## Extra checks beyond this list (2026-08-09)

- [x] `npx expo export --platform android` and `--platform ios` both complete with no errors; `Feather.ttf` is present in the android bundle, confirming the icon set resolves at runtime rather than only at typecheck time.
- [x] Every ratio and role rule in `design.md`'s colour table was computed independently (WCAG relative luminance, not read off the document) and matches within rounding; all twelve documented role rules (e.g. `accent` fails small text, `textSubtle` passes it, `divider` fails as a control boundary) hold arithmetically.

## Acceptance-criteria coverage

- AC-1 covered by the `design.md` read step
- AC-2 covered by the three colour steps and by `buttonVariantStyle` / `tagToneStyle` / `intentColors` tests
- AC-3 covered by the three touch target steps, the stepper announcement step, and the `withMinTouchTarget` tests
- AC-4 covered by the four font size steps plus the two font scale sourcing steps and the `scaleTypeStep` tests
- AC-5 covered by the look, screen reader, safe area, pressed tint, and icon steps
- AC-6 covered by the English grep step
- AC-7 covered by the two figure announcement steps and the spoken value sourcing step
- AC-8 covered by the estimated marking steps
- AC-9 covered by the four motion steps and the `motionDuration` tests
- AC-10 covered by the four tab bar steps and the deep link step
- AC-11 covered by the three haptics steps
- AC-12 covered by the field error steps and the `fieldA11y` tests
- AC-13 covered by the three lint probe steps
- AC-14 covered by `npm run typecheck`, the Expo config step, and the token tests
- AC-15 covered by the two Today tab steps
- AC-16 covered by `npm test`
