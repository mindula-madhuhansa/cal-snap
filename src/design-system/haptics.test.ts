import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `expo-haptics` is a native module; the mock stands in for the boundary the
 * design intentionally never lets an ordinary component reach past. Each
 * async function starts resolved, and a test flips it to a rejection to
 * prove the "never throws" half of AC-11.
 */
const selectionAsync = vi.fn().mockResolvedValue(undefined);
const impactAsync = vi.fn().mockResolvedValue(undefined);
const notificationAsync = vi.fn().mockResolvedValue(undefined);

vi.mock('expo-haptics', () => ({
  selectionAsync: (...args: unknown[]) => selectionAsync(...args),
  impactAsync: (...args: unknown[]) => impactAsync(...args),
  notificationAsync: (...args: unknown[]) => notificationAsync(...args),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

const { haptics } = await import('./haptics');
const Haptics = await import('expo-haptics');

describe('haptics', () => {
  beforeEach(() => {
    selectionAsync.mockClear().mockResolvedValue(undefined);
    impactAsync.mockClear().mockResolvedValue(undefined);
    notificationAsync.mockClear().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('selection', () => {
    // covers: AC-11
    it('fires a selection change through expo-haptics', () => {
      haptics.selection();

      expect(selectionAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('change', () => {
    // covers: AC-11
    it('fires a light impact for a value moving one step', () => {
      haptics.change();

      expect(impactAsync).toHaveBeenCalledExactlyOnceWith(Haptics.ImpactFeedbackStyle.Light);
    });
  });

  describe('saved', () => {
    // covers: AC-11
    it('fires a success notification for a save that worked', () => {
      haptics.saved();

      expect(notificationAsync).toHaveBeenCalledExactlyOnceWith(
        Haptics.NotificationFeedbackType.Success,
      );
    });
  });

  describe('when the underlying call fails', () => {
    // covers: AC-11. This is the requirement's whole point: a phone with
    // haptics disabled, a simulator with no motor, or an unsupported
    // platform must read as silence, never as a thrown error or a rejected
    // promise nobody caught.
    it('does not throw synchronously when selectionAsync rejects', () => {
      selectionAsync.mockRejectedValueOnce(new Error('no haptic engine'));

      expect(() => haptics.selection()).not.toThrow();
    });

    it('does not throw synchronously when impactAsync rejects', () => {
      impactAsync.mockRejectedValueOnce(new Error('no haptic engine'));

      expect(() => haptics.change()).not.toThrow();
    });

    it('does not throw synchronously when notificationAsync rejects', () => {
      notificationAsync.mockRejectedValueOnce(new Error('no haptic engine'));

      expect(() => haptics.saved()).not.toThrow();
    });

    it('leaves no unhandled rejection once the failed call settles', async () => {
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);

      selectionAsync.mockRejectedValueOnce(new Error('no haptic engine'));
      haptics.selection();

      // Let the rejected promise's microtask queue drain.
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(unhandled).not.toHaveBeenCalled();
      process.off('unhandledRejection', unhandled);
    });
  });

  describe('independence', () => {
    it('calls only the helper that was invoked, not the other two', () => {
      haptics.change();

      expect(impactAsync).toHaveBeenCalledTimes(1);
      expect(selectionAsync).not.toHaveBeenCalled();
      expect(notificationAsync).not.toHaveBeenCalled();
    });
  });
});
