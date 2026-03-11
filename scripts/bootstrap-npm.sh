#!/usr/bin/env bash
set -euo pipefail

NPM_SPEC="${1:-@ipocket/clawrss@latest}"
DB_PATH="${2:-~/.openclaw/clawrss-sync.db}"
WORKSPACE_ID="${3:?Usage: $0 [npm-spec] [db-path] <workspace-id> [relay-base-url]}"
RELAY_BASE_URL="${4:-https://push.ipocket.xyz}"

npx --yes "$NPM_SPEC" setup \
  --workspace "$WORKSPACE_ID" \
  --db-path "$DB_PATH" \
  --relay-base-url "$RELAY_BASE_URL" \
  --restart
