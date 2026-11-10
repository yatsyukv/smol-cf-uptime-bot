import { describe, expect, it } from 'vitest';
import { parseChecks } from '../src/checks.ts';
import { REMINDER_MS } from '../src/constants.ts';
import { canonical, parseState, stateToSave } from '../src/persist.ts';
import { step } from '../src/step.ts';
import { zonedParts } from '../src/time.ts';
import type { CheckResult, State } from '../src/types.ts';

const T0 = new Date('2026-01-15T12:00:00.000Z');
const TODAY = zonedParts(T0, 'UTC').date;

const API = 'https://api.example.com/healthz';
const WEB = 'https://www.example.com/healthz';

function empty(): State {
  return { lastSummaryDate: TODAY };
}

function fail(
  name = 'api',
  reason = 'HTTP 500',
  url = API,
): CheckResult {
  return { name, url, ok: false, reason };
}

function pass(name = 'api', url = API): CheckResult {
  return { name, url, ok: true };
}

function kinds(messages: { kind: string }[]): string[] {
  return messages.map((m) => m.kind);
}

describe('zoned clock', () => {
  it('maps 09:00 UTC as 09:00 in UTC', () => {
    expect(zonedParts(new Date('2026-01-15T09:00:00.000Z'), 'UTC')).toEqual({
      date: '2026-01-15',
      hour: 9,
      minute: 0,
    });
  });

  it('maps 07:00 UTC in winter to 09:00 Europe/Kyiv', () => {
    expect(
      zonedParts(new Date('2026-01-15T07:00:00.000Z'), 'Europe/Kyiv'),
    ).toEqual({ date: '2026-01-15', hour: 9, minute: 0 });
  });

  it('maps 06:00 UTC in summer to 09:00 Europe/Kyiv', () => {
    expect(
      zonedParts(new Date('2026-07-15T06:00:00.000Z'), 'Europe/Kyiv'),
    ).toEqual({ date: '2026-07-15', hour: 9, minute: 0 });
  });
});

describe('parseChecks', () => {
  it('reads a name/url list', () => {
    expect(
      parseChecks(
        JSON.stringify([
          { name: 'api', url: 'https://api.example.com/healthz' },
          { name: 'web', url: 'http://localhost:3000/healthz' },
        ]),
      ),
    ).toHaveLength(2);
  });

  it('rejects empty, reserved, and bad urls', () => {
    expect(() => parseChecks('[]')).toThrow(/non-empty/);
    expect(() =>
      parseChecks(JSON.stringify([{ name: 'lastSummaryDate', url: 'https://x' }])),
    ).toThrow(/reserved/);
    expect(() =>
      parseChecks(JSON.stringify([{ name: 'api', url: 'ftp://x' }])),
    ).toThrow(/http/);
  });
});

