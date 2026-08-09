import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, space } from '../theme';
import { AppText } from './app-text';
import { fieldA11y, type FieldA11y } from './field-a11y';

/**
 * The wrapper around every form control (spec 0003, AC-5, AC-12).
 *
 * `children` is a function rather than an element. That is unusual, and it is
 * the point: the accessibility props land directly on the control, visibly, in
 * the code you are reading, instead of being smuggled in by cloning an element
 * whose type nobody can check.
 *
 *     <Field label="Weight" hint="In kilograms" error={error}>
 *       {(a11y) => <TextInput value={value} onChangeText={setValue} {...a11y} />}
 *     </Field>
 */

export type FieldProps = {
  readonly label: string;
  readonly children: (a11y: FieldA11y) => ReactNode;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
};

/** The visible mark for a required field. Spoken as a word by `fieldA11y`. */
const REQUIRED_MARK = '*';

export const Field = ({ label, children, hint, error, required = false }: FieldProps) => {
  const a11y = fieldA11y({ label, hint, error, required });
  const failure = colors.intents.failure;

  return (
    <View style={styles.field}>
      <AppText variant="label" color={colors.textSubtle}>
        {required ? `${label} ${REQUIRED_MARK}` : label}
      </AppText>

      {children(a11y)}

      {hint === undefined || a11y.invalid ? undefined : (
        // Hidden from a screen reader: it is already the control's hint, and
        // hearing it twice is worse than not hearing it at all.
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AppText variant="caption" color={colors.textSubtle}>
            {hint}
          </AppText>
        </View>
      )}

      {error === undefined ? undefined : (
        // Same reasoning: the error is part of the control's own label, so
        // this is the seen half only, never a second spoken fragment.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.error, { borderLeftColor: failure.mark }]}>
          <AppText variant="caption" color={failure.text}>
            {error}
          </AppText>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  field: {
    gap: space[1],
  },
  error: {
    // A rule beside the words, because there is no red in this palette to
    // carry the meaning on its own.
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: space[2],
  },
});
