/**
 * SQLite stores macros as `REAL` while Postgres stores them as
 * `numeric(6,1)`. Keeping the two equal to one decimal place is a rule the
 * write path holds, not something either database enforces (AC-13, and the
 * tradeoff spec 0002 states openly).
 *
 * `toPrecision` before rounding is what stops the usual binary floating point
 * surprise: `2.675 * 100` is `267.49999999999997`, which a naive
 * `Math.round` would send down to 2.67 instead of up to 2.68.
 */
export const roundToScale = (value: number, scale: number): number => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** scale;
  return Math.round(Number((value * factor).toPrecision(12))) / factor;
};

/** The scale every macro gram column uses, in both databases. */
export const MACRO_SCALE = 1;

/** Macro grams, rounded the one way the whole app rounds them. */
export const roundMacro = (value: number): number => roundToScale(value, MACRO_SCALE);

/** Calories are whole numbers in both databases. */
export const roundCalories = (value: number): number => Math.round(Number(value.toPrecision(12)));
