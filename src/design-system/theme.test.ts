import { describe, expect, it } from 'vitest';

import { colors, fonts, gradients, minTouchTarget, motion, space, type } from './theme';

describe('colors: the alpha derived tokens', () => {
  // `withAlpha` is the one function standing between the raw paper and cyan
  // hexes and every translucent token the contrast table promises. A wrong
  // channel order or a wrong percentage here would silently break every ratio
  // in the role rule without any other test noticing, since they all read
  // these exported values rather than recomputing them.
  it('resolves textMuted to paper at 62%, matching the 7.20:1 the role rule claims', () => {
    expect(colors.textMuted).toBe('rgba(244, 246, 251, 0.62)');
  });

  it('resolves textDim to paper at 42%, matching the 3.83:1 the role rule claims', () => {
    expect(colors.textDim).toBe('rgba(244, 246, 251, 0.42)');
  });

  it('resolves the two edges to paper at 10% and 24%', () => {
    expect(colors.border).toBe('rgba(244, 246, 251, 0.1)');
    expect(colors.borderStrong).toBe('rgba(244, 246, 251, 0.24)');
  });

  it('resolves each pressed tint to its own colour at its own percentage', () => {
    expect(colors.pressed.accent).toBe('rgba(95, 220, 208, 0.18)');
    expect(colors.pressed.neutral).toBe('rgba(244, 246, 251, 0.08)');
    expect(colors.pressed.ghost).toBe('rgba(95, 220, 208, 0.12)');
    expect(colors.pressed.surface).toBe(colors.surfaceRaised);
  });

  it('washes each hue at a low enough alpha that the hue above it still reads', () => {
    expect(colors.wash.cyan).toBe('rgba(95, 220, 208, 0.12)');
    expect(colors.wash.neutral).toBe('rgba(244, 246, 251, 0.06)');
  });
});

describe('colors: the role rule', () => {
  // The three macros have to be told apart at a glance rather than read, so
  // two of them sharing a value would make a chart meaningless.
  it('gives each macro its own hue', () => {
    const macros = Object.values(colors.macros);

    expect(new Set(macros).size).toBe(macros.length);
  });

  it('gives every intent both a text colour and a mark colour', () => {
    for (const intent of Object.values(colors.intents)) {
      expect(intent.text.length).toBeGreaterThan(0);
      expect(intent.mark.length).toBeGreaterThan(0);
    }
  });

  // `textDim` is the one value in the palette below 4.5:1. It is permitted on
  // large text and marks, and an intent is neither, so no intent may reach for
  // it as the colour of a sentence.
  it('never sets an intent’s text in the one value that misses the small-text floor', () => {
    for (const intent of Object.values(colors.intents)) {
      expect(intent.text).not.toBe(colors.textDim);
    }
  });

  // A failure and a success that resolved to the same value would leave the
  // difference resting entirely on the words.
  it('keeps failure and success distinct', () => {
    expect(colors.intents.failure.text).not.toBe(colors.intents.success.text);
  });

  // Words on the gradient are set in the ground itself. If that ever became a
  // pale value it would vanish against the cyan end.
  it('sets textOnAccent to the ground, which is what the gradient is measured against', () => {
    expect(colors.textOnAccent).toBe(colors.bg);
  });
});

describe('gradients: the one accent', () => {
  // Every gradient in the design is the same cyan to violet pair. A third
  // stop or a second pair would make the brand two brands.
  it('runs the brand from cyan to violet, and reverses exactly that pair', () => {
    expect(gradients.brand).toEqual([colors.cyan, colors.violet]);
    expect(gradients.brandReversed).toEqual([colors.violet, colors.cyan]);
  });
});

describe('space: the 4 point grid', () => {
  it('keeps every step on the grid', () => {
    expect(space).toEqual({ 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32 });
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

  // `lineHeight` must always exceed `fontSize` for every step, or a scaled
  // line would start overlapping the one below it.
  it('gives every step a line height taller than its font size', () => {
    const steps = [
      type.display,
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
      type.data,
      type.kicker,
    ];

    for (const step of steps) {
      expect(step.lineHeight).toBeGreaterThan(step.fontSize);
    }
  });

  // The mono face exists so a column of figures lines up. A data or kicker
  // step that quietly fell back to the proportional face would break that
  // without looking broken.
  it('sets the three dense steps in the mono face', () => {
    expect(type.data.fontFamily).toBe(fonts.monoRegular);
    expect(type.kicker.fontFamily).toBe(fonts.monoBold);
    expect(type.h6.fontFamily).toBe(fonts.monoBold);
  });

  it('sets the display step larger than every heading under it', () => {
    expect(type.display.fontSize).toBeGreaterThan(type.h1.fontSize);
  });
});

describe('motion: what reduce motion collapses to', () => {
  // `motionDuration` reads `motion.duration.instant` as the value every
  // animation collapses to; if it ever drifted off zero, an animation
  // "reduced" to it would still visibly move.
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
  // `withMinTouchTarget` is tested against this exact value elsewhere; pinning
  // it here catches a change made at the source.
  it('is 44 points, the WCAG AA floor', () => {
    expect(minTouchTarget).toBe(44);
  });
});
