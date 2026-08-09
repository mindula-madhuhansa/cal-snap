import { roundToScale } from './rounding';

/**
 * Display only. Weight is stored in kilograms and height in centimetres,
 * everywhere, in both databases. Changing the unit preference changes what is
 * shown and never what is stored (AC-12), so nothing in this file is ever
 * called on a write path.
 */

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;
const INCHES_PER_FOOT = 12;

export type UnitPreference = 'metric' | 'imperial';

export const kgToLb = (kg: number): number => roundToScale(kg / KG_PER_LB, 1);
export const lbToKg = (lb: number): number => roundToScale(lb * KG_PER_LB, 2);

export type FeetAndInches = { readonly feet: number; readonly inches: number };

export const cmToFeetAndInches = (cm: number): FeetAndInches => {
  const totalInches = Math.round(cm / CM_PER_INCH);
  return {
    feet: Math.floor(totalInches / INCHES_PER_FOOT),
    inches: totalInches % INCHES_PER_FOOT,
  };
};

export const feetAndInchesToCm = ({ feet, inches }: FeetAndInches): number =>
  roundToScale((feet * INCHES_PER_FOOT + inches) * CM_PER_INCH, 1);

/** The stored kilograms shown in the unit the person chose. */
export const displayWeight = (
  kg: number,
  preference: UnitPreference,
): { readonly value: number; readonly unit: 'kg' | 'lb' } =>
  preference === 'imperial'
    ? { value: kgToLb(kg), unit: 'lb' }
    : { value: roundToScale(kg, 1), unit: 'kg' };
