import { StyleSheet, View } from 'react-native';

import { radii, space } from '../theme';
import { AppText } from './app-text';
import { tagToneStyle, type TagTone } from './tag-tone';

/**
 * A small label (spec 0003, AC-5, AC-6).
 *
 * Not tappable, by design. A tag says what something is; if it needs to do
 * something, it is a button.
 */

export type TagProps = {
  readonly label: string;
  readonly tone?: TagTone;
  readonly testID?: string;
};

export const Tag = ({ label, tone = 'neutral', testID }: TagProps) => {
  const resolved = tagToneStyle(tone);

  return (
    <View
      style={[
        styles.tag,
        {
          backgroundColor: resolved.background,
          borderColor: resolved.border,
        },
      ]}
      testID={testID}>
      <AppText variant="caption" color={resolved.text}>
        {label}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    // `.tag`: 3px by 10px padding, rounded to the nearest steps of the scale.
    alignSelf: 'flex-start',
    paddingVertical: space[1],
    paddingHorizontal: space[2],
    borderRadius: radii.tag,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
