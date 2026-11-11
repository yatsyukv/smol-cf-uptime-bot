import { isMetaKey } from './constants.ts';
import type { CheckState, State } from './types.ts';

const EMPTY: State = { lastSummaryDate: null, lastRunAt: null };

export function isCheckState(value: unknown): value is CheckState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as CheckState;
  return (
    (v.status === 'up' || v.status === 'down') &&
    typeof v.fails === 'number' &&
    (v.downSince === null || typeof v.downSince === 'string') &&
    (v.lastAlertAt === null || typeof v.lastAlertAt === 'string')
  );
}

export function parseState(raw: string | null): State {
  if (!raw) return { ...EMPTY };
  try {
    const value = JSON.parse(raw) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { ...EMPTY };
    }
    const obj = value as Record<string, unknown>;
    const state: State = {
      lastSummaryDate:
        typeof obj.lastSummaryDate === 'string' || obj.lastSummaryDate === null
          ? obj.lastSummaryDate
          : null,
      lastRunAt:
        typeof obj.lastRunAt === 'string' || obj.lastRunAt === null
          ? obj.lastRunAt
          : null,
    };
    for (const [key, v] of Object.entries(obj)) {
      if (isMetaKey(key)) continue;
      if (isCheckState(v)) state[key] = v;
    }
    return state;
  } catch {
    return { ...EMPTY };
  }
}

export function canonical(state: State): string {
  const names = Object.keys(state)
    .filter((k) => !isMetaKey(k))
    .sort();
  const out: Record<string, unknown> = {
    lastSummaryDate: state.lastSummaryDate ?? null,
    lastRunAt: state.lastRunAt ?? null,
  };
  for (const name of names) out[name] = state[name];
  return JSON.stringify(out);
}

export function shouldWrite(prev: State, next: State): boolean {
  return canonical(prev) !== canonical(next);
}

/** Persist next only when Telegram succeeded (or there was nothing to send). */
export function stateToSave(
  prev: State,
  next: State,
  sendSucceeded: boolean,
): State | null {
  if (!sendSucceeded) return null;
  if (!shouldWrite(prev, next)) return null;
  return next;
}
