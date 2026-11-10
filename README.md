# WinWin uptime monitor

Cloudflare Worker that pings WinWin health endpoints every minute and sends Telegram alerts when something is down. It runs on Cloudflare, not on the production Hetzner/Dokploy host.

A check is up when it returns HTTP 200 within 10 seconds. Checks run in parallel.

## Alerts

One Telegram group receives:

- **DOWN** after 2 failed runs in a row (name, URL, reason, UTC time)
- a **reminder** every 30 minutes while still down
- **UP** on the first success after DOWN, with downtime length
- a **daily summary** on the first run at or after 09:00 Europe/Kyiv (`all N up`, or a list of what is down)

If Telegram send fails, the run does not mark the alert as sent, so the next minute retries. KV is written only when state actually changes (free plan: 1000 writes/day).

## Add a project

One line in `src/checks.ts`:

```ts
export const CHECKS: Check[] = [
  { name: 'events', url: 'https://events.winwin.education/healthz' },
  { name: 'website', url: 'https://www.winwin.education/healthz' },
  { name: 'core', url: 'https://api.winwin.education/healthz' },
  { name: 'new-service', url: 'https://new.winwin.education/healthz' },
];
```

Then `npm run deploy`.

## Secrets

Never commit these. Never print them.

| Name | Where | Used for |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | `~/.config/winwin-uptime.env` | `wrangler deploy` (Workers Scripts Edit + Workers KV Storage Edit) |
| `TELEGRAM_BOT_TOKEN` | same file, and Worker secret | Telegram Bot API |
| `TELEGRAM_CHAT_ID` | same file, and Worker secret | target group |
| `CLOUDFLARE_ACCOUNT_ID` | optional, same file | only if the token can see more than one account |

Create a BotFather bot, add it to the group, send `/start` in the group, then:

```bash
cp winwin-uptime.env.example ~/.config/winwin-uptime.env
# fill CLOUDFLARE_API_TOKEN and TELEGRAM_BOT_TOKEN
npm run chat-id
# write TELEGRAM_CHAT_ID into the env file
```

`scripts/deploy.sh` sets Worker secrets with `wrangler secret put` from stdin (not argv).

## Deploy

```bash
npm install
npm test
npm run deploy
npm run test-message
set -a && source ~/.config/winwin-uptime.env && set +a
npx wrangler tail
```

Requires `~/.config/winwin-uptime.env`. The first deploy creates a KV namespace and writes its id into `wrangler.jsonc` (not a secret; commit it). The worker has no public route (`workers_dev = false`); cron `* * * * *` is the only trigger.

To confirm a DOWN/UP cycle, temporarily add a line for `https://www.winwin.education/healthz-broken` (404), deploy, wait ~2 minutes, then remove the line and deploy again.

## Tests

```bash
npm test
```

Vitest covers `step()`: one fail is silent, two fails send DOWN, a 30-minute outage sends a reminder, recovery sends UP with duration, the daily summary fires once, and a failed send is retried.
