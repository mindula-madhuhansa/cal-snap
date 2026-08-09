import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
} from 'react-native-reanimated';

import { motionDuration } from '../motion-duration';
import { useReducedMotion } from '../use-reduced-motion';
import { colors, motion, space } from '../theme';
import { AppText } from './app-text';

/**
 * Waiting (spec 0003, AC-5, AC-6, AC-9).
 *
 * A short gold line that breathes under one honest sentence, matching the
 * canvas's "reading your day". No spinner: a spinner says nothing about what
 * is happening, and this app is asking a model about somebody's dinner.
 *
 * With reduce motion on, the line simply sits there at full strength. It is
 * still visibly a waiting state, it just does not move.
 */

export type LoadingStateProps = {
  readonly message: string;
  readonly testID?: string;
};

/** The pulse's dimmest point. */
const PULSE_MIN_OPACITY = 0.25;

export const LoadingState = ({ message, testID }: LoadingStateProps) => {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    const duration = motionDuration(motion.loop.pulse, reduced);

    if (duration === motion.duration.instant) {
      cancelAnimation(opacity);
      opacity.value = 1;
      return;
    }

    opacity.value = withRepeat(
      withTiming(PULSE_MIN_OPACITY, {
        duration,
        easing: Easing.bezier(...motion.easing.standard),
      }),
      // Forever, reversing, so it breathes rather than restarting with a jump.
      -1,
      true,
    );

    return () => cancelAnimation(opacity);
  }, [reduced, opacity]);

  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      // Announced as one busy thing, so a screen reader says what is happening
      // instead of reading a decorative line.
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      accessibilityState={{ busy: true }}
      style={styles.state}
      testID={testID}>
      <Animated.View style={[styles.line, pulse]} />
      <AppText variant="bodySmall" color={colors.textSubtle} align="center">
        {message}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[8],
  },
  line: {
    width: space[8] * 2,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: colors.accent,
  },
});
