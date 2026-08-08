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
});

export type Env = z.infer<typeof envSchema>;

/**
 * Feature 5 (Account & sign in) adds the Supabase project URL and anonymous
 * key here as required values. Both are safe to ship: row level security is
 * what protects the data. The Anthropic key never appears in this file.
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
