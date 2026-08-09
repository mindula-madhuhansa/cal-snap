import { useSignIn, useSignUp } from '@clerk/expo';
import { useCallback, useState } from 'react';

import { devWarn } from '@/config/dev-warning';

import { failureMessage } from './error-messages';

/**
 * The one combined door: sign in and sign up behind a single email field
 * (spec 0004, AC-1, AC-2).
 *
 * A person should not have to know whether they already have an account. They
 * type their email, and this works out the rest:
 *
 *   email -> has a password?   -> ask for it, and offer a code instead
 *         -> no password?      -> email a code
 *         -> no account?       -> sign up, email a code
 *
 * The emailed code is a first class way in, not a password reset. That is why
 * this release ships no "change password" screen and nobody is ever locked
 * out: whatever state an account is in, a code always gets you back to it.
 *
 * Clerk's method based API is used throughout (`signIn.password()`,
 * `signIn.emailCode.sendCode()`, `signIn.finalize()`). The legacy
 * `create` + `prepareFirstFactor` + `setActive` pattern is deliberately not
 * used; it lives at `@clerk/expo/legacy` and is only for existing code.
 */

export type SignInStep =
  | { readonly kind: 'email' }
  | { readonly kind: 'password'; readonly email: string }
  /** `signingUp` decides which of Clerk's two objects verifies the code. */
  | { readonly kind: 'code'; readonly email: string; readonly signingUp: boolean };

export type SignInFlow = {
  readonly step: SignInStep;
  readonly busy: boolean;
  /** Empty when there is nothing to say, which includes a cancelled sheet. */
  readonly error: string;
  readonly submitEmail: (email: string) => Promise<void>;
  readonly submitPassword: (password: string) => Promise<void>;
  readonly submitCode: (code: string) => Promise<void>;
  /** AC-2: the way past a forgotten password, from the password step. */
  readonly switchToCode: () => Promise<void>;
  readonly resendCode: () => Promise<void>;
  /** Back to the email field, so a typo is fixable without restarting. */
  readonly startOver: () => void;
};

/** Clerk returns `{ error }` rather than throwing, on every method here. */
type ClerkResult = { readonly error: unknown };

/**
 * Says, in the developer console, exactly which dashboard setting is blocking
 * sign up. The person on screen gets a calm sentence; whoever configured the
 * instance gets the actual field name, which is the only thing that makes
 * this fixable in under an hour.
 */
const reportBlockedSignUp = (missingFields: readonly string[]): void => {
  devWarn(
    `[account] sign up blocked: the Clerk instance requires ${missingFields.join(', ')}, ` +
      'which the combined sign in screen does not collect. Spec 0004 AC-1 says no password ' +
      'is required to sign up, so make it optional in the Clerk dashboard ' +
      '(User & authentication -> Email, phone, username -> Password) rather than adding a step here.',
  );
};

