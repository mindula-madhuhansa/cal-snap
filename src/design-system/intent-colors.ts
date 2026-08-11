/**
 * Intent to colour pair (spec 0003, AC-2).
 *
 * Each intent resolves to a pair: the colour the words are set in, and the
 * colour of the rule, border, dot, or bar that sits beside them. Both sides of
 * every pair clear 4.5:1 on every ground the design draws on, so choosing an
 * intent can never produce an unreadable screen.
 *
 * Colour alone never carries the meaning. Every intent is drawn with a rule or
 * a mark as well as a hue, so the difference survives a person who cannot tell
 * the two hues apart.
 */

import { colors } from './theme';

export type Intent = keyof typeof colors.intents;

/** The words, and the mark beside them. */
export type IntentColors = {
  readonly text: string;
  readonly mark: string;
};

/** The pair for an intent. Total over the union, so every case is covered. */
export const intentColors = (intent: Intent): IntentColors => colors.intents[intent];
