import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CONSENT_SUMMARY } from '@/config/consent';
import {
  ACTIVITY_MULTIPLIERS,
  DAYS_PER_WEEK,
  KCAL_PER_KG,
  type ActivityLevel,
  type GoalDirection,
  type Sex,
} from '@/data/calculations/calorie-target';
import {
  cmToFeetAndInches,
  feetAndInchesToCm,
  kgToLb,
  lbToKg,
  type UnitPreference,
} from '@/data/calculations/units';
import type { OnboardingAnswers } from '@/data/local/onboarding';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Callout } from '@/design-system/components/callout';
import { RadioRow } from '@/design-system/components/radio-row';
import { SegmentedControl } from '@/design-system/components/segmented-control';
import { Stepper } from '@/design-system/components/stepper';
import { colors, space } from '@/design-system/theme';

/**
 * The eight questions, one component each (spec 0006, AC-2 to AC-4).
 *
 * Each one is given the answers so far and a single callback, and each one
 * enforces the same bounds its column's check declares, so a check constraint
 * violation is unreachable and nobody ever meets a generic transaction failure
 * where a specific sentence belongs (AC-16, key invariants).
 */

export type StepProps = {
  readonly answers: OnboardingAnswers;
  readonly onAnswer: (answers: OnboardingAnswers) => void;
  readonly busy: boolean;
};

/** The bounds each column declares, repeated here so the screen stops a value first. */
const BOUNDS = {
  age: { min: 13, max: 120 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 20, max: 500 },
} as const;

export const ConsentStep = ({ onAnswer, busy }: StepProps) => (
  <View style={styles.stack}>
    {CONSENT_SUMMARY.map((line) => (
      <AppText key={line} variant="body" color={colors.textMuted}>
        {line}
      </AppText>
    ))}

    <Button
      label="I agree, continue"
      size="block"
      fullWidth
      disabled={busy}
      onPress={() => onAnswer({ consentedAt: new Date().toISOString() })}
      accessibilityHint="Agrees to the note above and starts the questions"
      testID="onboarding-consent-agree"
    />
  </View>
);

