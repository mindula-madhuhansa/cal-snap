import { StyleSheet, View } from 'react-native';

import { radii, space } from '../theme';
import { AppText } from './app-text';
import { tagToneStyle, type TagTone } from './tag-tone';

/**
 * A small label.
 *
 * Not tappable, by design. A tag says what something is; if it needs to do
 * something, it is a button.
 *
 * Set in the uppercase mono step, which is how the design draws every chip.
 * That makes the visible text a poor thing to read aloud, so `accessibilityLabel`
 * matters more here than on most components.
 */

export type TagProps = {
  readonly label: string;
  readonly tone?: TagTone;
  /**
   * Overrides what a screen reader says. The visible label is uppercased and
   * set tight, so it can carry a separator or an abbreviation that reads badly
   * aloud; this is where the spoken sentence goes instead.
   */
  readonly accessibilityLabel?: string;
  readonly testID?: string;
};

export const Tag = ({ label, tone = 'neutral', accessibilityLabel, testID }: TagProps) => {
  const resolved = tagToneStyle(tone);

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        styles.tag,
        {
          backgroundColor: resolved.background,
          borderColor: resolved.border,
        },
      ]}
      testID={testID}>
      <AppText variant="kicker" color={resolved.text} uppercase>
        {label}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    paddingVertical: space[1] + space[1] / 2,
    paddingHorizontal: space[2],
    borderRadius: radii.tag,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
