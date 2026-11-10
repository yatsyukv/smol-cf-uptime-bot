import type { CheckResult, Message } from './types.ts';
import { downtime, formatUtc } from './time.ts';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function title(emoji: string, label: string, name: string): string {
  return `${emoji} <b>${escapeHtml(label)}</b> · <code>${escapeHtml(name)}</code>`;
}

function link(url: string): string {
  return `🔗 ${escapeHtml(url)}`;
}

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
      title('🔴', 'DOWN', name),
      link(url),
      `💥 ${escapeHtml(reason)}`,
      `🕒 ${escapeHtml(formatUtc(now))}`,
    ].join('\n'),
  };
}

export function upMessage(
  name: string,
  url: string | null,
  downSince: string | null,
  now: Date,
): Message {
  const lines = [title('🟢', 'UP', name)];
  if (url) lines.push(link(url));
  lines.push(`⏱ downtime: ${escapeHtml(downtime(downSince, now))}`);
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
      title('🟡', 'still down', name),
      link(url),
      `💥 ${escapeHtml(reason)}`,
      `⏱ down for: ${escapeHtml(downtime(downSince, now))}`,
    ].join('\n'),
  };
}

export function summaryMessage(results: CheckResult[]): Message {
  const n = results.length;
  const down = results.filter((r) => !r.ok);
  if (down.length === 0) {
    return {
      kind: 'summary',
      text: `✨ <b>Daily summary</b>\n✅ all ${n} up`,
    };
  }
  const lines = [
    `✨ <b>Daily summary</b>`,
    `🔴 ${down.length} of ${n} down`,
    ...down.map(
      (r) =>
        `• <code>${escapeHtml(r.name)}</code> — ${escapeHtml(r.reason ?? 'unknown')}`,
    ),
  ];
  return { kind: 'summary', text: lines.join('\n') };
}
