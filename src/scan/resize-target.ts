/**
 * How big the photo should be before it leaves the phone (spec 0007, AC-16).
 *
 * Pure, and runnable without a phone or a camera. The effectful half is
 * `prepare-photo.ts`; this is the whole of the decision it makes.
 *
 * 1024 px throws away detail the model could have used, which is a deliberate
 * trade for cost and speed: base64 inflates the payload by about a third, and
 * at this size that lands around 200 KB.
 */

/** AC-16. The longest edge, in pixels. */
export const MAX_EDGE = 1024;

/** AC-16. JPEG, and this much compression. */
export const JPEG_QUALITY = 0.7;

export type Pixels = { readonly width: number; readonly height: number };

/**
 * Which single edge to constrain, so the manipulator derives the other and the
 * aspect ratio is preserved. `undefined` means the photo is already small
 * enough and must not be resized: enlarging it would add no detail and cost
 * bytes.
 *
 * A square photo constrains the width, arbitrarily but consistently.
 */
export const resizeTarget = (
  source: Pixels,
): { readonly width: number } | { readonly height: number } | undefined => {
  const { width, height } = source;

  // A source with a dimension we cannot trust (zero, negative, or not a real
  // number) is left alone rather than resized to nonsense.
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  if (width <= MAX_EDGE && height <= MAX_EDGE) return undefined;

  return width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE };
};
