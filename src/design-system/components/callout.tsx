import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { intentColors, type Intent } from '../intent-colors';
import { colors, radii, space } from '../theme';
import { AppText } from './app-text';

/**
 * A standing note in a tinted box: the caveat under a pace, the line in
 * Settings saying a change starts tomorrow.
 *
 * **Not the same thing as `Notice`.** A `Notice` is an answer to something a
 * person just did, so it is announced as an alert. A `Callout` is part of the
 * screen, there before anything is pressed, so it is read in document order
 * like any other paragraph and never interrupts. Using the announced one for
 * standing copy makes a screen reader talk over itself on every render.
 *
 * The dot beside the words is what carries the meaning alongside the hue, so
 * an intent is never signalled by colour alone.
 */

export type CalloutProps = {
  readonly message: string;
  /** Defaults to `notice`: worth knowing, nothing has gone wrong. */
  readonly intent?: Intent;
  /**
   * Words inside the message that carry the point, set in the intent's colour.
   * Rendered after the message as its own emphasised run.
   */
  readonly emphasis?: string;
  /** A button, or a second line. */
  readonly children?: ReactNode;
  readonly testID?: string;
};

export const Callout = ({
  message,
  intent = 'notice',
  emphasis,
  children,
  testID,
}: CalloutProps) => {
  const resolved = intentColors(intent);

  return (
    <View style={[styles.callout, { borderColor: resolved.mark }]} testID={testID}>
      <View style={styles.row}>
        {/* The mark that says this is a note, for anyone who cannot separate
            the tint from the card behind it. */}
        <View style={[styles.dot, { backgroundColor: resolved.mark }]} />
        <View style={styles.body}>
          <AppText variant="bodySmall" color={colors.textMuted}>
            {message}
            {emphasis === undefined ? undefined : (
              <AppText variant="bodySmall" color={resolved.text}>
                {` ${emphasis}`}
              </AppText>
            )}
          </AppText>
          {children}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  callout: {
    padding: space[3],
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.wash.neutral,
  },
  row: {
    flexDirection: 'row',
    gap: space[2],
  },
  dot: {
    width: space[1] + space[1] / 2,
    height: space[1] + space[1] / 2,
    borderRadius: radii.full,
    // Sits on the first line's optical centre rather than at its top.
    marginTop: space[2],
  },
  body: {
    flex: 1,
    gap: space[2],
  },
});
