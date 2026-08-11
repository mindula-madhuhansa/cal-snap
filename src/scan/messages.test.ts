import { describe, expect, it } from 'vitest';

import {
  confidenceLabel,
  confidenceSentence,
  overDailyCapMessage,
  scanFailureMessage,
} from './messages';
import type { Confidence, ScanFailureReason } from './transport';

/**
 * Spec 0007. Every failure a person can hit says something honest on screen,
 * and every uncertain number says it is uncertain.
 */

const ALL_REASONS: readonly ScanFailureReason[] = [
  'upstream_timeout',
  'upstream_refused',
  'upstream_error',
  'invalid_reply',
  'internal',
  'offline',
];

describe('scanFailureMessage', () => {
  // covers: AC-19. The set is closed, so this list failing to compile is the
  // signal that a new reason arrived without a sentence being written for it.
  it.each(ALL_REASONS)('has a written sentence for %s', (reason) => {
    const message = scanFailureMessage(reason);
    expect(message.length).toBeGreaterThan(20);
    expect(message.endsWith('.')).toBe(true);
  });

  // covers: AC-19. Nothing internal reaches a person: no reason code, no stack,
  // no provider name, no HTTP status.
  it.each(ALL_REASONS)('leaks nothing internal for %s', (reason) => {
    const message = scanFailureMessage(reason);
    expect(message).not.toContain(reason);
    expect(message).not.toMatch(/anthropic|supabase|claude|http|error:|undefined|null/i);
  });

  // Every reason produces its own sentence, so two different causes never look
  // like the same problem.
  it('says something different for each reason', () => {
    const said = ALL_REASONS.map(scanFailureMessage);
    expect(new Set(said).size).toBe(ALL_REASONS.length);
  });

  // covers: AC-6. Offline names the connection as the cause and says the photo
  // survived, because it did.
  it('names the connection when offline, and says nothing is lost', () => {
    const message = scanFailureMessage('offline');
    expect(message).toContain('internet');
    expect(message).toContain('still here');
  });
});

describe('overDailyCapMessage', () => {
  const now = new Date('2026-08-11T14:00:00.000Z');

  // covers: AC-8b. The limit and when it comes back, in plain words.
  it('says the limit and when it resets', () => {
    const message = overDailyCapMessage('2026-08-11T22:00:00.000Z', now);
    expect(message).toContain('25 scans');
    expect(message).toMatch(/scan again at /);
  });

  // A reset more than a day out is a clock disagreement, not a time worth
  // quoting, so it degrades to the vaguer but true sentence.
  it('falls back to tomorrow when the reset is not within a day', () => {
    const message = overDailyCapMessage('2026-08-14T00:00:00.000Z', now);
    expect(message).toContain('tomorrow');
  });

  // covers: AC-8b. An unreadable value must not put "Invalid Date" on screen.
  it('still says something true when the reset time is unreadable', () => {
    const message = overDailyCapMessage('not a date', now);
    expect(message).toContain('25 scans');
    expect(message).not.toMatch(/invalid|nan/i);
  });
});

describe('confidence wording', () => {
  const ALL: readonly Confidence[] = ['high', 'medium', 'low'];

  // covers: AC-2. Each level is a word, not a colour and not an icon.
  it.each(ALL)('labels %s in words', (confidence) => {
    expect(confidenceLabel(confidence)).toMatch(/[a-z]/i);
  });

  it('gives each level its own label', () => {
    expect(new Set(ALL.map(confidenceLabel)).size).toBe(3);
  });

  // covers: AC-2. Only a fully confident reading is described as confident.
  it('calls a clean high confidence reading confident', () => {
    expect(confidenceSentence('high', 0)).toContain('confident');
  });

  // covers: AC-2. Anything below high is marked as an estimate worth checking,
  // in a sentence, and the sentence counts what needs checking.
  it('calls a medium reading an estimate and asks for a check', () => {
    const sentence = confidenceSentence('medium', 2);
    expect(sentence).toContain('estimate');
    expect(sentence).toContain('Check');
    expect(sentence).toContain('2 items');
  });

  it('calls a low reading a guess rather than an estimate', () => {
    const sentence = confidenceSentence('low', 1);
    expect(sentence).toContain('guess');
    expect(sentence).toContain('the item marked below');
  });

  // covers: AC-2. A high overall reading with an uncertain item still asks for
  // the check, because the item is what a person would act on.
  it('still asks for a check when the whole is high but an item is not', () => {
    expect(confidenceSentence('high', 1)).toContain('Check');
  });
});
