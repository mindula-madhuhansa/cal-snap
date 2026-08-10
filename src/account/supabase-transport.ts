import type { SupabaseClient } from '@supabase/supabase-js';

import type { RemoteRow } from '@/data/remote/codec';
import type { SyncTransport, TransportFailure, TransportResult } from '@/data/remote/transport';

import { syncFailureMessage } from './error-messages';
import { looksLikeLostConnection } from './network-failure';

/**
 * The Supabase half of the sync port (spec 0004, AC-15).
 *
 * Everything that knows what Supabase is lives here, so `src/data/remote/`
 * stays a set of rules over a narrow port and the tests can drive those rules
 * with no network and no client.
 *
 * Every request goes through a client built with Clerk's `getToken` as its
 * `accessToken` callback, so the session token is on the wire every time and
 * there is no anonymous path to any row.
 */

/**
 * PostgREST codes that mean the token, not the data, was the problem.
 *
 * `42501` is Postgres refusing the row under row level security, which with
 * Clerk means the token carried no usable `sub` (or no `role: authenticated`).
 * The `PGRST3xx` family is the token being absent, expired, or unreadable.
 * Both are the session ending as far as a person is concerned (AC-13).
 */
const SESSION_CODES: readonly string[] = ['42501', 'PGRST301', 'PGRST302', 'PGRST303'];

type PostgrestLikeError = {
  readonly code?: string;
  readonly message?: string;
};

const classify = (error: PostgrestLikeError): TransportFailure => {
  const code = error.code ?? '';
  if (SESSION_CODES.includes(code)) return 'session-ended';
  return looksLikeLostConnection(error.message ?? '') ? 'offline' : 'rejected';
};

/** One place where a failure becomes a result value with a written sentence. */
const failed = (error: PostgrestLikeError): TransportResult => {
  const reason = classify(error);
  return { kind: 'failed', reason, message: syncFailureMessage(reason).message };
};

/** A thrown value (no signal, DNS, an aborted request) read as a failure. */
const threw = (error: unknown): TransportResult =>
  failed({ message: error instanceof Error ? error.message : 'network' });

export const createSupabaseTransport = (client: SupabaseClient): SyncTransport => ({
  upsert: async (table, key, rows): Promise<TransportResult> => {
    if (rows.length === 0) return { kind: 'ok', rows: [] };

    try {
      const { data, error } = await client
        .from(table)
        // Upserting on the primary key is what makes a replay harmless: the
        // identifier was minted on the device, so the same push twice writes
        // the same row twice and creates nothing (spec 0002, AC-14).
        .upsert(rows as readonly Record<string, unknown>[], { onConflict: key })
        .select();

      if (error !== null) return failed(error);
      return { kind: 'ok', rows: (data ?? []) as readonly RemoteRow[] };
    } catch (error) {
      return threw(error);
    }
  },

  select: async (table, key, since, limit): Promise<TransportResult> => {
    try {
      const { data, error } = await client
        .from(table)
        .select('*')
        // Inclusive, and ordered by the same keyset the watermark resumes on.
        // Tombstones are rows like any other here: a deleted meal has to reach
        // the second phone or it never disappears there.
        .gte('updated_at', since)
        .order('updated_at', { ascending: true })
        .order(key, { ascending: true })
        .limit(limit);

      if (error !== null) return failed(error);
      return { kind: 'ok', rows: (data ?? []) as readonly RemoteRow[] };
    } catch (error) {
      return threw(error);
    }
  },
});
