import { StyleSheet, View } from 'react-native';

import { colors, space } from '../theme';

/**
 * A decorative rule (spec 0003, AC-5).
 *
 * `colors.divider` is ink at 16%, which is 1.38 against paper and so far below
 * the contrast floor for anything a person has to see. That is deliberate and
 * it is also the limit: a rule may be this faint, a control's boundary may
 * not. Nothing tappable is ever bounded by this component.
 */

export type DividerProps = {
  /** Pulls the rule in from the gutter, for a rule inside a list. */
  readonly inset?: boolean;
};

export const Divider = ({ inset = false }: DividerProps) => (
  <View
    // Decorative, so a screen reader should walk straight past it.
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
    style={[styles.rule, inset ? styles.inset : undefined]}
  />
);

const styles = StyleSheet.create({
  rule: {
    // `.hr { height: 1px; margin: var(--space-4) 0 }`, drawn as a true
    // hairline so it stays one device pixel on a retina screen.
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.divider,
    marginVertical: space[4],
  },
  inset: {
    marginHorizontal: space[3],
  },
});
