/**
 * The Nocturne theme, ported from the design in `docs/design/`.
 *
 * This module owns the raw tokens only. Every colour, space, radius, font,
 * type step, motion duration, gradient, and shadow the app uses is defined
 * here once, so no screen ever invents a number.
 *
 * The design is **dark only**. It is one ground, not a light theme with a dark
 * variant, so there is no colour-scheme branch anywhere and `app.config.ts`
 * pins `userInterfaceStyle` to `dark`.
 */

/** A hex plus an alpha percentage, resolved to the `rgba()` React Native wants. */
const withAlpha = (hex: string, percent: number): string => {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${percent / 100})`;
};

/** The ground, and the two surfaces that sit on it. */
const ground = '#0a0c14';
const surface = '#161926';
const surfaceRaised = '#1d2130';

/** The paper of this design: near white, never pure white. */
const paper = '#f4f6fb';

/**
 * The brand pair. Every gradient in the design runs cyan to violet, left to
 * right or top to bottom, and nothing else is ever the accent.
 */
const cyan = '#5fdcd0';
const violet = '#8f7bf5';

/**
 * The state hues. Unlike the theme this replaced, this design does carry
 * meaning in colour, so each one is paired with a text-safe cut: the bright
 * value is for marks, rules, bars and rings, the `…Text` value for words.
 *
 * Every ratio below is measured against the ground `#0a0c14`, and again
 * against `surfaceRaised` `#1d2130`, which is the palest thing anything is
 * ever drawn on and therefore the worst case.
 */
const green = '#3ee08f';
const amber = '#e8a33d';
const coral = '#ff7a5c';
const red = '#ff6b6b';

/**
 * The colour role rule. The palette is kept exactly as the design drew it;
 * what is defined here is where each value is allowed to appear.
 *
 * | Value                      | Ground | Raised | Permitted on                                    |
 * | -------------------------- | ------ | ------ | ----------------------------------------------- |
 * | `text` `#f4f6fb`           |  18.06 |  14.80 | anything                                        |
 * | `cyan` `#5fdcd0`           |  11.75 |   9.63 | anything, including the smallest mono labels    |
 * | `green` `#3ee08f`          |  11.40 |   9.34 | anything                                        |
 * | `amber` `#e8a33d`          |   9.05 |   7.42 | anything                                        |
 * | `coral` `#ff7a5c`          |   7.61 |   6.24 | anything                                        |
 * | `textMuted` (paper 62%)    |   7.20 |   5.90 | anything                                        |
 * | `red` `#ff6b6b`            |   7.04 |   5.77 | anything                                        |
 * | `violet` `#8f7bf5`         |   5.88 |   4.82 | anything                                        |
 * | `textDim` (paper 42%)      |   3.83 |   3.14 | text at 20 points and above, and marks          |
 * | `borderStrong` (paper 24%) |   2.01 |   1.65 | a card's edge, never a control's only boundary  |
 * | `border` (paper 10%)       |   1.25 |   1.02 | decorative rules only, never a control boundary |
 *
 * Every hue clears 4.5:1 on both grounds, so a state may be said in colour
 * here in a way the theme this replaced could not afford. `textDim` is the one
 * value that does not, which is why it is capped at 20 points and marks.
 *
 * The practical effect: anything a finger can press is bounded in `cyan`,
 * `violet`, or a filled surface, never in `border` alone; and the faintest
 * paper tint is for rules, never for a sentence.
 *
 * `textOnAccent` is the ground itself, set on the gradient. Its worst point is
 * the violet end, at 5.88.
 */
export const colors = {
  bg: ground,
  /** A card, a field, a row group. */
  surface,
  /** A card sitting on a card, and the pressed state of a plain surface. */
  surfaceRaised,

  text: paper,
  /** Body copy at reduced emphasis. Passes at any size. */
  textMuted: withAlpha(paper, 62),
  /** The quietest step. 20 points and above only, or a decorative mark. */
  textDim: withAlpha(paper, 42),
  /** Words set on a filled cyan or gradient ground. */
  textOnAccent: ground,

  cyan,
  violet,
  green,
  amber,
  coral,
  red,

  /** Decorative rules and the faintest separations. Never a control boundary. */
  border: withAlpha(paper, 10),
  /** A card's visible edge. */
  borderStrong: withAlpha(paper, 24),

  /**
   * The three macros, each with its own hue, because the design draws them as
   * three bars that have to be told apart at a glance rather than read.
   */
  macros: {
    protein: green,
    carbs: violet,
    fat: coral,
  },

  /**
   * What a state means, said as a pair: `text` is what the words are set in,
   * `mark` the rule, border, dot, or bar beside them.
   */
  intents: {
    /** The day's target exceeded. Worth seeing, never an alarm. */
    over: { text: amber, mark: amber },
    /** Wants attention, but nothing has gone wrong. */
    notice: { text: amber, mark: amber },
    /** A genuine error. */
    failure: { text: red, mark: red },
    /** Something went right, and saying so is the point. */
    success: { text: green, mark: green },
  },

  /** The pressed tints, one per surface a press can land on. */
  pressed: {
    accent: withAlpha(cyan, 18),
    neutral: withAlpha(paper, 8),
    ghost: withAlpha(cyan, 12),
    surface: surfaceRaised,
  },

  /** A translucent wash of each hue, for a filled tag or a selected card. */
  wash: {
    cyan: withAlpha(cyan, 12),
    violet: withAlpha(violet, 14),
    green: withAlpha(green, 12),
    amber: withAlpha(amber, 12),
    coral: withAlpha(coral, 12),
    red: withAlpha(red, 12),
    neutral: withAlpha(paper, 6),
  },

  /** The indigo haze the design paints behind the top of every screen. */
  glow: {
    top: withAlpha(violet, 16),
    fade: withAlpha(violet, 0),
  },
} as const;

