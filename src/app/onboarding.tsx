import { AppText } from '@/design-system/components/app-text';
import { EmptyState } from '@/design-system/components/empty-state';
import { Screen } from '@/design-system/components/screen';

/**
 * Where a signed in person with no finished profile lands (spec 0004, AC-6).
 *
 * Spec 0004 owns the *routing* to onboarding and deliberately not the
 * onboarding itself: the questions, the calorie formula, and the target are
 * scope feature 6. This route exists so the gate has somewhere real to send
 * people, and it says so plainly rather than pretending to be a form.
 */
export default function OnboardingScreen() {
  return (
    <Screen testID="onboarding-screen">
      <AppText variant="h1" heading>
        Welcome to CalSnap
      </AppText>

      <EmptyState
        title="Setup is not built yet"
        body="Your account is ready and you are signed in. The few questions that work out your daily calorie target arrive with the next feature."
      />
    </Screen>
  );
}
