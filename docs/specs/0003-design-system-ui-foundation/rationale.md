# 0003. Design system and UI foundation, rationale

The reasoning behind [index.md](index.md). Not read during a build.

## Context

> ⚠️ Premise note: AC-15 asks for the Today tab rebuilt from the component set, which is the proof the scope's done when demands. That pulls feature 9's layout into feature 4, and the calorie ring was deliberately left out of this feature's inventory. The consequence is that CalSnap's focal screen will sit in the app looking visibly unfinished at exactly its focal point, for as long as feature 9 is unbuilt. That is an acceptable trade if feature 9 follows soon, and it is a poor one if Release 1 slips. The right framing is that feature 9 now owns two things and not three: the ring, and wiring real data into a layout that already exists. Worth confirming that explicitly rather than discovering it later.

CalSnap has a complete visual language and none of it is built. Spec 0001 ported `docs/design/classical.css` into `src/design-system/theme.ts` as typed tokens (colours, a 4.6 point spacing scale, tiny radii, four font cuts, a ten step type scale, three elevation steps, and a 44 point touch floor), and the scaffold's sample screen proves those tokens load on a phone. Above that line there is nothing. Every screen in features 5 through 10 would currently start by inventing its own button, its own list row, and its own idea of what a label looks like.

There is also a full design canvas in the repo, `docs/design/CalSnap.dc.html`, drawing every screen the product will ever have: five onboarding steps, Today with its calorie ring and macro bars, the camera, the scan result with per item portion steppers, add by hand, exercise, the weekly ledger with a weight trend, a coach chat, settings, and a five tab bar. It is unusually complete for a design at this stage. It is also drawn in HTML with inline styles, in round pixels, against a browser's rendering model, and it covers work the scope has in Release 2 and in Deferred. So it is an excellent source and a poor specification.

Three forces shaped this decision. First, the project's `AGENTS.md` makes WCAG AA the accessibility baseline on every screen, and the palette does not currently clear it. Measured against the paper ground, the accent gold `#b68235` is 3.02:1 and the `textMuted` token is 3.63:1, both short of the 4.5:1 that normal sized text requires, and the canvas leans on both for its 10 point uppercase eyebrows and its meta rows. The canvas's lighter greys, at ink 45% and 42%, measure 2.74 and 2.54 and fail outright. This is not a detail to be fixed per screen; it is a property of the system or it is nothing.

Second, the project's rules are strict in a way that shapes the component API: pure functions by default, immutable data, strict types with every case handled, no escape hatches, named exports only, folder by feature. A component set written against those rules looks different from a typical React Native one, and the difference is mostly in where decisions live. Anything that can be a pure function of its inputs should be, because that is the part that can be tested without a phone.

Third, health numbers are the product, and `AGENTS.md` requires that an uncertain value says so rather than being presented as fact. The AI scan in feature 7 will return values with varying confidence, and if the way to express that is invented under deadline in feature 7, it will be inconsistent with everywhere else. The credibility of the whole app rests on the treatment being decided once, here, before there is pressure on it.

Not deciding means each of features 5 through 10 makes its own version of these calls, in a hurry, and the app ends up looking like six people built it. Design systems are cheap to build once and expensive to retrofit, which is precisely why the scope placed this in Foundation rather than treating it as a coat of paint.

## Options considered

### Option 1: Port the canvas into a small typed component set, with colour governed by role

Build seventeen components from the existing tokens and the canvas, sized to what Release 1 actually consumes. Keep every colour value untouched and instead define which role each colour may play, so the deeper gold carries text, the accent carries hairlines and large figures, and every permitted pairing clears AA. Enforce the rules in ESLint and record them in `docs/design/design.md`.

**Pros**:

- The visual language survives intact. No value in `theme.ts` changes, so the canvas and the app stay recognisably the same design.
- Accessibility becomes a property of the components rather than a thing each screen author remembers.
- The component set is small enough to build in one feature and complete enough that Release 1 never has to extend it under pressure.
- Pure decision functions (font scale, hit area, variant to style, intent to colour) are testable in the Vitest setup that already exists, with no new test infrastructure.

**Cons**:

- The colour role rule is two rules, not one. A builder has to know that gold means one thing on a hairline and another on text, and nothing mechanical enforces it.
- The canvas's lightest text visibly darkens on every screen. It is a small loss repeated everywhere.
- Seventeen components is real work before any user facing feature ships, on a plan whose whole idea is shipping the smallest usable thing.

### Option 2: Adopt a third party React Native component library and theme it

Take an established library (Tamagui, gluestack, React Native Paper, or similar) and configure it with the Classical tokens, then build on its primitives.

**Pros**:

