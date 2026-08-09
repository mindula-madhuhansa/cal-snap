/**
 * Which calendar day a moment belongs to, in a named zone. This is the whole
 * of AC-3, and it is the reason `eaten_on` is stored rather than derived: a
 * meal saved at 23:50 in Colombo must still read as that date after the phone
 * lands in London.
 *
 * Pure, and runnable without a phone. The zone is always passed in; nothing
 * here reads the device.
 */

export type LocalDayResult =
  | { readonly kind: 'ok'; readonly value: string }
  | { readonly kind: 'failed'; readonly message: string };

type DateParts = {
  readonly year: string;
  readonly month: string;
  readonly day: string;
  readonly hour: number;
};

/**
 * `formatToParts` rather than a formatted string, because the part names are
 * stable across locales and ICU builds while the assembled text is not.
 * `hourCycle: 'h23'` keeps midnight at 0 instead of 24.
 */
const partsIn = (instant: Date, timeZone: string): DateParts | undefined => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant);

    const find = (type: string): string => parts.find((part) => part.type === type)?.value ?? '';

    const year = find('year');
    const month = find('month');
    const day = find('day');
    const hour = Number(find('hour'));

    if (year === '' || month === '' || day === '' || !Number.isFinite(hour)) return undefined;
    return { year, month, day, hour };
  } catch {
    return undefined;
  }
};

/**
 * The local calendar date as `YYYY-MM-DD`. An unknown zone is an expected
 * failure (a device can report a name this runtime's ICU does not carry), so
 * it comes back as a value rather than a throw.
 */
export const resolveLocalDay = (instant: Date, timeZone: string): LocalDayResult => {
  const parts = partsIn(instant, timeZone);
  if (parts === undefined) {
    return { kind: 'failed', message: `The time zone "${timeZone}" was not recognised.` };
  }
  return { kind: 'ok', value: `${parts.year}-${parts.month}-${parts.day}` };
};

/** The local hour, 0 to 23. Used only to guess a meal type. */
export const resolveLocalHour = (instant: Date, timeZone: string): number | undefined =>
  partsIn(instant, timeZone)?.hour;

/**
 * The zone the device is in right now. The one impure function in this file,
 * and the only place the app reads it.
 */
export const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** `YYYY-MM-DD` for the day the device is in right now. */
export const deviceLocalDay = (now: Date = new Date()): LocalDayResult =>
  resolveLocalDay(now, deviceTimeZone());

/** The date `days` before `day`, staying on calendar dates and never on offsets. */
export const shiftDay = (day: string, days: number): string => {
  const at = new Date(`${day}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
};
