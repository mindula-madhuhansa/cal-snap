import { JetBrainsMono_400Regular, JetBrainsMono_700Bold } from '@expo-google-fonts/jetbrains-mono';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import { useFonts } from 'expo-font';

/**
 * The six cuts the design uses, and no others.
 *
 * Outfit carries every heading, number, and line of body copy; JetBrains Mono
 * carries the uppercase micro labels and the dense data lines, where a fixed
 * advance width is what makes a column of figures line up.
 *
 * Font loading is a side effect, so it lives here at the edge and every other
 * module reads family names from `theme.fonts`.
 */
const appFonts = {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
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
