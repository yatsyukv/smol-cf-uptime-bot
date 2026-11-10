#!/usr/bin/env bash
set -euo pipefail
set +x

root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "${root}/scripts/lib.sh"
load_env
require CLOUDFLARE_API_TOKEN
require TELEGRAM_BOT_TOKEN
require TELEGRAM_CHAT_ID

# Keep Telegram values off wrangler's environment.
tg_token="${TELEGRAM_BOT_TOKEN}"
tg_chat="${TELEGRAM_CHAT_ID}"
unset TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID
export CLOUDFLARE_API_TOKEN

cd "${root}"

if [[ ! -d node_modules ]]; then
  npm install
fi

npx vitest run

title="winwin-uptime-state"

list_out="$(npx wrangler kv namespace list 2>/dev/null || true)"
id="$(
  LIST_OUT="${list_out}" TITLE="${title}" node --input-type=module -e '
    const text = process.env.LIST_OUT ?? "";
    const start = text.search(/[\[{]/);
    let id = "";
    if (start !== -1) {
      const parsed = JSON.parse(text.slice(start));
      const rows = Array.isArray(parsed) ? parsed : (parsed.namespaces ?? parsed.result ?? []);
      const hit = rows.find((n) => n && n.title === process.env.TITLE);
      if (hit?.id) id = hit.id;
    }
    process.stdout.write(id);
  '
)"

if [[ -z "${id}" ]]; then
  create_out="$(npx wrangler kv namespace create "${title}")"
  id="$(
    CREATE_OUT="${create_out}" node --input-type=module -e '
      const text = process.env.CREATE_OUT ?? "";
      const m = text.match(/id\s*=\s*"([0-9a-f]{32})"/i) || text.match(/"id"\s*:\s*"([0-9a-f]{32})"/i);
      if (!m) {
        console.error("Could not parse KV namespace id from wrangler output");
        process.exit(1);
      }
      process.stdout.write(m[1]);
    '
  )"
fi

NEW_ID="${id}" node --input-type=module -e '
  import { readFileSync, writeFileSync } from "node:fs";
  const path = "wrangler.jsonc";
  const cfg = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(cfg.kv_namespaces) || !cfg.kv_namespaces[0]) {
    console.error("wrangler.jsonc is missing kv_namespaces[0]");
    process.exit(1);
  }
  cfg.kv_namespaces[0].id = process.env.NEW_ID;
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
'

echo "Using KV namespace ${title}"

npx wrangler deploy

printf '%s' "${tg_token}" | npx wrangler secret put TELEGRAM_BOT_TOKEN >/dev/null
printf '%s' "${tg_chat}" | npx wrangler secret put TELEGRAM_CHAT_ID >/dev/null

echo "Deployed winwin-uptime. Secrets updated."
echo "If wrangler.jsonc changed (KV id), commit it."
echo "Watch cron with: npx wrangler tail"
echo "Ping the group with: npm run test-message"
