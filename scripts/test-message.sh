#!/usr/bin/env bash
set -euo pipefail
set +x

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT
# shellcheck disable=SC1091
source "${ROOT}/scripts/lib.sh"
load_env
require TELEGRAM_BOT_TOKEN
require TELEGRAM_CHAT_ID

tmp="$(mktemp)"
trap 'rm -f "${tmp}"' EXIT

code="$(curl -sS -o "${tmp}" -w '%{http_code}' \
  -H 'content-type: application/json' \
  -d "$(TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID}" node --input-type=module -e '
    process.stdout.write(JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: "uptime monitor: test message. Cron is armed for every minute.",
      disable_web_page_preview: true,
    }));
  ')" \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage")"

ok="$(OK_FILE="${tmp}" node --input-type=module -e '
  import { readFileSync } from "node:fs";
  try {
    const data = JSON.parse(readFileSync(process.env.OK_FILE, "utf8"));
    process.stdout.write(data.ok === true ? "true" : "false");
  } catch {
    process.stdout.write("false");
  }
')"

if [[ "${code}" != "200" || "${ok}" != "true" ]]; then
  echo "Telegram send failed (HTTP ${code})" >&2
  exit 1
fi

echo "Test message sent."
