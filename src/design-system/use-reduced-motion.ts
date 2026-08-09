import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the phone has asked for less motion (spec 0003, AC-9).
 *
 * The platform answers asynchronously, so there is a moment at launch where
 * the answer is not known. This hook reports `true` for that moment: someone
 * who asked for less motion never sees a single un-reduced frame, and the
 * whole cost of being wrong the other way is that the first transition after a
 * cold start is instant for everyone. Nobody notices that. Somebody would
 * notice the alternative.
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let listening = true;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (listening) {
          setReduced(enabled);
        }
      })
      .catch(() => {
        // The query failed, so the honest answer is still "assume reduced".
      });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);

    return () => {
      listening = false;
      subscription.remove();
    };
  }, []);

  return reduced;
};
