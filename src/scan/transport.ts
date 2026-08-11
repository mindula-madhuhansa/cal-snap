/**
 * The narrow port the scan talks to, in the same spirit as `SyncTransport` and
 * `SqlDatabase` (spec 0007).
 *
 * Nothing here imports Supabase. The adapter that does is
 * `@/account/supabase-scan-transport.ts`, which is what lets every rule in this
 * folder be driven against a fake with no network, no client, and no camera.
 *
 * The result is one exhaustive union, so TypeScript's exhaustiveness check is
 * what proves no case was forgotten on a screen.
 */

export type Confidence = 'high' | 'medium' | 'low';

export type PortionUnit = 'g' | 'ml' | 'piece';

export type ScannedItem = {
  readonly name: string;
  readonly quantity: number;
  readonly unit: PortionUnit;
  readonly calories: number;
  readonly protein_g: number;
  readonly carbs_g: number;
  readonly fat_g: number;
  /** AC-2. Per item, so one uncertain thing on a plate can be marked alone. */
  readonly confidence: Confidence;
};

/** The `meal_scans` row the server wrote, as the phone mirrors it. */
export type ScanRecord = {
  readonly id: string;
  readonly model: string;
  readonly prompt_version: string;
  readonly status: 'ok' | 'low_confidence' | 'unrecognised' | 'failed';
  readonly confidence: Confidence | null;
  readonly cost_cents: number | null;
  readonly created_at: string;
  readonly updated_at: string;
};

/**
 * AC-19. A fixed set the function chooses from, mapped to sentences in
 * `failure-messages.ts`. Never an exception message.
 */
export type ScanFailureReason =
  | 'upstream_timeout'
  | 'upstream_refused'
  | 'upstream_error'
  | 'invalid_reply'
  | 'internal'
  /** AC-6. The request never left the phone, so no `meal_scans` row exists. */
  | 'offline';

export type ScanResult =
  | {
      readonly kind: 'ok' | 'low_confidence';
      readonly items: readonly ScannedItem[];
      readonly confidence: Confidence;
      readonly scan: ScanRecord;
    }
  /** AC-3. No item is ever invented to fill an empty result. */
  | { readonly kind: 'unrecognised'; readonly scan: ScanRecord }
  /** AC-8b. No row was written, because nothing was attempted and nothing spent. */
  | { readonly kind: 'over_daily_cap'; readonly resets_at: string }
  | { readonly kind: 'failed'; readonly reason: ScanFailureReason };

export type ScanRequest = {
  /** A uuid v7 minted on the phone. AC-18: re-sending it can never cost twice. */
  readonly scan_id: string;
  readonly image_base64: string;
  readonly media_type: 'image/jpeg';
};

export type ScanTransport = {
  scan: (request: ScanRequest) => Promise<ScanResult>;
};

/** AC-12. The phone gives up after the function's own 25 seconds, not before. */
export const SCAN_TIMEOUT_MS = 30_000;

/** AC-12. When the waiting screen changes its wording. A phone side timer only. */
export const SLOW_SCAN_MS = 10_000;
