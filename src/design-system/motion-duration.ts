/**
 * Duration under the reduce motion setting, as a pure function
 * (spec 0003, AC-9, AC-16).
 *
 * Split out from the hook so the rule itself is testable without a phone:
 * when motion is reduced, every duration in the system collapses to
 * `instant`, and there is no animated component that gets to decide otherwise.
 */

import { motion } from './theme';

/** The duration an animation should really run for. */
export const motionDuration = (duration: number, reduced: boolean): number =>
  reduced ? motion.duration.instant : duration;
