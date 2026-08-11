import type { ScanResult } from './transport';

/**
 * The last completed scan, held outside React so it survives the capture screen
 * unmounting (spec 0007, AC-13).
 *
 * **This is the project's one piece of module level mutable state, and it is
 * deliberate.** `AGENTS.md` says module level values are constants only, and
 * every other place in this app obeys that. Backgrounding the app or navigating
 * away must not cancel a scan or throw its answer away, and React state cannot
 * outlive the component that holds it. Keeping it here is the smallest thing
 * that satisfies AC-13.
 *
 * Three things keep it honest:
 *
 * - **Nothing is persisted.** The durable record is the `meal_scans` row, which
 *   syncs. If the app is killed the list of foods is gone and the row is not,
 *   which is the accounting staying right while the convenience does not.
 * - **One entry, not a cache.** A newer scan replaces the older one, so there is
 *   no lifetime to manage and nothing to grow.
 * - **Nothing outside this folder writes it**, and feature 8 will read the same
 *   one rather than keeping a second copy of "the current scan".
 */

type Entry = {
  readonly scanId: string;
  readonly result: ScanResult;
  /** The photo this result came from, so a retry re-sends that same image. */
  readonly photoUri: string;
};

let current: Entry | undefined;

export const rememberScan = (entry: Entry): void => {
  current = entry;
};

export const readScan = (): Entry | undefined => current;

/** Called when the person discards a result, or starts a fresh capture. */
export const forgetScan = (): void => {
  current = undefined;
};
