# smol-cf-uptime-bot

Cron-only Cloudflare Worker: ping HTTPS health endpoints every minute, Telegram the group when something is down. The public repo has no site-specific hostnames.

A check is **up** when it returns HTTP 200 within 10 seconds. Checks run in parallel.

## Setup

```bash
git clone https://github.com/yatsyukv/smol-cf-uptime-bot.git
cd smol-cf-uptime-bot
npm install
npm run setup
```

The wizard asks for, in order:

1. **Cloudflare API token** (Workers Scripts Edit + Workers KV Storage Edit)
2. **Telegram bot token** (BotFather), then **chat id** (add the bot to the group, send `/start`, the wizard can call `getUpdates`)
3. **Hostnames** — one name + URL per check (blank name to finish)
4. Deploy the Worker

That writes gitignored `.env` and `checks.json`, then `wrangler deploy`.

Non-interactive:

```bash
cp .env.example .env          # fill tokens
cp checks.example.json checks.json   # fill your URLs
npm run deploy
```

## Hostnames

`checks.json` is the source of truth and is gitignored, so clones of this public repo stay generic:

```json
[
  { "name": "api", "url": "https://api.example.com/healthz" },
  { "name": "web", "url": "https://www.example.com/healthz" }
]
```

Add or remove a line, then `npm run deploy`. Deploy uploads the list as the Worker var `CHECKS_JSON` (atomic with the script, not committed). Telegram tokens stay Worker secrets (`wrangler secret put` from stdin).

## Alerts

One Telegram chat receives:

- **DOWN** after 2 failed runs in a row (name, URL, reason, UTC time)
- a **reminder** every 30 minutes while still down
- **UP** on the first success after DOWN, with downtime length
- a **daily summary** on the first run at or after 09:00 in `SUMMARY_TZ` (default UTC)

If Telegram send fails, the run does not mark the alert as sent, so the next minute retries. KV is written only when state actually changes (free plan: 1000 writes/day).

## Secrets

Never commit these. Never print them.

| Name | Where | Used for |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | `.env` | `wrangler deploy` |
| `TELEGRAM_BOT_TOKEN` | `.env` and Worker secret | Telegram Bot API |
| `TELEGRAM_CHAT_ID` | `.env` and Worker secret | target chat |
| `CLOUDFLARE_ACCOUNT_ID` | optional, `.env` | only if the token can see more than one account |

The worker has no public route (`workers_dev = false`); cron `* * * * *` is the only trigger. After deploy:

```bash
npm run test-message
npx wrangler tail -c .wrangler-deploy.jsonc
```

## Tests

```bash
npm test
```

Vitest covers `step()`: one fail is silent, two fails send DOWN, a 30-minute outage sends a reminder, recovery sends UP with duration, the daily summary fires once, and a failed send is retried.