- Accessibility, press states, font scaling, and platform differences are already solved and battle tested by many more users than this app will have.
- Far less to build now, and far less to maintain later.
- New contributors would arrive already knowing the API.

**Cons**:

- Every one of these libraries carries a strong visual opinion, and Classical is a deliberate rejection of the usual app look. Theming a library into a design of hairlines, serif numerals, and almost no fills means fighting its defaults on every component, which is usually more work than writing seventeen small files.
- `AGENTS.md` and `src/design-system/AGENTS.md` both record a decision that styling is React Native `StyleSheet` only, with no styling library. This would overturn a shipped decision from spec 0001 rather than build on it.
- It adds a large dependency, its styling runtime, and its upgrade cycle to a project that currently has a notably clean dependency list.
- The libraries that theme most flexibly are the ones with the heaviest runtimes, which is a real cost on a phone.

### Option 3: No component layer, keep tokens plus per screen StyleSheet

Leave things as they are. Each screen imports tokens and writes its own styles, and shared patterns get extracted only when the same thing has been written three times.

**Pros**:

- Nothing to build now, and Release 1 features start immediately.
- No abstraction is invented before its real usage is known, which is a genuine risk in any design system built up front.
- The tokens already prevent the worst kind of drift, since no screen can invent a colour.

**Cons**:

- Accessibility gets re-decided per screen, which in practice means it gets skipped on most of them. Touch targets, font scaling, and the label to error relationship are exactly the things that never get retrofitted.
- The canvas's small gold text would be copied faithfully into six screens, each of them failing AA, before anyone measured it.
- The scope's own done when requires `design.md` and a sample screen, so this option does not actually satisfy the feature.
- Extracting a component after six screens use a hand rolled version is strictly more work than writing it once.

### Option 4: Build every component the canvas draws

Build the full set now, including the weekly bar chart, the weight sparkline, the calorie ring, and the coach chat bubbles.

**Pros**:

- The system would be complete, and Release 2 and the deferred features would arrive with their UI already waiting.
- The charts and the ring are the parts that most define the look, so building them early would tell you sooner whether the design works on a real phone.

**Cons**:

- It builds Release 2 and Deferred UI before knowing whether the product works at all, which is the opposite of what Skateboard asks for.
- It pulls in `react-native-svg` and a meaningful amount of chart work for features that may be reshaped or, in the coach's case, may never ship.
- A foundation feature that takes three times as long delays everything behind it, and everything is behind it.

## Rationale

Option 1 wins on the force that Context puts first: the accessibility floor is stated as non negotiable in `AGENTS.md`, and only a component layer can make it hold without depending on every future screen author remembering it. Options 3 and 4 both leave that to per screen discipline, which is precisely how the canvas's 2.54:1 grey would end up shipping.

Between restricting roles and retuning the tokens, restricting won because of what Context says about the design's origin. `theme.ts` was ported exactly from `classical.css` and its `AGENTS.md` documents that exactness as the point, right down to keeping the odd 4.6 spacing numbers unrounded. Retuning `accent` and `textMuted` to clear 4.5:1 would darken the warm gold noticeably and put the app permanently out of step with the canvas and the CSS that both remain in the repo as the source of truth. Restricting where each value may appear leaves all three artefacts telling the same story, and it costs one rule that `design.md` can state in a table.

Option 2 is the one worth defending, and it lost on a specific force rather than a general preference. Spec 0001 already decided `StyleSheet` only with no styling library, and `src/design-system/AGENTS.md` records it. Overturning a shipped foundational decision needs a stronger reason than saving work, and the saving is smaller than it looks: a design of hairlines and serif numerals with almost no fills is exactly the case where a library's defaults become an obstacle rather than a head start. Seventeen small files that do only what this app needs is the more boring choice, and boring is what a foundation should be.

Two of the engineer's picks went against my recommendation, and both are defensible. On icons, I argued for no icon set at all, since the canvas is typographic and the four marks it uses are letterforms; `@expo/vector-icons` with Feather was chosen instead. That is the safer call for the features still ahead, several of which will want a mark that a serif glyph cannot carry, and putting Feather behind a name union means the family is one file's worth of change if it turns out to clash. On the contrast rule, an automated test was offered alongside the role restriction and not taken. The rule therefore holds by review and by `design.md` only, which is the weakest part of this spec and is enrolled as a follow up rather than argued further.

## Supporting evidence: measured contrast

Every value computed against the paper ground `#f3f2f2`, using the WCAG relative luminance formula. Alpha tokens are resolved to their composited value over the ground first, since React Native composites them the same way.

