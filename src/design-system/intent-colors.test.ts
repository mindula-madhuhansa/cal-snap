import { describe, expect, it } from 'vitest';

import { intentColors, type Intent } from './intent-colors';
import { colors } from './theme';

const ALL_INTENTS: readonly Intent[] = ['over', 'notice', 'failure'];

describe('intentColors', () => {
  // covers: AC-2
  it('gives every intent both halves of its pair', () => {
    for (const intent of ALL_INTENTS) {
      const pair = intentColors(intent);

      expect(pair.text.length).toBeGreaterThan(0);
      expect(pair.mark.length).toBeGreaterThan(0);
    }
  });

  // covers: AC-2. `accent` is 3.02 against paper, which clears the bar for a
  // mark and fails it for words. No intent may set text in it.
  it('never sets an intent’s text in the brighter gold', () => {
    for (const intent of ALL_INTENTS) {
      expect(intentColors(intent).text).not.toBe(colors.accent);
    }
  });

  it('says going over the target in gold, calmly', () => {
    expect(intentColors('over')).toEqual({ text: colors.accentText, mark: colors.accent });
  });

  it('says a notice in the subtle ink rather than in a hue', () => {
    expect(intentColors('notice')).toEqual({ text: colors.textSubtle, mark: colors.accent });
  });

  // covers: AC-2. There is no red in this palette, so a real error is carried
  // by full-strength ink and a deep gold rule.
  it('says a failure in plain ink, with the deep gold as its mark', () => {
    expect(intentColors('failure')).toEqual({
      text: colors.text,
      mark: colors.accentRamp[700],
    });
  });
});
