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
import { colors, motion, radii, space } from '../theme';
import { AppText } from './app-text';

/**
 * Waiting.
 *
 * A short cyan line that breathes under one honest sentence. No spinner: a
 * spinner says nothing about what is happening, and this app is asking a model
 * about somebody's dinner.
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
      <AppText variant="bodySmall" color={colors.textMuted} align="center">
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
    height: space[1] / 2,
    borderRadius: radii.full,
    backgroundColor: colors.cyan,
  },
});
