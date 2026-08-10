import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  openTestDatabase,
  seedProfile,
  USER_A,
  USER_B,
  type TestDatabase,
} from '../../../test/support/sqlite';
import { dayScopedId } from '../ids/uuid';

import {
  completeOnboarding,
  hasOnboarded,
  readDraft,
  saveDraftStep,
  type CompleteAnswers,
} from './onboarding';

let store: TestDatabase;

beforeEach(() => {
  store = openTestDatabase();
});

afterEach(() => {
  store.close();
});

const TODAY = '2026-08-10';

const completeAnswers: CompleteAnswers = {
  sex: 'female',
  ageYears: 35,
  heightCm: 165,
  weightKg: 70,
  activityLevel: 'moderate',
  goalDirection: 'lose',
  goalRateKgPerWeek: 0.5,
  goalWeightKg: 62,
  unitPreference: 'metric',
  consentedAt: '2026-08-10T08:00:00.000Z',
};

/**
 * The same database, but one statement fails, standing in for a disk that
 * filled up or a file that went bad partway through. The only way to reach the
 * rollback now that both writes are upserts.
 */
const failingOn = (db: TestDatabase['db'], fragment: string): TestDatabase['db'] => ({
  ...db,
  runAsync: async (sql, params) => {
    if (sql.includes(fragment)) throw new Error('the disk is full');
    return db.runAsync(sql, params);
  },
});

const complete = (overrides: Partial<CompleteAnswers> = {}) =>
  completeOnboarding(store.db, {
    userId: USER_A,
    answers: { ...completeAnswers, ...overrides },
    timezone: 'Asia/Colombo',
    today: TODAY,
    consentVersion: 'v1-test',
  });

describe('the draft', () => {
  it('is absent before setup is started', async () => {
    const result = await readDraft(store.db, USER_A);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.value).toBeUndefined();
  });

  // covers: AC-5. The whole of resuming: answers are written as they are
  // given, so nothing is held in memory waiting for the end.
  it('keeps every answer given so far and the question that comes next', async () => {
    await saveDraftStep(store.db, {
      userId: USER_A,
      answers: { consentedAt: '2026-08-10T08:00:00.000Z' },
      nextStep: 'sex',
    });
    await saveDraftStep(store.db, { userId: USER_A, answers: { sex: 'female' }, nextStep: 'age' });
    await saveDraftStep(store.db, {
      userId: USER_A,
      answers: { ageYears: 35 },
      nextStep: 'height',
    });

    const result = await readDraft(store.db, USER_A);

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.value).toStrictEqual({
        currentStep: 'height',
        consentedAt: '2026-08-10T08:00:00.000Z',
        sex: 'female',
        ageYears: 35,
      });
    }
  });

  // covers: AC-5. The failure this guards against is a later step quietly
  // blanking an earlier answer, which would send the person back a screen.
  it('never blanks an answer a later step did not mention', async () => {
    await saveDraftStep(store.db, { userId: USER_A, answers: { sex: 'male' }, nextStep: 'age' });
    await saveDraftStep(store.db, {
      userId: USER_A,
      answers: { ageYears: 40 },
      nextStep: 'height',
    });

    const result = await readDraft(store.db, USER_A);

    if (result.kind === 'ok') expect(result.value?.sex).toBe('male');
  });

  // covers: AC-2. Going back and answering differently replaces the answer
  // rather than adding a second one.
  it('overwrites an answer given again', async () => {
    await saveDraftStep(store.db, { userId: USER_A, answers: { sex: 'male' }, nextStep: 'age' });
    await saveDraftStep(store.db, { userId: USER_A, answers: { sex: 'female' }, nextStep: 'age' });

    const result = await readDraft(store.db, USER_A);

    if (result.kind === 'ok') expect(result.value?.sex).toBe('female');
  });

  // covers: AC-2. Stepping backward moves the step without touching answers.
  it('moves the step on its own when no answer is given', async () => {
    await saveDraftStep(store.db, { userId: USER_A, answers: { sex: 'female' }, nextStep: 'age' });
    await saveDraftStep(store.db, { userId: USER_A, answers: {}, nextStep: 'sex' });

    const result = await readDraft(store.db, USER_A);

    if (result.kind === 'ok') {
      expect(result.value?.currentStep).toBe('sex');
      expect(result.value?.sex).toBe('female');
    }
  });

  // covers: AC-13, AC-17
  it('belongs to one person and is invisible to another', async () => {
    await saveDraftStep(store.db, { userId: USER_A, answers: { sex: 'female' }, nextStep: 'age' });

    const other = await readDraft(store.db, USER_B);

    if (other.kind === 'ok') expect(other.value).toBeUndefined();
  });
});

