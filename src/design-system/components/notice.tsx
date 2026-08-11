import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { intentColors, type Intent } from '../intent-colors';
import { colors, radii, space } from '../theme';
import { AppText } from './app-text';

/**
 * A short message about what just happened, said out loud as well as drawn.
 *
 * `ErrorState` is the whole screen version: a heading, a body, and a retry,
 * for when the thing a person came for did not load. This is the inline one:
 * a sentence beside the form they are still using, for a wrong code, a phone
 * with no signal, or a session that ended under them. `Callout` is the third:
 * standing copy that was there before anything was pressed, and is therefore
 * never announced.
 *
 * **The reason this one exists is the announcement.** A message that appears
 * after a button is pressed is silent to a screen reader unless it is marked,
 * so somebody using VoiceOver or TalkBack presses "Continue", hears nothing,
 * and has no way to know they were told anything at all. `role="alert"` plus a
 * polite live region is what makes the sentence reach them. Worth knowing:
 * this asks the platform to announce, it cannot force it, so the message is
 * always visible too and never only spoken.
 *
 * The left edge is drawn thick rather than as a hairline, so the difference
 * between a failure and a note survives someone who cannot separate the two
 * hues.
 */

export type NoticeProps = {
  readonly message: string;
  /**
   * `failure` for something that went wrong, `notice` for something merely
   * worth knowing, which should not read as an error.
   */
  readonly intent?: Intent;
  /** Overrides what is spoken, when the visible sentence reads badly aloud. */
  readonly accessibilityLabel?: string;
  /**
   * A button, or a second line. Deliberately **outside** the announced group:
   * anything inside an `accessible` view is swallowed by it on iOS, and a
   * button a screen reader cannot reach is worse than one that is not
   * announced.
   */
  readonly children?: ReactNode;
  readonly testID?: string;
};

/** The wash each intent's box is filled with. */
const washes: Readonly<Record<Intent, string>> = {
  over: colors.wash.amber,
  notice: colors.wash.amber,
  failure: colors.wash.red,
  success: colors.wash.green,
};

export const Notice = ({
  message,
  intent = 'failure',
  accessibilityLabel,
  children,
  testID,
}: NoticeProps) => {
  const resolved = intentColors(intent);

  return (
    <View style={styles.notice} testID={testID}>
      <View
        // One announced thing, one sentence. `accessible` groups it so the
        // reader says the whole message rather than fragments of it.
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        accessibilityLabel={accessibilityLabel ?? message}
        style={[styles.box, { borderLeftColor: resolved.mark, backgroundColor: washes[intent] }]}>
        <AppText variant="bodySmall" color={resolved.text}>
          {message}
        </AppText>
      </View>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  notice: {
    gap: space[1],
  },
  box: {
    padding: space[3],
    borderRadius: radii.md,
    borderLeftWidth: space[1] / 2,
  },
});
