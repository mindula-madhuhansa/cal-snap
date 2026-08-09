import { useState } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  useWindowDimensions,
  type KeyboardTypeOptions,
} from 'react-native';

import { scaleTypeStep } from '../scale-type-step';
import { colors, minTouchTarget, radii, space, type } from '../theme';

/**
 * A text input (spec 0003, AC-3, AC-5, AC-12).
 *
 * Spread a `Field`'s accessibility props onto it and the label, the hint, and
 * any error come with them.
 */

export type TextInputProps = {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder?: string;
  readonly invalid?: boolean;
  readonly multiline?: boolean;
  readonly keyboardType?: KeyboardTypeOptions;
  readonly editable?: boolean;
  readonly accessibilityLabel: string;
  readonly accessibilityHint?: string;
  readonly testID?: string;
};

/** `textarea.input { min-height: 90px }`, snapped to the space scale. */
const MULTILINE_HEIGHT = space[8] * 2.5;

export const TextInput = ({
  value,
  onChangeText,
  placeholder,
  invalid = false,
  multiline = false,
  keyboardType,
  editable = true,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: TextInputProps) => {
  const { fontScale } = useWindowDimensions();
  const [focused, setFocused] = useState(false);

  // Resting gold rather than the CSS's `divider`: a control's visible boundary
  // owes 3:1, and `divider` is 1.38. Focus deepens it instead of switching it
  // on, so nothing about the layout moves when the keyboard opens.
  const border = invalid
    ? colors.intents.failure.mark
    : focused
      ? colors.accentText
      : colors.accent;

  return (
    <RNTextInput
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      placeholderTextColor={colors.textSubtle}
      multiline={multiline}
      keyboardType={keyboardType}
      editable={editable}
      selectionColor={colors.accent}
      cursorColor={colors.accent}
      // Scaling happens once, in `scaleTypeStep`, like every other text in the
      // system.
      allowFontScaling={false}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={[
        scaleTypeStep(type.body, fontScale),
        styles.input,
        multiline ? styles.multiline : undefined,
        { borderColor: border },
      ]}
    />
  );
};

const styles = StyleSheet.create({
  input: {
    width: '100%',
    // Tall enough to hit without slop, which an input inside a scrolling form
    // could not safely carry anyway.
    minHeight: minTouchTarget,
    paddingHorizontal: space[2],
    paddingVertical: space[2],
    color: colors.text,
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.md,
  },
  multiline: {
    minHeight: MULTILINE_HEIGHT,
    textAlignVertical: 'top',
  },
});
