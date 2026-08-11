import { describe, expect, it } from 'vitest';

import { costCents } from './cost';

/**
 * Spec 0007, AC-15: `cost_cents` is computed from the token counts the model
 * API itself reported, against rates pinned in the function. It is never a
 * fixed guess.
 *
 * This file runs under Vitest even though the code beside it runs on Deno,
 * because the arithmetic is plain TypeScript with no runtime of its own. The
 * money is the point: nothing else in the app tells you what a scan cost.
 */

/** Inside the introductory period, which runs to the end of 31 August 2026. */
const INTRO = new Date('2026-08-11T12:00:00.000Z');
/** After it, when the input and output rates rise. */
const STANDARD = new Date('2026-09-01T00:00:01.000Z');

describe('costCents', () => {
  // covers: AC-15. Introductory Sonnet 5 is $2 in and $10 out per million
  // tokens, so a million of each is $12, which is 1200 cents.
  it('prices a million tokens each way at the introductory rates', () => {
    expect(costCents({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, INTRO)).toBe(1200);
  });

  // covers: AC-15. Standard is $3 and $15, so the same call is 1800 cents.
  it('prices the same call higher once the introductory period ends', () => {
    expect(costCents({ inputTokens: 1_000_000, outputTokens: 1_000_000 }, STANDARD)).toBe(1800);
  });

  // The boundary itself: the last instant of 31 August is still introductory,
  // and the first instant of 1 September is not. An off by one here silently
  // misprices a whole day of scans.
  it('switches rates exactly at the end of 31 August 2026', () => {
    const usage = { inputTokens: 1_000_000, outputTokens: 0 };
    expect(costCents(usage, new Date('2026-08-31T23:59:59.999Z'))).toBe(200);
    expect(costCents(usage, new Date('2026-09-01T00:00:00.000Z'))).toBe(300);
  });

  // covers: AC-15. A realistic scan: a 1024 px photo plus the prompt is on the
  // order of 1500 input tokens, and the reply a few hundred output tokens.
  it('prices a realistic scan at a fraction of a cent', () => {
    const cents = costCents({ inputTokens: 1_500, outputTokens: 400 }, INTRO);
    expect(cents).toBeGreaterThan(0);
    expect(cents).toBeLessThan(1);
  });

  // covers: AC-15. Three decimal places, matching `meal_scans.cost_cents`'s
  // `numeric(6,3)`. Rounding to whole cents would record every scan as zero,
  // which is exactly the "cost is measured, not assumed" promise failing.
  it('keeps three decimal places rather than rounding a scan to zero', () => {
    const cents = costCents({ inputTokens: 1_500, outputTokens: 400 }, INTRO);
    expect(cents).toBe(Math.round(cents * 1000) / 1000);
    expect(cents).not.toBe(0);
  });

  // Input and output are priced differently, so the two counts are not
  // interchangeable. Swapping them must change the answer.
  it('prices output more than input', () => {
    const inputHeavy = costCents({ inputTokens: 10_000, outputTokens: 1_000 }, INTRO);
    const outputHeavy = costCents({ inputTokens: 1_000, outputTokens: 10_000 }, INTRO);
    expect(outputHeavy).toBeGreaterThan(inputHeavy);
  });

  it('is zero when nothing was spent', () => {
    expect(costCents({ inputTokens: 0, outputTokens: 0 }, INTRO)).toBe(0);
  });

  // Far past every period named in the file, the standard rates still apply
  // rather than the function running out of answers.
  it('still prices a scan long after the last named period', () => {
    expect(costCents({ inputTokens: 1_000_000, outputTokens: 0 }, new Date('2030-01-01'))).toBe(
      300,
    );
  });
});
