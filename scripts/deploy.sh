#!/usr/bin/env bash
set -euo pipefail
set +x

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT
# shellcheck disable=SC1091
source "${ROOT}/scripts/lib.sh"
load_env
require CLOUDFLARE_API_TOKEN
require TELEGRAM_BOT_TOKEN
require TELEGRAM_CHAT_ID

if [[ ! -f "${CHECKS_FILE}" ]]; then
  echo "Missing ${CHECKS_FILE}" >&2
  echo "Run npm run setup, or copy checks.example.json to checks.json and edit it." >&2
  exit 1
fi

CHECKS_FILE="${CHECKS_FILE}" node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const raw = readFileSync(process.env.CHECKS_FILE, "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data) || data.length === 0) {
    console.error("checks.json must be a non-empty [{ name, url }, ...] list");
    process.exit(1);
  }
  for (const [i, item] of data.entries()) {
    if (!item || typeof item.name !== "string" || !item.name.trim()) {
      console.error(`checks.json[${i}] needs a name`);
      process.exit(1);
    }
    if (item.name === "lastSummaryDate" || item.name === "lastRunAt") {
      console.error(`check name ${item.name} is reserved`);
      process.exit(1);
    }
    if (typeof item.url !== "string" || !/^https?:\/\//i.test(item.url)) {
      console.error(`checks.json[${i}] (${item.name}) needs an http(s) url`);
      process.exit(1);
    }
    if (item.everyMinutes !== undefined) {
      const n = typeof item.everyMinutes === "string" ? Number(item.everyMinutes) : item.everyMinutes;
      if (!Number.isInteger(n) || n < 1) {
        console.error(`checks.json[${i}] (${item.name}) everyMinutes must be an integer >= 1`);
        process.exit(1);
      }
    }
  }
  console.error(`Using ${data.length} check(s)`);
'

tg_token="${TELEGRAM_BOT_TOKEN}"
tg_chat="${TELEGRAM_CHAT_ID}"
export CLOUDFLARE_API_TOKEN

cd "${ROOT}"

if [[ ! -d node_modules ]]; then
  npm install
fi

npx vitest run

worker_name="${WORKER_NAME:-smol-cf-uptime}"
title="${worker_name}-state"
id="${CLOUDFLARE_KV_NAMESPACE_ID:-}"
if [[ "${id}" == "00000000000000000000000000000000" ]]; then
  id=""
fi

if [[ -z "${id}" ]]; then
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
fi

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

export CLOUDFLARE_KV_NAMESPACE_ID="${id}"
export WORKER_NAME="${worker_name}"
export SUMMARY_TZ="${SUMMARY_TZ:-UTC}"
export SUMMARY_HOUR="${SUMMARY_HOUR:-9}"
export TELEGRAM_BOT_TOKEN="${tg_token}"
export TELEGRAM_CHAT_ID="${tg_chat}"
export CHECKS_FILE
export DEPLOY_CONFIG
export ENV_FILE
node "${ROOT}/scripts/write-env.mjs"
node "${ROOT}/scripts/build-wrangler.mjs"

unset TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID

echo "Using KV namespace ${title}"

npx wrangler deploy -c "${DEPLOY_CONFIG}"

printf '%s' "${tg_token}" | npx wrangler secret put TELEGRAM_BOT_TOKEN -c "${DEPLOY_CONFIG}" >/dev/null
printf '%s' "${tg_chat}" | npx wrangler secret put TELEGRAM_CHAT_ID -c "${DEPLOY_CONFIG}" >/dev/null

echo "Deployed ${worker_name}."
echo "Watch cron with: npx wrangler tail -c .wrangler-deploy.jsonc"
echo "Ping the group with: npm run test-message"
