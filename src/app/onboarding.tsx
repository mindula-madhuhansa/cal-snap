import { useEffect } from 'react';

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
  const { phase, answer, goBack, finish, dismissError } = useOnboarding(db, userId);
  const { onboardingFinished } = useOnboardingHandover();

  // Leaving setup is a handover rather than a navigation: while the gate says
  // onboarding, this is the only screen mounted, so there is nothing to
  // navigate to until the gate is told the answer it routed on has changed.
  // It runs only once the profile, the weigh in, and the target are all
  // written, so Today has a real day to show the moment it mounts.
  useEffect(() => {
    if (phase.kind === 'done') onboardingFinished();
  }, [phase, onboardingFinished]);

  if (phase.kind === 'loading' || phase.kind === 'done') {
    return (
      <Screen testID="onboarding-screen">
        <LoadingState message="Picking up where you left off" />
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
