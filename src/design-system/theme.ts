/**
 * Classical theme tokens, ported from `docs/design/classical.css`.
 *
 * This module owns the raw tokens only. The components built from them are
 * scope feature 4 (Design system & UI foundation), not this one.
 *
 * CSS `color-mix(in srgb, X n%, transparent)` has no React Native equivalent,
 * so those tokens are resolved here to the `rgba()` they produce.
 */

/** `color-mix(in srgb, <hex> <percent>%, transparent)` resolved to `rgba()`. */
const withAlpha = (hex: string, percent: number): string => {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${percent / 100})`;
};

const ink = '#201f1d';
const shadowInk = '#2d2b2b';
const accent = '#b68235';

const textMuted = withAlpha(ink, 55);
const textSubtle = withAlpha(ink, 70);

const neutral = {
  100: '#f8f4f4',
  200: '#eae7e7',
  300: '#d7d3d3',
  400: '#bab6b6',
  500: '#9b9797',
  600: '#7d7979',
  700: '#605d5d',
  800: '#444141',
  900: '#2d2b2b',
} as const;

const accentRamp = {
  100: '#fff3e4',
  200: '#ffe3bf',
  300: '#facb8d',
  400: '#e1ad66',
  500: '#c28d41',
  600: '#a06f24',
  700: '#7d5411',
  800: '#5a3b0a',
  900: '#3a270d',
} as const;

const accent2Ramp = {
  100: '#fff3e4',
  200: '#ffe3be',
  300: '#f5cd96',
  400: '#dbaf70',
  500: '#bc8f4e',
  600: '#9b7232',
  700: '#79561f',
  800: '#573d14',
  900: '#382810',
} as const;

/**
 * The colour role rule (spec 0003, AC-2). The palette is kept exactly as the
 * design drew it; what is new is where each value is allowed to appear. Every
 * ratio below is measured against the paper ground `#f3f2f2`.
 *
 * | Value                              | Ratio | Permitted on                                                          |
 * | ---------------------------------- | ----- | --------------------------------------------------------------------- |
 * | `text` ink `#201f1d`               | 14.74 | anything                                                              |
 * | `accentText` `#7d5411`             |  5.97 | anything, including the 10 point kickers                              |
 * | `textSubtle` (ink 70%)             |  5.79 | anything                                                              |
 * | `textMuted` (ink 55%)              |  3.63 | text at 24 points or above only (`h1`, `h2`, `h3`)                    |
 * | `accent` `#b68235`                 |  3.02 | hairlines, rules, ring strokes, control borders, and text 24pt and up |
 * | `divider` (ink 16%)                |  1.38 | decorative rules only, never a control boundary on its own            |
 * | `accentRamp[800]` on `[100]`       |  9.30 | the filled tag tones                                                  |
 * | `accentText` inside a gold border  |  5.97 | the outline tag tone: its border may be `accent`, its text may not    |
 *
 * The practical effect: gold on small text is always `accentText`, never
 * `accent`, and anything a finger can press is bounded in `accent` or darker.
 */
export const colors = {
  bg: '#f3f2f2',
  surface: '#eae9e9',
  text: ink,
  /** Body text at reduced emphasis (`.text-muted`). 24 points and above only. */
  textMuted,
  /** Labels and meta rows. Passes at any size. */
  textSubtle,
  accent,
  accent2: '#ac803e',
  /** The only gold permitted on text below 24 points. */
  accentText: accentRamp[700],
  divider: withAlpha(ink, 16),

  neutral,
  accentRamp,
  accent2Ramp,

  /**
   * What a state means, said in a colour pair rather than in a hue. `text` is
   * what the words are set in, `mark` what the rule, border, or dot beside
   * them is drawn in. There is no red anywhere: a wrong day is not a failure,
   * and a real error is carried by plain words and a rule.
   */
  intents: {
    /** The day's target exceeded. Calm, never alarming. */
    over: { text: accentRamp[700], mark: accent },
    /** Wants attention, but nothing has gone wrong. */
    notice: { text: textSubtle, mark: accent },
    /** A genuine error. Signalled by words and a rule, not by hue. */
    failure: { text: ink, mark: accentRamp[700] },
  },

  /** The CSS `:active` tints, resolved for React Native. */
  pressed: {
    accent: withAlpha(accent, 22),
    neutral: withAlpha(ink, 14),
    ghost: withAlpha(accent, 18),
  },
} as const;