describe('completeOnboarding', () => {
  // covers: AC-6
  it('writes the profile, the first weigh in, and today’s target together', async () => {
    const result = await complete();

    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      // The reference profile spec 0006 pins.
      expect(result.value.calories).toBe(1613);
      expect(result.value.onDate).toBe(TODAY);
      expect(result.value.source).toBe('computed');
    }

    expect(await hasOnboarded(store.db, USER_A)).toBe(true);

    const weighIn = store.raw
      .prepare('select weight_kg, source, on_date from weight_entries where user_id = ?')
      .get(USER_A);
    expect(weighIn).toMatchObject({ weight_kg: 70, source: 'onboarding', on_date: TODAY });
  });

  // covers: AC-6
  it('records the age against the date it was given, not a birthday', async () => {
    await complete();

    const profile = store.raw
      .prepare(
        'select age_years, age_recorded_on, timezone, consent_version from profiles where user_id = ?',
      )
      .get(USER_A);

    expect(profile).toMatchObject({
      age_years: 35,
      age_recorded_on: TODAY,
      timezone: 'Asia/Colombo',
      consent_version: 'v1-test',
    });
  });

  // covers: AC-6. The draft has done its job and would otherwise send the
  // person back into setup on the next launch.
  it('deletes the draft once the profile exists', async () => {
    await saveDraftStep(store.db, { userId: USER_A, answers: { sex: 'female' }, nextStep: 'age' });
    await complete();

    const draft = await readDraft(store.db, USER_A);
    if (draft.kind === 'ok') expect(draft.value).toBeUndefined();
  });

  // covers: AC-6. One transaction, so a failure leaves nothing half written
  // and the answers still safe.
  it('leaves no profile and an intact draft when the write fails partway', async () => {
    await saveDraftStep(store.db, {
      userId: USER_A,
      answers: { sex: 'female', ageYears: 35 },
      nextStep: 'height',
    });

    // Fails the very last statement, so the profile, the weigh in, and the
    // target have all been written by the time it throws. That is the only
    // interesting rollback: an early failure would prove nothing.
    const failingDb = failingOn(store.db, 'DELETE FROM onboarding_draft');

    const result = await completeOnboarding(failingDb, {
      userId: USER_A,
      answers: completeAnswers,
      timezone: 'Asia/Colombo',
      today: TODAY,
      consentVersion: 'v1-test',
    });

    expect(result.kind).toBe('failed');
    expect(await hasOnboarded(store.db, USER_A)).toBe(false);
    expect(store.raw.prepare('select count(*) as n from profiles').get()).toMatchObject({ n: 0 });
    expect(store.raw.prepare('select count(*) as n from weight_entries').get()).toMatchObject({
      n: 0,
    });
    expect(store.raw.prepare('select count(*) as n from daily_targets').get()).toMatchObject({
      n: 0,
    });

    const draft = await readDraft(store.db, USER_A);
    if (draft.kind === 'ok') {
      expect(draft.value?.sex).toBe('female');
      expect(draft.value?.ageYears).toBe(35);
    }
  });

  // covers: AC-6. The message is what the person acts on, and "please try
  // again" alone is only honest when trying again might work. Most failures
  // here are deterministic, so the reason comes through.
  it('says what actually went wrong rather than only that something did', async () => {
    const failingDb = failingOn(store.db, 'DELETE FROM onboarding_draft');

    const result = await completeOnboarding(failingDb, {
      userId: USER_A,
      answers: completeAnswers,
      timezone: 'Asia/Colombo',
      today: TODAY,
      consentVersion: 'v1-test',
    });

    if (result.kind === 'failed') {
      expect(result.message).toContain('nothing is lost');
      expect(result.message).toContain('disk is full');
    }
  });
});

/**
 * The bug a real phone found on 10 August 2026, and the states that caused it.
 *
 * Finishing setup is retryable by design: the screen tells the person their
 * answers are saved and to try again. So the second press has to be able to
 * succeed. A bare insert could not, because `profiles` is keyed on `user_id`
 * and `weight_entries` is unique on `(user_id, on_date)` while live, and every
 * one of these states makes that insert throw with no way forward.
 */
