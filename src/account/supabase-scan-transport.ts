import type { SupabaseClient } from '@supabase/supabase-js';

import type { ScanResult, ScanTransport } from '@/scan/transport';
import { SCAN_TIMEOUT_MS } from '@/scan/transport';

import { looksLikeLostConnection } from './network-failure';

/**
 * The Supabase half of the scan port (spec 0007).
 *
 * The only file on the phone that knows the scan travels over Supabase, exactly
 * as `supabase-transport.ts` is for sync. Everything in `src/scan/` stays rules
 * over the narrow port and can be driven with no network and no client.
 *
 * The client is always built with Clerk's `getToken` attached, so the session
 * token is on the wire every time and there is no anonymous path to a scan.
 */

/**
 * AC-12. The phone's own ceiling, deliberately five seconds past the function's,
 * so an upstream timeout comes back as the function's honest `upstream_timeout`
 * rather than being cut off here and reported as a bare network failure.
 */
const isLostConnection = (error: unknown): boolean => {
  if (error === null || error === undefined) return false;
  const message = error instanceof Error ? error.message : String(error);
  // An abort at exactly our own ceiling is the connection failing to answer in
  // time, which is what a person experiences as being offline.
  return looksLikeLostConnection(message);
};

export const createSupabaseScanTransport = (client: SupabaseClient): ScanTransport => ({
  scan: async (request): Promise<ScanResult> => {
    try {
      const { data, error } = await client.functions.invoke<ScanResult>('scan-meal', {
        body: request,
        timeout: SCAN_TIMEOUT_MS,
      });

      if (error !== null) {
        return { kind: 'failed', reason: isLostConnection(error) ? 'offline' : 'internal' };
      }

      // The function answers 200 with a tagged `kind` for every expected case,
      // so anything without one is a shape this build does not know and is
      // treated as the unexpected condition it is.
      if (data === null || typeof data !== 'object' || !('kind' in data)) {
        return { kind: 'failed', reason: 'internal' };
      }

      return data;
    } catch (error) {
      // No signal, DNS, a request the platform gave up on. The photo is still
      // on the phone and the same `scan_id` can be sent again (AC-6, AC-18).
      return { kind: 'failed', reason: isLostConnection(error) ? 'offline' : 'internal' };
    }
  },
});
