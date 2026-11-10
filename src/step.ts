import {
  DEFAULT_SUMMARY_HOUR,
  DEFAULT_SUMMARY_TZ,
  FAIL_THRESHOLD,
  REMINDER_MS,
} from './constants.ts';
import {
  downMessage,
  reminderMessage,
  summaryMessage,
  upMessage,
} from './messages.ts';
import { isCheckState } from './persist.ts';
import { zonedParts } from './time.ts';
import type {
  CheckResult,
  CheckState,
  Message,
  State,
  StepOptions,
} from './types.ts';

const HEALTHY: CheckState = Object.freeze({
  status: 'up',
  fails: 0,
  downSince: null,
  lastAlertAt: null,
});

function readCheck(state: State, name: string): CheckState {
  const value = state[name];
  return isCheckState(value) ? value : HEALTHY;
}

function keep(check: CheckState): boolean {
  return !(check.status === 'up' && check.fails === 0);
}

function reminderDue(lastAlertAt: string | null, now: Date): boolean {
  if (!lastAlertAt) return true;
  return now.getTime() - new Date(lastAlertAt).getTime() >= REMINDER_MS;
}

export function step(
  state: State,
  results: CheckResult[],
  now: Date,
  options: StepOptions = {},
): { state: State; messages: Message[] } {
  const messages: Message[] = [];
  const iso = now.toISOString();
  const next: State = { lastSummaryDate: state.lastSummaryDate ?? null };
  const seen = new Set(results.map((r) => r.name));
  const tz = options.tz || DEFAULT_SUMMARY_TZ;
  const summaryHour = options.summaryHour ?? DEFAULT_SUMMARY_HOUR;

  for (const [name, value] of Object.entries(state)) {
    if (name === 'lastSummaryDate' || !isCheckState(value)) continue;
    if (seen.has(name)) continue;
    if (value.status === 'down') {
      messages.push(upMessage(name, null, value.downSince, now));
    }
  }

  for (const result of results) {
    const prev = readCheck(state, result.name);
    let check: CheckState;

    if (result.ok) {
      if (prev.status === 'down') {
        messages.push(upMessage(result.name, result.url, prev.downSince, now));
      }
      check = HEALTHY;
    } else if (prev.status === 'down') {
      check = { ...prev };
      if (reminderDue(prev.lastAlertAt, now)) {
        messages.push(
          reminderMessage(
            result.name,
            result.url,
            result.reason ?? 'unknown',
            prev.downSince,
            now,
          ),
        );
        check = { ...check, lastAlertAt: iso };
      }
    } else {
      const fails = prev.fails + 1;
      if (fails >= FAIL_THRESHOLD) {
        messages.push(
          downMessage(result.name, result.url, result.reason ?? 'unknown', now),
        );
        check = {
          status: 'down',
          fails,
          downSince: iso,
          lastAlertAt: iso,
        };
      } else {
        check = { status: 'up', fails, downSince: null, lastAlertAt: null };
      }
    }

    if (keep(check)) next[result.name] = check;
  }

  const zoned = zonedParts(now, tz);
  if (zoned.hour >= summaryHour && next.lastSummaryDate !== zoned.date) {
    messages.push(summaryMessage(results));
    next.lastSummaryDate = zoned.date;
  }

  return { state: next, messages };
}
