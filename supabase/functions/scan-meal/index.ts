/**
 * `POST /functions/v1/scan-meal` (spec 0007).
 *
 * A photo in, one tagged result out. The phone shrinks and encodes the image,
 * this calls Claude Sonnet 5 with a pinned schema, records the scan and its
 * real cost in Postgres under row level security, and answers with a value the
 * phone handles exhaustively.
 *
 * **Always HTTP 200 with a tagged `kind`.** Expected failures are results, not
 * status codes, which is the project's "expected failures return an explicit
 * result value" rule carried across the network. A non 200 means something
 * genuinely unexpected, and the phone reads it as `failed`.
 *
 * **No service role key lives here.** The Supabase client is built with the
 * caller's own Clerk token, so `meal_scans`'s policy is the actual gate on the
 * cap count and the scan write. A wrong or missing filter in this file cannot
 * reach another account's rows, because the database refuses rather than
 * trusting the code. `ANTHROPIC_API_KEY` is a function secret and never crosses
 * back into a response, a log line, or `raw_response`.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.68.0';
import { createClient } from 'npm:@supabase/supabase-js@2.58.0';
import { z } from 'npm:zod@4.4.3';

import { costCents } from './cost.ts';
import { localDayWindow, utcDayWindow, type DayWindow } from './local-day.ts';
import { MODEL, PROMPT_VERSION, SCAN_SCHEMA, SYSTEM_PROMPT, USER_PROMPT } from './prompt.ts';

/** Spec 0007, AC-8. Per account, per the account's own local day. */
const DAILY_CAP = 25;

/** AC-12. The function gives up on Anthropic here; the phone gives up at 30 s. */
const UPSTREAM_TIMEOUT_MS = 25_000;

/**
 * AC-19. A fixed set, chosen per failure branch. **Never an exception message**,
 * which would put internals in front of a person. The phone maps each one to a
 * sentence of its own.
 */
type FailureReason =
  'upstream_timeout' | 'upstream_refused' | 'upstream_error' | 'invalid_reply' | 'internal';

const requestSchema = z.object({
  scan_id: z.uuid(),
  image_base64: z.string().min(1),
  media_type: z.literal('image/jpeg'),
});

/** The model's reply, constrained by `SCAN_SCHEMA` and checked again here. */
const replySchema = z.object({
  found_food: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.number(),
      unit: z.enum(['g', 'ml', 'piece']),
      calories: z.number(),
      protein_g: z.number(),
      carbs_g: z.number(),
      fat_g: z.number(),
      confidence: z.enum(['high', 'medium', 'low']),
    }),
  ),
});

type Reply = z.infer<typeof replySchema>;

type ScanRow = {
  readonly id: string;
  readonly model: string;
  readonly prompt_version: string;
  readonly status: 'ok' | 'low_confidence' | 'unrecognised' | 'failed';
  readonly confidence: 'high' | 'medium' | 'low' | null;
  readonly raw_response: { readonly reply?: unknown } | null;
  readonly cost_cents: number | null;
  readonly created_at: string;
  readonly updated_at: string;
};

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const failed = (reason: FailureReason): Response => json({ kind: 'failed', reason });

/**
 * AC-2, and the one derivation this function owns: `unrecognised` when the
 * model found no food, `low_confidence` when it is not fully sure, else `ok`.
 * Pure, and the whole of the status column's meaning.
 */
const statusFor = (reply: Reply): 'ok' | 'low_confidence' | 'unrecognised' =>
  !reply.found_food || reply.items.length === 0
    ? 'unrecognised'
    : reply.confidence === 'high'
      ? 'ok'
      : 'low_confidence';

