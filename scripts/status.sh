#!/usr/bin/env bash
set -euo pipefail
set +x

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT
# shellcheck disable=SC1091
source "${ROOT}/scripts/lib.sh"
load_env
require CLOUDFLARE_API_TOKEN

if [[ ! -f "${CHECKS_FILE}" ]]; then
  echo "Missing ${CHECKS_FILE}" >&2
  echo "Run npm run setup, or copy checks.example.json to checks.json." >&2
  exit 1
fi

if [[ ! -f "${DEPLOY_CONFIG}" ]]; then
  echo "Missing ${DEPLOY_CONFIG}. Deploy once with npm run deploy." >&2
  exit 1
fi

export CLOUDFLARE_API_TOKEN
unset TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID || true

raw="$(
  npx wrangler kv key get state \
    --binding STATE \
    -c "${DEPLOY_CONFIG}" \
    --remote \
    --text 2>/dev/null || true
)"

export CHECKS_FILE
export STATE_JSON="${raw}"
node --experimental-strip-types "${ROOT}/scripts/print-status.ts"
