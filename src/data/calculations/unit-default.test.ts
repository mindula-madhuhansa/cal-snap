import { describe, expect, it } from 'vitest';

import { unitPreferenceForLocale } from './unit-default';

describe('unitPreferenceForLocale', () => {
  // covers: AC-4
  it('opens imperial in the places that would expect it', () => {
    expect(unitPreferenceForLocale('en-US')).toBe('imperial');
    expect(unitPreferenceForLocale('en-GB')).toBe('imperial');
  });

  // covers: AC-4. Metric is the default for everywhere not named, rather than
  // a guess about the person.
  it('opens metric everywhere else', () => {
    for (const locale of ['si-LK', 'fr-FR', 'de-DE', 'ja-JP', 'en-AU', 'es-419']) {
      expect(unitPreferenceForLocale(locale)).toBe('metric');
    }
  });

  // covers: AC-4. A locale string is not something this gets to choose, so
  // every shape Intl hands back has to land somewhere sensible.
  it('reads the region out of the shapes a locale actually arrives in', () => {
    expect(unitPreferenceForLocale('en_US')).toBe('imperial');
    expect(unitPreferenceForLocale('en-Latn-US')).toBe('imperial');
    expect(unitPreferenceForLocale('en-us')).toBe('imperial');
    expect(unitPreferenceForLocale('US')).toBe('imperial');
  });

  // The failure this guards against: reading the language subtag as a country.
  it('never mistakes a language for a region', () => {
    expect(unitPreferenceForLocale('en')).toBe('metric');
    expect(unitPreferenceForLocale('gb')).toBe('imperial');
    expect(unitPreferenceForLocale('en-CA')).toBe('metric');
  });

  it('falls back to metric when there is no locale at all', () => {
    expect(unitPreferenceForLocale(undefined)).toBe('metric');
    expect(unitPreferenceForLocale('')).toBe('metric');
  });
});
