import { CHECK_TIMEOUT_MS } from './constants.ts';
import type { Check, CheckResult } from './types.ts';

function failReason(err: unknown): string {
  const name =
    typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name: unknown }).name)
      : '';
  if (name === 'TimeoutError' || name === 'AbortError') return 'timeout';
  return 'network error';
}

export async function probe(check: Check): Promise<CheckResult> {
  try {
    const res = await fetch(check.url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      headers: { 'user-agent': 'winwin-uptime-monitor' },
    });
    if (res.status === 200) return { name: check.name, url: check.url, ok: true };
    return {
      name: check.name,
      url: check.url,
      ok: false,
      reason: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name: check.name,
      url: check.url,
      ok: false,
      reason: failReason(err),
    };
  }
}
