import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors, radii, space } from '../theme';
import { AppText } from './app-text';
import { fieldA11y, type FieldA11y } from './field-a11y';

/**
 * The wrapper around every form control.
 *
 * `children` is a function rather than an element. That is unusual, and it is
 * the point: the accessibility props land directly on the control, visibly, in
 * the code you are reading, instead of being smuggled in by cloning an element
 * whose type nobody can check.
 *
 *     <Field label="Email" hint="We send a code" error={error}>
 *       {(a11y) => <TextInput value={value} onChangeText={setValue} {...a11y} />}
 *     </Field>
 *
 * **This component owns the frame.** The design draws the label inside the
 * input's rounded border rather than above it, so the border belongs to the
 * thing that knows about the label, the hint, and the error. Controls placed
 * inside draw no border of their own.
 *
 * Focus lives here for the same reason: the frame is what lights up, and the
 * control is what knows it was focused, so the handlers travel down with the
 * accessibility props and come back to the frame.
 */

/** What a control inside a `Field` is handed. */
export type FieldControlProps = FieldA11y & {
  readonly onFocus: () => void;
  readonly onBlur: () => void;
};

export type FieldProps = {
  readonly label: string;
  readonly children: (control: FieldControlProps) => ReactNode;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
};

/** The visible mark for a required field. Spoken as a word by `fieldA11y`. */
const REQUIRED_MARK = '*';

export const Field = ({ label, children, hint, error, required = false }: FieldProps) => {
  const a11y = fieldA11y({ label, hint, error, required });
  const [focused, setFocused] = useState(false);
  const failure = colors.intents.failure;

  // A control's boundary owes 3:1, so it is never `border` (1.25). Resting is
  // `borderStrong`; focus brightens it to cyan rather than switching a border
  // on, so nothing about the layout moves when the keyboard opens.
  const frameColor = a11y.invalid ? failure.mark : focused ? colors.cyan : colors.borderStrong;

  return (
    <View style={styles.field}>
      <View style={[styles.frame, { borderColor: frameColor }]}>
        <AppText
          variant="kicker"
          uppercase
          color={a11y.invalid ? failure.text : focused ? colors.cyan : colors.textDim}>
          {required ? `${label} ${REQUIRED_MARK}` : label}
        </AppText>

        {children({
          ...a11y,
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
        })}
      </View>

      {hint === undefined || a11y.invalid ? undefined : (
        // Hidden from a screen reader: it is already the control's hint, and
        // hearing it twice is worse than not hearing it at all.
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <AppText variant="caption" color={colors.textMuted}>
            {hint}
          </AppText>
        </View>
      )}

      {error === undefined ? undefined : (
        // Same reasoning: the error is part of the control's own label, so
        // this is the seen half only, never a second spoken fragment.
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
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
    gap: space[2],
  },
  frame: {
    gap: space[1],
    paddingHorizontal: space[3],
    paddingTop: space[2],
    paddingBottom: space[1],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
  },
});
