#!/usr/bin/env bash
set -euo pipefail

NPM_SPEC="${1:-@ipocket/clawrss@latest}"
DB_PATH="${2:-~/.openclaw/clawrss-sync.db}"

openclaw plugins install "$NPM_SPEC" \
  && openclaw plugins enable openclaw-rss \
  && openclaw config set plugins.entries.openclaw-rss.config.dbPath "$DB_PATH" \
  && openclaw gateway restart
