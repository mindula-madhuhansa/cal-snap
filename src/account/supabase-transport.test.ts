import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import type { RemoteRow } from '@/data/remote/codec';

import { syncFailureMessage } from './error-messages';
import { createSupabaseTransport } from './supabase-transport';

/**
 * The Supabase half of the sync port, driven by a client made of recorded
 * calls (spec 0004, AC-13, AC-14, AC-15).
 *
 * No network and no real client, which is possible because this module imports
 * `@supabase/supabase-js` as **types only**: the import erases at compile time,
 * so a plain object satisfies it at runtime. That is the same trick
 * `sync.test.ts` plays with its fake server, and it is why the layer boundary
 * was drawn here in the first place.
 *
 * Two things are worth pinning here above all. The **error classification**,
 * because getting it wrong either signs people out over a flat patch of signal
 * or leaves them tapping a screen that silently saves nothing. And the **query
 * shape**, because the watermark in `sync-state.ts` resumes on exactly the
 * keyset this file asks the server for; change one without the other and a
 * pull starts skipping rows.
 *
 * The codes below are not invented. A `/check verify` run on 10 August 2026
 * hit the live project with no valid token and got back `42501` for a refused
 * write and `PGRST301` for a forged one, which are two of the four this file
 * treats as the session ending.
 */

/** One recorded call: the method, and the arguments it was given. */
type Call = { readonly method: string; readonly args: readonly unknown[] };

type Response = {
  readonly data?: readonly RemoteRow[] | null;
  readonly error?: { readonly code?: string; readonly message?: string } | null;
};

type Fake = {
  readonly client: SupabaseClient;
  readonly calls: readonly Call[];
  /** Every table `from()` was called with, so an empty push proves itself. */
  readonly tables: readonly string[];
};

/**
 * A client whose every builder method returns itself and which resolves to one
 * fixed response.
 *
 * Making the chain thenable rather than modelling each builder separately is
 * deliberate: `upsert` finishes on `.select()` and `select` finishes on
 * `.limit()`, and one thenable object satisfies both without the fake needing
 * to know which shape it is standing in for.
 */
const fakeClient = (response: Response, throws?: unknown): Fake => {
  const calls: Call[] = [];
  const tables: string[] = [];

  const record = (method: string, args: readonly unknown[]): void => {
    calls.push({ method, args });
  };

  const chain: Record<string, unknown> = {
    then: (
      resolve: (value: Response) => unknown,
      reject: (reason: unknown) => unknown,
    ): unknown => {
      if (throws !== undefined) return reject(throws);
      return resolve({ data: response.data ?? null, error: response.error ?? null });
    },
  };

  for (const method of ['upsert', 'select', 'gte', 'order', 'limit']) {
    chain[method] = (...args: readonly unknown[]) => {
      record(method, args);
      return chain;
    };
  }

  const client = {
    from: (table: string) => {
      tables.push(table);
      return chain;
    },
  } as unknown as SupabaseClient;

  return { client, calls, tables };
};

const aRow = (id: string, updatedAt: string): RemoteRow =>
  ({ id, user_id: 'user_aaaaaaaaaaaaaaaaaaaaaa', updated_at: updatedAt }) as unknown as RemoteRow;

const argsOf = (fake: Fake, method: string): readonly unknown[] =>
  fake.calls.find((call) => call.method === method)?.args ?? [];

describe('createSupabaseTransport, classifying a failure', () => {
  // covers: AC-13. The four codes that mean the token was the problem, not the
  // data. `42501` and `PGRST301` were both observed from the live server.
  it.each(['42501', 'PGRST301', 'PGRST302', 'PGRST303'])(
    'reads %s as the session ending',
    async (code) => {
      const fake = fakeClient({ error: { code, message: 'refused' } });
      const result = await createSupabaseTransport(fake.client).upsert('meals', 'id', [
        aRow('a', '2026-08-10T00:00:00Z'),
      ]);

      expect(result.kind).toBe('failed');
      if (result.kind !== 'failed') return;
      expect(result.reason).toBe('session-ended');
      expect(result.message).toBe(syncFailureMessage('session-ended').message);
    },
  );

  // covers: AC-13. The narrowness is the point. A server that understood and
  // said no is a bug on our side, and signing someone out neither fixes it nor
  // tells them anything true.
  it('reads an ordinary Postgres error as rejected, not as the session ending', async () => {
    const fake = fakeClient({ error: { code: '23505', message: 'duplicate key value' } });
    const result = await createSupabaseTransport(fake.client).upsert('meals', 'id', [
      aRow('a', '2026-08-10T00:00:00Z'),
    ]);

    expect(result.kind === 'failed' && result.reason).toBe('rejected');
  });

  // covers: AC-12. A phone in a lift is an expected Tuesday. It must not read
  // as a refusal, or the person is told their meals were rejected when they
  // are sitting safely on the device.
  it.each(['Network request failed', 'fetch failed', 'The operation was aborted'])(
    'reads "%s" as offline',
    async (message) => {
      const fake = fakeClient({ error: { message } });
      const result = await createSupabaseTransport(fake.client).select(
        'meals',
        'id',
        '1970-01-01T00:00:00.000Z',
        100,
      );

      expect(result.kind === 'failed' && result.reason).toBe('offline');
    },
  );

  /**
   * The regression these five exist for (fixed 10 August 2026).
   *
   * `transport.ts` documents `offline` as "No signal, DNS, a timeout", and the
   * classifier matched none of the messages a DNS failure or a timeout
   * actually produces: it looked for `timeout` while every platform says
   * "timed **out**", and it knew none of the operating system codes. All five
   * came back `rejected`, so a phone with no signal was described as a server
   * refusing the data.
   *
   * They were written as `it.fails` by `/test` to pin the gap without editing
   * application code, and became plain assertions once `/debug` moved the rule
   * into `network-failure.ts`.
   */
  it.each([
    'The request timed out',
    'connect ETIMEDOUT 10.0.0.1:443',
    'socket hang up',
    'ENOTFOUND kfzlocqwrzgkyqkzphfq.supabase.co',
    'getaddrinfo EAI_AGAIN',
  ])('reads "%s" as offline', async (message) => {
    const fake = fakeClient({ error: { message } });
    const result = await createSupabaseTransport(fake.client).select(
      'meals',
      'id',
      '1970-01-01T00:00:00.000Z',
      100,
    );

    expect(result.kind === 'failed' && result.reason).toBe('offline');
  });

  // covers: AC-12. The project rule: expected failures return a result value.
  // A throw here would escape into a background sync with nobody to catch it.
  it('turns a thrown error into a result rather than letting it escape', async () => {
    const fake = fakeClient({}, new Error('fetch failed'));
    const result = await createSupabaseTransport(fake.client).select(
      'meals',
      'id',
      '1970-01-01T00:00:00.000Z',
      100,
    );

    expect(result.kind === 'failed' && result.reason).toBe('offline');
  });

  // covers: AC-12. Not everything thrown is an Error. A string, or an object
  // from a native module, must still come back as a sentence.
  it('survives a thrown value that is not an Error', async () => {
    const fake = fakeClient({}, 'something odd');
    const result = await createSupabaseTransport(fake.client).upsert('meals', 'id', [
      aRow('a', '2026-08-10T00:00:00Z'),
    ]);

    expect(result.kind).toBe('failed');
    if (result.kind !== 'failed') return;
    expect(result.message.length).toBeGreaterThan(0);
  });
});

