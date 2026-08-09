/**
 * Tying a label, a hint, and an error to the control they belong to
 * (spec 0003, AC-12, AC-16).
 *
 * The web answer to this is `aria-labelledby` pointing at other elements.
 * React Native's support for that is uneven across the two platforms, and an
 * error a screen reader reads out as loose text somewhere else on the screen
 * is worse than useless: a person hears "enter a number above zero" with no
 * idea which of five inputs it belongs to.
 *
 * So the relationship is built into the control's own label instead. It works
 * identically on both platforms, and the error can never be separated from its
 * input, because it is part of what the input is called.
 */

/** The three accessibility props a control spreads onto itself. */
export type FieldA11y = {
  readonly accessibilityLabel: string;
  readonly accessibilityHint: string | undefined;
  /** Drives the control's error styling. Not a spoken value; the label carries that. */
  readonly invalid: boolean;
};

/**
 * Screen reader annotations. These are the one deliberate exception to the
 * rule that no component holds an English word: they are heard, never read,
 * and they exist so a number or a fault cannot lose its meaning on the way to
 * somebody's ear.
 */
const REQUIRED_SPOKEN = 'required';
const ERROR_SPOKEN = 'error';

export type FieldA11yInput = {
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
};

/**
 * Build the accessibility props for a field's control.
 *
 * The spoken label is the visible label, then "required" if it is, then the
 * error if there is one. A screen reader therefore announces the fault in the
 * same breath as the input it belongs to.
 */
export const fieldA11y = ({ label, hint, error, required = false }: FieldA11yInput): FieldA11y => {
  const parts = [label];

  if (required) {
    parts.push(REQUIRED_SPOKEN);
  }

  if (error !== undefined && error.length > 0) {
    parts.push(`${ERROR_SPOKEN}: ${error}`);
  }

  return {
    accessibilityLabel: parts.join(', '),
    accessibilityHint: hint,
    invalid: error !== undefined && error.length > 0,
  };
};
