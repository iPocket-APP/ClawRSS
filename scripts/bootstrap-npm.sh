#!/usr/bin/env bash
set -euo pipefail

NPM_SPEC="${1:-@ipocket/clawrss@latest}"
DB_PATH="${2:-~/.openclaw/clawrss-sync.db}"

openclaw plugins install "$NPM_SPEC" \
  && openclaw plugins enable clawrss \
  && openclaw config set plugins.entries.clawrss.config.dbPath "$DB_PATH" \
  && openclaw gateway restart
