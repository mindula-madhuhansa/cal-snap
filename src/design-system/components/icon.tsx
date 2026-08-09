import Feather from '@expo/vector-icons/Feather';

import { colors, type } from '../theme';

/**
 * The app's marks (spec 0003, AC-5, AC-14).
 *
 * Feather, behind a closed union. This is the only file that imports the icon
 * set, so the drawing style stays one decision rather than fifteen, and a
 * screen cannot reach for a glyph that does not belong to the design.
 *
 * Sizes come from the type scale rather than from numbers, because an icon
 * beside a word should measure the same as the word.
 */

/** Every mark the design uses, mapped to its Feather name. */
const glyphs = {
  camera: 'camera',
  plus: 'plus',
  minus: 'minus',
  check: 'check',
  close: 'x',
  back: 'chevron-left',
  forward: 'chevron-right',
  retry: 'refresh-cw',
  edit: 'edit-2',
  remove: 'trash-2',
  settings: 'settings',
  alert: 'alert-circle',
  info: 'info',
} as const;

export type IconName = keyof typeof glyphs;

/** Icon sizes, taken from the type scale so a mark matches the text beside it. */
const sizes = {
  sm: type.label.fontSize,
  md: type.h5.fontSize,
  lg: type.h4.fontSize,
} as const;

export type IconSize = keyof typeof sizes;

export type IconProps = {
  readonly name: IconName;
  readonly size?: IconSize;
  readonly color?: string;
  /**
   * What a screen reader should say. Omit it for a mark that sits beside a
   * label, which is the usual case: the label already says it, and repeating
   * it is noise.
   */
  readonly accessibilityLabel?: string;
};

export const Icon = ({ name, size = 'md', color = colors.text, accessibilityLabel }: IconProps) => {
  const decorative = accessibilityLabel === undefined;

  return (
    <Feather
      name={glyphs[name]}
      size={sizes[size]}
      color={color}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    />
  );
};
