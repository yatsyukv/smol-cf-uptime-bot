# smol-cf-uptime-bot

Ping your HTTPS health endpoints from a Cloudflare Worker and get Telegram alerts when something is down. Nothing site-specific is committed; you configure hosts locally.

A host is **up** if it returns HTTP 200 within 10 seconds.

## Use

```bash
git clone https://github.com/yatsyukv/smol-cf-uptime-bot.git
cd smol-cf-uptime-bot
npm install
npm run setup
```

The wizard asks for:

1. **Cloudflare API token** — Workers Scripts Edit + Workers KV Storage Edit
2. **Telegram bot token** (BotFather) and **chat id** — add the bot to the group, send `/start`; the wizard can look the id up
3. **Each hostname** — name, URL, and how often to check (minutes, default 5)
4. Deploy

That writes gitignored `.env` and `checks.json`, then deploys the Worker.

## Add a check

```bash
npm run add-check
```

That appends to `checks.json` (name, URL, interval) and can deploy. Or add a line yourself and `npm run deploy`:

```json
[
  { "name": "api", "url": "https://api.example.com/healthz", "everyMinutes": 5 },
  { "name": "web", "url": "https://www.example.com/healthz", "everyMinutes": 1 }
]
```

Or skip the wizard:

```bash
cp .env.example .env && cp checks.example.json checks.json
# fill tokens and URLs, then:
npm run deploy
```

After deploy: `npm run test-message` to ping the group, `npx wrangler tail -c .wrangler-deploy.jsonc` to watch cron.

## Alerts

Telegram gets **DOWN** after 2 failed probes, a reminder every 30 minutes while down, **UP** with downtime, and a daily summary at 09:00 (`SUMMARY_TZ`, default UTC).
