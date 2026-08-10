import type { ActivityLevel, GoalDirection, Sex } from '../calculations/calorie-target';
import {
  FIRST_STEP,
  isOnboardingStep,
  type OnboardingStep,
} from '../calculations/onboarding-steps';
import { dayScopedId } from '../ids/uuid';
import type { UnitPreference } from '../calculations/units';
import { failed, ok, type DailyTarget, type DataResult } from '../types';

import { getOrCreateDailyTarget } from './daily-targets';
import type { SqlDatabase, SqlValue } from './database';
import { nowIso, optional } from './rows';
import { calorieTargetFormula } from './target-formula';

/**
 * First run setup: the answers as they are given, and the one transaction that
 * turns them into a real profile (spec 0006, AC-5 and AC-6).
 *
 * The shape of this module follows one rule from spec 0002: `profiles` holds
 * only complete answer sets. So a half answered setup never touches it. Every
 * answer lands in `onboarding_draft` the moment it is given, and the move
 * across happens once, atomically, at the end.
 */

export type OnboardingAnswers = {
  readonly sex?: Sex;
  readonly ageYears?: number;
  readonly heightCm?: number;
  readonly weightKg?: number;
  readonly activityLevel?: ActivityLevel;
  readonly goalDirection?: GoalDirection;
  readonly goalRateKgPerWeek?: number;
  readonly goalWeightKg?: number;
  readonly unitPreference?: UnitPreference;
  readonly consentedAt?: string;
};

export type OnboardingDraft = OnboardingAnswers & {
  readonly currentStep: OnboardingStep;
};

/** Every answer a complete setup must have. `goalWeightKg` is optional by design. */
export type CompleteAnswers = {
  readonly sex: Sex;
  readonly ageYears: number;
  readonly heightCm: number;
  readonly weightKg: number;
  readonly activityLevel: ActivityLevel;
  readonly goalDirection: GoalDirection;
  readonly goalRateKgPerWeek: number;
  readonly goalWeightKg?: number;
  readonly unitPreference: UnitPreference;
  readonly consentedAt: string;
};

type DraftRow = {
  readonly current_step: string;
  readonly sex: Sex | null;
  readonly age_years: number | null;
  readonly height_cm: number | null;
  readonly weight_kg: number | null;
  readonly activity_level: ActivityLevel | null;
  readonly goal_direction: GoalDirection | null;
  readonly goal_rate_kg_per_week: number | null;
  readonly goal_weight_kg: number | null;
  readonly unit_preference: UnitPreference | null;
  readonly consented_at: string | null;
};

const DRAFT_COLUMNS = `current_step, sex, age_years, height_cm, weight_kg, activity_level,
  goal_direction, goal_rate_kg_per_week, goal_weight_kg, unit_preference, consented_at`;

/**
 * The answer columns, mapped from the shape a screen hands over to the column
 * it lives in. Listed once so `saveDraftStep` cannot write a column
 * `readDraft` does not read back.
 */
const ANSWER_COLUMNS: Readonly<Record<keyof OnboardingAnswers, string>> = {
  sex: 'sex',
  ageYears: 'age_years',
  heightCm: 'height_cm',
  weightKg: 'weight_kg',
  activityLevel: 'activity_level',
  goalDirection: 'goal_direction',
  goalRateKgPerWeek: 'goal_rate_kg_per_week',
  goalWeightKg: 'goal_weight_kg',
  unitPreference: 'unit_preference',
  consentedAt: 'consented_at',
};