/**
 * Gradients, as the ordered colour stops React Native's linear gradient takes.
 * Cyan to violet is the brand; nothing else runs a gradient.
 */
export const gradients = {
  /** Left to right. The primary action, and the level and progress bars. */
  brand: [cyan, violet],
  /** The same pair, reversed, for a ring that starts at the top. */
  brandReversed: [violet, cyan],
} as const;

/** A plain 4 point grid. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  6: 24,
  8: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  /** The small pill on a tag or a chip. */
  tag: 8,
  full: 999,
} as const;

/**
 * Font family names as `expo-font` registers them. Nothing should reference a
 * font by string anywhere else.
 *
 * Two faces. Outfit carries every heading, every number, and all body copy;
 * JetBrains Mono carries the uppercase micro labels and the dense data lines
 * ("0.25 KG/WK · -250 KCAL"), where a fixed advance width is what makes a
 * column of figures line up.
 */
export const fonts = {
  displayBold: 'Outfit_700Bold',
  headingSemiBold: 'Outfit_600SemiBold',
  headingMedium: 'Outfit_500Medium',
  bodyRegular: 'Outfit_400Regular',
  monoRegular: 'JetBrainsMono_400Regular',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

/**
 * The type scale. `lineHeight` is absolute in React Native, so every
 * multiplier is already resolved to points here.
 */
export const type = {
  /** The one figure a screen is built around: the ring's number, the target. */
  display: { fontFamily: fonts.displayBold, fontSize: 56, lineHeight: 60, letterSpacing: -1.6 },
  h1: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  h2: { fontFamily: fonts.displayBold, fontSize: 25, lineHeight: 31, letterSpacing: -0.4 },
  h3: { fontFamily: fonts.headingSemiBold, fontSize: 20, lineHeight: 26, letterSpacing: -0.3 },
  h4: { fontFamily: fonts.headingSemiBold, fontSize: 17, lineHeight: 23, letterSpacing: -0.2 },
  h5: { fontFamily: fonts.headingSemiBold, fontSize: 15, lineHeight: 20 },
  /** `h6` is the uppercase mono eyebrow, not a heading size. */
  h6: { fontFamily: fonts.monoBold, fontSize: 11, lineHeight: 15, letterSpacing: 1.6 },
  body: { fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 23 },
  bodySmall: { fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: fonts.headingMedium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.bodyRegular, fontSize: 12, lineHeight: 18 },
  /** The dense mono data line under a title: `08:20 · P14 C58 F9`. */
  data: { fontFamily: fonts.monoRegular, fontSize: 11, lineHeight: 16, letterSpacing: 0.4 },
  /** Section kickers and tags: 10 point mono, wide, uppercased at the call site. */
  kicker: { fontFamily: fonts.monoBold, fontSize: 10, lineHeight: 14, letterSpacing: 1.5 },

  /**
   * The ceiling `scaleTypeStep` applies to the system font size setting. Past
   * 1.6 the design's long headings start to clip on a small phone, so this is
   * where growing stops.
   */
  fontScaleCap: 1.6,
} as const;

/**
 * Every key of `type` that is really a type step. `fontScaleCap` lives in the
 * same group because it belongs to the type system, but it is a number rather
 * than a step, so it is excluded here and `AppText` cannot be asked for it.
 */
export type TypeVariant = Exclude<keyof typeof type, 'fontScaleCap'>;

/**
 * Motion. `base` is the macro bars, `slow` the calorie ring, and the two loops
 * are the scan sweep and the typing pulse.
 *
 * Easing is stored as the four cubic bezier control points rather than as a
 * built `Easing` object, so this module stays free of any React Native import
 * and the pure functions built on it can be tested without a phone.
 */
export const motion = {
  duration: {
    /** What every duration collapses to when reduce motion is on. */
    instant: 0,
    fast: 160,
    base: 600,
    slow: 700,
  },
  loop: {
    sweep: 2400,
    pulse: 1200,
  },
  easing: {
    standard: [0.4, 0, 0.2, 1],
    linear: [0, 0, 1, 1],
  },
} as const;

/**
 * Elevation. On a ground this dark a drop shadow is nearly invisible, so the
 * design lifts a card with a brighter surface and an edge instead, and keeps
 * shadow for the two things that genuinely float: the primary action and the
 * tab bar. React Native needs both the iOS parts and Android's `elevation`,
 * so each step carries both.
 */
export const shadows = {
  sm: {
    shadowColor: ground,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: ground,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
  lg: {
    shadowColor: ground,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.6,
    shadowRadius: 32,
    elevation: 14,
  },
  /** The cyan bloom under the primary action and the snap button. */
  glow: {
    shadowColor: cyan,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 8,
  },
} as const;

/**
 * The smallest touch target we ship, in points. WCAG AA asks for 44, and
 * `AGENTS.md` makes that the accessibility baseline on every screen.
 */
export const minTouchTarget = 44;

export const theme = {
  colors,
  gradients,
  space,
  radii,
  fonts,
  type,
  motion,
  shadows,
  minTouchTarget,
} as const;

export type Theme = typeof theme;
