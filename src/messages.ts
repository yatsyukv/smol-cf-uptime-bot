import { isCheckState } from './persist.ts';
import { downtime, formatUtc } from './time.ts';
import type { Check, CheckResult, Message, State } from './types.ts';

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

export function summaryMessage(results: CheckResult[], now: Date): Message {
  const n = results.length;
  const down = results.filter((r) => !r.ok);
  const stamp = `🕒 last check: ${escapeHtml(formatUtc(now))}`;
  if (down.length === 0) {
    return {
      kind: 'summary',
      text: `✨ <b>Daily summary</b>\n✅ all ${n} up\n${stamp}`,
    };
  }
  const lines = [
    `✨ <b>Daily summary</b>`,
    `🔴 ${down.length} of ${n} down`,
    ...down.map(
      (r) =>
        `• <code>${escapeHtml(r.name)}</code> — ${escapeHtml(r.reason ?? 'unknown')}`,
    ),
    stamp,
  ];
  return { kind: 'summary', text: lines.join('\n') };
}

export function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, '');
}

export function statusMessage(
  state: State,
  checks: Check[],
  now: Date,
): string {
  const last = state.lastRunAt;
  const ago = last ? downtime(last, now) : null;
  const lines = [
    `💓 <b>status</b>`,
    last
      ? `🕒 last check: ${escapeHtml(ago ?? '0s')} ago (${escapeHtml(formatUtc(new Date(last)))})`
      : '🕒 last check: never',
  ];
  if (checks.length === 0) {
    lines.push('• no checks configured');
  }
  for (const check of checks) {
    const value = state[check.name];
    const st = isCheckState(value)
      ? value
      : { status: 'up' as const, fails: 0, downSince: null, lastAlertAt: null };
    if (st.status === 'down') {
      lines.push(
        `🔴 <code>${escapeHtml(check.name)}</code> — down ${escapeHtml(downtime(st.downSince, now))}`,
      );
    } else if (st.fails > 0) {
      lines.push(
        `🟡 <code>${escapeHtml(check.name)}</code> — ${st.fails} fail(s)`,
      );
    } else {
      lines.push(`✅ <code>${escapeHtml(check.name)}</code>`);
    }
  }
  return lines.join('\n');
}
