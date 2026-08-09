import { View } from 'react-native';

/**
 * The mount point Clerk's bot protection attaches to (spec 0004, AC-1).
 *
 * Clerk finds this by the native id `clerk-captcha`, so the string is a
 * contract with the provider and not a name to tidy. Without it, sign up
 * fails with a captcha error the person can do nothing about.
 *
 * It lives in the design system for one narrow reason: it needs a raw `View`
 * with a `nativeID`, and `eslint.config.js` forbids raw React Native
 * primitives inside `src/app/**`. Exposing it as a component keeps that rule
 * intact rather than punching a hole in it for one element.
 *
 * It draws nothing. Clerk renders into it only when a challenge is actually
 * required, which for most people is never.
 */
export const CaptchaMount = () => <View nativeID="clerk-captcha" />;
