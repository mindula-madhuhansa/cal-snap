import { useAuth } from '@clerk/expo';
import type { SQLiteDatabase } from 'expo-sqlite';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { openUserDatabase } from '@/data/local/database-file';

import { destinationFor, type Destination, type ProfileLookup } from './routing';
import { createSupabaseClient } from './supabase';

/**
 * The session state machine (spec 0004, "State transitions"), and the strict
 * startup sequence underneath it.
 *
 * **Startup is a sequence, not a race.** This is the thing the spec warns
 * about twice, because implementing it as three flags settling in parallel
 * fails silently: the app opens no file, or the wrong one, and nobody sees an
 * error. Each step here needs the one before it:
 *
 *   1. Clerk answers          -> gives the user id, or "signed out"
 *   2. openUserDatabase(id)   -> needs step 1's id
 *   3. pull the profiles row  -> needs steps 1 and 2
 *   4. route, once
 *
 * Fonts are the only thing allowed to load alongside; the root layout owns
 * that. Everything below runs in order, in one effect, so there is no way to
 * interleave the steps by accident.
 */

export type AccountState =
  /** Clerk has not answered yet. The splash screen covers exactly this. */
  | { readonly kind: 'loading' }
  | { readonly kind: 'signed-out' }
  /**
   * Signed in, and the local file is new for this account, so the first pull
   * is still running. This is the only state that renders a screen of its own
   * (AC-9); on a device that already has the file it never appears.
   */
  | { readonly kind: 'restoring' }
  | {
      readonly kind: 'ready';
      readonly userId: string;
      readonly db: SQLiteDatabase;
      readonly destination: Destination;
    }
  | { readonly kind: 'failed'; readonly message: string };

const AccountContext = createContext<AccountState>({ kind: 'loading' });

export const useAccount = (): AccountState => useContext(AccountContext);

/**
 * Step 3: the single `profiles` row, pulled from the server before routing.
 *
 * Deliberately server first, every sign in. Routing from the local row would
 * send someone who onboarded on another phone through onboarding again, and
 * that overwrites a real target with a guess (AC-6). When the pull fails the
 * caller falls back to the local row and says the app is offline, which is
 * the honest version of not knowing.
 */
const pullProfile = async (
  userId: string,
  getToken: () => Promise<string | null>,
): Promise<ProfileLookup> => {
  try {
    const supabase = createSupabaseClient(getToken);
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarded_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error !== null) return { kind: 'stale' };

    return data === null
      ? { kind: 'fresh' }
      : { kind: 'fresh', profile: { onboardedAt: data.onboarded_at as string | null } };
  } catch {
    // No network, a token that could not be fetched, a DNS failure. All of
    // them mean the same thing here: the server did not answer.
    return { kind: 'stale' };
  }
};

/** The local fallback, read only when the server could not be reached. */
const readLocalProfile = async (db: SQLiteDatabase, userId: string): Promise<ProfileLookup> => {
  try {
    const row = await db.getFirstAsync<{ onboarded_at: string | null }>(
      'SELECT onboarded_at FROM profiles WHERE user_id = ?',
      [userId],
    );
    return row === null
      ? { kind: 'stale' }
      : { kind: 'stale', profile: { onboardedAt: row.onboarded_at } };
  } catch {
    return { kind: 'stale' };
  }
};

export const AccountProvider = ({ children }: { readonly children: ReactNode }) => {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const [state, setState] = useState<AccountState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const settle = (next: AccountState): void => {
      if (!cancelled) setState(next);
    };

    // Step 1. Until Clerk has answered there is nothing to do and nothing to
    // show: `loading` is what the splash screen is covering.
    if (!isLoaded) {
      settle({ kind: 'loading' });
      return;
    }

    if (!isSignedIn || userId === null || userId === undefined) {
      settle({ kind: 'signed-out' });
      return;
    }

    void (async () => {
      // Step 2. Needs step 1's identifier, so it cannot run alongside it.
      const opened = await openUserDatabase(userId);
      if (opened.kind === 'failed') {
        settle({ kind: 'failed', message: opened.message });
        return;
      }

      // A file that is new for this account means a fresh device, so the
      // person waits on the restoring screen rather than watching an empty
      // diary fill in underneath them (AC-9).
      if (opened.createdNow) settle({ kind: 'restoring' });

      // Step 3. Needs both of the above.
      const fromServer = await pullProfile(userId, getToken);
      const lookup =
        fromServer.kind === 'fresh' ? fromServer : await readLocalProfile(opened.db, userId);

      // Step 4. One routing decision, made once, from the freshest answer
      // available.
      settle({
        kind: 'ready',
        userId,
        db: opened.db,
        destination: destinationFor(lookup),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, getToken]);

  return <AccountContext.Provider value={state}>{children}</AccountContext.Provider>;
};
