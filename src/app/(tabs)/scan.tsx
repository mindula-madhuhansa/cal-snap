import { CaptureScreen } from '@/scan/capture-screen';

/**
 * The Scan tab (spec 0007).
 *
 * Routing only. The screen itself lives in `src/scan/` with the rest of the
 * feature, because it uses the camera and the photo library directly and
 * `src/app/**` is kept to routes.
 */
export default function ScanRoute() {
  return <CaptureScreen />;
}
