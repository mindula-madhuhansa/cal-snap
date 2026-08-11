/**
 * The person's own calendar day, as an instant range, for the cap count.
 *
 * **This duplicates `src/data/calculations/local-day.ts`**, which is tested and
 * which this file cannot import: that code is bundled by Metro for the phone,
 * this one runs on Deno at the edge, and there is no shared build between them.
 * The two must stay in step; a drift shows up as a cap that resets at the wrong
 * hour. Spec 0007 carries this as a follow up.
 *
 * The zone is read from `profiles.timezone` server side and never sent by the
 * phone. A client supplied day would let anyone reset their own cap by lying.
 */

export type DayWindow = {
  /** Inclusive. */
  readonly start: Date;
  /** Exclusive, so a scan at the last millisecond of the day counts once. */
  readonly end: Date;
  /** The next local midnight, which is when the cap resets. Same value as `end`. */
  readonly resetsAt: Date;
};

/**
 * The offset that `timeZone` was at on `instant`, in minutes east of UTC.
 *
 * Derived by formatting the instant in that zone, reading the wall clock back
 * as if it were UTC, and taking the difference. `formatToParts` rather than a
 * formatted string, because part names are stable across locales and ICU builds
 * while the assembled text is not.
 */
const offsetMinutes = (instant: Date, timeZone: string): number => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const find = (type: string): number => Number(parts.find((part) => part.type === type)?.value);

  const asUtc = Date.UTC(
    find('year'),
    find('month') - 1,
    find('day'),
    find('hour'),
    find('minute'),
    find('second'),
  );

  // Whole minutes: every real zone offset is a whole number of minutes, and
  // rounding here drops the sub second noise `formatToParts` cannot carry.
  return Math.round((asUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
};

/**
 * The instant local midnight happened, for the day containing `instant`.
 *
 * **The offset has to be re-derived at the candidate, not read at `instant`**,
 * and that is the whole difficulty here. On a day the clocks change, the offset
 * at midday is not the offset at midnight, so deriving midnight from the
 * midday offset lands an hour out. The first pass guesses with whatever offset
 * is in force now; the second pass re-asks at the guessed midnight and, if the
 * answer differs, recomputes from that. One correction is always enough,
 * because no real zone shifts twice within a day.
 *
 * Getting this wrong resets somebody's daily allowance an hour early or late,
 * twice a year, and nothing would fail while it did.
 */
const midnightFor = (instant: Date, timeZone: string): Date => {
  let offset = offsetMinutes(instant, timeZone);

  for (let pass = 0; pass < 2; pass += 1) {
    const local = new Date(instant.getTime() + offset * 60_000);
    const midnightLocal = Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      0,
      0,
      0,
      0,
    );

    const candidate = midnightLocal - offset * 60_000;
    const atCandidate = offsetMinutes(new Date(candidate), timeZone);

    if (atCandidate === offset) return new Date(candidate);
    offset = atCandidate;
  }

  return new Date(instant.getTime() + offset * 60_000);
};

/**
 * The local day containing `instant`, in the named zone. An unrecognised zone
 * is an expected failure (a stored value this runtime's ICU does not carry), so
 * it comes back as `undefined` and the caller falls back to UTC rather than
 * throwing somebody's scan away.
 */
export const localDayWindow = (instant: Date, timeZone: string): DayWindow | undefined => {
  try {
    const start = midnightFor(instant, timeZone);

    // The next midnight, found the same careful way. 26 hours past this day's
    // start lands inside the *next* day whether this one is 23, 24 or 25 hours
    // long, and `midnightFor` walks back to its beginning. So a day that
    // crosses a clock change is exactly as long as it really was.
    const end = midnightFor(new Date(start.getTime() + 26 * 60 * 60_000), timeZone);

    return { start, end, resetsAt: end };
  } catch {
    return undefined;
  }
};

/** UTC, used only when the stored zone is missing or unrecognised. */
export const utcDayWindow = (instant: Date): DayWindow => {
  const start = new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
  );
  const end = new Date(start.getTime() + 24 * 60 * 60_000);
  return { start, end, resetsAt: end };
};
