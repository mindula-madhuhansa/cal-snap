import { useCallback, useEffect, useMemo, useState } from 'react';

import { CONSENT_VERSION } from '@/config/consent';
import { deviceTimeZone, resolveLocalDay } from '@/data/calculations/local-day';
import {
  FIRST_STEP,
  nextStep as stepAfter,
  previousStep as stepBefore,
  progressOf,
  type OnboardingStep,
} from '@/data/calculations/onboarding-steps';
import { unitPreferenceForLocale } from '@/data/calculations/unit-default';
import type { UnitPreference } from '@/data/calculations/units';
import { asSqlDatabase } from '@/db/client';
import {
  completeOnboarding,
  readDraft,
  saveDraftStep,
  type CompleteAnswers,
  type OnboardingAnswers,
  type OnboardingDraft,
} from '@/data/local/onboarding';
import type { DailyTarget } from '@/data/types';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * The setup flow's state, and the only place it touches the database.
 *
 * The step components below it are given values and callbacks and nothing
 * else, so every question screen stays a rendering of an answer rather than a
 * small program of its own. The rules about which step comes next live in
 * `calculations/onboarding-steps.ts` and are pure; this hook is the effectful
 * shell around them (spec 0006, AC-5).
 */

export type OnboardingPhase =
  /** Reading the draft. The very first launch of setup, and a resume, both start here. */
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'asking';
      readonly step: OnboardingStep;
      readonly answers: OnboardingAnswers;
      readonly progress: { readonly position: number; readonly total: number };
      /** Absent on the first screen, where there is nothing behind it. */
      readonly canGoBack: boolean;
      /** Set while a write is in flight, so a double tap cannot double answer. */
      readonly busy: boolean;
      /** A failure the person needs to read, in plain words. */
      readonly error?: string;
    }
  | { readonly kind: 'done'; readonly target: DailyTarget };

export type OnboardingFlow = {
  readonly phase: OnboardingPhase;
  /** Records an answer and moves forward. */
  readonly answer: (answers: OnboardingAnswers) => void;
  /** Moves back a step without touching any answer. */
  readonly goBack: () => void;
  /** Leaves the result screen, which is what commits everything. */
  readonly finish: () => void;
  readonly dismissError: () => void;
};

/** The unit family the fields open in, from the device's locale (AC-4). */
export const deviceUnitPreference = (): UnitPreference => {
  try {
    return unitPreferenceForLocale(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'metric';
  }
};

export const useOnboarding = (db: SQLiteDatabase, userId: string): OnboardingFlow => {
  const sql = useMemo(() => asSqlDatabase(db), [db]);
  const [phase, setPhase] = useState<OnboardingPhase>({ kind: 'loading' });

  const showStep = useCallback(
    (step: OnboardingStep, answers: OnboardingAnswers, error?: string): void => {
      setPhase({
        kind: 'asking',
        step,
        answers,
        progress: progressOf(step),
        canGoBack: stepBefore(step) !== undefined,
        busy: false,
        ...(error === undefined ? {} : { error }),
      });
    },
    [],
  );

  // Resuming (AC-5). A draft sends the person back to the question that was
  // next; no draft starts at the beginning, with the unit family the locale
  // implies already chosen so the height and weight fields open right.
  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      // The data layer returns expected failures as values, but a database
      // that cannot be read at all still throws. Without this the screen would
      // sit on "Picking up where you left off" for ever, which reads exactly
      // like the app having lost the answers.
      const draft = await readDraft(sql, userId).catch((error: unknown) => ({
        kind: 'failed' as const,
        message: `We could not read your answers on this phone. ${
          error instanceof Error ? error.message : 'Please try again.'
        }`,
      }));
      if (cancelled) return;

      if (draft.kind === 'failed') {
        showStep(FIRST_STEP, { unitPreference: deviceUnitPreference() }, draft.message);
        return;
      }

      const resumed: OnboardingDraft | undefined = draft.value;
      if (resumed === undefined) {
        showStep(FIRST_STEP, { unitPreference: deviceUnitPreference() });
        return;
      }

      const { currentStep, ...answers } = resumed;
      showStep(currentStep, {
        unitPreference: deviceUnitPreference(),
        ...answers,
      });
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [sql, userId, showStep]);

  const markBusy = useCallback((): void => {
    setPhase((current) => (current.kind === 'asking' ? { ...current, busy: true } : current));
  }, []);

  const answer = useCallback(
    (given: OnboardingAnswers): void => {
      if (phase.kind !== 'asking' || phase.busy) return;

      const target = stepAfter(phase.step);
      if (target === undefined) return;

      markBusy();

      void (async () => {
        const saved = await saveDraftStep(sql, {
          userId,
          answers: given,
          nextStep: target,
        }).catch((error: unknown) => ({
          kind: 'failed' as const,
          message: `That answer could not be saved on this phone. ${
            error instanceof Error ? error.message : 'Please try again.'
          }`,
        }));

        if (saved.kind === 'failed') {
          showStep(phase.step, { ...phase.answers, ...given }, saved.message);
          return;
        }

        // The draft is the truth from here, not what was held in memory, so a
        // write that stored something different cannot go unnoticed.
        showStep(target, { ...phase.answers, ...saved.value });
      })();
    },
    [phase, sql, userId, markBusy, showStep],
  );

  const goBack = useCallback((): void => {
    if (phase.kind !== 'asking' || phase.busy) return;

    const target = stepBefore(phase.step);
    if (target === undefined) return;

    markBusy();

    void (async () => {
      // The step moves in the draft too, so force quitting after going back
      // returns to the question the person was actually looking at.
      // A failure here is not worth a message: the person asked to go back,
      // and they do, with every answer intact. Only the remembered step is
      // stale, and the next answer rewrites it.
      const saved = await saveDraftStep(sql, { userId, answers: {}, nextStep: target }).catch(
        () => undefined,
      );
      showStep(
        target,
        saved !== undefined && saved.kind === 'ok'
          ? { ...phase.answers, ...saved.value }
          : phase.answers,
      );
    })();
  }, [phase, sql, userId, markBusy, showStep]);

  const finish = useCallback((): void => {
    if (phase.kind !== 'asking' || phase.busy) return;

    markBusy();

    void (async () => {
      // The zone and today's date are read here, at the edge, once, and passed
      // in. Nothing below this line asks the device what time it is.
      const timezone = deviceTimeZone();
      const day = resolveLocalDay(new Date(), timezone);
      if (day.kind === 'failed') {
        showStep(phase.step, phase.answers, day.message);
        return;
      }

      const written = await completeOnboarding(sql, {
        userId,
        answers: phase.answers as CompleteAnswers,
        timezone,
        today: day.value,
        consentVersion: CONSENT_VERSION,
      }).catch((error: unknown) => ({
        kind: 'failed' as const,
        message:
          `We could not finish setting up your profile. Your answers are saved, so please try again. ${
            error instanceof Error ? error.message : ''
          }`.trim(),
      }));

      if (written.kind === 'failed') {
        showStep(phase.step, phase.answers, written.message);
        return;
      }

      setPhase({ kind: 'done', target: written.value });
    })();
  }, [phase, sql, userId, markBusy, showStep]);

  const dismissError = useCallback((): void => {
    setPhase((current) => {
      if (current.kind !== 'asking' || current.error === undefined) return current;
      const { error: _dismissed, ...withoutError } = current;
      return withoutError;
    });
  }, []);

  return { phase, answer, goBack, finish, dismissError };
};
