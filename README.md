# smol-cf-uptime-bot

Ping your HTTPS health endpoints from a Cloudflare Worker and get Telegram alerts when something is down. Nothing site-specific is committed; you configure hosts locally.

A host is **up** if it returns HTTP 200 within 10 seconds. The Worker runs every 5 minutes.

## Use

```bash
git clone https://github.com/yatsyukv/smol-cf-uptime-bot.git
cd smol-cf-uptime-bot
npm install
npm run setup
```

The wizard asks for:

1. **Cloudflare API token** — Workers Scripts Edit + Workers KV Storage Edit
2. **Telegram bot token** (BotFather) and **chat id** — see below
3. **Each hostname** — name, URL, and how often to check (minutes, default 5)
4. Deploy

That writes gitignored `.env` and `checks.json`, then deploys the Worker.

## Chat id

Do not forward or share the group to another “get id” bot. Telegram will say there is nothing to share.

1. Add **your** bot to the group and make it an admin.
2. In BotFather: `/setprivacy` → **Disable** for that bot.
3. In the group send `/start@YourBotUsername` (one command).
4. Put the bot token in `.env` as `TELEGRAM_BOT_TOKEN` and run:

```bash
npm run chat-id
```

Use the **negative** `chat_id` (groups look like `-100…`). If the table is empty, send `/start@YourBotUsername` again and rerun immediately — opening `getUpdates` in a browser first consumes the events.

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

Telegram gets **DOWN** after 2 failed probes, a reminder every 30 minutes while down, **UP** with downtime, and a daily summary at 09:00 (`SUMMARY_TZ`, default UTC). Messages use emoji + bold HTML.
