import * as SecureStore from 'expo-secure-store';

import { devWarn } from '@/config/dev-warning';

import type { DrainingRecord } from './drain-rules';

export type { DrainingRecord } from './drain-rules';

/**
 * The draining account: signed out as far as the person is concerned, with
 * rows still owed to the server (spec 0004, AC-11b).
 *
 * "Sign out anyway" cannot simply delete the file, because the meals in it
 * never reached the account. It cannot silently keep the person signed in
 * either. So the phone looks and behaves as signed out immediately, and the
 * account is held here: the identifier, and the date after which the file goes
 * whatever happens.
 *
 * This record lives outside the database file on purpose. It has to outlive
 * the file it describes, and it has to be readable before any file is opened.
 *
 * **Seven days is a ceiling, not a promise.** A health record sitting on a
 * borrowed phone that nobody signs into again is the worse outcome, so at the
 * deadline the file is removed with the rows still unpushed.
 */

/** The only key. One phone drains one account at a time. */
const KEY = 'calsnap.draining';

const isRecord = (value: unknown): value is DrainingRecord => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<DrainingRecord>;
  return typeof candidate.userId === 'string' && typeof candidate.deadline === 'string';
};

export const readDraining = async (): Promise<DrainingRecord | undefined> => {
  try {
    const stored = await SecureStore.getItemAsync(KEY);
    if (stored === null) return undefined;

    const parsed: unknown = JSON.parse(stored);
    return isRecord(parsed) ? parsed : undefined;
  } catch (error) {
    // An unreadable record must not stop the app opening. The file it named is
    // still on disk, and the next forced sign out rewrites this.
    devWarn('[account] the draining record could not be read:', String(error));
    return undefined;
  }
};

export const writeDraining = async (record: DrainingRecord): Promise<void> => {
  await SecureStore.setItemAsync(KEY, JSON.stringify(record));
};

export const clearDraining = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(KEY);
};
