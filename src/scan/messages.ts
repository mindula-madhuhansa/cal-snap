import type { Confidence, ScanFailureReason } from './transport';

/**
 * Every sentence this feature can say when something is uncertain or has gone
 * wrong (spec 0007, AC-2, AC-3, AC-8b, AC-19).
 *
 * Pure, in its own file with its tests beside it, matching how `src/account/`
 * splits `error-messages.ts` from the providers. Two rules shape all of it:
 * a person only ever reads a written sentence, never a reason code or a
 * provider string; and where a number is uncertain, the words say so rather
 * than presenting a guess as fact.
 */

/**
 * AC-19. One sentence per reason, and the reasons are a closed set, so a new
 * one cannot reach a screen without a sentence being written for it.
 *
 * Each says what happened and what to do next. Where trying again might work,
 * it says so; where it would not, it does not pretend.
 */
export const scanFailureMessage = (reason: ScanFailureReason): string => {
  switch (reason) {
    case 'offline':
      // AC-6. The photo is kept, so this is honest about nothing being lost.
      return 'CalSnap could not reach the internet, so this photo has not been scanned yet. It is still here: try again when you have a connection.';
    case 'upstream_timeout':
      return 'The scan took too long to come back. Your photo is still here, so you can try again.';
    case 'upstream_refused':
      return 'CalSnap could not scan this photo just now. Please try again in a few minutes.';
    case 'upstream_error':
      return 'Something went wrong scanning this photo. Your photo is still here, so you can try again.';
    case 'invalid_reply':
      return 'The scan came back in a form CalSnap could not read, so it has not guessed at the numbers. Try again.';
    case 'internal':
      return 'Something went wrong on our side, so this photo was not scanned. Your photo is still here, so you can try again.';
  }
};

/**
 * AC-8b. In plain words, with when it comes back.
 *
 * The time is formatted in the phone's own zone, which is the same day the cap
 * was counted in unless the person has just travelled.
 */
export const overDailyCapMessage = (resetsAt: string, now: Date = new Date()): string => {
  const at = new Date(resetsAt);

  if (Number.isNaN(at.getTime())) {
    return 'You have reached your 25 scans for today. You can scan again tomorrow.';
  }

  const sameDay = at.getTime() - now.getTime() < 24 * 60 * 60 * 1000;
  const time = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    at,
  );

  return sameDay
    ? `You have reached your 25 scans for today. You can scan again at ${time}.`
    : 'You have reached your 25 scans for today. You can scan again tomorrow.';
};

/**
 * AC-2. What a confidence mark means, said in words rather than left to a
 * colour or an icon, because colour alone carries no meaning in this design and
 * an icon is not a sentence.
 */
export const confidenceLabel = (confidence: Confidence): string => {
  switch (confidence) {
    case 'high':
      return 'Confident';
    case 'medium':
      return 'Rough estimate';
    case 'low':
      return 'Unsure';
  }
};

/**
 * AC-2. The one line under a result that says how much of it to trust. Anything
 * below `high` is called an estimate worth checking, in a sentence.
 */
export const confidenceSentence = (confidence: Confidence, uncertainItems: number): string => {
  if (confidence === 'high' && uncertainItems === 0) {
    return 'CalSnap is confident about this reading.';
  }

  const which =
    uncertainItems === 0
      ? 'this reading'
      : uncertainItems === 1
        ? 'the item marked below'
        : `the ${uncertainItems} items marked below`;

  return confidence === 'low'
    ? `These numbers are a guess. Check ${which} before you save it.`
    : `These numbers are an estimate. Check ${which} before you save it.`;
};

/** AC-3. No food found, said without inventing anything. */
export const UNRECOGNISED_TITLE = 'No food found';
export const UNRECOGNISED_BODY =
  'CalSnap could not find food in that photo, so it has not guessed. Try again with the plate filling more of the frame, or pick a different photo.';

/** AC-5. Why the camera is needed, for someone who refused it. */
export const CAMERA_BLOCKED_TITLE = 'CalSnap needs the camera';
export const CAMERA_BLOCKED_BODY =
  'Scanning a meal means photographing it, so CalSnap needs permission to use the camera. You can turn it on in Settings, or pick a photo from your library instead.';