/**
 * The design's scale is 4.6 apart rather than 4, and the odd numbers are
 * deliberate. Kept exactly as the CSS has them.
 */
export const space = {
  1: 4.6,
  2: 9.2,
  3: 13.8,
  4: 18.4,
  6: 27.6,
  8: 36.8,
} as const;

export const radii = {
  sm: 2,
  md: 4,
  lg: 7,
  /** `.tag` uses `calc(var(--radius-md) * 0.75)`. */
  tag: 3,
  full: 999,
} as const;

/**
 * Font family names as `expo-font` registers them. Nothing should reference a
 * font by string anywhere else.
 */
export const fonts = {
  headingRegular: 'CormorantGaramond_400Regular',
  headingSemiBold: 'CormorantGaramond_600SemiBold',
  bodyRegular: 'Lora_400Regular',
  bodySemiBold: 'Lora_600SemiBold',
} as const;

/**
 * The type scale from `classical.css`. `lineHeight` is absolute in React
 * Native, so the CSS multipliers are resolved against each size here.
 * Headings and every number use the heading face; body copy uses Lora.
 */
export const type = {
  h1: { fontFamily: fonts.headingSemiBold, fontSize: 42, lineHeight: 47, letterSpacing: -0.63 },
  h2: { fontFamily: fonts.headingSemiBold, fontSize: 32, lineHeight: 36, letterSpacing: -0.48 },
  h3: { fontFamily: fonts.headingSemiBold, fontSize: 25, lineHeight: 28, letterSpacing: -0.38 },
  h4: { fontFamily: fonts.headingSemiBold, fontSize: 20, lineHeight: 22, letterSpacing: -0.3 },
  h5: { fontFamily: fonts.headingSemiBold, fontSize: 16, lineHeight: 18, letterSpacing: -0.24 },
  /** `h6` is the uppercase eyebrow, not a heading size. */
  h6: { fontFamily: fonts.headingSemiBold, fontSize: 13, lineHeight: 15, letterSpacing: 1.04 },
  body: { fontFamily: fonts.bodyRegular, fontSize: 15, lineHeight: 23 },
  bodySmall: { fontFamily: fonts.bodyRegular, fontSize: 14, lineHeight: 22 },
  label: { fontFamily: fonts.bodyRegular, fontSize: 12, lineHeight: 18 },
  caption: { fontFamily: fonts.bodyRegular, fontSize: 11, lineHeight: 17 },
  /** Card kickers and tags: 10px, wide tracking, uppercase at the call site. */
  kicker: { fontFamily: fonts.bodyRegular, fontSize: 10, lineHeight: 14, letterSpacing: 1 },

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
 * Motion, ported from the canvas. `base` is its macro bars, `slow` its
 * calorie ring, and the two loops are its scan sweep and its typing pulse.
 *
 * Easing is stored as the four cubic bezier control points rather than as a
 * built `Easing` object, so this module stays free of any React Native
 * import and the pure functions built on it can be tested without a phone.
 * The animating component builds the curve from these.
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
 * Elevation. React Native needs both the iOS shadow parts and Android's
 * `elevation`, so each step carries both.
 */
export const shadows = {
  sm: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: shadowInk,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 12,
  },
} as const;

/**
 * The smallest touch target we ship, in points. WCAG AA asks for 44, and
 * `AGENTS.md` makes that the accessibility baseline on every screen.
 */
export const minTouchTarget = 44;

export const theme = {
  colors,
  space,
  radii,
  fonts,
  type,
  motion,
  shadows,
  minTouchTarget,
} as const;

export type Theme = typeof theme;
