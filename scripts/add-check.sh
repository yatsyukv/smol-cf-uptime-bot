#!/usr/bin/env bash
set -euo pipefail
set +x

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ROOT
# shellcheck disable=SC1091
source "${ROOT}/scripts/lib.sh"

if [[ ! -t 0 ]]; then
  echo "No TTY. Add a line to ${CHECKS_FILE} and run npm run deploy." >&2
  exit 1
fi

if [[ ! -f "${CHECKS_FILE}" ]]; then
  echo "No ${CHECKS_FILE} yet. Run npm run setup first." >&2
  exit 1
fi

echo "Current checks:"
cat "${CHECKS_FILE}"
added="$(append_checks "${CHECKS_FILE}")"
if [[ "${added}" -eq 0 ]]; then
  echo "Nothing added."
  exit 0
fi

echo "Updated ${CHECKS_FILE}."
if yes_no "Deploy the Worker now? [Y/n]" Y; then
  exec "${ROOT}/scripts/deploy.sh"
fi

echo "Later: npm run deploy"
