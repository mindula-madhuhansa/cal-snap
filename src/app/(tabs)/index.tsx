import { StyleSheet, View } from 'react-native';

import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Card } from '@/design-system/components/card';
import { Divider } from '@/design-system/components/divider';
import { ListRow } from '@/design-system/components/list-row';
import { NumberText } from '@/design-system/components/number-text';
import { Screen } from '@/design-system/components/screen';
import { Tag } from '@/design-system/components/tag';
import { colors, space } from '@/design-system/theme';

/**
 * The Today tab, rebuilt from the design system alone (spec 0003, AC-15).
 *
 * This is the proof the component set holds up a real screen: every part of it
 * is a component, and there is not one measurement or colour written here.
 *
 * The figures are sample data and the screen says so twice: once in a card a
 * person reads, and once in every figure, which is marked as an estimate and
 * announced that way to a screen reader. `AGENTS.md` asks that health numbers
 * are never presented as fact when they are not, and a placeholder calorie
 * count is exactly that. The real Today screen, reading a real day, is scope
 * feature 9.
 */

/** Sample figures. Not a record of anything, and labelled as such on screen. */
const SAMPLE_TOTALS = [
  { key: 'eaten', label: 'Eaten', value: '1,420', unit: 'kcal' },
  { key: 'burned', label: 'Burned', value: '310', unit: 'kcal' },
  { key: 'target', label: 'Daily target', value: '2,290', unit: 'kcal' },
] as const;

const SAMPLE_MACROS = [
  { key: 'protein', label: 'Protein', value: '86', unit: 'g' },
  { key: 'carbs', label: 'Carbohydrate', value: '154', unit: 'g' },
  { key: 'fat', label: 'Fat', value: '49', unit: 'g' },
] as const;

const SAMPLE_MEALS = [
  {
    key: 'breakfast',
    mark: 'B',
    name: 'Greek yoghurt and berries',
    detail: '170 g pot · 17 P / 9 C / 4 F',
    value: '146',
  },
  {
    key: 'lunch',
    mark: 'L',
    name: 'Chicken and brown rice',
    detail: '150 g · 46 P / 45 C / 5 F',
    value: '447',
  },
  {
    key: 'snack',
    mark: 'S',
    name: 'Almonds',
    detail: '28 g · 6 P / 6 C / 14 F',
    value: '164',
  },
  {
    key: 'dinner',
    mark: 'D',
    name: 'Salmon, potatoes and greens',
    detail: '320 g · 38 P / 41 C / 26 F',
    value: '663',
  },
] as const;

const noop = () => undefined;

export default function TodayScreen() {
  return (
    <Screen>
      <View style={styles.masthead}>
        <AppText variant="kicker" color={colors.accentText} uppercase>
          CalSnap
        </AppText>
        <AppText variant="h1" heading>
          The day so far
        </AppText>
      </View>

      <Tag label="Sample data" tone="outline" />

      <Card kicker="Not your day yet" title="Every figure here is a placeholder">
        <AppText variant="bodySmall" color={colors.textSubtle}>
          Nothing on this screen was measured or logged. It is here to show the design system
          standing under a real layout. Your own day arrives once the camera and the diary are
          built.
        </AppText>
      </Card>

      <View style={styles.hero}>
        <NumberText value="870" unit="kcal left" size="h1" estimated />
        <AppText variant="caption" color={colors.textSubtle} align="center">
          What would be left of the sample day
        </AppText>
      </View>

      <Divider />

      <AppText variant="h3" heading>
        The day in numbers
      </AppText>

      <View>
        {SAMPLE_TOTALS.map((total, index) => (
          <ListRow
            key={total.key}
            title={total.label}
            trailing={<NumberText value={total.value} unit={total.unit} size="h4" estimated />}
            last={index === SAMPLE_TOTALS.length - 1}
          />
        ))}
      </View>

      <AppText variant="h3" heading>
        Macros
      </AppText>

      <View>
        {SAMPLE_MACROS.map((macro, index) => (
          <ListRow
            key={macro.key}
            title={macro.label}
            trailing={<NumberText value={macro.value} unit={macro.unit} size="h5" estimated />}
            last={index === SAMPLE_MACROS.length - 1}
          />
        ))}
      </View>

      <View style={styles.sectionHead}>
        <AppText variant="h3" heading>
          The day’s record
        </AppText>
        <Button label="Add by hand" onPress={noop} variant="ghost" />
      </View>

      <View>
        {SAMPLE_MEALS.map((meal, index) => (
          <ListRow
            key={meal.key}
            title={meal.name}
            subtitle={meal.detail}
            leading={<Tag label={meal.mark} tone="accent" />}
            trailing={<NumberText value={meal.value} unit="kcal" size="h5" estimated />}
            onPress={noop}
            accessibilityHint="Opens this meal. Not connected yet."
            last={index === SAMPLE_MEALS.length - 1}
          />
        ))}
      </View>

      <Button label="Log an exercise" onPress={noop} variant="secondary" size="block" fullWidth />

      <AppText variant="caption" color={colors.textSubtle} align="center">
        Built entirely from the design system. Nothing here is connected to your data.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  masthead: {
    gap: space[1],
  },
  hero: {
    alignItems: 'center',
    paddingVertical: space[4],
    gap: space[2],
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space[3],
  },
});
