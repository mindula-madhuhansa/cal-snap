import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Icon } from '@/design-system/components/icon';
import { IconButton } from '@/design-system/components/icon-button';
import { Notice } from '@/design-system/components/notice';
import { Screen } from '@/design-system/components/screen';
import { colors, minTouchTarget, radii, space } from '@/design-system/theme';

/**
 * What every question screen shares: the progress line, the question itself,
 * the answer, and the way back (spec 0006, AC-2).
 *
 * One frame rather than nine copies, so the progress indicator and the back
 * step cannot drift between screens and the accessibility wiring is done once.
 *
 * The design puts the way back at the top beside the progress, as a small
 * square, rather than at the foot of the screen.
 */

export type StepFrameProps = {
  /**
   * The question, as a person would ask it out loud. Omitted by the result
   * step, which draws its own heading under the ring rather than above it.
   */
  readonly title?: string;
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

/**
 * The progress row: one pill per question, lit up to where the person has
 * got to.
 *
 * Hidden from a screen reader in full, because the phrase beside it already
 * says "Question 3 of 8"; a row of eight unlabelled pills would otherwise be
 * read as eight blank elements.
 */
const ProgressPills = ({ position, total }: { position: number; total: number }) => (
  <View
    style={styles.pills}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants">
    {Array.from({ length: total }, (_, index) => (
      <View key={index} style={[styles.pill, index < position ? styles.pillDone : undefined]} />
    ))}
  </View>
);

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
      {/* Always rendered, so the progress row does not jump sideways between
          the first question and the second. */}
      <View style={styles.backSlot}>
        {canGoBack ? (
          <IconButton
            icon="back"
            label="Back"
            onPress={onBack}
            accessibilityHint="Returns to the previous question. Your answers are kept"
            testID="onboarding-back"
          />
        ) : (
          <View
            style={styles.backPlaceholder}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            <Icon name="back" size="sm" color={colors.textDim} />
          </View>
        )}
      </View>

      <ProgressPills position={position} total={total} />

      {/*
        Spoken as one phrase rather than as the bare numerals a screen reader
        would otherwise read out of the visual "3 / 8".
      */}
      <AppText
        variant="kicker"
        color={colors.textDim}
        accessibilityLabel={`Question ${position} of ${total}`}
        testID="onboarding-progress">
        {`${position}/${total}`}
      </AppText>
    </View>

    {title === undefined ? undefined : (
      <View style={styles.question}>
        <AppText variant="h1" heading>
          {title}
        </AppText>
        {subtitle === undefined ? undefined : (
          <AppText variant="body" color={colors.textMuted}>
            {subtitle}
          </AppText>
        )}
      </View>
    )}

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
  </Screen>
);

/** Matches `IconButton`, so the progress row sits in the same place either way. */
const BACK_SIZE = minTouchTarget;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginBottom: space[6],
  },
  backSlot: {
    width: BACK_SIZE,
  },
  backPlaceholder: {
    width: BACK_SIZE,
    height: BACK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
    opacity: 0.35,
  },
  pills: {
    flex: 1,
    flexDirection: 'row',
    gap: space[1],
  },
  pill: {
    flex: 1,
    height: space[1],
    borderRadius: radii.full,
    backgroundColor: colors.border,
  },
  pillDone: {
    backgroundColor: colors.cyan,
  },
  question: { gap: space[2], marginBottom: space[6] },
  answer: { gap: space[3] },
  footer: { marginTop: space[6] },
});
