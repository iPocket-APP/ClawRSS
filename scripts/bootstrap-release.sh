#!/usr/bin/env bash
set -euo pipefail

RELEASE_URL="${1:?Usage: $0 <release-tgz-url> [db-path] <workspace-id> [relay-base-url]}"
DB_PATH="${2:-~/.openclaw/clawrss-sync.db}"
WORKSPACE_ID="${3:?Usage: $0 <release-tgz-url> [db-path] <workspace-id> [relay-base-url]}"
RELAY_BASE_URL="${4:-https://push.ipocket.xyz}"
TMP_TGZ="/tmp/clawrss.tgz"

curl -fL "$RELEASE_URL" -o "$TMP_TGZ"
npx --yes "$TMP_TGZ" setup \
  --workspace "$WORKSPACE_ID" \
  --db-path "$DB_PATH" \
  --relay-base-url "$RELAY_BASE_URL" \
  --restart
