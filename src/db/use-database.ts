import type { SQLiteDatabase } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { openDatabase } from './client';

export type DatabaseState =
  | { readonly kind: 'opening' }
  | { readonly kind: 'ready'; readonly db: SQLiteDatabase; readonly version: number }
  | { readonly kind: 'failed'; readonly message: string };

/**
 * Opens and migrates the local database once, at startup. The effect is the
 * edge; everything downstream of it works with the plain handle.
 */
export const useDatabase = (): DatabaseState => {
  const [state, setState] = useState<DatabaseState>({ kind: 'opening' });

  useEffect(() => {
    let cancelled = false;

    void openDatabase().then((result) => {
      if (cancelled) return;
      setState(
        result.kind === 'ready'
          ? { kind: 'ready', db: result.db, version: result.version }
          : { kind: 'failed', message: result.message },
      );
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
