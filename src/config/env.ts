import Constants from 'expo-constants';
import { z } from 'zod';

/**
 * Configuration is parsed and validated once, at startup, and fails loudly on
 * a missing or malformed value (spec 0001, AC-7b). It must never fail later
 * and mysteriously, halfway through a scan.
 *
 * Values arrive from `app.config.ts`, which is the only place an
 * `EXPO_PUBLIC_` variable is read.
 */
const envSchema = z.object({
  /**
   * Which build this is. Defaults to `development` so a fresh clone runs with
   * no `.env` file at all; anything other than these three values is a
   * mistake worth failing on.
   */
  appEnv: z.enum(['development', 'preview', 'production']).default('development'),

  /**
   * The Clerk instance this build talks to (spec 0004). Required: without it
   * there is no sign in at all, and the app is a locked door. Failing here,
   * loudly, at startup beats a blank sign in screen that never works.
   */
  clerkPublishableKey: z
    .string()
    .min(1, 'is required (EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY)')
    .startsWith('pk_', "must start with 'pk_'; that is a Clerk publishable key"),

  /** The Supabase project endpoint (spec 0004). */
  supabaseUrl: z
    .string()
    .min(1, 'is required (EXPO_PUBLIC_SUPABASE_URL)')
    .url('must be a URL, like https://<project>.supabase.co'),

  /**
   * The Supabase publishable key (spec 0004). Safe to ship: with Clerk it
   * grants nothing on its own, because every policy now requires a valid
   * Clerk token.
   *
   * This is the modern `sb_publishable_` key, not the legacy `anon` JWT the
   * spec named. The legacy key is a signed JWT carrying an `anon` role, which
   * is exactly the thing this app no longer wants to exist: it rotates only
   * with the whole project's JWT secret, and it looks like a session token
   * next to a real one. The publishable key is an opaque identifier that
   * rotates on its own. Same guarantee, less to confuse.
   */
  supabasePublishableKey: z
    .string()
    .min(1, 'is required (EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)')
    .startsWith(
      'sb_publishable_',
      "must start with 'sb_publishable_'. The legacy anon JWT is superseded; take the publishable key from the Supabase dashboard under API keys",
    ),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Every value here is safe to ship: row level security is what protects the
 * data, not the keys. The Anthropic key never appears in this file, and never
 * leaves the edge function's own environment.
 */
const readEnv = (): Env => {
  const extra: unknown = Constants.expoConfig?.extra ?? {};
  const result = envSchema.safeParse(extra);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `CalSnap cannot start: its configuration is invalid.\n${problems}\n` +
        'Fix the EXPO_PUBLIC_ variables in your environment (see .env.example), then restart.',
    );
  }

  return result.data;
};

/**
 * Validated once, when this module is first imported at startup. A bad
 * configuration stops the app here rather than surfacing as a strange failure
 * on some screen much later.
 */
export const env: Env = readEnv();