const SEXES: readonly { readonly value: Sex; readonly label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

export const SexStep = ({ answers, onAnswer, busy }: StepProps) => (
  <View style={styles.stack}>
    {SEXES.map((option) => (
      <RadioRow
        key={option.value}
        label={option.label}
        selected={answers.sex === option.value}
        onSelect={() => {
          if (!busy) onAnswer({ sex: option.value });
        }}
        accessibilityLabel={option.label}
        testID={`onboarding-sex-${option.value}`}
      />
    ))}

    {/*
      Stated plainly rather than solved. The equation behind the target has
      two coefficients and no third, so offering a third option would mean
      picking one of these behind the person's back and not telling them.
    */}
    <AppText variant="caption" color={colors.textMuted}>
      The equation the target comes from only has these two settings. We would rather say so than
      quietly pick one for you.
    </AppText>
  </View>
);

export const AgeStep = ({ answers, onAnswer, busy }: StepProps) => {
  const [age, setAge] = useState(answers.ageYears ?? 30);

  return (
    <View style={styles.stack}>
      <Stepper
        value={age}
        onChange={setAge}
        min={BOUNDS.age.min}
        max={BOUNDS.age.max}
        format={(value) => `${value}`}
        accessibilityLabel="Your age in years"
        accessibilityHint={`Between ${BOUNDS.age.min} and ${BOUNDS.age.max}`}
        testID="onboarding-age"
      />
      <ContinueButton disabled={busy} onPress={() => onAnswer({ ageYears: age })} />
    </View>
  );
};

/** The inline unit switch both measurement questions carry (AC-4). */
const UnitToggle = ({
  value,
  onChange,
  metricLabel,
  imperialLabel,
  testID,
}: {
  readonly value: UnitPreference;
  readonly onChange: (value: UnitPreference) => void;
  readonly metricLabel: string;
  readonly imperialLabel: string;
  readonly testID: string;
}) => (
  <SegmentedControl
    options={[
      { value: 'metric', label: metricLabel },
      { value: 'imperial', label: imperialLabel },
    ]}
    value={value}
    onChange={(next) => onChange(next === 'imperial' ? 'imperial' : 'metric')}
    accessibilityLabel="Units"
    accessibilityHint="Switches the units on this question. What you type is stored the same either way"
    testID={testID}
  />
);

export const HeightStep = ({ answers, onAnswer, busy }: StepProps) => {
  const [units, setUnits] = useState<UnitPreference>(answers.unitPreference ?? 'metric');
  const [heightCm, setHeightCm] = useState(answers.heightCm ?? 170);

  const asFeet = cmToFeetAndInches(heightCm);

  return (
    <View style={styles.stack}>
      <UnitToggle
        value={units}
        onChange={setUnits}
        metricLabel="Centimetres"
        imperialLabel="Feet & inches"
        testID="onboarding-height-units"
      />

      {units === 'metric' ? (
        <Stepper
          value={heightCm}
          onChange={setHeightCm}
          min={BOUNDS.heightCm.min}
          max={BOUNDS.heightCm.max}
          format={(value) => `${value} cm`}
          accessibilityLabel="Your height in centimetres"
          testID="onboarding-height-cm"
        />
      ) : (
        <Stepper
          // Stepped in whole inches and converted back, so the stored value is
          // always centimetres whatever was typed.
          value={asFeet.feet * 12 + asFeet.inches}
          onChange={(totalInches) =>
            setHeightCm(
              feetAndInchesToCm({
                feet: Math.floor(totalInches / 12),
                inches: totalInches % 12,
              }),
            )
          }
          min={Math.round(BOUNDS.heightCm.min / 2.54)}
          max={Math.round(BOUNDS.heightCm.max / 2.54)}
          format={(totalInches) => `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`}
          accessibilityLabel="Your height in feet and inches"
          testID="onboarding-height-ft"
        />
      )}

      <ContinueButton
        disabled={busy}
        onPress={() => onAnswer({ heightCm, unitPreference: units })}
      />
    </View>
  );
};

export const WeightStep = ({ answers, onAnswer, busy }: StepProps) => {
  const [units, setUnits] = useState<UnitPreference>(answers.unitPreference ?? 'metric');
  const [weightKg, setWeightKg] = useState(answers.weightKg ?? 70);

  return (
    <View style={styles.stack}>
      <UnitToggle
        value={units}
        onChange={setUnits}
        metricLabel="Kilograms"
        imperialLabel="Pounds"
        testID="onboarding-weight-units"
      />

      {units === 'metric' ? (
        <Stepper
          value={weightKg}
          onChange={setWeightKg}
          min={BOUNDS.weightKg.min}
          max={BOUNDS.weightKg.max}
          format={(value) => `${value} kg`}
          accessibilityLabel="Your weight in kilograms"
          testID="onboarding-weight-kg"
        />
      ) : (
        <Stepper
          value={Math.round(kgToLb(weightKg))}
          onChange={(pounds) => setWeightKg(lbToKg(pounds))}
          min={Math.round(kgToLb(BOUNDS.weightKg.min))}
          max={Math.round(kgToLb(BOUNDS.weightKg.max))}
          format={(pounds) => `${pounds} lb`}
          accessibilityLabel="Your weight in pounds"
          testID="onboarding-weight-lb"
        />
      )}

      <ContinueButton
        disabled={busy}
        onPress={() => onAnswer({ weightKg, unitPreference: units })}
      />
    </View>
  );
};

/**
 * The five stored activity levels, said the way a person would describe their
 * own day rather than in the words the column stores.
 */
const ACTIVITY_LABELS: Readonly<Record<ActivityLevel, string>> = {
  sedentary: 'Mostly sitting',
  light: 'On my feet some of the day',
  moderate: 'On my feet most of the day, or I train a few times a week',
  active: 'Physically demanding days, or I train most days',
  very_active: 'Hard physical work, or I train twice a day',
};

export const ActivityStep = ({ answers, onAnswer, busy }: StepProps) => {
  const levels = Object.keys(ACTIVITY_MULTIPLIERS) as ActivityLevel[];

  return (
    <View style={styles.stack}>
      {levels.map((level) => (
        <RadioRow
          key={level}
          label={ACTIVITY_LABELS[level]}
          selected={answers.activityLevel === level}
          onSelect={() => {
            if (!busy) onAnswer({ activityLevel: level });
          }}
          accessibilityLabel={ACTIVITY_LABELS[level]}
          testID={`onboarding-activity-${level}`}
        />
      ))}
    </View>
  );
};

const GOALS: readonly { readonly value: GoalDirection; readonly label: string }[] = [
  { value: 'lose', label: 'Lose weight' },
  { value: 'hold', label: 'Stay where I am' },
  { value: 'gain', label: 'Gain weight' },
];

export const GoalDirectionStep = ({ answers, onAnswer, busy }: StepProps) => (
  <View style={styles.stack}>
    {GOALS.map((goal) => (
      <RadioRow
        key={goal.value}
        label={goal.label}
        selected={answers.goalDirection === goal.value}
        onSelect={() => {
          if (busy) return;
          // Holding has no pace, so its rate is zero rather than whatever a
          // previous answer left behind.
          onAnswer(
            goal.value === 'hold'
              ? { goalDirection: goal.value, goalRateKgPerWeek: 0 }
              : { goalDirection: goal.value },
          );
        }}
        accessibilityLabel={goal.label}
        testID={`onboarding-goal-${goal.value}`}
      />
    ))}
  </View>
);

/** The paces offered, all inside the column's 0 to 1.5 bound. */
const PACES: readonly { readonly value: number; readonly label: string }[] = [
  { value: 0.25, label: 'Cruise' },
  { value: 0.5, label: 'Steady climb' },
  { value: 0.75, label: 'Brisk' },
  { value: 1, label: 'Full send' },
];

/**
 * The daily calorie change a pace implies, derived from the same constant the
 * target itself uses rather than typed out beside it.
 *
 * This is why the figures here are 275, 550, 825 and 1100 rather than the
 * rounder 250, 500 and 750 a mock might show: 0.25 kg a week really is
 * 0.25 × 7700 ÷ 7 kilocalories a day. Showing the round number would put a
 * figure on screen that the number on the next screen disagrees with, and
 * `AGENTS.md` asks that a health figure is never prettier than the truth.
 */
const dailyChangeForPace = (rateKgPerWeek: number): number =>
  Math.round((rateKgPerWeek * KCAL_PER_KG) / DAYS_PER_WEEK);

export const GoalPaceStep = ({ answers, onAnswer, busy }: StepProps) => {
  const holding = answers.goalDirection === 'hold';
  const [rate, setRate] = useState(answers.goalRateKgPerWeek ?? 0.5);
  const gaining = answers.goalDirection === 'gain';

  if (holding) {
    return (
      <View style={styles.stack}>
        <AppText variant="body" color={colors.textMuted}>
          You are staying where you are, so there is no pace to set. Your target will be roughly
          what you burn in a day.
        </AppText>
        <ContinueButton disabled={busy} onPress={() => onAnswer({ goalRateKgPerWeek: 0 })} />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      {PACES.map((pace) => {
        const change = dailyChangeForPace(pace.value);
        const sign = gaining ? '+' : '−';

        return (
          <RadioRow
            key={pace.value}
            label={pace.label}
            subtitle={`${pace.value} KG/WK · ${sign}${change} KCAL`}
            selected={rate === pace.value}
            onSelect={() => setRate(pace.value)}
            accessibilityLabel={`${pace.label}, ${pace.value} kilograms a week, about ${change} kilocalories a day ${gaining ? 'more' : 'less'}`}
            testID={`onboarding-pace-${pace.value}`}
          />
        );
      })}

      {/*
        AC-8's promise, said before the number rather than after it. The floor
        is the one place the app overrides what was asked for, so somebody
        picking the fastest pace should already know it exists.
      */}
      <Callout
        message="Push harder and we still won’t take you below a safe floor."
        emphasis="We’ll say so if it tries."
      />

      <ContinueButton disabled={busy} onPress={() => onAnswer({ goalRateKgPerWeek: rate })} />
    </View>
  );
};

const ContinueButton = ({
  onPress,
  disabled,
}: {
  readonly onPress: () => void;
  readonly disabled: boolean;
}) => (
  <Button
    label="Continue"
    size="block"
    fullWidth
    disabled={disabled}
    onPress={onPress}
    accessibilityHint="Saves this answer and moves to the next question"
    testID="onboarding-continue"
  />
);

const styles = StyleSheet.create({
  stack: { gap: space[3] },
});
