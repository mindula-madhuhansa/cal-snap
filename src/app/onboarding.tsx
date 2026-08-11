import { useEffect } from 'react';
import { router } from 'expo-router';

import { useAccount, useOnboardingHandover } from '@/account/session';
import type { CompleteAnswers } from '@/data/local/onboarding';
import { LoadingState } from '@/design-system/components/loading-state';
import { Screen } from '@/design-system/components/screen';
import { ResultStep } from '@/onboarding/result-step';
import { StepFrame } from '@/onboarding/step-frame';
import {
  ActivityStep,
  AgeStep,
  ConsentStep,
  GoalDirectionStep,
  GoalPaceStep,
  HeightStep,
  SexStep,
  WeightStep,
  type StepProps,
} from '@/onboarding/steps';
import { useOnboarding } from '@/onboarding/use-onboarding';

/**
 * First run setup (spec 0006).
 *
 * One route rather than nine, because the flow is driven by
 * `onboarding_draft.current_step` and not by the navigation stack. That is
 * what makes resuming work: reopening the app after a force quit lands on the
 * question that was next, with no history to rebuild and no way to reach a
 * later question by going back into a stack that no longer matches the answers
 * (AC-5). Each step is still its own screen with its own progress and back
 * step, which is what AC-2 asks for.
 *
 * Spec 0006's build plan suggested `src/app/onboarding/`; the step components
 * live in `src/onboarding/` instead so that Expo Router does not turn each one
 * into a reachable route of its own. Same screens, same order.
 */

/** The question, and the words under it, for each step. */
const PROMPTS = {
  consent: {
    title: 'Before we start',
    subtitle: 'A short note about what we ask for and why.',
  },
  sex: { title: 'Which should we use?', subtitle: 'The calorie equation needs one of these.' },
  age: { title: 'How old are you?' },
  height: { title: 'How tall are you?' },
  weight: { title: 'What do you weigh?', subtitle: 'Roughly is fine. You can update it any time.' },
  activity: { title: 'How active is a normal day?' },
  goal_direction: { title: 'What are you here to do?' },
  goal_pace: { title: 'How fast?' },
  result: { title: 'Here is your daily target' },
} as const;

const QUESTION_STEPS: Readonly<Record<string, (props: StepProps) => React.ReactElement>> = {
  consent: ConsentStep,
  sex: SexStep,
  age: AgeStep,
  height: HeightStep,
  weight: WeightStep,
  activity: ActivityStep,
  goal_direction: GoalDirectionStep,
  goal_pace: GoalPaceStep,
};

export default function OnboardingScreen() {
  const account = useAccount();

  if (account.kind !== 'ready') {
    return (
      <Screen testID="onboarding-screen">
        <LoadingState message="Getting your account ready" />
      </Screen>
    );
  }

  return <OnboardingFlowScreen db={account.db} userId={account.userId} />;
}

const OnboardingFlowScreen = ({
  db,
  userId,
}: {
  readonly db: Parameters<typeof useOnboarding>[0];
  readonly userId: string;
}) => {
  const account = useAccount();
  const { phase, answer, goBack, finish, dismissError } = useOnboarding(db, userId);
  const { onboardingFinished } = useOnboardingHandover();

  /**
   * Leaving setup takes two steps, and it needs both.
   *
   * The gate mounts one screen at a time, so while it says onboarding there is
   * no Today to navigate to: step one tells it the answer it routed on has
   * changed. But changing what the gate *declares* does not move the route
   * that is already showing, so on its own step one leaves the finished setup
   * screen sitting there for ever. Step two is the navigation, and it waits
   * for the gate to have actually declared the tabs rather than firing in the
   * same tick, when there would still be nothing to go to.
   */
  useEffect(() => {
    if (phase.kind === 'done') onboardingFinished();
  }, [phase, onboardingFinished]);

  const handedOver = account.kind === 'ready' && account.destination.kind === 'today';

  useEffect(() => {
    if (handedOver) router.replace('/');
  }, [handedOver]);

  if (phase.kind === 'loading') {
    return (
      <Screen testID="onboarding-screen">
        <LoadingState message="Picking up where you left off" />
      </Screen>
    );
  }

  // Its own message rather than the resuming one. They are opposite ends of
  // the flow, and showing "picking up where you left off" to somebody who has
  // just finished is both wrong and, if it ever hangs again, hides which of
  // the two states it hung in.
  if (phase.kind === 'done') {
    return (
      <Screen testID="onboarding-screen">
        <LoadingState message="Saving your daily target" />
      </Screen>
    );
  }

  const prompt = PROMPTS[phase.step];
  const Question = QUESTION_STEPS[phase.step];

  return (
    <StepFrame
      title={prompt.title}
      {...('subtitle' in prompt ? { subtitle: prompt.subtitle } : {})}
      position={phase.progress.position}
      total={phase.progress.total}
      canGoBack={phase.canGoBack}
      onBack={goBack}
      {...(phase.error === undefined ? {} : { error: phase.error })}
      onDismissError={dismissError}
      testID="onboarding-screen">
      {Question === undefined ? (
        <ResultStep
          answers={phase.answers as CompleteAnswers}
          onFinish={finish}
          busy={phase.busy}
        />
      ) : (
        <Question answers={phase.answers} onAnswer={answer} busy={phase.busy} />
      )}
    </StepFrame>
  );
};
