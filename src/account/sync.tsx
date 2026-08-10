import { useAuth } from '@clerk/expo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { nowIso } from '@/data/local/rows';
import { runSync, type SyncReason } from '@/data/remote/sync';
import type { SyncTransport, TransportFailure } from '@/data/remote/transport';
import { asSqlDatabase } from '@/db/client';

import { useAccount } from './session';
import { resumeDraining } from './sign-out';
import { createSupabaseClient } from './supabase';
import { createSupabaseTransport } from './supabase-transport';

/**
 * When sync runs (spec 0004, AC-10), and what a screen may say about it
 * (AC-9).
 *
 * Spec 0002 designed push and pull but left them with no trigger, which is the
 * half of feature 3 that was waiting on this feature. There are three, and
 * between them they cover every way a change happens:
 *
 * 1. **Sign in.** A new phone has nothing; an old one has been away.
 * 2. **Foreground.** The other phone has been used since this one was closed.
 * 3. **Three seconds after the last local write.** One saved meal is one
 *    push, not one per item, which is the whole reason it is a debounce and
 *    not a write hook.
 *
 * While signed out this provider still has a job: an account that was signed
 * out with work owed is draining, and each foreground is another chance to
 * finish it (AC-11b).
 */

/** The debounce spec 0004 fixes at three seconds. */
const AFTER_WRITE_MS = 3000;

export type SyncStatus =
  /** Nothing has run yet this launch. */
  | { readonly kind: 'idle' }
  | { readonly kind: 'syncing' }
  /** The last run finished. Today drops its marker on this. */
  | { readonly kind: 'settled'; readonly at: string }
  /**
   * The last run did not finish. Today keeps a quiet marker rather than
   * removing it, because a number that may still change must not be presented
   * as settled.
   */
  | {
      readonly kind: 'failed';
      readonly failure: TransportFailure;
      readonly message: string;
    };

export type SyncControl = {
  readonly status: SyncStatus;
  /** Run now. Safe to call at any time; overlapping runs are collapsed. */
  readonly syncNow: (reason: SyncReason) => void;
  /** Something was written locally. Pushes three seconds after the last one. */
  readonly afterWrite: () => void;
};

const SyncContext = createContext<SyncControl>({
  status: { kind: 'idle' },
  syncNow: () => undefined,
  afterWrite: () => undefined,
});

export const useSync = (): SyncControl => useContext(SyncContext);

export const SyncProvider = ({ children }: { readonly children: ReactNode }) => {
  const account = useAccount();
  const { getToken, signOut } = useAuth();
  const [status, setStatus] = useState<SyncStatus>({ kind: 'idle' });

  /**
   * `getToken` and `signOut` are fresh functions on every render. Depending on
   * them directly would retrigger every effect below, which sets state, which
   * renders, which makes new functions: the loop this app has already been
   * bitten by once (see `session.tsx`).
   */
  const clerk = useRef({ getToken, signOut });
  useEffect(() => {
    clerk.current = { getToken, signOut };
  }, [getToken, signOut]);

  /** One run at a time. A second trigger while one is in flight is dropped. */
  const running = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Built once, in an effect rather than during render, because it closes over
   * the ref above. The client asks Clerk for a token per request, so one
   * client lasts the whole session and never holds a token itself.
   */
  const [transport, setTransport] = useState<SyncTransport | undefined>(undefined);

  useEffect(() => {
    setTransport(
      createSupabaseTransport(createSupabaseClient((...args) => clerk.current.getToken(...args))),
    );
  }, []);

  const db = account.kind === 'ready' ? account.db : undefined;

  const syncNow = useCallback(
    (reason: SyncReason): void => {
      if (db === undefined || transport === undefined || running.current) return;
      running.current = true;
      setStatus({ kind: 'syncing' });

      void (async () => {
        const outcome = await runSync(asSqlDatabase(db), transport, reason);
        running.current = false;

        setStatus(
          outcome.kind === 'synced'
            ? { kind: 'settled', at: nowIso() }
            : { kind: 'failed', failure: outcome.failure, message: outcome.message },
        );
      })();
    },
    [db, transport],
  );

  const afterWrite = useCallback((): void => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = undefined;
      syncNow('after-write');
    }, AFTER_WRITE_MS);
  }, [syncNow]);

  // Trigger 1. The database being open for this account is what "signed in"
  // means here, so this fires once per sign in and once per launch.
  useEffect(() => {
    if (db === undefined) return;
    syncNow('sign-in');
  }, [db, syncNow]);

  // Trigger 2, and the drain retry, which is why this effect does not require
  // a signed in account.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || transport === undefined) return;

      if (db !== undefined) {
        syncNow('foreground');
        return;
      }

      void (async () => {
        const outcome = await resumeDraining({ transport });
        // The retained Clerk session existed for one purpose. The moment the
        // last row lands, or the deadline passes, it ends.
        if (outcome.kind === 'removed' || outcome.kind === 'expired') {
          await clerk.current.signOut();
        }
      })();
    });

    return () => subscription.remove();
  }, [db, syncNow, transport]);

  // A pending debounce must not outlive the screen that started it.
  useEffect(
    () => () => {
      if (timer.current !== undefined) clearTimeout(timer.current);
    },
    [],
  );

  const control = useMemo<SyncControl>(
    () => ({ status, syncNow, afterWrite }),
    [status, syncNow, afterWrite],
  );

  return <SyncContext.Provider value={control}>{children}</SyncContext.Provider>;
};
