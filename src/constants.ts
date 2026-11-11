export const STATE_KEY = 'state';
export const CHECK_TIMEOUT_MS = 10_000;
export const FAIL_THRESHOLD = 2;
export const REMINDER_MS = 30 * 60 * 1000;
export const DEFAULT_SUMMARY_TZ = 'UTC';
export const DEFAULT_SUMMARY_HOUR = 9;
export const DEFAULT_EVERY_MINUTES = 5;
export const META_KEYS = ['lastSummaryDate', 'lastRunAt'] as const;

export function isMetaKey(key: string): boolean {
  return (META_KEYS as readonly string[]).includes(key);
}
