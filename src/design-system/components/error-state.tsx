import { StyleSheet, View } from 'react-native';

import { colors, radii, space } from '../theme';
import { AppText } from './app-text';
import { Button } from './button';

/**
 * Something went wrong.
 *
 * The fault is carried by the words first and the colour second: a heading
 * that names what happened, a line saying what to do about it, and a red edge
 * beside them. `AGENTS.md` asks that every failure a person can hit says
 * something honest on screen, and a red border has never told anybody what
 * happened or what to do next.
 */

export type ErrorStateProps = {
  readonly title: string;
  readonly body: string;
  readonly onRetry?: () => void;
  /** The retry button's words. Required whenever `onRetry` is given. */
  readonly retryLabel?: string;
  readonly testID?: string;
};

export const ErrorState = ({ title, body, onRetry, retryLabel, testID }: ErrorStateProps) => {
  const failure = colors.intents.failure;

  return (
    <View style={[styles.state, { borderLeftColor: failure.mark }]} testID={testID}>
      <AppText variant="h4" heading color={failure.text}>
        {title}
      </AppText>
      <AppText variant="bodySmall" color={colors.textMuted}>
        {body}
      </AppText>
      {onRetry === undefined || retryLabel === undefined ? undefined : (
        <Button label={retryLabel} onPress={onRetry} variant="secondary" icon="retry" />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  state: {
    alignItems: 'flex-start',
    gap: space[2],
    padding: space[4],
    borderRadius: radii.md,
    backgroundColor: colors.wash.red,
    borderLeftWidth: space[1] / 2,
  },
});
