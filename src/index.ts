import { parseChecks } from './checks.ts';
import { DEFAULT_SUMMARY_HOUR, DEFAULT_SUMMARY_TZ, STATE_KEY } from './constants.ts';
import { canonical, parseState, stateToSave } from './persist.ts';
import { probe } from './probe.ts';
import { step } from './step.ts';
import { sendTelegram } from './telegram.ts';

export interface Env {
  STATE: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  CHECKS_JSON: string;
  SUMMARY_TZ: string;
  SUMMARY_HOUR: string;
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
  ): Promise<void> {
    const now = new Date();
    const checks = parseChecks(env.CHECKS_JSON);
    const prev = parseState(await env.STATE.get(STATE_KEY));
    const results = await Promise.all(checks.map((check) => probe(check)));
    const hour = Number(env.SUMMARY_HOUR);
    const { state: next, messages } = step(prev, results, now, {
      tz: env.SUMMARY_TZ || DEFAULT_SUMMARY_TZ,
      summaryHour: Number.isFinite(hour) ? hour : DEFAULT_SUMMARY_HOUR,
    });

    let sendOk = true;
    for (const message of messages) {
      sendOk = (await sendTelegram(
        env.TELEGRAM_BOT_TOKEN,
        env.TELEGRAM_CHAT_ID,
        message.text,
      )) && sendOk;
      if (!sendOk) break;
    }

    const toSave = stateToSave(prev, next, sendOk);
    if (toSave) await env.STATE.put(STATE_KEY, canonical(toSave));
  },
} satisfies ExportedHandler<Env>;