describe('createSupabaseTransport, pushing', () => {
  // covers: AC-14. The upsert conflicts on the key the caller names, which is
  // what makes a replayed push write the same row rather than a second one.
  it('upserts on the primary key the caller names', async () => {
    const fake = fakeClient({ data: [] });
    await createSupabaseTransport(fake.client).upsert('meals', 'id', [
      aRow('a', '2026-08-10T00:00:00Z'),
    ]);

    expect(argsOf(fake, 'upsert')[1]).toEqual({ onConflict: 'id' });
  });

  // covers: AC-10. Nothing to send means no request at all, not an empty one.
  // Sync runs on every foreground, so an empty push would be a request per
  // launch for a diary nobody changed.
  it('sends no request when there is nothing dirty', async () => {
    const fake = fakeClient({ data: [] });
    const result = await createSupabaseTransport(fake.client).upsert('meals', 'id', []);

    expect(result).toEqual({ kind: 'ok', rows: [] });
    expect(fake.tables).toEqual([]);
  });

  // covers: AC-14. The server's `updated_at` is the value that comes back, and
  // it is the whole reason the push selects after writing: a device with a
  // fast clock must not win every conflict forever.
  it('returns the rows the server stored, not the rows it was given', async () => {
    const stored = aRow('a', '2026-08-10T09:00:00Z');
    const fake = fakeClient({ data: [stored] });

    const result = await createSupabaseTransport(fake.client).upsert('meals', 'id', [
      aRow('a', '2026-08-10T00:00:00Z'),
    ]);

    expect(result).toEqual({ kind: 'ok', rows: [stored] });
  });

  // covers: AC-14. PostgREST can answer with no error and no body. Reading
  // that as a crash would fail a push that actually succeeded.
  it('reads a null body as no rows rather than failing', async () => {
    const fake = fakeClient({ data: null });
    const result = await createSupabaseTransport(fake.client).upsert('meals', 'id', [
      aRow('a', '2026-08-10T00:00:00Z'),
    ]);

    expect(result).toEqual({ kind: 'ok', rows: [] });
  });
});

describe('createSupabaseTransport, pulling', () => {
  // covers: AC-9. The exact query the watermark depends on. `gte` is inclusive
  // and the order is `(updated_at asc, key asc)`, which is the keyset
  // `sync-state.ts` resumes from. Change one side only and a pull starts
  // skipping rows, silently.
  it('asks for rows at or after the watermark, in the keyset order the resume depends on', async () => {
    const fake = fakeClient({ data: [] });
    await createSupabaseTransport(fake.client).select('meals', 'id', '2026-08-01T00:00:00Z', 500);

    expect(argsOf(fake, 'gte')).toEqual(['updated_at', '2026-08-01T00:00:00Z']);
    expect(argsOf(fake, 'limit')).toEqual([500]);

    const orders = fake.calls.filter((call) => call.method === 'order');
    expect(orders.map((call) => call.args)).toEqual([
      ['updated_at', { ascending: true }],
      ['id', { ascending: true }],
    ]);
  });

  // covers: AC-5. A pull selects everything, tombstones included. Filtering
  // deleted rows out here would mean a meal deleted on one phone never
  // disappears on the other.
  it('selects every column so a tombstone arrives like any other row', async () => {
    const fake = fakeClient({ data: [] });
    await createSupabaseTransport(fake.client).select(
      'meals',
      'id',
      '1970-01-01T00:00:00.000Z',
      100,
    );

    expect(argsOf(fake, 'select')).toEqual(['*']);
  });

  // covers: AC-9. The table the caller named is the table asked for. Trivial,
  // and worth pinning: sync loops over six of them and a fixed table here
  // would sync one diary six times.
  it('reads from the table it was given', async () => {
    const fake = fakeClient({ data: [] });
    await createSupabaseTransport(fake.client).select(
      'weight_entries',
      'id',
      '1970-01-01T00:00:00.000Z',
      100,
    );

    expect(fake.tables).toEqual(['weight_entries']);
  });
});
