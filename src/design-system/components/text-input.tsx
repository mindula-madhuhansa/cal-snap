import {
  StyleSheet,
  TextInput as RNTextInput,
  useWindowDimensions,
  type KeyboardTypeOptions,
  type TextInputProps as RNTextInputProps,
} from 'react-native';

import { scaleTypeStep } from '../scale-type-step';
import { colors, minTouchTarget, space, type } from '../theme';

/**
 * A text input.
 *
 * Spread a `Field`'s control props onto it and the label, the hint, any error,
 * and the focus ring come with them.
 *
 * **It draws no border of its own.** In this design the label sits inside the
 * input's rounded frame, so the frame belongs to `Field`, which is the thing
 * that knows about the label. This component is the editable line inside it.
 */

export type TextInputProps = {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  /**
   * Accepted so a `Field`'s control props spread cleanly, and deliberately not
   * read: the frame is what turns red, and `Field` owns the frame.
   */
  readonly invalid?: boolean;
  readonly multiline?: boolean;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly editable?: boolean;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  /** Handed down by `Field`, so the frame around this input can light up. */
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
  readonly testID?: string;
  /** Masks the text, for a password (spec 0004, AC-16). */
  readonly secureTextEntry?: boolean;
  /**
   * What this field holds, told to the platform so the password manager and
   * the one time code autofill can offer to fill it (spec 0004, AC-16).
   * These are two separate props because iOS and Android read different ones,
   * and a field marked for only one of them autofills on only one platform.
   */
  readonly textContentType?: RNTextInputProps['textContentType'];
  readonly autoComplete?: RNTextInputProps['autoComplete'];
  readonly maxLength?: number;
  /** Off for an email or a code, where an initial capital is always wrong. */
  readonly autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
};

/** A multiline box, snapped to the space scale. */
const MULTILINE_HEIGHT = space[8] * 3;

export const TextInput = ({
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  editable = true,
  accessibilityLabel,
  accessibilityHint,
  onFocus,
  onBlur,
  testID,
  secureTextEntry = false,
  textContentType,
  autoComplete,
  maxLength,
  autoCapitalize,
}: TextInputProps) => {
  const { fontScale } = useWindowDimensions();

  return (
    <RNTextInput
      value={value}
      onChangeText={onChangeText}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      placeholderTextColor={colors.textDim}
      multiline={multiline}
      keyboardType={keyboardType}
      editable={editable}
      secureTextEntry={secureTextEntry}
      textContentType={textContentType}
      autoComplete={autoComplete}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize}
      selectionColor={colors.cyan}
      cursorColor={colors.cyan}
      // The design is dark, so the platform's own light keyboard would arrive
      // as a white slab under a dark screen.
      keyboardAppearance="dark"
      // Scaling happens once, in `scaleTypeStep`, like every other text in the
      // system.
      allowFontScaling={false}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={[
        scaleTypeStep(type.h4, fontScale),
        styles.input,
        multiline ? styles.multiline : undefined,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    width: '100%',
    // The frame around this is what a finger aims at, and `Field` pads it; this
    // floor is what guarantees the pair clears the target size together.
    minHeight: minTouchTarget - space[3],
    padding: 0,
    color: colors.text,
    backgroundColor: 'transparent',
  },
  multiline: {
    minHeight: MULTILINE_HEIGHT,
    textAlignVertical: 'top',
  },
});
