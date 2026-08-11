import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Notice } from '@/design-system/components/notice';
import { Screen } from '@/design-system/components/screen';
import { colors, space } from '@/design-system/theme';

/**
 * What every question screen shares: the progress line, the question itself,
 * the answer, and the way back (spec 0006, AC-2).
 *
 * One frame rather than nine copies, so the progress indicator and the back
 * step cannot drift between screens and the accessibility wiring is done once.
 */

export type StepFrameProps = {
  /** The question, as a person would ask it out loud. */
  readonly title: string;
  /** One line under it, when the question needs a word of explanation. */
  readonly subtitle?: string;
  readonly position: number;
  readonly total: number;
  readonly canGoBack: boolean;
  readonly onBack: () => void;
  readonly error?: string;
  readonly onDismissError: () => void;
  readonly children: ReactNode;
  /** The primary action, rendered under the answer. */
  readonly footer?: ReactNode;
  readonly testID?: string;
};

export const StepFrame = ({
  title,
  subtitle,
  position,
  total,
  canGoBack,
  onBack,
  error,
  onDismissError,
  children,
  footer,
  testID,
}: StepFrameProps) => (
  <Screen testID={testID}>
    <View style={styles.header}>
      {/*
        Spoken as one phrase rather than as the bare numerals a screen reader
        would otherwise read out of the visual "3 / 8".
      */}
      <AppText
        variant="caption"
        color={colors.textSubtle}
        uppercase
        accessibilityLabel={`Question ${position} of ${total}`}
        testID="onboarding-progress">
        {`${position} of ${total}`}
      </AppText>

      <View
        style={styles.track}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <View style={[styles.fill, { flex: position }]} />
        <View style={{ flex: Math.max(total - position, 0) }} />
      </View>
    </View>

    <View style={styles.question}>
      <AppText variant="h2" heading>
        {title}
      </AppText>
      {subtitle === undefined ? undefined : (
        <AppText variant="body" color={colors.textSubtle}>
          {subtitle}
        </AppText>
      )}
    </View>

    {error === undefined ? undefined : (
      <Notice message={error} intent="failure" testID="onboarding-error">
        <Button
          label="Dismiss"
          variant="ghost"
          onPress={onDismissError}
          accessibilityHint="Hides this message so you can try again"
          testID="onboarding-error-dismiss"
        />
      </Notice>
    )}

    <View style={styles.answer}>{children}</View>

    {footer === undefined ? undefined : <View style={styles.footer}>{footer}</View>}

    {canGoBack ? (
      <View style={styles.back}>
        <Button
          label="Back"
          variant="ghost"
          icon="back"
          onPress={onBack}
          accessibilityHint="Returns to the previous question. Your answers are kept"
          testID="onboarding-back"
        />
      </View>
    ) : undefined}
  </Screen>
);

const styles = StyleSheet.create({
  header: { gap: space[2], marginBottom: space[6] },
  track: { flexDirection: 'row', height: 2, backgroundColor: colors.divider },
  fill: { backgroundColor: colors.accent },
  question: { gap: space[2], marginBottom: space[6] },
  answer: { gap: space[3] },
  footer: { marginTop: space[6] },
  back: { marginTop: space[4], alignItems: 'flex-start' },
});