const toDraft = (row: DraftRow): OnboardingDraft => ({
  // A row whose step somehow is not one the app knows restarts at the first
  // question rather than stranding the person on a screen that cannot render.
  currentStep: isOnboardingStep(row.current_step) ? row.current_step : FIRST_STEP,
  ...(optional(row.sex) === undefined ? {} : { sex: row.sex as Sex }),
  ...(optional(row.age_years) === undefined ? {} : { ageYears: row.age_years as number }),
  ...(optional(row.height_cm) === undefined ? {} : { heightCm: row.height_cm as number }),
  ...(optional(row.weight_kg) === undefined ? {} : { weightKg: row.weight_kg as number }),
  ...(optional(row.activity_level) === undefined
    ? {}
    : { activityLevel: row.activity_level as ActivityLevel }),
  ...(optional(row.goal_direction) === undefined
    ? {}
    : { goalDirection: row.goal_direction as GoalDirection }),
  ...(optional(row.goal_rate_kg_per_week) === undefined
    ? {}
    : { goalRateKgPerWeek: row.goal_rate_kg_per_week as number }),
  ...(optional(row.goal_weight_kg) === undefined
    ? {}
    : { goalWeightKg: row.goal_weight_kg as number }),
  ...(optional(row.unit_preference) === undefined
    ? {}
    : { unitPreference: row.unit_preference as UnitPreference }),
  ...(optional(row.consented_at) === undefined ? {} : { consentedAt: row.consented_at as string }),
});

/**
 * The answers so far, or nothing if setup has not been started.
 *
 * This is the whole of resuming (AC-5): the app reads this on launch and sends
 * the person to `currentStep` with everything before it already filled in.
 */
export const readDraft = async (
  db: SqlDatabase,
  userId: string,
): Promise<DataResult<OnboardingDraft | undefined>> => {
  const row = await db.getFirstAsync<DraftRow>(
    `SELECT ${DRAFT_COLUMNS} FROM onboarding_draft WHERE user_id = ?`,
    [userId],
  );

  return ok(row === null ? undefined : toDraft(row));
};

/**
 * Records one answer and where the person goes next, in one write.
 *
 * Called on every answer rather than at the end, which is what makes force
 * quitting halfway harmless. The draft never syncs, so this costs nothing but
 * a local write.
 */
export const saveDraftStep = async (
  db: SqlDatabase,
  input: {
    readonly userId: string;
    readonly answers: OnboardingAnswers;
    readonly nextStep: OnboardingStep;
  },
): Promise<DataResult<OnboardingDraft>> => {
  const at = nowIso();

  // Built from `ANSWER_COLUMNS`, never from the caller's keys, so no value from
  // outside the app can reach the statement text. Only the answers actually
  // given are written, which is what stops a later step blanking an earlier
  // answer, and `current_step` always moves.
  const answered = (Object.keys(ANSWER_COLUMNS) as (keyof OnboardingAnswers)[]).filter(
    (key) => input.answers[key] !== undefined,
  );

  const columns = ['current_step', ...answered.map((key) => ANSWER_COLUMNS[key])];
  const values: readonly SqlValue[] = [
    input.nextStep,
    ...answered.map((key) => input.answers[key] as SqlValue),
  ];

  await db.runAsync(
    `INSERT INTO onboarding_draft (user_id, ${columns.join(', ')}, created_at, updated_at)
     VALUES (?, ${columns.map(() => '?').join(', ')}, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       ${columns.map((column) => `${column} = excluded.${column}`).join(',\n       ')},
       updated_at = excluded.updated_at`,
    [input.userId, ...values, at, at],
  );

  const written = await readDraft(db, input.userId);
  if (written.kind === 'failed') return failed(written.message);
  if (written.value === undefined)
    return failed('Your answer could not be saved. Please try again.');

  return ok(written.value);
};

/** Which answers are still missing, named the way a person would say them. */
const missingFrom = (answers: OnboardingAnswers): readonly string[] =>
  [
    answers.consentedAt === undefined ? 'your agreement to the privacy note' : undefined,
    answers.sex === undefined ? 'sex' : undefined,
    answers.ageYears === undefined ? 'age' : undefined,
    answers.heightCm === undefined ? 'height' : undefined,
    answers.weightKg === undefined ? 'weight' : undefined,
    answers.activityLevel === undefined ? 'activity level' : undefined,
    answers.goalDirection === undefined ? 'goal' : undefined,
    answers.goalRateKgPerWeek === undefined ? 'pace' : undefined,
    answers.unitPreference === undefined ? 'units' : undefined,
  ].filter((name): name is string => name !== undefined);

