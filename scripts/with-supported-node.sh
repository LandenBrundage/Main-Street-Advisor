#!/usr/bin/env bash

set -euo pipefail

minimum_major=24
current_node="$(command -v node || true)"

shopt -s nullglob
candidates=(
  "${BUSINESS_COPILOT_NODE:-}"
  "$current_node"
  "$HOME"/.local/node-v*/bin/node
  "$HOME"/.nvm/versions/node/v*/bin/node
  "$HOME"/.volta/bin/node
)
shopt -u nullglob

selected_node=""
for candidate in "${candidates[@]}"; do
  if [[ -z "$candidate" || ! -x "$candidate" ]]; then
    continue
  fi
  major="$("$candidate" -p 'Number(process.versions.node.split(".")[0])' 2>/dev/null || true)"
  if [[ "$major" =~ ^[0-9]+$ ]] && (( major >= minimum_major )); then
    selected_node="$candidate"
    break
  fi
done

if [[ -z "$selected_node" ]]; then
  printf '%s\n' \
    "Main Street Advisor requires Node.js ${minimum_major} or newer." \
    'Install Node.js 24, or run `nvm install 24 && nvm use 24`, then try again.' >&2
  exit 1
fi

if [[ $# -eq 0 || ! -f "$1" ]]; then
  printf 'The required project tool is missing: %s\n' "${1:-not provided}" >&2
  printf 'Run `npm install` with Node.js %s first.\n' "$minimum_major" >&2
  exit 1
fi

export PATH="$(dirname "$selected_node"):$PATH"
exec "$selected_node" "$@"
