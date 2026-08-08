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

export const colors = {
  bg: '#f3f2f2',
  surface: '#eae9e9',
  text: ink,
  /** Body text at reduced emphasis (`.text-muted`). */
  textMuted: withAlpha(ink, 55),
  /** Labels and meta rows. */
  textSubtle: withAlpha(ink, 70),
  accent: '#b68235',
  accent2: '#ac803e',
  divider: withAlpha(ink, 16),

  neutral: {
    100: '#f8f4f4',
    200: '#eae7e7',
    300: '#d7d3d3',
    400: '#bab6b6',
    500: '#9b9797',
    600: '#7d7979',
    700: '#605d5d',
    800: '#444141',
    900: '#2d2b2b',
  },

  accentRamp: {
    100: '#fff3e4',
    200: '#ffe3bf',
    300: '#facb8d',
    400: '#e1ad66',
    500: '#c28d41',
    600: '#a06f24',
    700: '#7d5411',
    800: '#5a3b0a',
    900: '#3a270d',
  },

  accent2Ramp: {
    100: '#fff3e4',
    200: '#ffe3be',
    300: '#f5cd96',
    400: '#dbaf70',
    500: '#bc8f4e',
    600: '#9b7232',
    700: '#79561f',
    800: '#573d14',
    900: '#382810',
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

export const theme = { colors, space, radii, fonts, type, shadows, minTouchTarget } as const;

export type Theme = typeof theme;