describe('finishing setup a second time', () => {
  it('succeeds after a first attempt that already wrote the profile', async () => {
    const failingDb = failingOn(store.db, 'DELETE FROM onboarding_draft');
    await completeOnboarding(failingDb, {
      userId: USER_A,
      answers: completeAnswers,
      timezone: 'Asia/Colombo',
      today: TODAY,
      consentVersion: 'v1-test',
    });

    const second = await complete();

    expect(second.kind).toBe('ok');
    if (second.kind === 'ok') expect(second.value.calories).toBe(1613);
    expect(await hasOnboarded(store.db, USER_A)).toBe(true);
  });

  it('leaves exactly one profile and one weigh in when pressed twice', async () => {
    await complete();
    const again = await complete();

    expect(again.kind).toBe('ok');
    expect(store.raw.prepare('select count(*) as n from profiles').get()).toMatchObject({ n: 1 });
    expect(store.raw.prepare('select count(*) as n from weight_entries').get()).toMatchObject({
      n: 1,
    });
  });

  // A profile row that arrived but was never finished is exactly what routing
  // sends to onboarding, so this is the state a person is most likely to be in.
  it('completes over a profile row that exists but was never onboarded', async () => {
    seedProfile(store.raw, USER_A, { onboarded: false });

    const result = await complete();

    expect(result.kind).toBe('ok');
    expect(await hasOnboarded(store.db, USER_A)).toBe(true);

    // The answers just given win over whatever the unfinished row held.
    const profile = store.raw
      .prepare('select age_years, sex, timezone from profiles where user_id = ?')
      .get(USER_A);
    expect(profile).toMatchObject({ age_years: 35, sex: 'female', timezone: 'Asia/Colombo' });
  });

  it('completes when a weigh in for today already exists', async () => {
    store.raw
      .prepare(
        `insert into weight_entries (id, user_id, on_date, recorded_at, weight_kg, source,
           created_at, updated_at, deleted_at, is_dirty, synced_at)
         values (?, ?, ?, ?, 68, 'manual', ?, ?, null, 0, null)`,
      )
      .run(
        dayScopedId('weight_entries', USER_A, TODAY),
        USER_A,
        TODAY,
        `${TODAY}T06:00:00Z`,
        `${TODAY}T06:00:00Z`,
        `${TODAY}T06:00:00Z`,
      );

    const result = await complete();

    expect(result.kind).toBe('ok');
    const weighIn = store.raw
      .prepare('select weight_kg, is_dirty from weight_entries where user_id = ?')
      .get(USER_A);
    expect(weighIn).toMatchObject({ weight_kg: 70, is_dirty: 1 });
  });

  // covers: AC-6. `profiles` holds only complete answer sets, so an incomplete
  // one is refused before any write, and the message names what is missing.
  it('refuses an incomplete answer set and names what is missing', async () => {
    // Built by dropping a key rather than by setting it undefined, because
    // the types cannot express an incomplete set. That is the point: the only
    // way this reaches the function is a draft the screens never finished.
    const withoutConsent = Object.fromEntries(
      Object.entries(completeAnswers).filter(([key]) => key !== 'consentedAt'),
    ) as CompleteAnswers;

    const result = await completeOnboarding(store.db, {
      userId: USER_A,
      answers: withoutConsent,
      timezone: 'Asia/Colombo',
      today: TODAY,
      consentVersion: 'v1-test',
    });

    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') {
      expect(result.message).toContain('agreement to the privacy note');
    }
    expect(store.raw.prepare('select count(*) as n from profiles').get()).toMatchObject({ n: 0 });
  });

  // covers: AC-6. Everything the goal answers imply reaches the row, including
  // the goal weight release 1 stores but does not read.
  it('stores the goal answers and the unit the person used', async () => {
    await complete({ unitPreference: 'imperial', goalDirection: 'gain', goalRateKgPerWeek: 0.25 });

    const profile = store.raw
      .prepare(
        'select unit_preference, goal_direction, goal_rate_kg_per_week, goal_weight_kg from profiles where user_id = ?',
      )
      .get(USER_A);

    expect(profile).toMatchObject({
      unit_preference: 'imperial',
      goal_direction: 'gain',
      goal_rate_kg_per_week: 0.25,
      goal_weight_kg: 62,
    });
  });
});

describe('hasOnboarded', () => {
  // covers: AC-1
  it('is false with no profile at all', async () => {
    expect(await hasOnboarded(store.db, USER_A)).toBe(false);
  });

  // covers: AC-1. A profile row that arrived by sync but was never finished is
  // still not onboarded.
  it('is false for a profile whose onboarded_at is null', async () => {
    seedProfile(store.raw, USER_A, { onboarded: false });

    expect(await hasOnboarded(store.db, USER_A)).toBe(false);
  });

  // covers: AC-1. The second device case: the profile arrived by sync, so
  // setup must not run again.
  it('is true for a profile that arrived complete, so setup never repeats', async () => {
    seedProfile(store.raw, USER_A);

    expect(await hasOnboarded(store.db, USER_A)).toBe(true);
  });
});
