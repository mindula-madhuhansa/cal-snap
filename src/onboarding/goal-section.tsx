import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { deviceTimeZone, resolveLocalDay } from '@/data/calculations/local-day';
import { displayWeight } from '@/data/calculations/units';
import { getOrCreateDailyTarget } from '@/data/local/daily-targets';
import { readProfile, updateProfileAnswers, type ProfileAnswers } from '@/data/local/profile';
import { calorieTargetFormula } from '@/data/local/target-formula';
import {
  clearOverride,
  resolveOverride,
  setOverride,
  type TargetOverride,
} from '@/data/local/target-overrides';
import type { DailyTarget } from '@/data/types';
import { deviceIdSource } from '@/data/ids/device';
import { asSqlDatabase } from '@/db/client';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Divider } from '@/design-system/components/divider';
import { ListRow } from '@/design-system/components/list-row';
import { LoadingState } from '@/design-system/components/loading-state';
import { Notice } from '@/design-system/components/notice';
import { NumberText } from '@/design-system/components/number-text';
import { Stepper } from '@/design-system/components/stepper';
import { colors, space } from '@/design-system/theme';

import {
  basisSentence,
  goalSummary,
  heightSummary,
  startsOn,
  startsTomorrowSentence,
} from './goal-sentences';

/**
 * "Your goal" in Settings (spec 0006, AC-12).
 *
 * Shows today's target and where it came from, and offers the two ways to
 * change it: setting a number yourself, and clearing it again. Every change
 * here is forward dated, and the screen says so each time rather than letting
 * somebody discover it by watching today's number not move (AC-11).
 */

type Loaded = {
  readonly profile: ProfileAnswers;
  readonly target: DailyTarget;
  readonly override: TargetOverride | undefined;
  readonly today: string;
};

export type GoalSectionProps = {
  readonly db: SQLiteDatabase;
  readonly userId: string;
};

