/**
 * Whether a failure message means the connection was lost, rather than the
 * server having understood and said no (spec 0004, AC-12).
 *
 * One rule, one place, deliberately. This used to be two near copies, one in
 * `error-messages.ts` for the sign in door and one in `supabase-transport.ts`
 * for sync, and they had drifted apart in both directions: the sync copy knew
 * about `fetch failed` and `abort`, the sign in copy knew about `internet`,
 * and **neither knew what a timeout or a DNS failure actually says**.
 *
 * That is the mistake this file exists to make unrepeatable. Both copies were
 * written from browser `fetch` vocabulary plus the guessed word `timeout`. The
 * platforms this app runs on do not use it: they say "timed out", and below
 * that they surface the operating system's own error codes.
 *
 * Getting it wrong is not cosmetic. A phone with no signal was being told
 * "Something went wrong signing you in" instead of "CalSnap could not reach
 * the internet", and a sync on a train was described as a server refusing the
 * data rather than as being offline.
 */

/**
 * The shapes a lost connection really takes, gathered from the three runtimes
 * this app talks through rather than from memory.
 *
 * React Native produces "Network request failed" on both platforms. iOS adds
 * NSURLError text like "The request timed out". Node and `undici`, which the
 * Supabase client uses, produce "fetch failed" wrapping an operating system
 * code: `ETIMEDOUT`, `ENOTFOUND` and `EAI_AGAIN` for DNS, `ECONNRESET` and
 * "socket hang up" for a connection dropped mid request.
 *
 * Matched as lowercase substrings, so an error code embedded in a longer
 * sentence ("getaddrinfo ENOTFOUND kfz...supabase.co") still matches.
 */
const LOST_CONNECTION_MARKERS: readonly string[] = [
  // What the JavaScript layer says.
  'network',
  'internet',
  'offline',
  'failed to fetch',
  'fetch failed',
  'load failed',
  // Timeouts. Both spellings: "timed out" is the one a person or a platform
  // writes, "timeout" is the one an API name uses, and only the second was
  // ever here.
  'timed out',
  'timeout',
  'etimedout',
  // A request the app or the platform gave up on.
  'abort',
  // Name resolution. Spec 0002 and this module's own port both name DNS as an
  // offline condition, and none of these was matched before.
  'enotfound',
  'eai_again',
  'dns',
  // The connection itself.
  'socket hang up',
  'econnreset',
  'econnrefused',
  'econnaborted',
  'enetunreach',
  'enetdown',
  'ehostunreach',
  'unreachable',
  'connection closed',
  'connection refused',
];

/**
 * Pure, total, and safe on an empty string.
 *
 * Deliberately generous: reading a genuine server refusal as "offline" tells
 * someone to check a connection that is fine, which is mildly annoying.
 * Reading a lost connection as a refusal tells them their meals were rejected
 * when they are sitting safely on the phone, which is alarming and untrue.
 * When the evidence is thin, the kinder reading is also the likelier one.
 */
export const looksLikeLostConnection = (message: string): boolean => {
  const text = message.toLowerCase();
  return LOST_CONNECTION_MARKERS.some((marker) => text.includes(marker));
};
