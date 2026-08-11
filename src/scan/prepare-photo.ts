import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { JPEG_QUALITY, resizeTarget, type Pixels } from './resize-target';

/**
 * A captured photo, shrunk and encoded for the scan (spec 0007, AC-16).
 *
 * One of the two deliberate edges in `src/scan/`: it touches native image code,
 * so the decision it acts on lives next door in `resize-target.ts` as a pure
 * function with its own tests, and this file is only the effect.
 *
 * Expected failures come back as a result value. A photo the manipulator cannot
 * read is an ordinary Tuesday (a file the operating system reclaimed, a format
 * a device produced that this build does not handle), not an exception.
 */

export type PreparedPhoto = {
  /** The shrunk file, still on this device, in the cache directory. */
  readonly uri: string;
  readonly base64: string;
};

export type PreparePhotoResult =
  | { readonly kind: 'ok'; readonly photo: PreparedPhoto }
  | { readonly kind: 'failed'; readonly message: string };

export type SourcePhoto = Pixels & { readonly uri: string };

export const preparePhoto = async (source: SourcePhoto): Promise<PreparePhotoResult> => {
  try {
    const context = ImageManipulator.manipulate(source.uri);
    const target = resizeTarget(source);

    // Already small enough: resizing would enlarge it, adding bytes and no
    // detail. The re-encode still happens, so quality and format are uniform.
    if (target !== undefined) context.resize(target);

    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({
      format: SaveFormat.JPEG,
      compress: JPEG_QUALITY,
      base64: true,
    });

    if (saved.base64 === undefined) {
      return { kind: 'failed', message: 'CalSnap could not read that photo. Try taking it again.' };
    }

    return { kind: 'ok', photo: { uri: saved.uri, base64: saved.base64 } };
  } catch {
    return { kind: 'failed', message: 'CalSnap could not read that photo. Try taking it again.' };
  }
};