export const GoalSection = ({ db, userId }: GoalSectionProps) => {
  const sql = useMemo(() => asSqlDatabase(db), [db]);

  const [loaded, setLoaded] = useState<Loaded | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [confirmation, setConfirmation] = useState<string | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(0);
  const [busy, setBusy] = useState(false);

  /** Bumped after every change, which is how the section reads itself back. */
  const [reloads, setReloads] = useState(0);

  // The reading lives inside the effect, so what sets state is the effect
  // itself rather than a function called from it. Same pattern as
  // `AccountProvider`'s startup sequence, and for the same reason.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await read();
      } catch (error) {
        // Expected failures come back as values; a database that cannot be
        // read at all still throws, and without this the section would sit on
        // its loading line for ever with nothing said.
        if (!cancelled) {
          setFailure(
            `We could not read your daily target on this phone. ${
              error instanceof Error ? error.message : 'Please try again.'
            }`,
          );
        }
      }
    })();

    async function read(): Promise<void> {
      const timezone = deviceTimeZone();
      const day = resolveLocalDay(new Date(), timezone);
      if (day.kind === 'failed') {
        if (!cancelled) setFailure(day.message);
        return;
      }

      const profile = await readProfile(sql, userId);
      if (profile.kind === 'failed' || profile.value === undefined) {
        if (!cancelled) setFailure('We could not read your profile. Try signing out and back in.');
        return;
      }

      const target = await getOrCreateDailyTarget(
        sql,
        { userId, onDate: day.value },
        calorieTargetFormula,
      );
      if (target.kind === 'failed') {
        if (!cancelled) setFailure(target.message);
        return;
      }

      // Tomorrow's, because tomorrow is the only day Settings can change.
      const override = await resolveOverride(sql, { userId, onDate: startsOn(day.value) });
      if (cancelled) return;

      setLoaded({
        profile: profile.value,
        target: target.value,
        override: override.kind === 'ok' ? override.value : undefined,
        today: day.value,
      });
    }

    return () => {
      cancelled = true;
    };
  }, [sql, userId, reloads]);

  if (failure !== undefined) {
    return <Notice message={failure} intent="failure" testID="goal-failed" />;
  }

  if (loaded === undefined) {
    return <LoadingState message="Reading your daily target" />;
  }

  const { profile, target, override, today } = loaded;
  const weight = displayWeight(0, profile.unitPreference);

  const runChange = (work: () => Promise<string | undefined>) => (): void => {
    setBusy(true);
    setFailure(undefined);
    setConfirmation(undefined);

    void (async () => {
      try {
        const message = await work();
        if (message !== undefined) setConfirmation(message);
      } catch (error) {
        setFailure(
          `That change could not be saved. ${
            error instanceof Error ? error.message : 'Please try again.'
          }`,
        );
      } finally {
        // Read back rather than patched in memory, so what the section shows
        // is what the database holds and a write that stored something else
        // cannot go unnoticed. In `finally`, so a thrown write still clears
        // `busy` rather than leaving every button disabled for good.
        setReloads((previous) => previous + 1);
        setBusy(false);
        setEditing(false);
      }
    })();
  };

  const saveOverride = runChange(async () => {
    const written = await setOverride(
      sql,
      { userId, effectiveFrom: startsOn(today), calories: Math.round(draft) },
      deviceIdSource,
    );
    if (written.kind === 'failed') {
      setFailure(written.message);
      return undefined;
    }
    // AC-11. Said on every set, not once in a tooltip.
    return startsTomorrowSentence(today);
  });

  const removeOverride = runChange(async () => {
    const cleared = await clearOverride(sql, { userId, effectiveFrom: startsOn(today) });
    if (cleared.kind === 'failed') {
      setFailure(cleared.message);
      return undefined;
    }
    return `Your own number is cleared. From ${startsOn(today)} the target goes back to being worked out from your answers.`;
  });

  const changeAnswer = (edit: Parameters<typeof updateProfileAnswers>[2]) =>
    runChange(async () => {
      const written = await updateProfileAnswers(sql, userId, edit);
      if (written.kind === 'failed') {
        setFailure(written.message);
        return undefined;
      }
      return startsTomorrowSentence(today);
    });

  return (
    <View style={styles.section} testID="goal-section">
      <AppText variant="kicker" color={colors.accentText} uppercase>
        Your goal
      </AppText>

      <View accessible accessibilityRole="summary" testID="goal-today">
        <NumberText
          value={String(target.calories)}
          unit="cal a day"
          estimated={target.source === 'computed'}
          size="h2"
        />
        <AppText variant="caption" color={colors.textSubtle}>
          {basisSentence(target.source)}
        </AppText>
      </View>

      {confirmation === undefined ? undefined : (
        <Notice message={confirmation} intent="notice" testID="goal-confirmation" />
      )}

      <Divider />

      <View>
        <ListRow
          title="Goal"
          subtitle={goalSummary(profile.goalDirection, profile.goalRateKgPerWeek)}
        />
        <ListRow title="Activity" subtitle={profile.activityLevel.replace(/_/g, ' ')} />
        <ListRow title="Age" subtitle={`${profile.ageYears}`} />
        <ListRow
          title="Height"
          subtitle={heightSummary(profile.heightCm, profile.unitPreference)}
          last
        />
      </View>

      {/*
        The single question edit paths AC-12 asks for. Each one changes one
        answer and confirms that the change starts tomorrow, which is the same
        promise the override path makes.
      */}
      <View style={styles.row}>
        <Button
          label="I am more active now"
          variant="ghost"
          disabled={busy || profile.activityLevel === 'very_active'}
          onPress={changeAnswer({ activityLevel: nextLevelUp(profile.activityLevel) })}
          accessibilityHint="Moves your activity level up one step. The new target starts tomorrow"
          testID="goal-more-active"
        />
        <Button
          label="I am less active now"
          variant="ghost"
          disabled={busy || profile.activityLevel === 'sedentary'}
          onPress={changeAnswer({ activityLevel: nextLevelDown(profile.activityLevel) })}
          accessibilityHint="Moves your activity level down one step. The new target starts tomorrow"
          testID="goal-less-active"
        />
      </View>

      <Divider />

      {editing ? (
        <View style={styles.stack}>
          <AppText variant="body" color={colors.textSubtle}>
            {startsTomorrowSentence(today)}
          </AppText>
          <Stepper
            value={draft}
            onChange={setDraft}
            min={800}
            max={6000}
            step={10}
            format={(value) => `${value} cal`}
            accessibilityLabel="Your own daily calorie target"
            testID="goal-override-stepper"
          />
          <Button
            label="Use this number"
            disabled={busy}
            fullWidth
            onPress={saveOverride}
            accessibilityHint={`Sets your own daily target starting ${startsOn(today)}`}
            testID="goal-override-save"
          />
          <Button
            label="Cancel"
            variant="ghost"
            disabled={busy}
            fullWidth
            onPress={() => setEditing(false)}
          />
        </View>
      ) : (
        <View style={styles.stack}>
          <Button
            label={override === undefined ? 'Set my own target' : 'Change my target'}
            variant="ghost"
            disabled={busy}
            fullWidth
            onPress={() => {
              setDraft(override?.calories ?? target.calories);
              setEditing(true);
            }}
            accessibilityHint="Lets you type a daily calorie target of your own, starting tomorrow"
            testID="goal-override-open"
          />

          {override === undefined ? undefined : (
            <Button
              label="Go back to the worked out number"
              variant="ghost"
              disabled={busy}
              fullWidth
              onPress={removeOverride}
              accessibilityHint="Clears the number you set, so later days go back to being worked out from your answers"
              testID="goal-override-clear"
            />
          )}
        </View>
      )}

      {/* Weight lives with the weigh in feature; this only says which unit is in use. */}
      <AppText variant="caption" color={colors.textSubtle}>
        {`Shown in ${weight.unit === 'kg' ? 'kilograms and centimetres' : 'pounds and feet'}.`}
      </AppText>
    </View>
  );
};

const LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
type Level = (typeof LEVELS)[number];

const nextLevelUp = (level: Level): Level =>
  LEVELS[Math.min(LEVELS.indexOf(level) + 1, 4)] ?? level;
const nextLevelDown = (level: Level): Level =>
  LEVELS[Math.max(LEVELS.indexOf(level) - 1, 0)] ?? level;

const styles = StyleSheet.create({
  section: { gap: space[3] },
  stack: { gap: space[2] },
  row: { flexDirection: 'row', gap: space[2], flexWrap: 'wrap' },
});
