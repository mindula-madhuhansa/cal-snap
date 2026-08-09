/**
 * Intent to colour pair (spec 0003, AC-2).
 *
 * The palette has one hue, so a state cannot be signalled by turning
 * something red. Each intent resolves to a pair instead: the colour the words
 * are set in, and the colour of the rule, border, or dot that sits beside
 * them. Both sides of every pair clear the contrast floor, so choosing an
 * intent can never produce an unreadable screen.
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
