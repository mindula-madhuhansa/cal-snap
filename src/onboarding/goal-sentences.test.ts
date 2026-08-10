import { describe, expect, it } from 'vitest';

import {
  basisSentence,
  goalSummary,
  heightSummary,
  startsOn,
  startsTomorrowSentence,
} from './goal-sentences';

describe('startsOn', () => {
  // covers: AC-11
  it('is always the day after today, never today', () => {
    expect(startsOn('2026-08-10')).toBe('2026-08-11');
  });

  it('crosses a month and a year end', () => {
    expect(startsOn('2026-08-31')).toBe('2026-09-01');
    expect(startsOn('2026-12-31')).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(startsOn('2028-02-28')).toBe('2028-02-29');
  });
});

describe('startsTomorrowSentence', () => {
  // covers: AC-11. Both halves: when it starts, and that today is untouched.
  it('names the day and says today stays as it is', () => {
    const sentence = startsTomorrowSentence('2026-08-10');

    expect(sentence).toContain('2026-08-11');
    expect(sentence).toContain("Today's target stays as it is");
  });
});

describe('basisSentence', () => {
  // covers: AC-12. Two different explanations for where a number came from,
  // which is the tradeoff spec 0006 accepted, so both have to be said clearly.
  it('says whether the number was worked out or set by hand', () => {
    expect(basisSentence('computed')).toContain('Worked out from your answers');
    expect(basisSentence('manual')).toContain('you set yourself');
  });
});

describe('goalSummary', () => {
  it('says the goal and the pace', () => {
    expect(goalSummary('lose', 0.5)).toBe('Losing weight, about 0.5 kg a week');
    expect(goalSummary('gain', 0.25)).toBe('Gaining weight, about 0.25 kg a week');
  });

  // Holding has no pace, so mentioning one would be noise at best.
  it('leaves the pace out when there is none', () => {
    expect(goalSummary('hold', 0)).toBe('Staying where you are');
    expect(goalSummary('hold', 0.5)).toBe('Staying where you are');
  });
});

describe('heightSummary', () => {
  // covers: AC-4. Storage is centimetres either way; only the saying changes.
  it('says the stored centimetres in the units the person chose', () => {
    expect(heightSummary(165, 'metric')).toBe('165 cm');
    expect(heightSummary(165, 'imperial')).toBe('5 ft 5 in');
    expect(heightSummary(182.9, 'imperial')).toBe('6 ft 0 in');
  });
});
