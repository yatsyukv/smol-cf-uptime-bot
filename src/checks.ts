import { RESERVED_CHECK_NAME } from './constants.ts';
import type { Check } from './types.ts';

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
    seen.add(name);
    checks.push({ name, url });
  }
  return checks;
}
