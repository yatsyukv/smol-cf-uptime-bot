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

# Prompt for name/url/interval until a blank name. Appends to $1 (JSON array file).
# Prints the number of checks added to stdout (other messages on stderr).
append_checks() {
  local file="$1"
  local added=0
  if [[ ! -f "${file}" ]]; then
    echo '[]' > "${file}"
  fi
  echo "HTTP checks (blank name to finish). Up = HTTP 200 within 10s." >&2
  while true; do
    local name="" url="" every=""
    read -r -p "  name: " name || true
    if [[ -z "${name}" ]]; then
      break
    fi
    read -r -p "  url:  " url || true
    read -r -p "  how often to check (minutes) [5]: " every || true
    every="${every:-5}"
    if NAME="${name}" URL="${url}" EVERY="${every}" FILE="${file}" node --input-type=module -e '
      import { readFileSync, writeFileSync } from "node:fs";
      const name = process.env.NAME;
      const url = process.env.URL;
      const everyMinutes = Number(process.env.EVERY);
      if (!name || !url || !/^https?:\/\//i.test(url)) {
        console.error("  skip: need a name and an http(s) url");
        process.exit(2);
      }
      if (name === "lastSummaryDate" || name === "lastRunAt") {
        console.error("  skip: that name is reserved");
        process.exit(2);
      }
      if (!Number.isInteger(everyMinutes) || everyMinutes < 1) {
        console.error("  skip: interval must be an integer >= 1");
        process.exit(2);
      }
      const checks = JSON.parse(readFileSync(process.env.FILE, "utf8"));
      if (checks.some((c) => c.name === name)) {
        console.error("  skip: duplicate name");
        process.exit(2);
      }
      checks.push({ name, url, everyMinutes });
      writeFileSync(process.env.FILE, JSON.stringify(checks, null, 2) + "\n");
    '
    then
      added=$((added + 1))
    fi
  done
  echo "${added}"
}
