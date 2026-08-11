import { StyleSheet, View } from 'react-native';

import { colors, space } from '../theme';
import { AppText } from './app-text';

/**
 * A decorative rule, optionally with a label set into it.
 *
 * `colors.border` is paper at 10%, which is 1.25 against the ground and so far
 * below the contrast floor for anything a person has to see. That is
 * deliberate and it is also the limit: a rule may be this faint, a control's
 * boundary may not. Nothing tappable is ever bounded by this component.
 *
 * A labelled rule is **not** decorative: the label is a heading for what comes
 * after it, so only the two hairlines are hidden from a screen reader.
 */

export type DividerProps = {
  /** Pulls the rule in from the gutter, for a rule inside a list. */
  readonly inset?: boolean;
  /** A short label centred in the rule, uppercased by the component. */
  readonly label?: string;
};

/** The two hairlines either side of a label. Never read aloud. */
const Rule = () => (
  <View
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={styles.hairline}
  />
);

export const Divider = ({ inset = false, label }: DividerProps) => {
  if (label !== undefined) {
    return (
      <View style={[styles.labelled, inset ? styles.inset : undefined]}>
        <Rule />
        <AppText variant="kicker" uppercase color={colors.textDim} heading>
          {label}
        </AppText>
        <Rule />
      </View>
    );
  }

  return (
    <View
      // Decorative, so a screen reader should walk straight past it.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.rule, inset ? styles.inset : undefined]}
    />
  );
};

const styles = StyleSheet.create({
  rule: {
    // A true hairline, so it stays one device pixel on a retina screen.
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: space[4],
  },
  inset: {
    marginHorizontal: space[3],
  },
  labelled: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    marginVertical: space[4],
  },
  hairline: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
