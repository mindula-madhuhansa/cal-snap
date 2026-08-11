import { StyleSheet, View } from 'react-native';

import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { Callout } from '@/design-system/components/callout';
import { Card } from '@/design-system/components/card';
import { EmptyState } from '@/design-system/components/empty-state';
import { ErrorState } from '@/design-system/components/error-state';
import { ListRow } from '@/design-system/components/list-row';
import { NumberText } from '@/design-system/components/number-text';
import { Tag } from '@/design-system/components/tag';
import { colors, space } from '@/design-system/theme';

import { caloriesLabel, itemSpoken, macroLine, portionLabel, totalCalories } from './format-item';
import {
  UNRECOGNISED_BODY,
  UNRECOGNISED_TITLE,
  confidenceLabel,
  confidenceSentence,
  overDailyCapMessage,
  scanFailureMessage,
} from './messages';
import type { ScanResult, ScannedItem } from './transport';
import { uncertainCount } from './use-scan';

/**
 * What a finished scan looks like (spec 0007, AC-1, AC-2, AC-3, AC-8b, AC-19).
 *
 * One exhaustive switch over the result union, so a case added to the port
 * cannot reach here without a screen being drawn for it: TypeScript fails the
 * build instead.
 *
 * **Uncertainty is said, not implied.** An item below `high` carries a written
 * tag and the figure is marked as an estimate, and the sentence above the list
 * names how many need checking. Colour is never the only signal, and neither is
 * an icon.
 */

export type ScanResultViewProps = {
  readonly result: ScanResult;
  /** Take another photo. */
  readonly onRetake: () => void;
  /** AC-6, AC-18. Send the same photo again under the same identifier. */
  readonly onRetry: () => void;
  readonly onPickFromLibrary: () => void;
};

const ItemRow = ({ item, last }: { readonly item: ScannedItem; readonly last: boolean }) => (
  <ListRow
    title={item.name}
    subtitle={`${portionLabel(item)} · ${macroLine(item)}`}
    accessibilityHint={
      item.confidence === 'high'
        ? undefined
        : `${confidenceLabel(item.confidence)}. Worth checking.`
    }
    trailing={
      <View style={styles.trailing}>
        <NumberText
          value={caloriesLabel(item)}
          unit="kcal"
          // AC-2. The figure itself carries the mark, not just a tag beside it.
          estimated={item.confidence !== 'high'}
          spoken={itemSpoken(item)}
        />
        {item.confidence === 'high' ? undefined : (
          <Tag
            label={confidenceLabel(item.confidence)}
            tone={item.confidence === 'low' ? 'warning' : 'neutral'}
          />
        )}
      </View>
    }
    last={last}
  />
);

export const ScanResultView = ({
  result,
  onRetake,
  onRetry,
  onPickFromLibrary,
}: ScanResultViewProps) => {
  switch (result.kind) {
    case 'ok':
    case 'low_confidence': {
      const uncertain = uncertainCount(result.items);

      return (
        <View style={styles.stack}>
          <View
            // One announced summary carrying the sentence, rather than a large
            // numeral read out of context.
            accessible
            accessibilityRole="summary"
            accessibilityLabel={`${totalCalories(result.items)} calories in ${
              result.items.length === 1 ? '1 item' : `${result.items.length} items`
            }. ${confidenceSentence(result.confidence, uncertain)}`}>
            <NumberText
              value={String(totalCalories(result.items))}
              unit="kcal"
              size="display"
              layout="stacked"
              estimated={result.confidence !== 'high'}
            />
          </View>

          {/* AC-2. Standing copy, so `Callout` rather than the announced
              `Notice`: it was there before anything was pressed. */}
          <Callout
            message={confidenceSentence(result.confidence, uncertain)}
            intent={result.confidence === 'high' ? 'success' : 'notice'}
          />

          <Card flush kicker="Found in this photo">
            {result.items.map((item, index) => (
              <ItemRow
                key={`${item.name}-${index}`}
                item={item}
                last={index === result.items.length - 1}
              />
            ))}
          </Card>

          <AppText variant="caption" color={colors.textDim} align="center">
            Saving a meal arrives with the next release. For now this is a reading only.
          </AppText>

          <Button label="Scan another" variant="secondary" onPress={onRetake} fullWidth />
        </View>
      );
    }

    // AC-3. No items, an honest line, and both ways back.
    case 'unrecognised':
      return (
        <View style={styles.stack}>
          <EmptyState
            title={UNRECOGNISED_TITLE}
            body={UNRECOGNISED_BODY}
            action={{ label: 'Take another photo', onPress: onRetake }}
          />
          <Button
            label="Pick from library"
            variant="secondary"
            onPress={onPickFromLibrary}
            fullWidth
          />
        </View>
      );

    // AC-8b. Told the limit and when it resets. Retrying is not offered,
    // because it cannot work until then.
    case 'over_daily_cap':
      return (
        <View style={styles.stack}>
          <EmptyState
            title="Daily scan limit reached"
            body={overDailyCapMessage(result.resets_at)}
          />
        </View>
      );

    // AC-19. The sentence comes from the reason, and the reason comes from a
    // fixed set. No exception message can reach this screen.
    case 'failed':
      return (
        <View style={styles.stack}>
          <ErrorState
            title={result.reason === 'offline' ? 'No connection' : 'That scan did not finish'}
            body={scanFailureMessage(result.reason)}
            onRetry={onRetry}
            retryLabel="Try again"
          />
          <Button label="Take another photo" variant="secondary" onPress={onRetake} fullWidth />
        </View>
      );
  }
};

const styles = StyleSheet.create({
  stack: {
    gap: space[4],
  },
  trailing: {
    alignItems: 'flex-end',
    gap: space[1],
  },
});
