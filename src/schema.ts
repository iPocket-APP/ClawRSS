export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS openclaw_rss_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('rss','article')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  url_fingerprint TEXT NOT NULL,
  snippet TEXT DEFAULT '',
  source_host TEXT DEFAULT '',
  score REAL DEFAULT 0,
  query TEXT,
  provider TEXT,
  published_at TEXT,
  discovered_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  raw_json TEXT,
  UNIQUE(namespace, url_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_openclaw_rss_items_discovered
ON openclaw_rss_items(namespace, discovered_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS openclaw_rss_digests (
  digest_id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  job_id TEXT NOT NULL,
  scheduled_for TEXT NOT NULL,
  title TEXT NOT NULL,
  body_raw TEXT NOT NULL,
  body_format TEXT NOT NULL CHECK(body_format IN ('html','markdown','plain_text')),
  render_html TEXT NOT NULL,
  preview_text TEXT NOT NULL,
  virtual_url TEXT NOT NULL,
  source_json TEXT NOT NULL,
  metadata_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(namespace, job_id, scheduled_for)
);

CREATE INDEX IF NOT EXISTS idx_openclaw_rss_digests_updated
ON openclaw_rss_digests(namespace, updated_at DESC, digest_id DESC);

CREATE TABLE IF NOT EXISTS openclaw_rss_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  namespace TEXT NOT NULL,
  feed_url TEXT NOT NULL,
  feed_name TEXT NOT NULL,
  url_fingerprint TEXT NOT NULL,
  category TEXT,
  source TEXT NOT NULL DEFAULT 'ios_manual',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(namespace, url_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_openclaw_rss_subscriptions_updated
ON openclaw_rss_subscriptions(namespace, updated_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS openclaw_rss_sync_state (
  namespace TEXT NOT NULL,
  consumer TEXT NOT NULL,
  last_cursor TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(namespace, consumer)
);

CREATE TABLE IF NOT EXISTS openclaw_push_devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  device_token TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  topic TEXT NOT NULL,
  environment TEXT NOT NULL CHECK(environment IN ('sandbox','production')),
  locale TEXT,
  app_version TEXT,
  build_number TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(app_id, installation_id)
);

CREATE INDEX IF NOT EXISTS idx_openclaw_push_devices_target
ON openclaw_push_devices(app_id, enabled, topic, environment, updated_at DESC);
`;
