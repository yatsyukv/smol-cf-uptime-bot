import { DEFAULT_EVERY_MINUTES, RESERVED_CHECK_NAME } from './constants.ts';
import type { Check } from './types.ts';

export function parseEveryMinutes(value: unknown, label: string): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
    throw new Error(`${label} everyMinutes must be an integer >= 1`);
  }
  return n;
}

export function parseChecks(raw: string | null | undefined): Check[] {
  if (!raw || !raw.trim()) {
    throw new Error('CHECKS_JSON is empty');
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('CHECKS_JSON is not valid JSON');
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('CHECKS_JSON must be a non-empty array');
  }
  const seen = new Set<string>();
  const checks: Check[] = [];
  for (const [i, item] of value.entries()) {
    if (typeof item !== 'object' || item === null) {
      throw new Error(`check ${i} must be an object`);
    }
    const name = 'name' in item ? item.name : undefined;
    const url = 'url' in item ? item.url : undefined;
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error(`check ${i} needs a name`);
    }
    if (name === RESERVED_CHECK_NAME) {
      throw new Error(`check name ${RESERVED_CHECK_NAME} is reserved`);
    }
    if (seen.has(name)) throw new Error(`duplicate check name: ${name}`);
    if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
      throw new Error(`check ${name} needs an http(s) url`);
    }
    const everyMinutes =
      'everyMinutes' in item && item.everyMinutes !== undefined
        ? parseEveryMinutes(item.everyMinutes, `check ${name}`)
        : DEFAULT_EVERY_MINUTES;
    seen.add(name);
    checks.push({ name, url, everyMinutes });
  }
  return checks;
}

/** Cron fires every 5 minutes; probe only when this interval is due. */
export function isDue(everyMinutes: number, now: Date): boolean {
  const minute = Math.floor(now.getTime() / 60_000);
  return minute % everyMinutes === 0;
}
