#!/usr/bin/env bash
set -euo pipefail
set +x

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT
# shellcheck disable=SC1091
source "${ROOT}/scripts/lib.sh"

if [[ ! -t 0 ]]; then
  echo "No TTY. Fill .env and checks.json, then run npm run deploy." >&2
  exec "${ROOT}/scripts/deploy.sh"
fi

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
  echo "Loaded existing ${ENV_FILE}"
fi

prompt() {
  local __var="$1"
  local __label="$2"
  local __default="${3:-}"
  local __val=""
  if [[ -n "${__default}" ]]; then
    read -r -p "${__label} [${__default}]: " __val || true
    __val="${__val:-$__default}"
  else
    read -r -p "${__label}: " __val || true
  fi
  printf -v "${__var}" '%s' "${__val}"
}

prompt_secret() {
  local __var="$1"
  local __label="$2"
  local __current="${!__var:-}"
  local __val=""
  if [[ -n "${__current}" ]]; then
    echo "${__label}: already set"
    return
  fi
  read -r -s -p "${__label}: " __val
  echo
  if [[ -z "${__val}" ]]; then
    echo "This value is required." >&2
    exit 1
  fi
  printf -v "${__var}" '%s' "${__val}"
}

echo "Cloudflare + Telegram keys"
prompt_secret CLOUDFLARE_API_TOKEN "Cloudflare API token"
prompt_secret TELEGRAM_BOT_TOKEN "Telegram bot token"

if [[ -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "Add the bot to the Telegram group and send /start in that group."
  if yes_no "Look up chat id via getUpdates now? [Y/n]" Y; then
    export TELEGRAM_BOT_TOKEN
    if ! "${ROOT}/scripts/get-chat-id.sh"; then
      echo "No chats yet. Send /start in the group and rerun npm run setup." >&2
    fi
  fi
  prompt TELEGRAM_CHAT_ID "Telegram chat id"
fi
if [[ -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "TELEGRAM_CHAT_ID is required." >&2
  exit 1
fi

prompt WORKER_NAME "Worker name" "${WORKER_NAME:-smol-cf-uptime}"
prompt SUMMARY_TZ "Daily summary timezone" "${SUMMARY_TZ:-UTC}"
prompt SUMMARY_HOUR "Daily summary hour (0-23 in that timezone)" "${SUMMARY_HOUR:-9}"

keep_checks=false
if [[ -f "${CHECKS_FILE}" ]]; then
  echo "Existing ${CHECKS_FILE}:"
  cat "${CHECKS_FILE}"
  if yes_no "Keep these checks? [Y/n]" Y; then
    keep_checks=true
  fi
fi

if [[ "${keep_checks}" != true ]]; then
  echo "HTTP checks (blank name to finish). A check is up on HTTP 200 within 10s."
  tmp="$(mktemp)"
  echo '[]' > "${tmp}"
  while true; do
    name=""
    url=""
    read -r -p "  name: " name || true
    if [[ -z "${name}" ]]; then
      break
    fi
    read -r -p "  url:  " url || true
    NAME="${name}" URL="${url}" FILE="${tmp}" node --input-type=module -e '
      import { readFileSync, writeFileSync } from "node:fs";
      const name = process.env.NAME;
      const url = process.env.URL;
      if (!name || !url || !/^https?:\/\//i.test(url)) {
        console.error("  skip: need a name and an http(s) url");
        process.exit(0);
      }
      if (name === "lastSummaryDate") {
        console.error("  skip: lastSummaryDate is reserved");
        process.exit(0);
      }
      const checks = JSON.parse(readFileSync(process.env.FILE, "utf8"));
      if (checks.some((c) => c.name === name)) {
        console.error("  skip: duplicate name");
        process.exit(0);
      }
      checks.push({ name, url });
      writeFileSync(process.env.FILE, JSON.stringify(checks, null, 2) + "\n");
    '
  done
  count="$(FILE="${tmp}" node --input-type=module -e '
    import { readFileSync } from "node:fs";
    const checks = JSON.parse(readFileSync(process.env.FILE, "utf8"));
    process.stdout.write(String(checks.length));
  ')"
  if [[ "${count}" -eq 0 ]]; then
    rm -f "${tmp}"
    echo "Need at least one check." >&2
    exit 1
  fi
  mv "${tmp}" "${CHECKS_FILE}"
fi

export CLOUDFLARE_API_TOKEN TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID
export CLOUDFLARE_ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-}"
export CLOUDFLARE_KV_NAMESPACE_ID="${CLOUDFLARE_KV_NAMESPACE_ID:-}"
export WORKER_NAME SUMMARY_TZ SUMMARY_HOUR ENV_FILE
node "${ROOT}/scripts/write-env.mjs"
echo "Wrote ${ENV_FILE} and ${CHECKS_FILE} (gitignored)."

if yes_no "Deploy the Worker to Cloudflare now? [Y/n]" Y; then
  exec "${ROOT}/scripts/deploy.sh"
fi

echo "Later: npm run deploy"
