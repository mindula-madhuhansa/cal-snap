import { useAuth } from '@clerk/expo';
import type { SQLiteDatabase } from 'expo-sqlite';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { openUserDatabase } from '@/data/local/database-file';
import { runSync } from '@/data/remote/sync';
import { asSqlDatabase } from '@/db/client';

import { clearDraining, readDraining } from './draining';
import { destinationFor, type Destination, type ProfileLookup } from './routing';
import { sessionEndedNotice } from './session-end';
import { createSupabaseClient } from './supabase';
import { createSupabaseTransport } from './supabase-transport';

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
 * The draining case, which is the one state where Clerk and the app disagree
 * on purpose (spec 0004, AC-11b).
 *
 * Clerk still holds a session, because the rows this phone owes the account
 * cannot be pushed without one. The app shows the sign in screen anyway, and
 * no screen reads from the file. `signBackIn` is the way out: the same person
 * saying "that was me", which adopts the file and lets it drain from inside a
 * normal session.
 */
export type DrainingView = {
  readonly draining: boolean;
  readonly signBackIn: () => void;
  /**
   * Re-runs the startup sequence. Sign out anyway calls it, which is what
   * makes the phone look signed out **immediately** rather than at the next
   * launch: the sequence reads the draining record it just wrote and refuses
   * to open the file.
   */
  readonly recheck: () => void;
};

const DrainingContext = createContext<DrainingView>({
  draining: false,
  signBackIn: () => undefined,
  recheck: () => undefined,
});

export const useDraining = (): DrainingView => useContext(DrainingContext);

/**
 * Why the sign in screen is showing, when it is showing for a reason other
 * than somebody choosing to sign out (spec 0004, AC-13).
 *
 * Empty on an ordinary launch and after an ordinary sign out, which is the
 * common case: there is nothing to explain, so nothing is said. It fills only
 * when the session ended underneath a person who was using the app, and it
 * clears the moment they are signed in again.
 *
 * It lives here rather than in `sync.tsx` because it is session state, and
 * because the screen that reads it and the provider that writes it are on
 * opposite sides of the startup gate.
 */
export type SessionNotice = {
  /** The sentence to show, or nothing at all when there is nothing to say. */
  readonly notice: string | undefined;
  /** Called by the sync layer when a request came back with the token refused. */
  readonly reportSessionEnded: () => void;
  /** The person read it and moved on. */
  readonly dismissNotice: () => void;
};

const SessionNoticeContext = createContext<SessionNotice>({
  notice: undefined,
  reportSessionEnded: () => undefined,
  dismissNotice: () => undefined,
});

export const useSessionNotice = (): SessionNotice => useContext(SessionNoticeContext);

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
  const [draining, setDraining] = useState(false);
  const [notice, setNotice] = useState<string | undefined>(undefined);

  /**
   * Bumped by `signBackIn`, and a dependency of the sequence below, so
   * adopting a draining file re-runs the startup steps rather than needing a
   * relaunch.
   */
  const [attempt, setAttempt] = useState(0);

  /**
   * `getToken` is a fresh function on every render, so it must not be an
   * effect dependency: it would retrigger the sequence, which sets state,
   * which renders, which makes another `getToken`, forever. Holding it in a
   * ref keeps the latest one reachable while the effect below depends only on
   * the three primitives that actually describe the session.
   */
  const getTokenRef = useRef(getToken);

  // Kept current in an effect rather than during render, which React forbids.
  // Declared before the sequence below so it runs first, and seeded by
  // `useRef` above, so the ref is never empty even on the first pass.
  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    let cancelled = false;

    /**
     * Sets the state, but returns the previous object when nothing has
     * actually changed, so React bails out instead of rendering.
     *
     * The two states with no payload (`loading`, `signed-out`) are the ones
     * worth guarding: a fresh object literal is never `Object.is` equal to
     * the last one, so re-settling the same state renders every time. That
     * turned an unstable effect dependency into an infinite loop once
     * already, and the guard makes the failure impossible rather than
     * unlikely.
     */
    const settle = (next: AccountState): void => {
      if (cancelled) return;
      setState((previous) =>
        previous.kind === next.kind && (next.kind === 'loading' || next.kind === 'signed-out')
          ? previous
          : next,
      );
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
      /**
       * Step 1b. An account this phone signed out of, with work still owed, is
       * draining: Clerk still has a session but the person is not signed in
       * here, and no screen may read that file (AC-11b). Read before anything
       * is opened, because the answer decides whether to open anything at all.
       */
      const record = await readDraining();
      if (record !== undefined && record.userId === userId) {
        if (!cancelled) setDraining(true);
        settle({ kind: 'signed-out' });
        return;
      }
      if (!cancelled) setDraining(false);

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
      const fromServer = await pullProfile(userId, (...args) => getTokenRef.current(...args));
      const lookup =
        fromServer.kind === 'fresh' ? fromServer : await readLocalProfile(opened.db, userId);

      /**
       * Step 3b, on a fresh device only: hold the restoring screen until the
       * first pull has actually finished (AC-9).
       *
       * On a phone that already has the file this is skipped entirely, and the
       * ordinary foreground sync covers it behind the syncing marker. Holding
       * there too would put a loading screen in front of a diary the person
       * can already read, which is the opposite of local first.
       *
       * A failure here does not hold anybody hostage: the diary is empty
       * rather than wrong, the sequence carries on, and Today says it is
       * offline.
       */
      if (opened.createdNow) {
        const transport = createSupabaseTransport(
          createSupabaseClient((...args) => getTokenRef.current(...args)),
        );
        await runSync(asSqlDatabase(opened.db), transport, 'sign-in');
      }

      // Signed in again, so whatever the sign in screen was explaining is
      // over. Cleared here rather than on the screen, because the screen that
      // showed it is already gone by the time this runs (AC-13).
      if (!cancelled) setNotice(undefined);

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
    // Only the values that describe the session, plus `attempt`, which is how
    // signing back into a draining account restarts the sequence. `getToken`
    // is deliberately absent; see the ref above.
  }, [isLoaded, isSignedIn, userId, attempt]);

  const signBackIn = useCallback((): void => {
    void (async () => {
      // The file is adopted, not removed: the rows it owes are pushed from
      // inside the session now, like any other unpushed work.
      await clearDraining();
      setDraining(false);
      setAttempt((previous) => previous + 1);
    })();
  }, []);

  const recheck = useCallback((): void => setAttempt((previous) => previous + 1), []);

  const drainingView = useMemo<DrainingView>(
    () => ({ draining, signBackIn, recheck }),
    [draining, signBackIn, recheck],
  );

  // Read at call time rather than held as a constant, so the sentence has one
  // home (`error-messages.ts`) and this file never keeps a second copy of it.
  const reportSessionEnded = useCallback((): void => setNotice(sessionEndedNotice()), []);
  const dismissNotice = useCallback((): void => setNotice(undefined), []);

  const noticeView = useMemo<SessionNotice>(
    () => ({ notice, reportSessionEnded, dismissNotice }),
    [notice, reportSessionEnded, dismissNotice],
  );

  return (
    <AccountContext.Provider value={state}>
      <DrainingContext.Provider value={drainingView}>
        <SessionNoticeContext.Provider value={noticeView}>{children}</SessionNoticeContext.Provider>
      </DrainingContext.Provider>
    </AccountContext.Provider>
  );
};
