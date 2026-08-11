import { StyleSheet, View } from 'react-native';

import { SyncMarker } from '@/account/sync-marker';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Callout } from '@/design-system/components/callout';
import { Card } from '@/design-system/components/card';
import { ListRow } from '@/design-system/components/list-row';
import { NumberText } from '@/design-system/components/number-text';
import { ProgressBar } from '@/design-system/components/progress-bar';
import { ProgressRing } from '@/design-system/components/progress-ring';
import { Screen } from '@/design-system/components/screen';
import { Tag } from '@/design-system/components/tag';
import { colors, space } from '@/design-system/theme';

/**
 * The Today tab, rebuilt in the new design system.
 *
 * This is the proof the component set holds up a real screen: every part of it
 * is a component, and there is not one measurement or colour written here.
 *
 * The figures are sample data and the screen says so twice: once in a note a
 * person reads, and once in every figure, which is marked as an estimate and
 * announced that way to a screen reader. `AGENTS.md` asks that health numbers
 * are never presented as fact when they are not, and a placeholder calorie
 * count is exactly that. The real Today screen, reading a real day, is scope
 * feature 9.
 *
 * The design also draws a level bar, an XP count, a day streak, and a row of
 * daily quests across the top of this screen. None of it is here: nothing in
 * the schema counts XP or levels, and the honest options were to invent the
 * numbers or to leave them out. They arrive when a feature computes them.
 */

/** Sample figures. Not a record of anything, and labelled as such on screen. */
const SAMPLE_EATEN = 952;
const SAMPLE_TARGET = 1613;
const SAMPLE_LEFT = SAMPLE_TARGET - SAMPLE_EATEN;

const SAMPLE_MACROS = [
  { key: 'protein', label: 'Protein', eaten: 71, target: 121, tone: 'protein' },
  { key: 'carbs', label: 'Carbs', eaten: 88, target: 161, tone: 'carbs' },
  { key: 'fat', label: 'Fat', eaten: 30, target: 54, tone: 'fat' },
] as const;

const SAMPLE_MEALS = [
  {
    key: 'breakfast',
    name: 'Porridge & berries',
    detail: '08:20 · P14 C58 F9',
    value: '341',
  },
  {
    key: 'lunch',
    name: 'Chicken & brown rice',
    detail: '13:05 · P46 C45 F5',
    value: '447',
  },
  {
    key: 'snack',
    name: 'Almonds',
    detail: '16:40 · P6 C6 F14',
    value: '164',
  },
] as const;

const noop = () => undefined;

export default function TodayScreen() {
  const eatenFraction = SAMPLE_EATEN / SAMPLE_TARGET;

  return (
    <Screen>
      <View style={styles.masthead}>
        <View style={styles.mastheadText}>
          <AppText variant="kicker" uppercase color={colors.cyan}>
            Today
          </AppText>
          <AppText variant="h1" heading>
            Day one, and you’re on it
          </AppText>
        </View>
        {/* AC-9. Quiet while a pull is running, and honest when it failed. */}
        <SyncMarker />
      </View>

      <View style={styles.markers}>
        <Tag label="Sample data" tone="warning" accessibilityLabel="Showing sample data" />
      </View>

      <View style={styles.hero}>
        <ProgressRing progress={eatenFraction}>
          <NumberText
            value={String(SAMPLE_LEFT)}
            unit="kcal left"
            size="display"
            layout="stacked"
            estimated
          />
        </ProgressRing>

        <View style={styles.totals}>
          <NumberText
            value={String(SAMPLE_EATEN)}
            unit="eaten"
            size="h4"
            estimated
            spoken={`${SAMPLE_EATEN} kilocalories eaten`}
          />
          <View style={styles.totalsRule} />
          <NumberText
            value={String(SAMPLE_TARGET)}
            unit="target"
            size="h4"
            estimated
            spoken={`${SAMPLE_TARGET} kilocalories target`}
          />
        </View>
      </View>

      <Card kicker="Macros">
        {SAMPLE_MACROS.map((macro) => (
          <View key={macro.key} style={styles.macro}>
            <View
              accessible
              accessibilityLabel={`${macro.label}, ${macro.eaten} of ${macro.target} grams`}
              style={styles.macroHead}>
              <AppText variant="h5">{macro.label}</AppText>
              <AppText variant="data" color={colors.textMuted}>
                {`${macro.eaten}/${macro.target} g`}
              </AppText>
            </View>
            <ProgressBar progress={macro.eaten / macro.target} tone={macro.tone} />
          </View>
        ))}
      </Card>

      <View style={styles.sectionHead}>
        <AppText variant="kicker" uppercase color={colors.textDim} heading>
          Logged today
        </AppText>
        <Button label="Add by hand" onPress={noop} variant="ghost" />
      </View>

      <Card flush>
        {SAMPLE_MEALS.map((meal, index) => (
          <ListRow
            key={meal.key}
            title={meal.name}
            subtitle={meal.detail}
            trailing={<NumberText value={meal.value} unit="kcal" size="h4" estimated />}
            onPress={noop}
            accessibilityHint="Opens this meal. Not connected yet."
            last={index === SAMPLE_MEALS.length - 1}
          />
        ))}
      </Card>

      <Callout message="Nothing on this screen was measured or logged. Your own day arrives once the camera and the diary are built." />
    </Screen>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[3],
  },
  mastheadText: {
    flex: 1,
    minWidth: 0,
    gap: space[1],
  },
  markers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space[2],
  },
  hero: {
    alignItems: 'center',
    paddingVertical: space[4],
    gap: space[4],
  },
  totals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
  },
  totalsRule: {
    width: space[1],
    height: space[1],
    borderRadius: space[1],
    backgroundColor: colors.textDim,
  },
  macro: {
    gap: space[2],
    paddingVertical: space[1],
  },
  macroHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[2],
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
});
