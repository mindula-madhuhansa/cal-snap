/**
 * A warning meant for whoever is building the app, never for the person using
 * it.
 *
 * Two rules make this safe to call from anywhere:
 *
 * - It is silent outside a development build, so nothing it is given can ever
 *   reach a device log in a release. That matters here specifically: the root
 *   `AGENTS.md` and spec 0004's security model both forbid a health value or
 *   a session token appearing in a log line, and the surest way to honour
 *   that is for the log not to exist.
 * - It imports nothing. This module is reached from pure code that the test
 *   suite runs under plain Node, so pulling in `expo-constants` here would
 *   break those tests for the sake of a console call.
 *
 * `__DEV__` is injected by the React Native bundler rather than declared by a
 * package, so it is declared here, once, instead of as a bare global at every
 * call site.
 */
declare const __DEV__: boolean | undefined;

export const isDevelopmentBuild = (): boolean => typeof __DEV__ !== 'undefined' && __DEV__ === true;

export const devWarn = (...parts: readonly unknown[]): void => {
  if (isDevelopmentBuild()) {
    console.warn(...parts);
  }
};
