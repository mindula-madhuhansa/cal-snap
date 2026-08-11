import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useDraining, useSessionNotice } from '@/account/session';
import { useSignInOrUp } from '@/account/use-sign-in-or-up';
import { AppMark } from '@/design-system/components/app-mark';
import { AppText } from '@/design-system/components/app-text';
import { Button } from '@/design-system/components/button';
import { CaptchaMount } from '@/design-system/components/captcha-mount';
import { Divider } from '@/design-system/components/divider';
import { Field } from '@/design-system/components/field';
import { Notice } from '@/design-system/components/notice';
import { NumberedList } from '@/design-system/components/numbered-list';
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
 * rule from applying at all.
 */

/** Six digits, so the field can be sized and the keyboard chosen for it. */
const CODE_LENGTH = 6;

/**
 * What signing up actually costs, said before it is asked for. Somebody
 * deciding whether to hand over an email deserves to know what happens next.
 */
const WHAT_HAPPENS_NEXT = [
  'Eight quick questions. Under a minute.',
  'You get a daily number you can change.',
  'Point your camera at lunch. That’s it.',
] as const;

export default function SignInScreen() {
  const flow = useSignInOrUp();
  const { draining, signBackIn } = useDraining();
  const { notice, dismissNotice } = useSessionNotice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');

  const busy = flow.busy;
  const error = flow.error;
  const onEmailStep = flow.step.kind === 'email';

  return (
    <Screen testID="sign-in-screen">
      <View style={styles.header}>
        <AppMark />
        <AppText variant="h1" heading align="center">
          Let’s get you in the game
        </AppText>
        <AppText variant="body" color={colors.textMuted} align="center">
          One email. No password to forget, ever. We send a six digit code and you’re off.
        </AppText>
      </View>

      {/*
        AC-13. The person did not choose to be here: their session stopped
        being valid while they were using the app. Nothing of theirs was lost
        and the sentence says so, because being returned to the door with no
        explanation reads exactly like data loss.
      */}
      {notice === undefined ? undefined : (
        <Notice message={notice} intent="notice" testID="session-ended-notice">
          <Button
            label="Dismiss"
            variant="ghost"
            onPress={dismissNotice}
            accessibilityHint="Hides this message. You can still sign in below"
            testID="session-ended-dismiss"
          />
        </Notice>
      )}

      {/*
        AC-11b. This phone signed out of an account with meals still owed to
        it. Nothing of that diary is readable from here, and it is being sent
        quietly in the background; saying so is more honest than a sign in
        screen that looks like any other while a health record is still on
        disk. Signing back in adopts it and finishes the job from inside a
        normal session.
      */}
      {draining ? (
        <Notice
          message="Your last meals have not reached your account yet. CalSnap keeps trying, and removes them from this phone once they land, or after seven days."
          intent="notice"
          testID="draining-notice">
          <Button
            label="Sign back in to finish"
            variant="ghost"
            onPress={signBackIn}
            accessibilityHint="Opens your diary again so the meals waiting on this phone can be sent"
            testID="draining-sign-back-in"
          />
        </Notice>
      ) : undefined}

      {/* AC-12, AC-16. Announced, not just drawn: a sentence that appears
          after a button press is silent to a screen reader otherwise. */}
      {error === '' ? undefined : <Notice message={error} testID="sign-in-error" />}

      {flow.step.kind === 'email' ? (
        <View style={styles.form}>
          <Field label="Email" required>
            {(control) => (
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
                {...control}
              />
            )}
          </Field>
          <Button
            label={busy ? 'One moment' : 'Send my code'}
            size="block"
            fullWidth
            onPress={() => void flow.submitEmail(email)}
            disabled={busy}
            accessibilityHint="Continues with this email address, whether or not you already have an account"
            testID="sign-in-continue"
          />
        </View>
      ) : undefined}

      {flow.step.kind === 'password' ? (
        <View style={styles.form}>
          <AppText variant="caption" color={colors.textMuted}>
            {`Signing in as ${flow.step.email}`}
          </AppText>
          <Field label="Password" required>
            {(control) => (
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                autoComplete="current-password"
                editable={!busy}
                testID="sign-in-password"
                {...control}
              />
            )}
          </Field>
          <Button
            label={busy ? 'One moment' : 'Sign in'}
            size="block"
            fullWidth
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
          <AppText variant="caption" color={colors.textMuted}>
            {`We sent a ${CODE_LENGTH} digit code to ${flow.step.email}.`}
          </AppText>
          <Field label="Code" required>
            {(control) => (
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
                {...control}
              />
            )}
          </Field>
          <Button
            label={busy ? 'One moment' : 'Continue'}
            size="block"
            fullWidth
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

      {/* Only on the way in. Once a code has been sent, what happens next is
          the code, and this list would be answering a question nobody is
          still asking. */}
      {onEmailStep ? (
        <>
          <Divider label="What happens next" />
          <NumberedList items={WHAT_HAPPENS_NEXT} />
        </>
      ) : undefined}

      <View style={styles.footer}>
        <AppText variant="caption" color={colors.textDim} align="center">
          Your diary lives on your phone and in your account. Nowhere else.
        </AppText>
      </View>

      {/* Clerk's bot protection attaches here. Draws nothing (AC-1). */}
      <CaptchaMount />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: space[3],
    paddingTop: space[6],
    paddingBottom: space[4],
  },
  form: {
    gap: space[3],
  },
  footer: {
    paddingTop: space[4],
  },
});