describe('step', () => {
  it('1 fail then success is silent and cleans state', () => {
    const first = step(empty(), [fail()], T0);
    const { state, messages } = step(
      first.state,
      [pass()],
      new Date(T0.getTime() + 60_000),
    );
    expect(messages).toEqual([]);
    expect(state.api).toBeUndefined();
  });

  it('fails are per check', () => {
    const t1 = new Date(T0.getTime() + 60_000);
    const first = step(empty(), [fail('api'), pass('web', WEB)], T0);
    const { state, messages } = step(
      first.state,
      [fail('api', 'timeout'), pass('web', WEB)],
      t1,
    );
    expect(messages.map((m) => [m.kind, m.name])).toEqual([['down', 'api']]);
    expect(state.web).toBeUndefined();
    expect(messages[0]?.text).toContain('reason: timeout');
  });

  it('1 fail → nothing', () => {
    const { state, messages } = step(empty(), [fail()], T0);
    expect(messages).toEqual([]);
    expect(state.api).toEqual({
      status: 'up',
      fails: 1,
      downSince: null,
      lastAlertAt: null,
    });
  });

  it('2 fails → DOWN', () => {
    const first = step(empty(), [fail('api', 'HTTP 500')], T0);
    const t1 = new Date(T0.getTime() + 60_000);
    const { state, messages } = step(first.state, [fail('api', 'HTTP 404')], t1);

    expect(kinds(messages)).toEqual(['down']);
    expect(messages[0]?.text).toContain('DOWN: api');
    expect(messages[0]?.text).toContain(API);
    expect(messages[0]?.text).toContain('reason: HTTP 404');
    expect(messages[0]?.text).toContain('2026-01-15 12:01:00 UTC');
    expect(state.api).toEqual({
      status: 'down',
      fails: 2,
      downSince: t1.toISOString(),
      lastAlertAt: t1.toISOString(),
    });
  });

  it('down 30 min → reminder', () => {
    const downAt = T0;
    const downState: State = {
      lastSummaryDate: TODAY,
      api: {
        status: 'down',
        fails: 2,
        downSince: downAt.toISOString(),
        lastAlertAt: downAt.toISOString(),
      },
    };

    const before = new Date(downAt.getTime() + REMINDER_MS - 1);
    const early = step(downState, [fail('api', 'timeout')], before);
    expect(kinds(early.messages)).toEqual([]);
    expect(canonical(early.state)).toBe(canonical(downState));

    const at30 = new Date(downAt.getTime() + REMINDER_MS);
    const { state, messages } = step(
      downState,
      [fail('api', 'timeout')],
      at30,
    );
    expect(kinds(messages)).toEqual(['reminder']);
    expect(messages[0]?.text).toContain('still down: api');
    expect(messages[0]?.text).toContain('reason: timeout');
    expect(messages[0]?.text).toContain('down for: 30m');
    expect(state.api).toMatchObject({
      status: 'down',
      lastAlertAt: at30.toISOString(),
    });
  });

  it('recovery → UP with duration', () => {
    const downAt = T0;
    const downState: State = {
      lastSummaryDate: TODAY,
      api: {
        status: 'down',
        fails: 2,
        downSince: downAt.toISOString(),
        lastAlertAt: downAt.toISOString(),
      },
    };
    const upAt = new Date(downAt.getTime() + 2 * 60 * 1000);
    const { state, messages } = step(downState, [pass()], upAt);

    expect(kinds(messages)).toEqual(['up']);
    expect(messages[0]?.text).toContain('UP: api');
    expect(messages[0]?.text).toContain('downtime: 2m');
    expect(state.api).toBeUndefined();
    expect(canonical(state)).toBe(canonical(empty()));
  });

  it('summary once a day', () => {
    const before9 = new Date('2026-01-15T08:59:00.000Z');
    const at9 = new Date('2026-01-15T09:00:00.000Z');
    const later = new Date('2026-01-15T12:00:00.000Z');
    const nextMorning = new Date('2026-01-16T09:00:00.000Z');
    const results = [pass('api'), pass('web', WEB), pass('core')];

    const tooEarly = step({ lastSummaryDate: null }, results, before9);
    expect(kinds(tooEarly.messages)).toEqual([]);
    expect(tooEarly.state.lastSummaryDate).toBeNull();

    const first = step({ lastSummaryDate: null }, results, at9);
    expect(kinds(first.messages)).toEqual(['summary']);
    expect(first.messages[0]?.text).toBe('daily summary: all 3 up');
    expect(first.state.lastSummaryDate).toBe('2026-01-15');

    const again = step(first.state, results, later);
    expect(kinds(again.messages)).toEqual([]);
    expect(again.state.lastSummaryDate).toBe('2026-01-15');

    const nextDay = step(first.state, results, nextMorning);
    expect(kinds(nextDay.messages)).toEqual(['summary']);
    expect(nextDay.state.lastSummaryDate).toBe('2026-01-16');
  });

  it('summary timezone is configurable', () => {
    const at9Kyiv = new Date('2026-01-15T07:00:00.000Z');
    const { messages } = step(
      { lastSummaryDate: null },
      [pass('api')],
      at9Kyiv,
      { tz: 'Europe/Kyiv', summaryHour: 9 },
    );
    expect(kinds(messages)).toEqual(['summary']);
  });

  it('summary lists what is down', () => {
    const at9 = new Date('2026-01-15T09:00:00.000Z');
    const { messages } = step(
      { lastSummaryDate: null },
      [pass('api'), fail('web', 'HTTP 404', WEB), pass('core')],
      at9,
    );
    expect(kinds(messages)).toEqual(['summary']);
    expect(messages[0]?.text).toContain('1 of 3 down');
    expect(messages[0]?.text).toContain('web — HTTP 404');
  });

  it('failed send → retried', () => {
    const first = step(empty(), [fail()], T0);
    const t1 = new Date(T0.getTime() + 60_000);
    const attempt = step(first.state, [fail('api', 'network error')], t1);

    expect(kinds(attempt.messages)).toEqual(['down']);
    expect(stateToSave(first.state, attempt.state, false)).toBeNull();

    const retry = step(first.state, [fail('api', 'network error')], t1);
    expect(kinds(retry.messages)).toEqual(['down']);
    expect(retry.messages[0]?.text).toContain('reason: network error');

    const saved = stateToSave(first.state, attempt.state, true);
    expect(saved).not.toBeNull();
    const afterSave = step(saved!, [fail('api', 'network error')], t1);
    expect(kinds(afterSave.messages)).toEqual([]);
  });

  it('removing a down check sends UP and leaves state clean', () => {
    const downState: State = {
      lastSummaryDate: TODAY,
      broken: {
        status: 'down',
        fails: 2,
        downSince: T0.toISOString(),
        lastAlertAt: T0.toISOString(),
      },
    };
    const { state, messages } = step(downState, [pass('api')], T0);
    expect(kinds(messages)).toEqual(['up']);
    expect(messages[0]?.name).toBe('broken');
    expect(state.broken).toBeUndefined();
    expect(state.api).toBeUndefined();
  });

  it('does not write KV when nothing changed', () => {
    const { state, messages } = step(empty(), [pass()], T0);
    expect(messages).toEqual([]);
    expect(stateToSave(empty(), state, true)).toBeNull();
  });
});

describe('parseState', () => {
  it('returns empty state for junk', () => {
    expect(parseState(null)).toEqual({ lastSummaryDate: null });
    expect(parseState('nope')).toEqual({ lastSummaryDate: null });
  });
});
