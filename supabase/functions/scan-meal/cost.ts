/**
 * What a scan actually cost, from what the model API reported (spec 0007, AC-15).
 *
 * Never a fixed guess. The token counts come from the response's own `usage`
 * object, and the rates are pinned here so a past scan's `cost_cents` can be
 * explained from the row and this file alone.
 */

/**
 * Claude Sonnet 5, in US dollars per million tokens.
 *
 * **The introductory rates run out on 31 August 2026**, after which the input
 * and output prices rise. Both periods are written down rather than only the
 * current one, so the arithmetic stays right on 1 September without anybody
 * remembering to come back. A scan is priced by the period it happened in.
 */
const SONNET_5_RATES: readonly {
  readonly until?: string;
  readonly inputPerMillion: number;
  readonly outputPerMillion: number;
}[] = [
  // Introductory pricing, through the end of 31 August 2026 UTC.
  { until: '2026-09-01T00:00:00.000Z', inputPerMillion: 2.0, outputPerMillion: 10.0 },
  // Standard pricing, from 1 September 2026 onwards. No `until`, so it is the
  // fallback and there is no date past which this file silently has no answer.
  { inputPerMillion: 3.0, outputPerMillion: 15.0 },
];

export type TokenUsage = {
  readonly inputTokens: number;
  readonly outputTokens: number;
};

const ratesAt = (at: Date) =>
  SONNET_5_RATES.find(
    (rate) => rate.until === undefined || at.getTime() < Date.parse(rate.until),
  ) ?? SONNET_5_RATES[SONNET_5_RATES.length - 1]!;

/**
 * Cents, to three decimal places, matching `meal_scans.cost_cents`'s
 * `numeric(6,3)`. A typical scan lands around a tenth of a cent, so rounding to
 * whole cents would record every one of them as zero.
 */
export const costCents = (usage: TokenUsage, at: Date = new Date()): number => {
  const rates = ratesAt(at);
  const dollars =
    (usage.inputTokens / 1_000_000) * rates.inputPerMillion +
    (usage.outputTokens / 1_000_000) * rates.outputPerMillion;

  return Math.round(dollars * 100 * 1000) / 1000;
};
