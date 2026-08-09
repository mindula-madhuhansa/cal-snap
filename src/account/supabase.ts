import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/config/env';

/**
 * The Supabase client, which never exists without a token source attached
 * (spec 0004, AC-15 and key invariants).
 *
 * There is no anonymous client anywhere in this app, and that is the point.
 * The anonymous key alone grants nothing now that every policy requires a
 * valid Clerk token, but a client built without `accessToken` would still
 * *send* requests, and they would come back empty rather than refused, which
 * is the failure that looks like a bug and hides a security hole.
 *
 * `accessToken` is a callback rather than a value: Clerk refreshes the token
 * on its own schedule, so the client must ask for it per request. App code
 * never holds the raw token, never caches it, and never logs it.
 */

export type TokenSource = () => Promise<string | null>;

/**
 * Session persistence is Clerk's job, not Supabase's, so all three of
 * Supabase's own auth behaviours are turned off. Leaving them on would have
 * Supabase writing its own session into storage and refreshing a token it
 * does not own, which is how the two vendors start disagreeing about who you
 * are.
 */
const CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

export const createSupabaseClient = (getToken: TokenSource): SupabaseClient =>
  createClient(env.supabaseUrl, env.supabasePublishableKey, {
    ...CLIENT_OPTIONS,
    accessToken: async () => (await getToken()) ?? '',
  });
