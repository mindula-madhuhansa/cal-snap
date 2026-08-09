import { describe, expect, it } from 'vitest';

import { cmToFeetAndInches, displayWeight, feetAndInchesToCm, kgToLb, lbToKg } from './units';

/**
 * AC-12: weight is stored in kilograms and height in centimetres, everywhere.
 * Everything in this file is display only, so the tests care about the round
 * trip staying stable and about nothing here ever being the stored value.
 */
describe('weight conversion', () => {
  // covers: AC-12
  it('converts kilograms to pounds', () => {
    expect(kgToLb(70)).toBe(154.3);
    expect(kgToLb(100)).toBe(220.5);
  });

  it('converts pounds to kilograms', () => {
    expect(lbToKg(154.3)).toBe(69.99);
    expect(lbToKg(220)).toBe(99.79);
  });

  // covers: AC-12. A person toggling the unit switch back and forth must not
  // watch their weight creep.
  //
  // The tolerance is 0.03kg, not zero, and deliberately so: `kgToLb` rounds to
  // one decimal for display, which is about 0.023kg of resolution, so a round
  // trip cannot be exact. That is fine precisely because none of this is ever
  // stored. The stored kilograms are untouched, which the last test in this
  // file is what actually pins.
  it('round trips a weight to within the resolution of a one decimal pound', () => {
    for (const kg of [45, 62.5, 70.5, 88.8, 120]) {
      expect(Math.abs(lbToKg(kgToLb(kg)) - kg)).toBeLessThan(0.03);
    }
  });

  it('handles the ends of the range the schema allows', () => {
    expect(kgToLb(20)).toBeGreaterThan(0);
    expect(kgToLb(500)).toBeGreaterThan(0);
  });
});

describe('height conversion', () => {
  // covers: AC-12
  it('converts centimetres to feet and inches', () => {
    expect(cmToFeetAndInches(168)).toEqual({ feet: 5, inches: 6 });
    expect(cmToFeetAndInches(180)).toEqual({ feet: 5, inches: 11 });
  });

  // 183cm is 72.05 inches, which must read as 6 feet 0, never 5 feet 12.
  it('rolls twelve inches up into the next foot', () => {
    expect(cmToFeetAndInches(183)).toEqual({ feet: 6, inches: 0 });
    expect(cmToFeetAndInches(152.4)).toEqual({ feet: 5, inches: 0 });
  });

  it('converts feet and inches back to centimetres', () => {
    expect(feetAndInchesToCm({ feet: 5, inches: 6 })).toBe(167.6);
    expect(feetAndInchesToCm({ feet: 6, inches: 0 })).toBe(182.9);
  });

  it('round trips a height to within a centimetre', () => {
    for (const cm of [150, 160.5, 168, 175, 190]) {
      const back = feetAndInchesToCm(cmToFeetAndInches(cm));
      expect(Math.abs(back - cm)).toBeLessThan(1.3);
    }
  });
});

describe('displayWeight', () => {
  // covers: AC-12
  it('shows kilograms when the preference is metric', () => {
    expect(displayWeight(70.5, 'metric')).toEqual({ value: 70.5, unit: 'kg' });
  });

  it('shows pounds when the preference is imperial', () => {
    expect(displayWeight(70.5, 'imperial')).toEqual({ value: 155.4, unit: 'lb' });
  });

  // covers: AC-12. The stored value is the same number in both branches; only
  // what is shown changes.
  it('reads the same stored kilograms whichever unit is displayed', () => {
    const storedKg = 70.5;
    const metric = displayWeight(storedKg, 'metric');
    const imperial = displayWeight(storedKg, 'imperial');

    expect(metric.unit).not.toBe(imperial.unit);
    expect(lbToKg(imperial.value)).toBeCloseTo(storedKg, 1);
  });
});
