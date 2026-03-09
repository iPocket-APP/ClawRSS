#!/usr/bin/env bash
set -euo pipefail

RELEASE_URL="${1:?Usage: $0 <release-tgz-url> [db-path]}"
DB_PATH="${2:-~/.openclaw/clawrss-sync.db}"
TMP_TGZ="/tmp/clawrss.tgz"

curl -fL "$RELEASE_URL" -o "$TMP_TGZ" \
  && openclaw plugins install "$TMP_TGZ" \
  && openclaw plugins enable clawrss \
  && openclaw config set plugins.entries.clawrss.config.dbPath "$DB_PATH" \
  && openclaw gateway restart
