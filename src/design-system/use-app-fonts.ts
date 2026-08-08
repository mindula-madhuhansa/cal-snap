import {
  CormorantGaramond_400Regular,
  CormorantGaramond_600SemiBold,
} from '@expo-google-fonts/cormorant-garamond';
import { Lora_400Regular, Lora_600SemiBold } from '@expo-google-fonts/lora';
import { useFonts } from 'expo-font';

/**
 * The four cuts the Classical design uses, and no others. The design retired
 * bold: semibold is the ceiling for interface headings.
 *
 * Font loading is a side effect, so it lives here at the edge and every other
 * module reads family names from `theme.fonts`.
 */
const appFonts = {
  CormorantGaramond_400Regular,
  CormorantGaramond_600SemiBold,
  Lora_400Regular,
  Lora_600SemiBold,
} as const;

export type FontLoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready' }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * Loads the app's fonts. A failure is an expected outcome (a corrupt asset,
 * a device out of space), so it comes back as a value rather than a throw and
 * the caller decides what to show.
 */
export const useAppFonts = (): FontLoadState => {
  const [loaded, error] = useFonts(appFonts);

  if (error) {
    return { kind: 'failed', message: error.message };
  }
  return loaded ? { kind: 'ready' } : { kind: 'loading' };
};
