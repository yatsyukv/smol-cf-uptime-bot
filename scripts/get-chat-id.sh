#!/usr/bin/env bash
set -euo pipefail
set +x

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT
# shellcheck disable=SC1091
source "${ROOT}/scripts/lib.sh"

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" ]]; then
  load_env
  require TELEGRAM_BOT_TOKEN
fi

api() {
  local method="$1"
  shift
  curl -sS -o "${tmp}" -w '%{http_code}' \
    "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}" "$@"
}

tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

code="$(api getWebhookInfo)"
if [[ "${code}" == "200" ]]; then
  webhook="$(OK_FILE="${tmp}" node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const data = JSON.parse(readFileSync(process.env.OK_FILE, "utf8"));
    process.stdout.write(data.result?.url || "");
  ')"
  if [[ -n "${webhook}" ]]; then
    echo "This bot has a webhook, so getUpdates stays empty. Clearing it." >&2
    api deleteWebhook >/dev/null || true
  fi
fi

code="$(curl -sS -o "${tmp}" -w '%{http_code}' -G \
  --data-urlencode 'allowed_updates=["message","edited_message","my_chat_member","chat_member"]' \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates")"

if [[ "${code}" != "200" ]]; then
  echo "getUpdates failed (HTTP ${code})" >&2
  if [[ "${code}" == "409" ]]; then
    echo "A webhook is still set. Re-run after it is cleared." >&2
  fi
  exit 1
fi

UPDATES_FILE="${tmp}" node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const data = JSON.parse(readFileSync(process.env.UPDATES_FILE, "utf8"));
  if (!data.ok) {
    console.error("Telegram getUpdates returned ok=false");
    process.exit(1);
  }
  const chats = new Map();
  for (const update of data.result ?? []) {
    const chat =
      update.message?.chat ||
      update.channel_post?.chat ||
      update.my_chat_member?.chat ||
      update.chat_member?.chat ||
      update.edited_message?.chat;
    if (!chat) continue;
    const label = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || "";
    chats.set(String(chat.id), `${chat.id}\t${chat.type}\t${label}`);
  }
  if (chats.size === 0) {
    console.log(`No chats in getUpdates.

Do not share the group with another bot (Telegram will say there is nothing to share).

In BotFather: /setprivacy → Disable for this bot.
In the group: make the bot an admin, then send exactly:
  /start@YourBotUsername
Immediately run: npm run chat-id

Use the negative chat_id (groups look like -100…).`);
    process.exit(2);
  }
  console.log("chat_id\ttype\tname");
  for (const line of chats.values()) console.log(line);
'
