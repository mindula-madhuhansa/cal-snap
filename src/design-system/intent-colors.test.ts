import { describe, expect, it } from 'vitest';

import { intentColors, type Intent } from './intent-colors';
import { colors } from './theme';

const ALL_INTENTS: readonly Intent[] = ['over', 'notice', 'failure', 'success'];

describe('intentColors', () => {
  it('gives every intent both halves of its pair', () => {
    for (const intent of ALL_INTENTS) {
      const pair = intentColors(intent);

      expect(pair.text.length).toBeGreaterThan(0);
      expect(pair.mark.length).toBeGreaterThan(0);
    }
  });

  // `textDim` is the one palette value below 4.5:1. It is permitted on large
  // text and on marks, and an intent's words are neither.
  it('never sets an intent’s text in the value that misses the small-text floor', () => {
    for (const intent of ALL_INTENTS) {
      expect(intentColors(intent).text).not.toBe(colors.textDim);
    }
  });

  it('says going over the target in amber, calmly', () => {
    expect(intentColors('over')).toEqual({ text: colors.amber, mark: colors.amber });
  });

  it('says a notice in amber too, since neither is a fault', () => {
    expect(intentColors('notice')).toEqual({ text: colors.amber, mark: colors.amber });
  });

  it('says a failure in red', () => {
    expect(intentColors('failure')).toEqual({ text: colors.red, mark: colors.red });
  });

  it('says a success in green', () => {
    expect(intentColors('success')).toEqual({ text: colors.green, mark: colors.green });
  });

  // A fault and a success that resolved alike would leave the difference
  // resting entirely on the wording.
  it('keeps a fault and a success visibly apart', () => {
    expect(intentColors('failure').mark).not.toBe(intentColors('success').mark);
  });
});
