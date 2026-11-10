import { CHECKS } from './checks.ts';
import { STATE_KEY } from './constants.ts';
import { canonical, parseState, stateToSave } from './persist.ts';
import { probe } from './probe.ts';
import { step } from './step.ts';
import { sendTelegram } from './telegram.ts';

export interface Env {
  STATE: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
  ): Promise<void> {
    const now = new Date();
    const prev = parseState(await env.STATE.get(STATE_KEY));
    const results = await Promise.all(CHECKS.map((check) => probe(check)));
    const { state: next, messages } = step(prev, results, now);

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
