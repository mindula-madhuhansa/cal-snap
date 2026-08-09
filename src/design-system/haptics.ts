import * as Haptics from 'expo-haptics';

/**
 * The app's one source of physical feedback (spec 0003, AC-11).
 *
 * A side effect, so it lives at the edge behind a small named surface rather
 * than being called inline from a component. Three moments earn a tap and no
 * others: choosing between options, changing a number, and a save that
 * worked. Anything more turns into noise a person switches off.
 *
 * Every call is fire and forget and swallows its own failure. A phone with
 * feedback disabled, a simulator with no motor, an unsupported platform: all
 * of them are silence, never a crash, and never a rejected promise nobody
 * caught. Haptics are a nicety, and a nicety must not be able to break a save.
 */

/** Runs the effect, discarding both its result and any failure. */
const fire = (effect: () => Promise<void>): void => {
  void effect().catch(() => undefined);
};

export const haptics = {
  /** A choice was made: a segmented control, a radio row. */
  selection: (): void => fire(() => Haptics.selectionAsync()),

  /** A value moved by one step: the stepper's minus and plus. */
  change: (): void => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** Something was saved and it worked. */
  saved: (): void =>
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
} as const;
