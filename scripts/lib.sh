# shellcheck shell=bash
# Shared helpers. Never print secret values.

ENV_FILE="${WINWIN_UPTIME_ENV:-${HOME}/.config/winwin-uptime.env}"

load_env() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    echo "Missing ${ENV_FILE}" >&2
    echo "Copy winwin-uptime.env.example there and fill in the values." >&2
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
