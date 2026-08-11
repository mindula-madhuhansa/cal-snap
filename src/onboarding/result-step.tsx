import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { computeCalorieTarget, type CalorieTarget } from '@/data/calculations/calorie-target';
import type { CompleteAnswers } from '@/data/local/onboarding';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { NumberText } from '@/design-system/components/number-text';
import { ProgressRing } from '@/design-system/components/progress-ring';
import { colors, space } from '@/design-system/theme';

import { detailSentences, floorSentence, targetSentence } from './result-sentences';

/**
 * The answer (spec 0006, AC-8 and AC-9).
 *
 * The number shown here is the number that will be stored, because both come
 * from the same pure function over the same answers. Nothing is computed twice
 * with a chance of disagreeing.
 *
 * The design draws a macro breakdown under this number. It is not here, and
 * that is deliberate: nothing in the app computes a protein, carbohydrate and
 * fat split yet, and three invented figures on the screen that introduces
 * somebody to their daily target is exactly the thing `AGENTS.md` forbids.
 * They arrive when a feature computes them.
 */

export type ResultStepProps = {
  readonly answers: CompleteAnswers;
  readonly onFinish: () => void;
  readonly busy: boolean;
};

/** The ring is the whole budget, so it is drawn closed. */
const WHOLE = 1;

/**
 * How many of the detail sentences are shown up front, in the card. The rest
 * stay behind the toggle, so the card is a summary rather than a wall and
 * nothing is said twice on one screen.
 */
const DETAIL_SUMMARY_LINES = 2;

export const ResultStep = ({ answers, onFinish, busy }: ResultStepProps) => {
  const [showDetail, setShowDetail] = useState(false);

  const target: CalorieTarget = computeCalorieTarget({
    sex: answers.sex,
    ageYears: answers.ageYears,
    heightCm: answers.heightCm,
    weightKg: answers.weightKg,
    activityLevel: answers.activityLevel,
    goalDirection: answers.goalDirection,
    goalRateKgPerWeek: answers.goalRateKgPerWeek,
  });

  const headline = targetSentence(target.calories, answers.goalDirection);
  const floored = floorSentence(target, answers.goalDirection);

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <AppText variant="kicker" uppercase color={colors.cyan}>
          Your daily number
        </AppText>

        {/*
          AC-15. Announced as the sentence rather than drawn as a large numeral
          a screen reader would read out of context, so the number arrives with
          its meaning attached.
        */}
        <View
          accessible
          accessibilityRole="summary"
          accessibilityLabel={floored === undefined ? headline : `${headline} ${floored}`}
          testID="onboarding-result">
          <ProgressRing progress={WHOLE}>
            {/*
              `estimated` is not decoration. AC-9 says the number is never
              presented as fact, and this is the design system's own way of
              saying so, in the figure and in what a screen reader reads out.
            */}
            <NumberText
              value={String(target.calories)}
              unit="kcal a day"
              estimated
              size="display"
              layout="stacked"
              testID="onboarding-result-calories"
            />
          </ProgressRing>
        </View>

        <AppText variant="h1" heading align="center">
          {headline}
        </AppText>

        {floored === undefined ? undefined : (
          <AppText
            variant="body"
            color={colors.amber}
            align="center"
            testID="onboarding-result-floored">
            {floored}
          </AppText>
        )}
      </View>

      <Card kicker="The maths, plainly">
        {detailSentences(target)
          .slice(0, DETAIL_SUMMARY_LINES)
          .map((line) => (
            <AppText key={line} variant="bodySmall" color={colors.textMuted}>
              {line}
            </AppText>
          ))}
      </Card>

      <Button
        label={showDetail ? 'Hide how this was worked out' : 'How was this worked out?'}
        variant="ghost"
        onPress={() => {
          const next = !showDetail;
          setShowDetail(next);
          // Expanding changes what is on screen without moving focus, which a
          // screen reader would otherwise not mention at all.
          if (next) AccessibilityInfo.announceForAccessibility(detailSentences(target).join(' '));
        }}
        accessibilityHint="Shows the formula behind this number and what it can and cannot tell you"
        testID="onboarding-result-detail-toggle"
      />

      {showDetail ? (
        <View style={styles.detail} testID="onboarding-result-detail">
          {detailSentences(target)
            .slice(DETAIL_SUMMARY_LINES)
            .map((line) => (
              <AppText key={line} variant="caption" color={colors.textMuted}>
                {line}
              </AppText>
            ))}
        </View>
      ) : undefined}

      <AppText variant="caption" color={colors.textDim} align="center">
        It’s an estimate from a handful of answers, not a prescription. Tune it any time in
        Settings.
      </AppText>

      <Button
        label="Start day one"
        size="block"
        fullWidth
        disabled={busy}
        onPress={onFinish}
        accessibilityHint="Saves your answers and your daily target, then opens the app"
        testID="onboarding-finish"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { gap: space[4] },
  hero: { alignItems: 'center', gap: space[3] },
  detail: { gap: space[2] },
});
