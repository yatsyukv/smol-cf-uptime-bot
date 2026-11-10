# shellcheck shell=bash
# Shared helpers. Never print secret values.
# Caller must set ROOT to the repo root before sourcing.

ENV_FILE="${UPTIME_ENV:-${ROOT}/.env}"
CHECKS_FILE="${UPTIME_CHECKS:-${ROOT}/checks.json}"
DEPLOY_CONFIG="${ROOT}/.wrangler-deploy.jsonc"

load_env() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Missing ${ENV_FILE}" >&2
    echo "Run npm run setup, or copy .env.example to .env and fill it in." >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
}

require() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing ${name} in ${ENV_FILE}" >&2
    exit 1
  fi
}

yes_no() {
  local prompt="$1"
  local default="${2:-Y}"
  local ans
  read -r -p "${prompt} " ans || true
  ans="${ans:-$default}"
  [[ "${ans}" == [Yy]* ]]
}
