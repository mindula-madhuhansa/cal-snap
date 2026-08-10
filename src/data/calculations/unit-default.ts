import type { UnitPreference } from './units';

/**
 * Which unit family the height and weight fields open in (spec 0006, AC-4).
 *
 * A default only. The person can switch it on the field itself, and whatever
 * they type is stored in centimetres and kilograms regardless, so getting this
 * wrong costs a tap and never costs a wrong number.
 */

/**
 * The regions that would find pounds and feet normal. Deliberately short: it
 * is easier to defend three entries than a list of every country, and anywhere
 * not named here gets metric, which is the world's default rather than an
 * assumption about the person.
 *
 * `GB` is here because British people give their weight in stones and pounds
 * and their height in feet, even though almost everything else there is metric.
 */
const IMPERIAL_REGIONS: readonly string[] = ['US', 'GB', 'LR', 'MM'];

/**
 * The unit family a locale implies. Takes the locale rather than reading one,
 * so it stays pure and the device is touched only at the edge.
 *
 * Accepts what `Intl` hands back in any of its usual shapes (`en-US`,
 * `en_US`, `en-Latn-US`, or a bare `US`), because a locale string is not
 * something this function gets to choose.
 */
export const unitPreferenceForLocale = (locale: string | undefined): UnitPreference => {
  if (locale === undefined || locale.length === 0) return 'metric';

  const parts = locale.replace(/_/g, '-').split('-');

  // The region is never the first subtag, which is the language, so `en` can
  // never be read as a country. A bare two letter string is the one exception:
  // there is no language in front of it, so it is already a region.
  const candidates = parts.length === 1 ? parts : parts.slice(1);
  const region = candidates.find((part) => /^[A-Za-z]{2}$/.test(part))?.toUpperCase();

  return region !== undefined && IMPERIAL_REGIONS.includes(region) ? 'imperial' : 'metric';
};

export { IMPERIAL_REGIONS };
