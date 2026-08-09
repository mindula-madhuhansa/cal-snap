import { StyleSheet, View } from 'react-native';

import { colors, space } from '../theme';
import { AppText } from './app-text';
import { Button } from './button';

/**
 * Something went wrong (spec 0003, AC-5, AC-6).
 *
 * There is no red in this palette, so the fault is carried by plain words and
 * a rule rather than by a colour. That is not a compromise: `AGENTS.md` asks
 * that every failure a person can hit says something honest on screen, and a
 * red border has never told anybody what happened or what to do next.
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
      <AppText variant="bodySmall" color={colors.textSubtle}>
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
    paddingVertical: space[3],
    paddingLeft: space[3],
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
});
