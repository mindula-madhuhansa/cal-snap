import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { SCAN_TIMEOUT_MS, type ScanResult } from '@/scan/transport';

import { createSupabaseScanTransport } from './supabase-scan-transport';

/**
 * The Supabase half of the scan port, driven by a client made of recorded
 * calls (spec 0007, AC-6, AC-12, AC-19).
 *
 * No network and no real client, which works because the module imports
 * `@supabase/supabase-js` as **types only**: the import erases at compile time,
 * so a plain object satisfies it at runtime. Same trick as
 * `supabase-transport.test.ts`, for the same reason.
 *
 * What matters most here is the classification. A phone in a tunnel must be
 * told the connection failed, not that something went wrong internally, and
 * the difference is the whole of AC-6. The other half is that a reply this
 * build does not recognise is treated as the unexpected condition it is rather
 * than handed onward to a screen that will try to render it.
 */

/**
 * The client hands back a `FunctionsError`, which is an `Error` subclass, and
 * the adapter reads `.message` off it. That detail is load bearing: for
 * anything that is not an `Error` the adapter falls back to `String(error)`,
 * which on a plain object is `[object Object]` and matches no marker at all,
 * so every lost connection would quietly be reported as an internal failure.
 * The fake therefore returns real `Error` values, or it would be testing a
 * shape the real client never produces.
 */
type Invoked = { readonly name: string; readonly options: Record<string, unknown> };

type Fake = {
  readonly client: SupabaseClient;
  readonly calls: readonly Invoked[];
};

const fakeClient = (
  answer: { readonly data?: unknown; readonly error?: unknown } | { readonly throws: unknown },
): Fake => {
  const calls: Invoked[] = [];

  const client = {
    functions: {
      invoke: async (name: string, options: Record<string, unknown>) => {
        calls.push({ name, options });
        if ('throws' in answer) throw answer.throws;
        return { data: answer.data ?? null, error: answer.error ?? null };
      },
    },
  } as unknown as SupabaseClient;

  return { client, calls };
};

const aRequest = {
  scan_id: '019ff0fc-c81c-7aa2-ab53-0f07255412b1',
  image_base64: 'AAAA',
  media_type: 'image/jpeg',
} as const;

const anOkResult: ScanResult = {
  kind: 'low_confidence',
  confidence: 'medium',
  items: [
    {
      name: 'Rice',
      quantity: 180,
      unit: 'g',
      calories: 234,
      protein_g: 4.9,
      carbs_g: 50.8,
      fat_g: 0.5,
      confidence: 'medium',
    },
  ],
  scan: {
    id: aRequest.scan_id,
    model: 'claude-sonnet-5',
    prompt_version: 'v1',
    status: 'low_confidence',
    confidence: 'medium',
    cost_cents: 0.527,
    created_at: '2026-08-11T13:34:03.513Z',
    updated_at: '2026-08-11T13:34:09.675Z',
  },
};

describe('the Supabase scan transport', () => {
  // covers: AC-1. The function answers 200 with a tagged kind for every
  // expected case, so a recognised result travels through untouched.
  it('hands a recognised result straight back', async () => {
    const fake = fakeClient({ data: anOkResult });

    expect(await createSupabaseScanTransport(fake.client).scan(aRequest)).toEqual(anOkResult);
  });

  // covers: AC-12. The phone's ceiling sits five seconds past the function's
  // own, so an upstream timeout comes back as the function's honest reason
  // rather than being cut off here and reported as a bare network failure.
  it('sends the request under the phone side timeout', async () => {
    const fake = fakeClient({ data: anOkResult });
    await createSupabaseScanTransport(fake.client).scan(aRequest);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.name).toBe('scan-meal');
    expect(fake.calls[0]?.options).toMatchObject({ body: aRequest, timeout: SCAN_TIMEOUT_MS });
  });

  // covers: AC-6. A phone with no signal is told about the connection. Getting
  // this wrong tells someone their photo was refused when it never left.
  it.each([
    ['Network request failed', 'React Native, both platforms'],
    ['The request timed out', 'iOS NSURLError text'],
    ['fetch failed', 'undici, which the Supabase client uses'],
    ['getaddrinfo ENOTFOUND kfz.supabase.co', 'a DNS failure inside a longer sentence'],
    ['socket hang up', 'a connection dropped mid request'],
  ])('reads %s as being offline (%s)', async (message) => {
    const fake = fakeClient({ error: new Error(message) });

    expect(await createSupabaseScanTransport(fake.client).scan(aRequest)).toEqual({
      kind: 'failed',
      reason: 'offline',
    });
  });

  // covers: AC-19. A server that understood and said no is not a connection
  // problem, and must not be described as one.
  it('reads a refusal as internal rather than offline', async () => {
    const fake = fakeClient({ error: new Error('Function returned a non 2xx status code') });

    expect(await createSupabaseScanTransport(fake.client).scan(aRequest)).toEqual({
      kind: 'failed',
      reason: 'internal',
    });
  });

  // covers: AC-6. A thrown error is the same judgement as a returned one: no
  // signal, DNS, a request the platform gave up on.
  it('reads a thrown connection error as being offline', async () => {
    const fake = fakeClient({ throws: new Error('Network request failed') });

    expect(await createSupabaseScanTransport(fake.client).scan(aRequest)).toEqual({
      kind: 'failed',
      reason: 'offline',
    });
  });

  it('reads any other thrown error as internal', async () => {
    const fake = fakeClient({ throws: new Error('Unexpected token < in JSON') });

    expect(await createSupabaseScanTransport(fake.client).scan(aRequest)).toEqual({
      kind: 'failed',
      reason: 'internal',
    });
  });

  // covers: AC-19. Anything without a `kind` is a shape this build does not
  // know. Passing it on would put an unrenderable object in front of someone.
  it.each([
    ['null', null],
    ['an empty object', {}],
    ['a string', 'ok'],
    ['a result missing its tag', { items: [], confidence: 'high' }],
  ])('treats %s as an internal failure rather than passing it on', async (_label, data) => {
    const fake = fakeClient({ data });

    expect(await createSupabaseScanTransport(fake.client).scan(aRequest)).toEqual({
      kind: 'failed',
      reason: 'internal',
    });
  });

  // covers: AC-8b. The over cap answer is a normal tagged result, not a
  // failure, so the screen can say when the allowance comes back.
  it('passes the over cap answer through as itself', async () => {
    const overCap: ScanResult = { kind: 'over_daily_cap', resets_at: '2026-08-12T00:00:00.000Z' };
    const fake = fakeClient({ data: overCap });

    expect(await createSupabaseScanTransport(fake.client).scan(aRequest)).toEqual(overCap);
  });

  // covers: AC-10. Nothing about the key, the model, or the provider is known
  // on this side of the port, so nothing about them can leak from here.
  it('never names the model or the provider in a failure it produces', async () => {
    const fake = fakeClient({ throws: new Error('anthropic: 401 invalid x-api-key sk-ant-XXXX') });

    const result = await createSupabaseScanTransport(fake.client).scan(aRequest);

    expect(JSON.stringify(result)).not.toMatch(/anthropic|sk-ant|401/i);
  });
});
