import type { SQLiteDatabase } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { mirrorScan } from '@/data/local/meal-scans';
import { deviceIdSource } from '@/data/ids/device';
import { asSqlDatabase } from '@/db/client';

import { preparePhoto, type SourcePhoto } from './prepare-photo';
import { forgetScan, readScan, rememberScan } from './result-store';
import {
  SLOW_SCAN_MS,
  type ScanRecord,
  type ScanResult,
  type ScanTransport,
  type ScannedItem,
} from './transport';

/**
 * The capture screen as one state machine (spec 0007, "State transitions").
 *
 * The shape of the whole feature lives here, and the screens are drawings of
 * it. Everything it depends on is passed in: the transport is the narrow port,
 * so this runs against a fake with no network, and the database is the account's
 * open handle rather than anything this file opens.
 *
 * **A scan in flight is never cancelled.** Backgrounding the app or navigating
 * away unmounts the screen, and the request keeps running: the record is
 * written with its real cost either way, and the answer is put in the module
 * level store so returning to the screen shows the result rather than an empty
 * camera (AC-13).
 */

export type ScanState =
  /** The camera is live and waiting. */
  | { readonly kind: 'idle' }
  /** AC-5. Permission refused, so the screen explains and offers the library. */
  | { readonly kind: 'blocked' }
  /** Shrinking and encoding, before anything leaves the phone. */
  | { readonly kind: 'preparing' }
  /** AC-12. `slow` flips at ten seconds and only changes the wording. */
  | { readonly kind: 'scanning'; readonly slow: boolean }
  | { readonly kind: 'result'; readonly result: ScanResult };

export type ScanView = {
  readonly state: ScanState;
  /** The photo behind the current state, kept so a retry re-sends that image. */
  readonly photoUri: string | undefined;
  readonly scanPhoto: (source: SourcePhoto) => void;
  /** AC-6, AC-18. Re-sends the same photo under the same `scan_id`. */
  readonly retry: () => void;
  readonly reset: () => void;
  readonly setBlocked: () => void;
};

type InFlight = {
  readonly scanId: string;
  readonly photo: { readonly uri: string; readonly base64: string };
};

/** AC-2. How many items on this result are worth a second look. */
export const uncertainCount = (items: readonly ScannedItem[]): number =>
  items.filter((item) => item.confidence !== 'high').length;

export const useScan = (options: {
  readonly transport: ScanTransport;
  readonly db: SQLiteDatabase;
  readonly userId: string;
}): ScanView => {
  const { transport, db, userId } = options;

  // Seeded from the store, so a screen re-mounting after a background lands on
  // the result rather than on an empty camera (AC-13).
  const [state, setState] = useState<ScanState>(() => {
    const kept = readScan();
    return kept === undefined ? { kind: 'idle' } : { kind: 'result', result: kept.result };
  });
  const [photoUri, setPhotoUri] = useState<string | undefined>(() => readScan()?.photoUri);

  const inFlight = useRef<InFlight | undefined>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      // Only stops this hook writing state into an unmounted tree. The request
      // itself is deliberately left running: the money is already committed and
      // the answer still has somewhere to go.
      mounted.current = false;
    };
  }, []);

  /** The local mirror. A failure here is never surfaced: the durable record is
   *  the Postgres row, which comes back on the next pull. */
  const mirror = useCallback(
    async (scan: ScanRecord): Promise<void> => {
      await mirrorScan(asSqlDatabase(db), userId, {
        id: scan.id,
        model: scan.model,
        promptVersion: scan.prompt_version,
        status: scan.status,
        confidence: scan.confidence,
        costCents: scan.cost_cents,
        createdAt: scan.created_at,
        updatedAt: scan.updated_at,
      });
    },
    [db, userId],
  );

  const send = useCallback(
    (job: InFlight): void => {
      setState({ kind: 'scanning', slow: false });

      // AC-12. A phone side timer, not anything the server sends. It only
      // changes the wording, so a slow scan reads as slow rather than stuck.
      const slowTimer = setTimeout(() => {
        if (mounted.current)
          setState((previous) =>
            previous.kind === 'scanning' ? { kind: 'scanning', slow: true } : previous,
          );
      }, SLOW_SCAN_MS);

      void (async () => {
        const result = await transport.scan({
          scan_id: job.scanId,
          image_base64: job.photo.base64,
          media_type: 'image/jpeg',
        });

        clearTimeout(slowTimer);

        // AC-9, and the local half of it: every result carrying a scan record
        // is filed on this device too, clean.
        if (
          result.kind === 'ok' ||
          result.kind === 'low_confidence' ||
          result.kind === 'unrecognised'
        ) {
          await mirror(result.scan);
        }

        // Stored before the state is set, so the answer survives even when the
        // screen has already gone (AC-13).
        rememberScan({ scanId: job.scanId, result, photoUri: job.photo.uri });

        if (mounted.current) setState({ kind: 'result', result });
      })();
    },
    [transport, mirror],
  );

  const scanPhoto = useCallback(
    (source: SourcePhoto): void => {
      forgetScan();
      setPhotoUri(source.uri);
      setState({ kind: 'preparing' });

      void (async () => {
        const prepared = await preparePhoto(source);

        if (prepared.kind === 'failed') {
          if (mounted.current) {
            setState({ kind: 'result', result: { kind: 'failed', reason: 'internal' } });
          }
          return;
        }

        // AC-18. The identifier is minted here, once, and a retry re-uses it,
        // so one photo can cost at most one scan however many times the reply
        // is lost.
        const job: InFlight = { scanId: deviceIdSource.newId(), photo: prepared.photo };
        inFlight.current = job;
        setPhotoUri(prepared.photo.uri);
        send(job);
      })();
    },
    [send],
  );

  const retry = useCallback((): void => {
    const job = inFlight.current;
    if (job === undefined) return;
    send(job);
  }, [send]);

  const reset = useCallback((): void => {
    inFlight.current = undefined;
    forgetScan();
    setPhotoUri(undefined);
    setState({ kind: 'idle' });
  }, []);

  const setBlocked = useCallback((): void => setState({ kind: 'blocked' }), []);

  return { state, photoUri, scanPhoto, retry, reset, setBlocked };
};
