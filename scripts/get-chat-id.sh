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

tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

code="$(curl -sS -o "${tmp}" -w '%{http_code}' \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates")"

if [[ "${code}" != "200" ]]; then
  echo "getUpdates failed (HTTP ${code})" >&2
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
      update.edited_message?.chat;
    if (!chat) continue;
    const label = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(" ") || chat.username || "";
    chats.set(String(chat.id), `${chat.id}\t${chat.type}\t${label}`);
  }
  if (chats.size === 0) {
    console.log("No chats yet. Add the bot to the group, send /start in the group, then rerun npm run chat-id.");
    process.exit(2);
  }
  console.log("chat_id\ttype\tname");
  for (const line of chats.values()) console.log(line);
'
