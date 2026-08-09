import { describe, expect, it } from 'vitest';

import { fieldA11y } from './field-a11y';

describe('fieldA11y', () => {
  it('speaks a plain field as just its label', () => {
    expect(fieldA11y({ label: 'Weight' })).toEqual({
      accessibilityLabel: 'Weight',
      accessibilityHint: undefined,
      invalid: false,
    });
  });

  it('passes the hint through as the control’s hint', () => {
    expect(fieldA11y({ label: 'Weight', hint: 'In kilograms' }).accessibilityHint).toBe(
      'In kilograms',
    );
  });

  it('says that a required field is required', () => {
    expect(fieldA11y({ label: 'Weight', required: true }).accessibilityLabel).toBe(
      'Weight, required',
    );
  });

  // covers: AC-12. This is the whole reason the function exists: an error read
  // out on its own tells nobody which of five inputs it belongs to.
  it('announces the error as part of the input’s own name', () => {
    const a11y = fieldA11y({ label: 'Weight', error: 'Enter a number above zero' });

    expect(a11y.accessibilityLabel).toBe('Weight, error: Enter a number above zero');
    expect(a11y.invalid).toBe(true);
  });

  // covers: AC-12
  it('keeps the order label, required, error, so the field is named before it is faulted', () => {
    expect(
      fieldA11y({ label: 'Weight', required: true, error: 'Enter a number' }).accessibilityLabel,
    ).toBe('Weight, required, error: Enter a number');
  });

  it('treats an empty error string as no error at all', () => {
    const a11y = fieldA11y({ label: 'Weight', error: '' });

    expect(a11y.accessibilityLabel).toBe('Weight');
    expect(a11y.invalid).toBe(false);
  });

  it('keeps the hint out of the label, so it stays a hint rather than a name', () => {
    expect(fieldA11y({ label: 'Weight', hint: 'In kilograms' }).accessibilityLabel).toBe('Weight');
  });
});
