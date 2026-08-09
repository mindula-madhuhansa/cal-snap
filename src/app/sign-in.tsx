import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSignInOrUp } from '@/account/use-sign-in-or-up';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { CaptchaMount } from '@/design-system/components/captcha-mount';
import { Field } from '@/design-system/components/field';
import { Screen } from '@/design-system/components/screen';
import { TextInput } from '@/design-system/components/text-input';
import { colors, space } from '@/design-system/theme';

/**
 * The door (spec 0004, AC-1, AC-2, AC-5, AC-16).
 *
 * One screen, one email field. Nobody has to decide up front whether they are
 * signing in or signing up, because the app can work that out and asking is
 * just a question with a wrong answer in it.
 *
 * **Email only.** Spec 0004 AC-3 also asked for native Google and Sign in
 * with Apple, and they were dropped on 9 August 2026: native Google needs
 * Google Cloud OAuth credentials and a registered signing fingerprint, which
 * is real setup for a way in that the emailed code already covers. Dropping
 * both rather than only Apple also keeps the App Store's third party sign in
 * rule from applying at all. AC-3 is owed an amendment in the spec.
 */

/** Six digits, so the field can be sized and the keyboard chosen for it. */
const CODE_LENGTH = 6;

export default function SignInScreen() {
  const flow = useSignInOrUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const busy = flow.busy;
  const error = flow.error;

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
  error: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: space[2],
    marginBottom: space[2],
  },
});