| Foreground | Composited | Ratio | AA verdict |
|---|---|---|---|
| `text` ink `#201f1d` | `#201f1d` | 14.74 | passes at any size |
| `accentRamp[700]` `#7d5411` | `#7d5411` | 5.97 | passes at any size |
| `textSubtle`, ink 70% | `#5f5e5d` | 5.79 | passes at any size |
| `accentRamp[600]` `#a06f24` | `#a06f24` | 3.92 | 24 points and above only |
| `textMuted`, ink 55% | `#7f7e7d` | 3.63 | 24 points and above only |
| `accent2` `#ac803e` | `#ac803e` | 3.18 | 24 points and above only |
| canvas ink 50% | `#8a8988` | 3.12 | 24 points and above only |
| `accent` `#b68235` | `#b68235` | 3.02 | 24 points and above, and control boundaries |
| canvas ink 45% | `#949392` | 2.74 | fails everywhere |
| canvas ink 42% | `#9a9999` | 2.54 | fails everywhere |
| `divider`, ink 16% | `#d1d0d0` | 1.38 | decorative only |

Two further pairings, checked because the components use them:

| Pairing | Ratio | Verdict |
|---|---|---|
| ink on `surface` `#eae9e9` | 13.59 | passes |
| `accent` on `surface` | 2.78 | fails, so gold on surface is never text |
| tag: `accentRamp[800]` on `accentRamp[100]` | 9.30 | passes comfortably |

The threshold used throughout is WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for text at 24 CSS pixels or above (or 18.66 pixels at semibold), and 3:1 for the visible boundary of a user interface component. React Native points map to CSS pixels closely enough for this purpose, so the practical cut is at the `h3` step (25 points): `h1`, `h2`, and `h3` may use the 3:1 group, and everything from `h4` down may not.

## Supporting evidence: what the canvas actually contains

Extracted from `docs/design/CalSnap.dc.html`, to size the component inventory against real usage rather than guesswork.

| Pattern in the canvas | Appears on | Becomes |
|---|---|---|
| Scrolling page, 58 point top pad, 24 point gutter | every screen | `Screen` |
| Uppercase gold eyebrow, 10 points, wide tracking | Today, Result, Exercise, Ledger, Coach, Settings | `AppText` with `type.kicker` |
| Serif figure with `font-feature-settings: 'tnum'` | Today's remaining, tallies, macros, every kcal, the ledger stats, weight | `NumberText` |
| Row: leading mark, title, subtitle, trailing figure, bottom hairline | Today's record, search results, activities, settings | `ListRow` |
| Minus and plus pair around a value | Result's portions, Exercise's duration | `Stepper` |
| Full width bordered action, 50 points tall | Result, Exercise, onboarding | `Button` with `variant="primary"` and `fullWidth` |
| Horizontal group with a gold inset ring on the selection | Result's meal slot, onboarding's activity and goal | `SegmentedControl` |
| Dot with an inner ring when selected | Exercise's activities, onboarding | `RadioRow` |
| Bordered box with a label above | Exercise's duration, the weight chart | `Card` |
| Pill with a hairline gold border | Coach's suggested prompts | `Tag` with `tone="outline"` |
| Text input, gold caret, hairline border | search, coach, onboarding | `TextInput` inside `Field` |
| Full width hairline | everywhere | `Divider` |
| Pulsing gold line of text | Coach's "reading your day" | `LoadingState` |
| Typographic tab labels, gold hairline over the active one | the bar | `(tabs)/_layout.tsx` |
| SVG progress ring, weekly bars, weight polyline | Today, Ledger | out of scope, features 9 and 15 |
| Chat bubbles with an aligned speaker label | Coach | out of scope, deferred |
| `.plate` photo frame with a sepia filter | Result | out of scope, needs a decision, see follow up |

Seventeen components cover everything Release 1 touches. The three excluded groups all belong to features the scope has placed later.

## Supporting evidence: spacing drift between the canvas and the scale

The canvas was drawn in round pixels; the token scale is 4.6 apart. Where they differ, the component snaps to the nearest step. The differences are all under 3.6 points.

| Canvas value | Nearest step | Delta |
|---|---|---|
| 24 (page gutter) | `space[6]` 27.6 | 3.6 |
| 22 (section margin) | `space[4]` 18.4 or `space[6]` 27.6 | 3.6 |
| 18 (block gap) | `space[4]` 18.4 | 0.4 |
| 14 (row gap, list padding) | `space[3]` 13.8 | 0.2 |
| 12 (inline gap) | `space[2]` 9.2 or `space[3]` 13.8 | 1.8 |
| 10 (tight padding) | `space[2]` 9.2 | 0.8 |
| 5, 6 (micro gaps) | `space[1]` 4.6 | 0.4 to 1.4 |

The two 3.6 point cases (the gutter and the section margin) are the only ones large enough to notice side by side, and both are page rhythm rather than component detail.
