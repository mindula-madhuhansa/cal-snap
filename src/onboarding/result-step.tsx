import { useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { computeCalorieTarget, type CalorieTarget } from '@/data/calculations/calorie-target';
import type { CompleteAnswers } from '@/data/local/onboarding';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Divider } from '@/design-system/components/divider';
import { NumberText } from '@/design-system/components/number-text';
import { colors, space } from '@/design-system/theme';

import { detailSentences, floorSentence, targetSentence } from './result-sentences';

/**
 * The answer (spec 0006, AC-8 and AC-9).
 *
 * The number shown here is the number that will be stored, because both come
 * from the same pure function over the same answers. Nothing is computed twice
 * with a chance of disagreeing.
 */

export type ResultStepProps = {
  readonly answers: CompleteAnswers;
  readonly onFinish: () => void;
  readonly busy: boolean;
};

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
      <Card>
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
          {/*
            `estimated` is not decoration. AC-9 says the number is never
            presented as fact, and this is the design system's own way of
            saying so, in the figure and in what a screen reader reads out.
          */}
          <NumberText
            value={String(target.calories)}
            unit="cal a day"
            estimated
            size="h1"
            testID="onboarding-result-calories"
          />

          <View style={styles.sentence}>
            <AppText variant="body">{headline}</AppText>
          </View>

          {floored === undefined ? undefined : (
            <View style={styles.sentence}>
              <AppText variant="body" color={colors.textSubtle} testID="onboarding-result-floored">
                {floored}
              </AppText>
            </View>
          )}
        </View>
      </Card>

      <Divider />

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
          {detailSentences(target).map((line) => (
            <AppText key={line} variant="caption" color={colors.textSubtle}>
              {line}
            </AppText>
          ))}
        </View>
      ) : undefined}

      <Button
        label="Start using CalSnap"
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
  sentence: { marginTop: space[3] },
  detail: { gap: space[2] },
});