export const useSignInOrUp = (): SignInFlow => {
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [step, setStep] = useState<SignInStep>({ kind: 'email' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /**
   * Every call goes through here, so there is exactly one place a failure can
   * become a sentence and exactly one place `busy` is cleared. A path that
   * forgot either would leave a spinner running forever with no explanation.
   */
  const attempt = useCallback(async (work: () => Promise<ClerkResult>): Promise<boolean> => {
    setBusy(true);
    setError('');
    try {
      const { error: failure } = await work();
      if (failure !== null && failure !== undefined) {
        setError(failureMessage(failure).message);
        return false;
      }
      return true;
    } catch (thrown) {
      setError(failureMessage(thrown).message);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const sendSignInCode = useCallback(
    async (email: string): Promise<void> => {
      // No argument: `submitEmail` has already created the sign in with this
      // identifier, and Clerk sends to the address on it. Passing one here
      // would be a second, conflicting source for the same value.
      const sent = await attempt(() => signIn.emailCode.sendCode());
      if (sent) setStep({ kind: 'code', email, signingUp: false });
    },
    [attempt, signIn],
  );

  const startSignUp = useCallback(
    async (email: string): Promise<void> => {
      const created = await attempt(() => signUp.create({ emailAddress: email }));
      if (!created) return;

      const sent = await attempt(() => signUp.verifications.sendEmailCode());
      if (sent) setStep({ kind: 'code', email, signingUp: true });
    },
    [attempt, signUp],
  );

  const submitEmail = useCallback(
    async (email: string): Promise<void> => {
      const trimmed = email.trim();
      if (trimmed === '') {
        setError('Enter your email address to continue.');
        return;
      }

      setBusy(true);
      setError('');

      // `create` is used here for the one thing it is genuinely needed for:
      // finding out which first factors this account supports, before asking
      // the person for anything. Everything after this point uses the
      // factor specific methods.
      let identified = false;
      try {
        const { error: failure } = await signIn.create({ identifier: trimmed });
        identified = failure === null || failure === undefined;
      } catch {
        identified = false;
      } finally {
        setBusy(false);
      }

      // No such account. That is not a failure on this screen: it is the
      // sign up half of the same door (AC-1).
      if (!identified) {
        await startSignUp(trimmed);
        return;
      }

      const factors = signIn.supportedFirstFactors ?? [];
      const hasPassword = factors.some((factor) => factor.strategy === 'password');

      if (hasPassword) {
        setStep({ kind: 'password', email: trimmed });
        return;
      }

      await sendSignInCode(trimmed);
    },
    [signIn, sendSignInCode, startSignUp],
  );

  const submitPassword = useCallback(
    async (password: string): Promise<void> => {
      if (step.kind !== 'password') return;
      if (password === '') {
        setError('Enter your password, or choose "Email me a code instead".');
        return;
      }

      const signedIn = await attempt(() => signIn.password({ identifier: step.email, password }));
      if (signedIn) await attempt(() => signIn.finalize());
    },
    [attempt, signIn, step],
  );

  const submitCode = useCallback(
    async (code: string): Promise<void> => {
      if (step.kind !== 'code') return;
      if (code.trim() === '') {
        setError('Enter the six digit code from your email.');
        return;
      }

      const trimmed = code.trim();

      if (step.signingUp) {
        const verified = await attempt(() =>
          signUp.verifications.verifyEmailCode({ code: trimmed }),
        );
        if (!verified) return;

        // The email is confirmed, but Clerk will only hand over a session if
        // the sign up has everything the *instance* requires. If the
        // dashboard marks a field required that this screen never collects
        // (a password, most often), `finalize` fails with a shape that maps
        // to nothing, and the person reads "something went wrong" after doing
        // everything right. Name it instead.
        if (signUp.status === 'missing_requirements') {
          setError(failureMessage({ code: 'sign_up_incomplete' }).message);
          reportBlockedSignUp(signUp.missingFields);
          return;
        }

        await attempt(() => signUp.finalize());
        return;
      }

      const verified = await attempt(() => signIn.emailCode.verifyCode({ code: trimmed }));
      if (verified) await attempt(() => signIn.finalize());
    },
    [attempt, signIn, signUp, step],
  );

  const switchToCode = useCallback(async (): Promise<void> => {
    if (step.kind !== 'password') return;
    await sendSignInCode(step.email);
  }, [sendSignInCode, step]);

  const resendCode = useCallback(async (): Promise<void> => {
    if (step.kind !== 'code') return;

    if (step.signingUp) {
      await attempt(() => signUp.verifications.sendEmailCode());
      return;
    }
    await attempt(() => signIn.emailCode.sendCode());
  }, [attempt, signIn, signUp, step]);

  const startOver = useCallback((): void => {
    setError('');
    setStep({ kind: 'email' });
  }, []);

  return {
    step,
    busy,
    error,
    submitEmail,
    submitPassword,
    submitCode,
    switchToCode,
    resendCode,
    startOver,
  };
};
