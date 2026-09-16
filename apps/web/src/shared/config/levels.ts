/**
 * Club NTRP-style ratings (1.5–5.5, step 0.5).
 * Not official USTA ratings — club use only.
 */
export const NTRP_LEVELS = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5] as const;
export type NtrpLevel = (typeof NTRP_LEVELS)[number];

export function formatLevel(level: NtrpLevel): string {
  return `${level.toFixed(1)} (club NTRP-style)`;
}
