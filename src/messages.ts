import type { CheckResult, Message } from './types.ts';
import { downtime, formatUtc } from './time.ts';

export function downMessage(
  name: string,
  url: string,
  reason: string,
  now: Date,
): Message {
  return {
    kind: 'down',
    name,
    text: [
      `DOWN: ${name}`,
      url,
      `reason: ${reason}`,
      `time: ${formatUtc(now)}`,
    ].join('\n'),
  };
}

export function upMessage(
  name: string,
  url: string | null,
  downSince: string | null,
  now: Date,
): Message {
  const lines = [`UP: ${name}`];
  if (url) lines.push(url);
  lines.push(`downtime: ${downtime(downSince, now)}`);
  return { kind: 'up', name, text: lines.join('\n') };
}

export function reminderMessage(
  name: string,
  url: string,
  reason: string,
  downSince: string | null,
  now: Date,
): Message {
  return {
    kind: 'reminder',
    name,
    text: [
      `still down: ${name}`,
      url,
      `reason: ${reason}`,
      `down for: ${downtime(downSince, now)}`,
    ].join('\n'),
  };
}

export function summaryMessage(results: CheckResult[]): Message {
  const n = results.length;
  const down = results.filter((r) => !r.ok);
  if (down.length === 0) {
    return { kind: 'summary', text: `WinWin daily summary: all ${n} up` };
  }
  const lines = [
    `WinWin daily summary: ${down.length} of ${n} down`,
    ...down.map((r) => `• ${r.name} — ${r.reason ?? 'unknown'} (${r.url})`),
  ];
  return { kind: 'summary', text: lines.join('\n') };
}