/** The scan summary the phone mirrors into its own `meal_scans` row. */
const scanSummary = (row: ScanRow) => ({
  id: row.id,
  model: row.model,
  prompt_version: row.prompt_version,
  status: row.status,
  confidence: row.confidence,
  cost_cents: row.cost_cents,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

/** AC-18. What a repeated `scan_id` gets back, rebuilt from the row alone. */
const resultForRecorded = (row: ScanRow): Response => {
  const parsed = replySchema.safeParse(row.raw_response?.reply);

  if (row.status === 'unrecognised' || !parsed.success) {
    return json({ kind: 'unrecognised', scan: scanSummary(row) });
  }

  return json({
    kind: row.status === 'ok' ? 'ok' : 'low_confidence',
    items: parsed.data.items,
    confidence: parsed.data.confidence,
    scan: scanSummary(row),
  });
};

/**
 * How an upstream failure becomes one of the five reasons. Deliberately reads
 * the *shape* of the error rather than its text, so no provider wording leaks
 * into the choice and none of it reaches a screen.
 */
const reasonFor = (error: unknown): FailureReason => {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return 'upstream_timeout';
  if (error instanceof DOMException && error.name === 'TimeoutError') return 'upstream_timeout';
  if (error instanceof Anthropic.APIConnectionError) return 'upstream_error';

  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    // The key was rejected, the org is out of quota, or we are being throttled.
    // All three mean "it understood and said no", which is not a bug in the
    // photo and not something a retry in the next second will fix.
    if (status === 401 || status === 403 || status === 429) return 'upstream_refused';
    return 'upstream_error';
  }

  return 'internal';
};

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // **This function is deployed with `verify_jwt` off, and this is the check
  // that replaces it.** The platform check only accepts tokens Supabase itself
  // signed; a Clerk token fails it and the request dies at the gateway with a
  // 401 that never reaches here. Registering Clerk as a third party auth
  // provider teaches Postgres and PostgREST to trust it, not the edge gateway.
  //
  // Nothing is weakened by that, because the platform check was never the gate.
  // A caller with no token is refused here. A caller with a forged one gets
  // past this line and no further: the client below is built from their token
  // alone, so PostgREST refuses it, `claim_meal_scan` fails, and the request
  // ends before the model is ever called. Spending money requires a claim, and
  // a claim requires a real `sub`.
  const authorization = request.headers.get('Authorization');
  if (authorization === null) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!anthropicKey || !supabaseUrl || !supabaseKey) {
    // Configuration is validated at the edge of the request rather than
    // silently mid scan, matching the project's startup rule.
    console.error('scan-meal: missing configuration');
    return failed('internal');
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const now = new Date();

  // The cap window comes from the profile's stored zone, read here, never from
  // the request body: a client supplied day would let anyone reset their own
  // cap by lying about where they are.
  const { data: profile } = await supabase.from('profiles').select('timezone').maybeSingle();
  const zone = typeof profile?.timezone === 'string' ? profile.timezone : undefined;
  const window: DayWindow =
    (zone === undefined ? undefined : localDayWindow(now, zone)) ?? utcDayWindow(now);

  // The cap gate and the pessimistic row, as one serialised step. See
  // supabase/migrations/20260811000000_scan_cap.sql for why it is a function.
  const { data: claim, error: claimError } = await supabase.rpc('claim_meal_scan', {
    p_scan_id: body.scan_id,
    p_model: MODEL,
    p_prompt_version: PROMPT_VERSION,
    p_day_start: window.start.toISOString(),
    p_day_end: window.end.toISOString(),
    p_cap: DAILY_CAP,
  });

  if (claimError !== null || claim === null) {
    console.error('scan-meal: claim failed', claimError?.code ?? 'no row');
    return failed('internal');
  }

  const outcome = (claim as { outcome: string }).outcome;

  if (outcome === 'over_cap') {
    // AC-8b. No row was written, nothing was spent, and the person is told
    // when the allowance comes back.
    return json({ kind: 'over_daily_cap', resets_at: window.resetsAt.toISOString() });
  }

  if (outcome === 'recorded') {
    return resultForRecorded((claim as { scan: ScanRow }).scan);
  }

  const claimed = (claim as { scan: ScanRow }).scan;

  // From here the row exists and reads 'failed'. Every path below either
  // updates it to the truth or leaves the safe lie, which costs nothing.
  const anthropic = new Anthropic({ apiKey: anthropicKey, maxRetries: 0 });

  let reply: Reply;
  let usage: { input_tokens: number; output_tokens: number };

  try {
    const message = await anthropic.messages.create(
      {
        model: MODEL,
        max_tokens: 2048,
        // The fast, cheap setting. A genuinely confusing plate reads less well
        // than it would at the model's defaults; the confidence marks are the
        // mitigation, and they are the honest one.
        thinking: { type: 'disabled' },
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: SCAN_SCHEMA },
        },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: body.media_type, data: body.image_base64 },
              },
              { type: 'text', text: USER_PROMPT },
            ],
          },
        ],
      },
      { timeout: UPSTREAM_TIMEOUT_MS },
    );

    if (message.stop_reason === 'refusal') return failed('upstream_refused');
    // Truncated, so whatever arrived is not the whole shape even if it parses.
    if (message.stop_reason === 'max_tokens') return failed('invalid_reply');

    const text = message.content.find((block) => block.type === 'text');
    if (text === undefined || text.type !== 'text') return failed('invalid_reply');

    const parsed = replySchema.safeParse(JSON.parse(text.text));
    if (!parsed.success) return failed('invalid_reply');

    reply = parsed.data;
    usage = message.usage;
  } catch (error) {
    // Nothing from `error` is returned or stored: the reason is chosen from its
    // shape, and the row stays 'failed', which does not count toward the cap.
    console.error('scan-meal: upstream call failed');
    return failed(reasonFor(error));
  }

  const status = statusFor(reply);
  const cost = costCents(
    { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens },
    now,
  );

  const { data: settled, error: settleError } = await supabase
    .from('meal_scans')
    .update({
      status,
      confidence: reply.confidence,
      // The parsed reply plus the usage that priced it, and nothing else. Never
      // the SDK's envelope, and never image bytes: a meal photo does not belong
      // in Postgres when the whole point is that photos stay on the device.
      raw_response: { reply, usage },
      cost_cents: cost,
    })
    .eq('id', claimed.id)
    .select()
    .single();

  if (settleError !== null || settled === null) {
    // The call happened and was paid for, but the row still reads 'failed'. The
    // person is told honestly rather than shown numbers with no record behind
    // them; a retry on the same scan_id reuses the row and spends no cap slot.
    console.error('scan-meal: settle failed', settleError?.code ?? 'no row');
    return failed('internal');
  }

  const row = settled as ScanRow;

  if (status === 'unrecognised') {
    return json({ kind: 'unrecognised', scan: scanSummary(row) });
  }

  return json({
    kind: status === 'ok' ? 'ok' : 'low_confidence',
    items: reply.items,
    confidence: reply.confidence,
    scan: scanSummary(row),
  });
});
