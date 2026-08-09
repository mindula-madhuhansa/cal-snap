import { useSignInWithApple } from '@clerk/expo/apple';
import { useSignInWithGoogle } from '@clerk/expo/google';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { failureMessage } from '@/account/error-messages';
import { useSignInOrUp } from '@/account/use-sign-in-or-up';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { CaptchaMount } from '@/design-system/components/captcha-mount';
import { Divider } from '@/design-system/components/divider';
import { Field } from '@/design-system/components/field';
import { Screen } from '@/design-system/components/screen';
import { TextInput } from '@/design-system/components/text-input';
import { colors, space } from '@/design-system/theme';

/**
 * The door (spec 0004, AC-1, AC-2, AC-3, AC-5, AC-16).
 *
 * One screen, one email field. Nobody has to decide up front whether they are
 * signing in or signing up, because the app can work that out and asking is
 * just a question with a wrong answer in it.
 */

/** Six digits, so the field can be sized and the keyboard chosen for it. */
const CODE_LENGTH = 6;

export default function SignInScreen() {
  const flow = useSignInOrUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [socialError, setSocialError] = useState('');

  const { startGoogleAuthenticationFlow } = useSignInWithGoogle();
  const { startAppleAuthenticationFlow } = useSignInWithApple();

  const busy = flow.busy;
  // One error line, whichever half produced it. Two separate slots would let
  // a stale social error sit under a fresh password error.
  const error = flow.error !== '' ? flow.error : socialError;

  const runSocial = (start: () => Promise<unknown>) => (): void => {
    setSocialError('');
    void (async () => {
      try {
        await start();
      } catch (thrown) {
        // A cancelled sheet maps to an empty message on purpose: the person
        // closed it deliberately, and an error after that reads as a bug.
        setSocialError(failureMessage(thrown).message);
      }
    })();
  };

  return (
    <Screen testID="sign-in-screen">
      <View style={styles.header}>
        <AppText variant="h1" heading align="center">
          CalSnap
        </AppText>
        <AppText variant="body" color={colors.textSubtle} align="center">
          Snap a meal, see what is left of your day.
        </AppText>
      </View>

      {error === '' ? undefined : (
        <View style={[styles.error, { borderLeftColor: colors.intents.failure.mark }]}>
          <AppText variant="caption" color={colors.intents.failure.text}>
            {error}
          </AppText>
        </View>
      )}

      {flow.step.kind === 'email' ? (
        <View style={styles.form}>
          <Field label="Email address" required>
            {(a11y) => (
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                textContentType="emailAddress"
                autoComplete="email"
                editable={!busy}
                testID="sign-in-email"
                {...a11y}
              />
            )}
          </Field>
          <Button
            label={busy ? 'One moment' : 'Continue'}
            size="block"
            onPress={() => void flow.submitEmail(email)}
            disabled={busy}
            accessibilityHint="Continues with this email address, whether or not you already have an account"
            testID="sign-in-continue"
          />
        </View>
      ) : undefined}

      {flow.step.kind === 'password' ? (
        <View style={styles.form}>
          <AppText variant="caption" color={colors.textSubtle}>
            {`Signing in as ${flow.step.email}`}
          </AppText>
          <Field label="Password" required>
            {(a11y) => (
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="current-password"
                editable={!busy}
                testID="sign-in-password"
                {...a11y}
              />
            )}
          </Field>
          <Button
            label={busy ? 'One moment' : 'Sign in'}
            size="block"
            onPress={() => void flow.submitPassword(password)}
            disabled={busy}
            testID="sign-in-submit-password"
          />
          {/* AC-2: the reason nobody is ever locked out. */}
          <Button
            label="Email me a code instead"
            variant="ghost"
            onPress={() => void flow.switchToCode()}
            disabled={busy}
            accessibilityHint="Sends a six digit code to your email so you can sign in without your password"
            testID="sign-in-use-code"
          />
          <Button
            label="Use a different email"
            variant="ghost"
            onPress={flow.startOver}
            disabled={busy}
          />
        </View>
      ) : undefined}

      {flow.step.kind === 'code' ? (
        <View style={styles.form}>
          <AppText variant="caption" color={colors.textSubtle}>
            {`We sent a ${CODE_LENGTH} digit code to ${flow.step.email}.`}
          </AppText>
          <Field label="Code" required>
            {(a11y) => (
              <TextInput
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                editable={!busy}
                testID="sign-in-code"
                {...a11y}
              />
            )}
          </Field>
          <Button
            label={busy ? 'One moment' : 'Continue'}
            size="block"
            onPress={() => void flow.submitCode(code)}
            disabled={busy}
            testID="sign-in-submit-code"
          />
          <Button
            label="Send a new code"
            variant="ghost"
            onPress={() => void flow.resendCode()}
            disabled={busy}
          />
          <Button
            label="Use a different email"
            variant="ghost"
            onPress={flow.startOver}
            disabled={busy}
          />
        </View>
      ) : undefined}

      {flow.step.kind === 'email' ? (
        <View style={styles.social}>
          <Divider />
          <AppText variant="caption" color={colors.textSubtle} align="center">
            or
          </AppText>
          <Button
            label="Continue with Google"
            onPress={runSocial(startGoogleAuthenticationFlow)}
            fullWidth
            disabled={busy}
            testID="sign-in-google"
          />
          {/* Sign in with Apple is offered on iOS wherever Google is (AC-3). */}
          {Platform.OS === 'ios' ? (
            <Button
              label="Continue with Apple"
              onPress={runSocial(startAppleAuthenticationFlow)}
              fullWidth
              disabled={busy}
              testID="sign-in-apple"
            />
          ) : undefined}
        </View>
      ) : undefined}

      {/* Clerk's bot protection attaches here. Draws nothing (AC-1). */}
      <CaptchaMount />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: space[1],
    paddingVertical: space[6],
  },
  form: {
    gap: space[3],
  },
  social: {
    gap: space[3],
    paddingTop: space[4],
  },
  error: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: space[2],
    marginBottom: space[2],
  },
});