/**
 * Turns a complete draft into a real profile: the `profiles` row, the first
 * weigh in, and today's target, all inside one transaction, and then the draft
 * is deleted (AC-6).
 *
 * One transaction is the point. Any failure part way leaves no profile, no
 * weigh in, no target, and the draft exactly as it was, so the person is on
 * the last screen with an honest message and nothing lost.
 */
export const completeOnboarding = async (
  db: SqlDatabase,
  input: {
    readonly userId: string;
    readonly answers: CompleteAnswers;
    /** The device's IANA zone, read once at the Expo edge and passed in. */
    readonly timezone: string;
    /** Today in that zone, resolved at the edge for the same reason. */
    readonly today: string;
    readonly consentVersion: string;
  },
): Promise<DataResult<DailyTarget>> => {
  const missing = missingFrom(input.answers);
  if (missing.length > 0) {
    return failed(`Setup is not finished yet: we still need ${missing.join(', ')}.`);
  }

  const { answers, userId, today } = input;
  const at = nowIso();
  let target: DataResult<DailyTarget> = failed('Your daily target could not be worked out.');

  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT INTO profiles (
           user_id, age_years, age_recorded_on, sex, height_cm, activity_level,
           goal_direction, goal_rate_kg_per_week, goal_weight_kg, unit_preference, timezone,
           exercise_credit, exercise_credit_factor, photo_sync_enabled,
           consented_at, consent_version, onboarded_at,
           created_at, updated_at, is_dirty, synced_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'full', 1, 0, ?, ?, ?, ?, ?, 1, NULL)`,
        [
          userId,
          answers.ageYears,
          // The date the age was given, not a birthday: the app never invents
          // a birth date it was not told (spec 0002).
          today,
          answers.sex,
          answers.heightCm,
          answers.activityLevel,
          answers.goalDirection,
          answers.goalRateKgPerWeek,
          answers.goalWeightKg ?? null,
          answers.unitPreference,
          input.timezone,
          answers.consentedAt,
          input.consentVersion,
          at,
          at,
          at,
        ],
      );

      await db.runAsync(
        `INSERT INTO weight_entries (
           id, user_id, on_date, recorded_at, weight_kg, source,
           created_at, updated_at, deleted_at, is_dirty, synced_at
         ) VALUES (?, ?, ?, ?, ?, 'onboarding', ?, ?, NULL, 1, NULL)`,
        [dayScopedId('weight_entries', userId, today), userId, today, at, answers.weightKg, at, at],
      );

      // Written here, inside the same transaction, so the number the result
      // screen shows is the number that was stored, not one computed again.
      target = await getOrCreateDailyTarget(db, { userId, onDate: today }, calorieTargetFormula);
      if (target.kind === 'failed') {
        throw new Error(target.message);
      }

      await db.runAsync('DELETE FROM onboarding_draft WHERE user_id = ?', [userId]);
    });
  } catch {
    // The transaction rolled back, so there is no profile and the draft is
    // untouched. Say so plainly rather than leaking a database message.
    return failed(
      'We could not finish setting up your profile. Your answers are saved, so please try again.',
    );
  }

  return target;
};

/** Whether this person has already finished setup, which is what decides AC-1. */
export const hasOnboarded = async (db: SqlDatabase, userId: string): Promise<boolean> => {
  const row = await db.getFirstAsync<{ onboarded_at: string | null }>(
    'SELECT onboarded_at FROM profiles WHERE user_id = ?',
    [userId],
  );

  return row !== null && row.onboarded_at !== null;
};
