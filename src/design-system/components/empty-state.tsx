import { StyleSheet, View } from 'react-native';

import { colors, space } from '../theme';
import { AppText } from './app-text';
import { Button } from './button';

/**
 * Nothing here yet.
 *
 * No illustration, no cheerful mascot. A heading and one honest line, so an
 * empty first day reads as intentional rather than as a screen that failed to
 * load. Every word arrives as a prop.
 */

export type EmptyStateProps = {
  readonly title: string;
  readonly body: string;
  /** An optional way out. */
  readonly action?: {
    readonly label: string;
    readonly onPress: () => void;
  };
  readonly testID?: string;
};

export const EmptyState = ({ title, body, action, testID }: EmptyStateProps) => (
  <View style={styles.state} testID={testID}>
    <AppText variant="h3" heading align="center">
      {title}
    </AppText>
    <AppText variant="bodySmall" color={colors.textMuted} align="center">
      {body}
    </AppText>
    {action === undefined ? undefined : (
      <Button label={action.label} onPress={action.onPress} variant="secondary" />
    )}
  </View>
);

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
  },
});
