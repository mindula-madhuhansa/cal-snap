import { describe, expect, it } from 'vitest';

import { colors, minTouchTarget, motion, space, type } from './theme';

describe('colors: the alpha derived tokens', () => {
  // covers: AC-2. `withAlpha` is the one function standing between the raw
  // ink hex and every translucent token the contrast table promises. A wrong
  // channel order or a wrong percentage here would silently break every ratio
  // in docs/design/design.md without any of the other tests noticing, since
  // they all read these exported values rather than recomputing them.
  it('resolves textMuted to ink at 55%, matching the 3.63:1 the contrast table claims', () => {
    expect(colors.textMuted).toBe('rgba(32, 31, 29, 0.55)');
  });

  it('resolves textSubtle to ink at 70%, matching the 5.79:1 the contrast table claims', () => {
    expect(colors.textSubtle).toBe('rgba(32, 31, 29, 0.7)');
  });

  it('resolves divider to ink at 16%, matching the 1.38:1 the contrast table claims', () => {
    expect(colors.divider).toBe('rgba(32, 31, 29, 0.16)');
  });

  it('resolves each pressed tint to its own colour at its own CSS :active percentage', () => {
    expect(colors.pressed.accent).toBe('rgba(182, 130, 53, 0.22)');
    expect(colors.pressed.neutral).toBe('rgba(32, 31, 29, 0.14)');
    expect(colors.pressed.ghost).toBe('rgba(182, 130, 53, 0.18)');
  });
});

describe('colors: the role rule (AC-2)', () => {
  // covers: AC-2. `accentText` is the one gold permitted on small text; the
  // rule collapses if it ever quietly becomes the same value as `accent`.
  it('keeps accentText distinct from accent', () => {
    expect(colors.accentText).not.toBe(colors.accent);
    expect(colors.accentText).toBe(colors.accentRamp[700]);
  });

  it('gives every intent both a text colour and a mark colour', () => {
    expect(colors.intents.over).toEqual({ text: colors.accentText, mark: colors.accent });
    expect(colors.intents.notice).toEqual({ text: colors.textSubtle, mark: colors.accent });
    expect(colors.intents.failure).toEqual({ text: colors.text, mark: colors.accentText });
  });

  it('never sets an intent’s text in the brighter, small-text-illegal gold', () => {
    for (const intent of Object.values(colors.intents)) {
      expect(intent.text).not.toBe(colors.accent);
    }
  });
});

describe('space: the 4.6 scale', () => {
  // covers: AC-14. The design's scale is deliberately 4.6 apart, not 4; a
  // component that rounds these to whole numbers breaks every measurement
  // downstream, so the exact values are worth pinning.
  it('keeps every step at its exact, deliberately odd value', () => {
    expect(space).toEqual({ 1: 4.6, 2: 9.2, 3: 13.8, 4: 18.4, 6: 27.6, 8: 36.8 });
  });

  it('is monotonically increasing, so no component can misread the scale’s order', () => {
    const steps = Object.values(space);
    for (let i = 1; i < steps.length; i += 1) {
      expect(steps[i]).toBeGreaterThan(steps[i - 1] as number);
    }
  });
});

describe('type: the scale every AppText step reads from', () => {
  it('sets the font scale cap that scaleTypeStep clamps to, at 1.6', () => {
    expect(type.fontScaleCap).toBe(1.6);
  });

  // covers: AC-4. `lineHeight` must always exceed `fontSize` for every step,
  // or a scaled line would start overlapping the one below it.
  it('gives every heading and body step a line height taller than its font size', () => {
    const steps = [
      type.h1,
      type.h2,
      type.h3,
      type.h4,
      type.h5,
      type.h6,
      type.body,
      type.bodySmall,
      type.label,
      type.caption,
      type.kicker,
    ];

    for (const step of steps) {
      expect(step.lineHeight).toBeGreaterThan(step.fontSize);
    }
  });
});

describe('motion: what reduce motion collapses to', () => {
  // covers: AC-9. `motionDuration` reads `motion.duration.instant` as the
  // value every animation collapses to; if it ever drifted off zero, an
  // animation "reduced" to it would still visibly move.
  it('keeps instant at exactly zero', () => {
    expect(motion.duration.instant).toBe(0);
  });

  it('orders every non-instant duration slower than instant', () => {
    expect(motion.duration.fast).toBeGreaterThan(motion.duration.instant);
    expect(motion.duration.base).toBeGreaterThan(motion.duration.fast);
    expect(motion.duration.slow).toBeGreaterThan(motion.duration.base);
  });
});

describe('minTouchTarget: the accessibility floor', () => {
  // covers: AC-3. `withMinTouchTarget` is tested against this exact value
  // elsewhere; pinning it here catches a change made at the source.
  it('is 44 points, the WCAG AA floor', () => {
    expect(minTouchTarget).toBe(44);
  });
});
