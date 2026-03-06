import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";

import initSqlJs, { type Database as SQLDatabase, type SqlJsStatic } from "sql.js";

import { renderDigestBody, type DigestBodyFormat } from "./digests.js";
import { fingerprintURL } from "./fingerprint.js";
import { normalizeItems, type NormalizedItem } from "./normalize.js";
import { SCHEMA_SQL } from "./schema.js";

type PullKind = "all" | "rss" | "article";
export type PushEnvironment = "sandbox" | "production";

export type UpsertFeedInput = {
  namespace?: string;
  feedURL: string;
  feedName?: string;
  category?: string;
  source?: string;
};

export type IngestInput = {
  namespace?: string;
  query?: string;
  provider?: string;
  items?: unknown;
};

export type PullInput = {
  namespace?: string;
  consumer?: string;
  cursor?: string | null;
  limit?: number;
  kind?: PullKind;
};

export type MarkInput = {
  namespace?: string;
  consumer?: string;
  cursor?: string | null;
  count?: number;
};

export type DeleteFeedInput = {
  namespace?: string;
  feedURL: string;
};

export type ListFeedsInput = {
  namespace?: string;
  cursor?: string | null;
  limit?: number;
};

export type RegisterPushDeviceInput = {
  appID?: string;
  installationID?: string;
  deviceToken?: string;
  topic?: string;
  environment?: PushEnvironment | string;
  locale?: string;
  appVersion?: string;
  buildNumber?: string;
};

export type UnregisterPushDeviceInput = {
  appID?: string;
  installationID?: string;
};

export type NotifyPushInput = {
  appID?: string;
  title?: string;
  body?: string;
  sound?: string;
  badge?: number;
  threadID?: string;
  category?: string;
  collapseID?: string;
  data?: unknown;
};

export type SaveDigestInput = {
  namespace?: string;
  jobID?: string;
  scheduledFor?: string;
  title?: string;
  bodyRaw?: string;
  bodyFormat?: DigestBodyFormat | string;
  sourceItems?: unknown;
  metadata?: unknown;
};

export type PullDigestsInput = {
  namespace?: string;
  cursor?: string | null;
  limit?: number;
};

export type GetDigestInput = {
  namespace?: string;
  digestID?: string;
};

export type PullRow = {
  title: string;
  url: string;
  kind: "rss" | "article";
  snippet: string;
  discovered_at: string;
  cursor_id: number;
};

export type DigestPullRow = {
  digest_id: string;
  job_id: string;
  scheduled_for: string;
  title: string;
  body_format: DigestBodyFormat;
  render_html: string;
  preview_text: string;
  virtual_url: string;
  updated_at: string;
  cursor_id: number;
};

type SQLParam = number | string | Uint8Array | null;

type ExistingItemRow = {
  title: string;
  snippet: string;
  source_host: string;
  score: number;
  kind: string;
  query: string | null;
  provider: string | null;
  published_at: string | null;
};

type SubscriptionRow = {
  id: number;
  namespace: string;
  feed_name: string;
  feed_url: string;
  url_fingerprint: string;
  updated_at: string;
  source: string;
  category: string | null;
};

type PushDeviceRow = {
  id: number;
  app_id: string;
  installation_id: string;
  device_token: string;
  token_hash: string;
  topic: string;
  environment: PushEnvironment;
  locale: string | null;
  app_version: string | null;
  build_number: string | null;
  enabled: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type DigestRow = {
  digest_id: string;
  namespace: string;
  job_id: string;
  scheduled_for: string;
  title: string;
  body_raw: string;
  body_format: DigestBodyFormat;
  render_html: string;
  preview_text: string;
  virtual_url: string;
  source_json: string;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
};

const require = createRequire(import.meta.url);

const REQUIRED_TABLE_COLUMNS: Record<string, string[]> = {
  openclaw_rss_items: ["namespace", "kind", "title", "url", "url_fingerprint", "discovered_at"],
  openclaw_rss_subscriptions: ["namespace", "feed_url", "feed_name", "url_fingerprint", "updated_at"],
  openclaw_rss_digests: ["digest_id", "namespace", "job_id", "scheduled_for", "render_html", "preview_text"],
  openclaw_rss_sync_state: ["namespace", "consumer", "last_cursor", "updated_at"],
};

export function resolveDBPath(input?: string): string {
  const provided = (input ?? "~/.openclaw/clawrss-sync.db").trim();
  if (!provided.startsWith("~")) return provided;
  return path.join(os.homedir(), provided.slice(1));
}

function nowISO(): string {
  return new Date().toISOString();
}

function parseCursor(cursor?: string | null): { ts: string; id: number } | null {
  if (!cursor) return null;
  const [ts, idRaw] = cursor.split("#");
  if (!ts || !idRaw) return null;
  const id = Number(idRaw);
  if (!Number.isFinite(id)) return null;
  return { ts, id };
}

function buildCursor(ts: string, id: number): string {
  return `${ts}#${id}`;
}

function normalizePushEnvironment(value?: string): PushEnvironment {
  return value === "production" ? "production" : "sandbox";
}

function normalizeTrimmed(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeAppID(value?: string): string {
  return normalizeTrimmed(value) ?? "claw-rss";
}

export function normalizeNamespace(value?: string): string {
  const normalized = normalizeTrimmed(value)?.toLowerCase();
  if (!normalized) return "default";
  return normalized.replace(/[^a-z0-9._-]+/g, "-");
}

function ensureRequiredString(value: unknown, field: string): string {
  const normalized = normalizeTrimmed(value);
  if (!normalized) {
    throw new Error(`Invalid ${field}: a non-empty value is required.`);
  }
  return normalized;
}

function schemaResetMessage(dbPath: string, detail: string): string {
  return [
    "Legacy openclaw-rss database schema detected.",
    detail,
    `Delete the SQLite file at ${dbPath} and restart the plugin.`,
    "This version does not support in-place schema migration."
  ].join(" ");
}

function normalizeScheduledFor(value: unknown): string {
  const normalized = ensureRequiredString(value, "scheduledFor");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid scheduledFor: expected an ISO-8601 timestamp.");
  }
  return date.toISOString();
}

function stableDigestID(namespace: string, jobID: string, scheduledFor: string): string {
  const hash = crypto.createHash("sha256").update(`${namespace}\u0000${jobID}\u0000${scheduledFor}`).digest("hex");
  return `digest_${hash.slice(0, 32)}`;
}

function safeJSONString(value: unknown, fallback: string): string {
  try {
    return JSON.stringify(value ?? JSON.parse(fallback));
  } catch {
    return fallback;
  }
}

function normalizeTopic(value?: string): string {
  return normalizeTrimmed(value) ?? "xyz.ipocket.clawrss";
}

function normalizeDeviceToken(value?: string): string {
  return (value ?? "").replace(/\s+/g, "").toLowerCase();
}

function tokenizeHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function maskDeviceToken(token: string): string {
  if (token.length <= 12) return token;
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

function firstRow<T extends Record<string, unknown>>(db: SQLDatabase, sql: string, params: SQLParam[] = []): T | undefined {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    if (!stmt.step()) return undefined;
    return stmt.getAsObject() as T;
  } finally {
    stmt.free();
  }
}

function allRows<T extends Record<string, unknown>>(db: SQLDatabase, sql: string, params: SQLParam[] = []): T[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as T);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

function mapPushDeviceRow(row: Record<string, unknown>): PushDeviceRow {
  return {
    id: Number(row.id ?? 0),
    app_id: String(row.app_id ?? ""),
    installation_id: String(row.installation_id ?? ""),
    device_token: String(row.device_token ?? ""),
    token_hash: String(row.token_hash ?? ""),
    topic: String(row.topic ?? ""),
    environment: normalizePushEnvironment(String(row.environment ?? "")),
    locale: row.locale == null ? null : String(row.locale),
    app_version: row.app_version == null ? null : String(row.app_version),
    build_number: row.build_number == null ? null : String(row.build_number),
    enabled: Number(row.enabled ?? 0),
    last_error: row.last_error == null ? null : String(row.last_error),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function mapDigestRow(row: Record<string, unknown>): DigestRow {
  return {
    digest_id: String(row.digest_id ?? ""),
    namespace: String(row.namespace ?? ""),
    job_id: String(row.job_id ?? ""),
    scheduled_for: String(row.scheduled_for ?? ""),
    title: String(row.title ?? ""),
    body_raw: String(row.body_raw ?? ""),
    body_format: row.body_format === "html" || row.body_format === "plain_text" ? row.body_format : "markdown",
    render_html: String(row.render_html ?? ""),
    preview_text: String(row.preview_text ?? ""),
    virtual_url: String(row.virtual_url ?? ""),
    source_json: String(row.source_json ?? "[]"),
    metadata_json: row.metadata_json == null ? null : String(row.metadata_json),
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

function locateFile(file: string): string {
  if (file === "sql-wasm.wasm") {
    return require.resolve("sql.js/dist/sql-wasm.wasm");
  }
  return require.resolve(`sql.js/dist/${file}`);
}

export class OpenClawRSSDatabase {
  private readonly dbPath: string;
  private sqlPromise: Promise<SqlJsStatic> | null = null;
  private dbPromise: Promise<SQLDatabase> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(dbPathInput?: string) {
    this.dbPath = resolveDBPath(dbPathInput);
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
  }

  async close(): Promise<void> {
    await this.writeQueue;
    if (!this.dbPromise) return;
    const db = await this.dbPromise;
    db.close();
    this.dbPromise = null;
  }

  private loadSQL(): Promise<SqlJsStatic> {
    if (!this.sqlPromise) {
      this.sqlPromise = initSqlJs({ locateFile });
    }
    return this.sqlPromise;
  }

  private async openDatabase(): Promise<SQLDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const SQL = await this.loadSQL();
        const exists = fs.existsSync(this.dbPath);
        const db = exists
          ? new SQL.Database(new Uint8Array(await fsp.readFile(this.dbPath)))
          : new SQL.Database();

        db.run("PRAGMA foreign_keys = ON");
        try {
          db.exec(SCHEMA_SQL);
        } catch (error) {
          if (exists) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(
              schemaResetMessage(
                this.dbPath,
                `Existing database file is incompatible with the current schema (${message}).`
              )
            );
          }
          throw error;
        }
        this.assertSchemaCompatibility(db);
        if (!exists) {
          await this.persist(db);
        }
        return db;
      })().catch((error) => {
        this.dbPromise = null;
        throw error;
      });
    }
    return this.dbPromise;
  }

  private assertSchemaCompatibility(db: SQLDatabase) {
    for (const [table, requiredColumns] of Object.entries(REQUIRED_TABLE_COLUMNS)) {
      const rows = allRows<Record<string, unknown>>(db, `PRAGMA table_info(${table})`);
      if (rows.length === 0) {
        throw new Error(schemaResetMessage(this.dbPath, `Table ${table} is missing.`));
      }

      const columns = new Set(rows.map((row) => String(row.name ?? "")));
      for (const column of requiredColumns) {
        if (!columns.has(column)) {
          throw new Error(
            schemaResetMessage(this.dbPath, `Table ${table} is missing required column ${column}.`)
          );
        }
      }
    }
  }

  private async persist(db: SQLDatabase): Promise<void> {
    const bytes = db.export();
    const tmpPath = `${this.dbPath}.tmp`;
    await fsp.writeFile(tmpPath, Buffer.from(bytes));
    await fsp.rename(tmpPath, this.dbPath);
  }

  private async withWriteLock<T>(operation: (db: SQLDatabase) => T): Promise<T> {
    let value: T | undefined;
    let failure: unknown;

    this.writeQueue = this.writeQueue.then(async () => {
      const db = await this.openDatabase();
      try {
        value = operation(db);
        await this.persist(db);
      } catch (error) {
        failure = error;
      }
    });

    await this.writeQueue;
    if (failure) throw failure;
    return value as T;
  }

  async upsertFeed(input: UpsertFeedInput): Promise<{ upserted: number; urlFingerprint: string }> {
    const namespace = normalizeNamespace(input.namespace);
    const canonicalURL = input.feedURL?.trim() ?? "";
    const fingerprint = fingerprintURL(canonicalURL);
    if (!fingerprint) {
      throw new Error("Invalid feedURL: only absolute http/https URLs are supported.");
    }

    const now = nowISO();
    const feedName = (input.feedName ?? "").trim() || canonicalURL;

    return this.withWriteLock((db) => {
      db.run(
        `
        INSERT INTO openclaw_rss_subscriptions
          (namespace, feed_url, feed_name, url_fingerprint, category, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(namespace, url_fingerprint) DO UPDATE SET
          feed_url = excluded.feed_url,
          feed_name = excluded.feed_name,
          category = excluded.category,
          source = excluded.source,
          updated_at = excluded.updated_at
        `,
        [
          namespace,
          canonicalURL,
          feedName,
          fingerprint,
          input.category?.trim() || null,
          input.source?.trim() || "ios_manual",
          now,
          now,
        ]
      );

      return { upserted: 1, urlFingerprint: fingerprint };
    });
  }

  async ingest(input: IngestInput): Promise<{ inserted: number; updated: number; duplicate: number; failed: number }> {
    const namespace = normalizeNamespace(input.namespace);
    const normalized = normalizeItems(input.items);
    const query = (input.query ?? "").trim() || null;
    const provider = (input.provider ?? "").trim() || null;

    return this.withWriteLock((db) => {
      const selectStmt = db.prepare(`
        SELECT title, snippet, source_host, score, kind, query, provider, published_at
        FROM openclaw_rss_items
        WHERE namespace = ? AND url_fingerprint = ?
      `);

      const insertStmt = db.prepare(`
        INSERT INTO openclaw_rss_items
          (namespace, kind, title, url, url_fingerprint, snippet, source_host, score, query, provider, published_at, discovered_at, updated_at, raw_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const updateStmt = db.prepare(`
        UPDATE openclaw_rss_items
        SET kind = ?,
            title = ?,
            url = ?,
            snippet = ?,
            source_host = ?,
            score = ?,
            query = ?,
            provider = ?,
            published_at = ?,
            updated_at = ?,
            raw_json = ?
        WHERE namespace = ? AND url_fingerprint = ?
      `);

      let inserted = 0;
      let updated = 0;
      let duplicate = 0;
      let failed = 0;

      try {
        for (const item of normalized) {
          try {
            const urlFingerprint = fingerprintURL(item.url);
            if (!urlFingerprint) {
              failed += 1;
              continue;
            }

            const discoveredAt = nowISO();
            const updatedAt = nowISO();
            const rawJSON = JSON.stringify(item);

            selectStmt.bind([namespace, urlFingerprint]);
            const existing = selectStmt.step()
              ? (selectStmt.getAsObject() as ExistingItemRow)
              : undefined;
            selectStmt.reset();

            if (!existing) {
              insertStmt.run([
                namespace,
                item.kind,
                item.title,
                item.url,
                urlFingerprint,
                item.snippet,
                item.sourceHost,
                item.score,
                query,
                provider,
                item.publishedAt,
                discoveredAt,
                updatedAt,
                rawJSON,
              ]);
              inserted += 1;
              continue;
            }

            const changed =
              existing.title !== item.title ||
              existing.snippet !== item.snippet ||
              existing.source_host !== item.sourceHost ||
              Number(existing.score) !== Number(item.score) ||
              existing.kind !== item.kind ||
              (existing.query ?? null) !== query ||
              (existing.provider ?? null) !== provider ||
              (existing.published_at ?? null) !== item.publishedAt;

            if (!changed) {
              duplicate += 1;
              continue;
            }

            updateStmt.run([
              item.kind,
              item.title,
              item.url,
              item.snippet,
              item.sourceHost,
              item.score,
              query,
              provider,
              item.publishedAt,
              updatedAt,
              rawJSON,
              namespace,
              urlFingerprint,
            ]);
            updated += 1;
          } catch {
            failed += 1;
          }
        }
      } finally {
        selectStmt.free();
        insertStmt.free();
        updateStmt.free();
      }

      return { inserted, updated, duplicate, failed };
    });
  }

  async pull(
    input: PullInput,
    defaultLimit: number
  ): Promise<{ results: Array<Pick<PullRow, "title" | "url" | "kind" | "snippet">>; nextCursor: string | null; hasMore: boolean }> {
    await this.writeQueue;
    const db = await this.openDatabase();
    const namespace = normalizeNamespace(input.namespace);
    const limit = Math.min(Math.max(Number(input.limit) || defaultLimit, 1), 500);
    const normalizedKind: PullKind = input.kind === "rss" || input.kind === "article" ? input.kind : "all";
    const cursor = parseCursor(input.cursor ?? null);

    const conditions: string[] = [];
    const params: SQLParam[] = [];

    conditions.push("namespace = ?");
    params.push(namespace);

    if (normalizedKind !== "all") {
      conditions.push("kind = ?");
      params.push(normalizedKind);
    }

    if (cursor) {
      conditions.push("(discovered_at < ? OR (discovered_at = ? AND cursor_id < ?))");
      params.push(cursor.ts, cursor.ts, cursor.id);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit + 1);

    const query = `
      WITH merged AS (
        SELECT
          namespace,
          discovered_at,
          id AS cursor_id,
          kind,
          title,
          url,
          snippet
        FROM openclaw_rss_items
        UNION ALL
        SELECT
          namespace,
          updated_at AS discovered_at,
          (1000000000000 + id) AS cursor_id,
          'rss' AS kind,
          feed_name AS title,
          feed_url AS url,
          '' AS snippet
        FROM openclaw_rss_subscriptions
      )
      SELECT title, url, kind, snippet, discovered_at, cursor_id
      FROM merged
      ${whereClause}
      ORDER BY discovered_at DESC, cursor_id DESC
      LIMIT ?
    `;

    const rows: PullRow[] = allRows<Record<string, unknown>>(db, query, params).map((row) => {
      const kind: PullRow["kind"] = row.kind === "rss" ? "rss" : "article";
      return {
        title: String(row.title ?? ""),
        url: String(row.url ?? ""),
        kind,
        snippet: String(row.snippet ?? ""),
        discovered_at: String(row.discovered_at ?? ""),
        cursor_id: Number(row.cursor_id ?? 0),
      };
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const results: Array<Pick<PullRow, "title" | "url" | "kind" | "snippet">> = page.map((row) => ({
      title: row.title,
      url: row.url,
      kind: row.kind,
      snippet: row.snippet,
    }));

    const last = page.at(-1);
    const nextCursor = last ? buildCursor(last.discovered_at, last.cursor_id) : null;

    if (input.consumer && nextCursor) {
      await this.mark({
        namespace,
        consumer: input.consumer,
        cursor: nextCursor,
        count: page.length
      });
    }

    return { results, nextCursor, hasMore };
  }

  async saveDigest(input: SaveDigestInput): Promise<{
    digestID: string;
    jobID: string;
    scheduledFor: string;
    title: string;
    previewText: string;
    renderHTML: string;
    bodyFormat: DigestBodyFormat;
    virtualURL: string;
    created: boolean;
    updated: boolean;
  }> {
    const namespace = normalizeNamespace(input.namespace);
    const jobID = ensureRequiredString(input.jobID, "jobID");
    const scheduledFor = normalizeScheduledFor(input.scheduledFor);
    const title = ensureRequiredString(input.title, "title");
    const rendered = renderDigestBody(input.bodyRaw, input.bodyFormat ?? "markdown");
    const digestID = stableDigestID(namespace, jobID, scheduledFor);
    const virtualURL = `openclaw://digest/${digestID}`;
    const sourceJSON = safeJSONString(input.sourceItems, "[]");
    const metadataJSON = input.metadata == null ? null : safeJSONString(input.metadata, "null");
    const now = nowISO();

    return this.withWriteLock((db) => {
      const existing = firstRow<Record<string, unknown>>(
        db,
        `
        SELECT digest_id
        FROM openclaw_rss_digests
        WHERE namespace = ? AND digest_id = ?
        LIMIT 1
        `,
        [namespace, digestID]
      );

      db.run(
        `
        INSERT INTO openclaw_rss_digests (
          digest_id,
          namespace,
          job_id,
          scheduled_for,
          title,
          body_raw,
          body_format,
          render_html,
          preview_text,
          virtual_url,
          source_json,
          metadata_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(digest_id) DO UPDATE SET
          namespace = excluded.namespace,
          job_id = excluded.job_id,
          scheduled_for = excluded.scheduled_for,
          title = excluded.title,
          body_raw = excluded.body_raw,
          body_format = excluded.body_format,
          render_html = excluded.render_html,
          preview_text = excluded.preview_text,
          virtual_url = excluded.virtual_url,
          source_json = excluded.source_json,
          metadata_json = excluded.metadata_json,
          updated_at = excluded.updated_at
        `,
        [
          digestID,
          namespace,
          jobID,
          scheduledFor,
          title,
          rendered.bodyRaw,
          rendered.bodyFormat,
          rendered.renderHTML,
          rendered.previewText,
          virtualURL,
          sourceJSON,
          metadataJSON,
          now,
          now,
        ]
      );

      return {
        digestID,
        jobID,
        scheduledFor,
        title,
        previewText: rendered.previewText,
        renderHTML: rendered.renderHTML,
        bodyFormat: rendered.bodyFormat,
        virtualURL,
        created: !existing,
        updated: Boolean(existing),
      };
    });
  }

  async pullDigests(
    input: PullDigestsInput,
    defaultLimit: number
  ): Promise<{
    results: Array<{
      digestID: string;
      jobID: string;
      scheduledFor: string;
      title: string;
      bodyFormat: DigestBodyFormat;
      renderHTML: string;
      previewText: string;
      virtualURL: string;
      updatedAt: string;
    }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    await this.writeQueue;
    const db = await this.openDatabase();
    const namespace = normalizeNamespace(input.namespace);
    const limit = Math.min(Math.max(Number(input.limit) || defaultLimit, 1), 500);
    const cursor = parseCursor(input.cursor ?? null);

    const conditions: string[] = [];
    const params: SQLParam[] = [];

    conditions.push("namespace = ?");
    params.push(namespace);

    if (cursor) {
      conditions.push("(updated_at < ? OR (updated_at = ? AND cursor_id < ?))");
      params.push(cursor.ts, cursor.ts, cursor.id);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit + 1);

    const rows: DigestPullRow[] = allRows<Record<string, unknown>>(
      db,
      `
      SELECT
        digest_id,
        namespace,
        job_id,
        scheduled_for,
        title,
        body_format,
        render_html,
        preview_text,
        virtual_url,
        updated_at,
        rowid AS cursor_id
      FROM openclaw_rss_digests
      ${whereClause}
      ORDER BY updated_at DESC, rowid DESC
      LIMIT ?
      `,
      params
    ).map((row) => ({
      digest_id: String(row.digest_id ?? ""),
      job_id: String(row.job_id ?? ""),
      scheduled_for: String(row.scheduled_for ?? ""),
      title: String(row.title ?? ""),
      body_format: row.body_format === "html" || row.body_format === "plain_text" ? row.body_format : "markdown",
      render_html: String(row.render_html ?? ""),
      preview_text: String(row.preview_text ?? ""),
      virtual_url: String(row.virtual_url ?? ""),
      updated_at: String(row.updated_at ?? ""),
      cursor_id: Number(row.cursor_id ?? 0),
    }));

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return {
      results: page.map((row) => ({
        digestID: row.digest_id,
        jobID: row.job_id,
        scheduledFor: row.scheduled_for,
        title: row.title,
        bodyFormat: row.body_format,
        renderHTML: row.render_html,
        previewText: row.preview_text,
        virtualURL: row.virtual_url,
        updatedAt: row.updated_at,
      })),
      nextCursor: last ? buildCursor(last.updated_at, last.cursor_id) : null,
      hasMore,
    };
  }

  async getDigest(input: GetDigestInput): Promise<{
    digestID: string;
    jobID: string;
    scheduledFor: string;
    title: string;
    bodyRaw: string;
    bodyFormat: DigestBodyFormat;
    renderHTML: string;
    previewText: string;
    virtualURL: string;
    sourceItems: unknown;
    metadata: unknown;
    createdAt: string;
    updatedAt: string;
  } | null> {
    await this.writeQueue;
    const db = await this.openDatabase();
    const namespace = normalizeNamespace(input.namespace);
    const digestID = ensureRequiredString(input.digestID, "digestID");
    const row = firstRow<Record<string, unknown>>(
      db,
      `
      SELECT
        digest_id,
        namespace,
        job_id,
        scheduled_for,
        title,
        body_raw,
        body_format,
        render_html,
        preview_text,
        virtual_url,
        source_json,
        metadata_json,
        created_at,
        updated_at
      FROM openclaw_rss_digests
      WHERE namespace = ? AND digest_id = ?
      LIMIT 1
      `,
      [namespace, digestID]
    );

    if (!row) return null;
    const digest = mapDigestRow(row);
    return {
      digestID: digest.digest_id,
      jobID: digest.job_id,
      scheduledFor: digest.scheduled_for,
      title: digest.title,
      bodyRaw: digest.body_raw,
      bodyFormat: digest.body_format,
      renderHTML: digest.render_html,
      previewText: digest.preview_text,
      virtualURL: digest.virtual_url,
      sourceItems: JSON.parse(digest.source_json),
      metadata: digest.metadata_json ? JSON.parse(digest.metadata_json) : null,
      createdAt: digest.created_at,
      updatedAt: digest.updated_at,
    };
  }

  async deleteFeed(input: DeleteFeedInput): Promise<{ deleted: number; urlFingerprint: string }> {
    const namespace = normalizeNamespace(input.namespace);
    const canonicalURL = input.feedURL?.trim() ?? "";
    const fingerprint = fingerprintURL(canonicalURL);
    if (!fingerprint) {
      throw new Error("Invalid feedURL: only absolute http/https URLs are supported.");
    }

    return this.withWriteLock((db) => {
      db.run(
        `
        DELETE FROM openclaw_rss_subscriptions
        WHERE namespace = ? AND url_fingerprint = ?
        `,
        [namespace, fingerprint]
      );

      const row = firstRow<{ deleted: number }>(db, "SELECT changes() AS deleted");
      return {
        deleted: Number(row?.deleted ?? 0),
        urlFingerprint: fingerprint,
      };
    });
  }

  async listFeeds(
    input: ListFeedsInput
  ): Promise<{
    results: Array<{
      feedName: string;
      feedURL: string;
      urlFingerprint: string;
      updatedAt: string;
      source: string;
      category: string | null;
    }>;
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    await this.writeQueue;
    const db = await this.openDatabase();
    const namespace = normalizeNamespace(input.namespace);
    const limit = Math.min(Math.max(Number(input.limit) || 200, 1), 500);
    const cursor = parseCursor(input.cursor ?? null);

    const conditions: string[] = [];
    const params: SQLParam[] = [];

    conditions.push("namespace = ?");
    params.push(namespace);

    if (cursor) {
      conditions.push("(updated_at < ? OR (updated_at = ? AND id < ?))");
      params.push(cursor.ts, cursor.ts, cursor.id);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit + 1);

    const rows = allRows<Record<string, unknown>>(
      db,
      `
      SELECT
        id,
        namespace,
        feed_name,
        feed_url,
        url_fingerprint,
        updated_at,
        source,
        category
      FROM openclaw_rss_subscriptions
      ${whereClause}
      ORDER BY updated_at DESC, id DESC
      LIMIT ?
      `,
      params
    ).map((row): SubscriptionRow => ({
      id: Number(row.id ?? 0),
      namespace: String(row.namespace ?? ""),
      feed_name: String(row.feed_name ?? ""),
      feed_url: String(row.feed_url ?? ""),
      url_fingerprint: String(row.url_fingerprint ?? ""),
      updated_at: String(row.updated_at ?? ""),
      source: String(row.source ?? ""),
      category: row.category == null ? null : String(row.category),
    }));

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return {
      results: page.map((row) => ({
        feedName: row.feed_name,
        feedURL: row.feed_url,
        urlFingerprint: row.url_fingerprint,
        updatedAt: row.updated_at,
        source: row.source,
        category: row.category,
      })),
      nextCursor: last ? buildCursor(last.updated_at, last.id) : null,
      hasMore,
    };
  }

  async mark(input: MarkInput): Promise<{ acknowledged: boolean; consumer: string }> {
    const namespace = normalizeNamespace(input.namespace);
    const consumer = (input.consumer ?? "claw-rss").trim() || "claw-rss";
    const now = nowISO();

    return this.withWriteLock((db) => {
      db.run(
        `
        INSERT INTO openclaw_rss_sync_state (namespace, consumer, last_cursor, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(namespace, consumer) DO UPDATE SET
          last_cursor = excluded.last_cursor,
          updated_at = excluded.updated_at
        `,
        [namespace, consumer, input.cursor ?? null, now]
      );

      return { acknowledged: true, consumer };
    });
  }

  async registerPushDevice(
    input: RegisterPushDeviceInput
  ): Promise<{
    registered: number;
    appID: string;
    installationID: string;
    environment: PushEnvironment;
    topic: string;
    enabled: boolean;
  }> {
    const appID = normalizeAppID(input.appID);
    const installationID = normalizeTrimmed(input.installationID);
    const deviceToken = normalizeDeviceToken(input.deviceToken);
    const topic = normalizeTopic(input.topic);
    const environment = normalizePushEnvironment(input.environment);

    if (!installationID) {
      throw new Error("Invalid installationID: a non-empty installation identifier is required.");
    }
    if (!/^[a-f0-9]{32,}$/i.test(deviceToken)) {
      throw new Error("Invalid deviceToken: expected a lowercase/uppercase APNs hex token.");
    }

    const tokenHash = tokenizeHash(deviceToken);
    const now = nowISO();

    return this.withWriteLock((db) => {
      db.run(
        `
        INSERT INTO openclaw_push_devices
          (app_id, installation_id, device_token, token_hash, topic, environment, locale, app_version, build_number, enabled, last_error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?)
        ON CONFLICT(app_id, installation_id) DO UPDATE SET
          device_token = excluded.device_token,
          token_hash = excluded.token_hash,
          topic = excluded.topic,
          environment = excluded.environment,
          locale = excluded.locale,
          app_version = excluded.app_version,
          build_number = excluded.build_number,
          enabled = 1,
          last_error = NULL,
          updated_at = excluded.updated_at
        `,
        [
          appID,
          installationID,
          deviceToken,
          tokenHash,
          topic,
          environment,
          normalizeTrimmed(input.locale),
          normalizeTrimmed(input.appVersion),
          normalizeTrimmed(input.buildNumber),
          now,
          now,
        ]
      );

      return {
        registered: 1,
        appID,
        installationID,
        environment,
        topic,
        enabled: true,
      };
    });
  }

  async unregisterPushDevice(
    input: UnregisterPushDeviceInput
  ): Promise<{ disabled: number; appID: string; installationID: string }> {
    const appID = normalizeAppID(input.appID);
    const installationID = normalizeTrimmed(input.installationID);

    if (!installationID) {
      throw new Error("Invalid installationID: a non-empty installation identifier is required.");
    }

    return this.withWriteLock((db) => {
      db.run(
        `
        UPDATE openclaw_push_devices
        SET enabled = 0,
            updated_at = ?,
            last_error = NULL
        WHERE app_id = ? AND installation_id = ?
        `,
        [nowISO(), appID, installationID]
      );

      const row = firstRow<{ disabled: number }>(db, "SELECT changes() AS disabled");
      return {
        disabled: Number(row?.disabled ?? 0),
        appID,
        installationID,
      };
    });
  }

  async listPushDevices(appIDInput?: string): Promise<{
    appID: string;
    results: Array<{
      installationID: string;
      deviceToken: string;
      topic: string;
      environment: PushEnvironment;
      enabled: boolean;
      locale: string | null;
      appVersion: string | null;
      buildNumber: string | null;
      lastError: string | null;
      updatedAt: string;
    }>;
  }> {
    await this.writeQueue;
    const db = await this.openDatabase();
    const appID = normalizeAppID(appIDInput);
    const rows = allRows<Record<string, unknown>>(
      db,
      `
      SELECT
        id,
        app_id,
        installation_id,
        device_token,
        token_hash,
        topic,
        environment,
        locale,
        app_version,
        build_number,
        enabled,
        last_error,
        created_at,
        updated_at
      FROM openclaw_push_devices
      WHERE app_id = ?
      ORDER BY enabled DESC, updated_at DESC, id DESC
      `,
      [appID]
    ).map(mapPushDeviceRow);

    return {
      appID,
      results: rows.map((row) => ({
        installationID: row.installation_id,
        deviceToken: maskDeviceToken(row.device_token),
        topic: row.topic,
        environment: row.environment,
        enabled: row.enabled === 1,
        locale: row.locale,
        appVersion: row.app_version,
        buildNumber: row.build_number,
        lastError: row.last_error,
        updatedAt: row.updated_at,
      })),
    };
  }

  async countEnabledPushDevices(appIDInput?: string): Promise<number> {
    await this.writeQueue;
    const db = await this.openDatabase();
    const appID = normalizeAppID(appIDInput);
    const row = firstRow<{ count: number }>(
      db,
      `
      SELECT COUNT(*) AS count
      FROM openclaw_push_devices
      WHERE app_id = ? AND enabled = 1
      `,
      [appID]
    );
    return Number(row?.count ?? 0);
  }

  async getEnabledPushTargets(appIDInput?: string): Promise<Array<{
    id: number;
    installationID: string;
    deviceToken: string;
    topic: string;
    environment: PushEnvironment;
  }>> {
    await this.writeQueue;
    const db = await this.openDatabase();
    const appID = normalizeAppID(appIDInput);
    const rows = allRows<Record<string, unknown>>(
      db,
      `
      SELECT
        id,
        app_id,
        installation_id,
        device_token,
        token_hash,
        topic,
        environment,
        locale,
        app_version,
        build_number,
        enabled,
        last_error,
        created_at,
        updated_at
      FROM openclaw_push_devices
      WHERE app_id = ? AND enabled = 1
      ORDER BY updated_at DESC, id DESC
      `,
      [appID]
    ).map(mapPushDeviceRow);

    return rows.map((row) => ({
      id: row.id,
      installationID: row.installation_id,
      deviceToken: row.device_token,
      topic: row.topic,
      environment: row.environment,
    }));
  }

  async updatePushDeviceStatus(
    input: {
      appID?: string;
      installationID?: string;
      enabled: boolean;
      lastError?: string | null;
    }
  ): Promise<{ updated: number; appID: string; installationID: string }> {
    const appID = normalizeAppID(input.appID);
    const installationID = normalizeTrimmed(input.installationID);

    if (!installationID) {
      throw new Error("Invalid installationID: a non-empty installation identifier is required.");
    }

    return this.withWriteLock((db) => {
      db.run(
        `
        UPDATE openclaw_push_devices
        SET enabled = ?,
            last_error = ?,
            updated_at = ?
        WHERE app_id = ? AND installation_id = ?
        `,
        [
          input.enabled ? 1 : 0,
          normalizeTrimmed(input.lastError),
          nowISO(),
          appID,
          installationID,
        ]
      );

      const row = firstRow<{ updated: number }>(db, "SELECT changes() AS updated");
      return {
        updated: Number(row?.updated ?? 0),
        appID,
        installationID,
      };
    });
  }

  async readSyncCursor(input: { namespace?: string; consumer?: string }): Promise<string | null> {
    await this.writeQueue;
    const db = await this.openDatabase();
    const namespace = normalizeNamespace(input.namespace);
    const consumer = (input.consumer ?? "claw-rss").trim() || "claw-rss";
    const row = firstRow<{ last_cursor: string | null }>(
      db,
      `
      SELECT last_cursor
      FROM openclaw_rss_sync_state
      WHERE namespace = ? AND consumer = ?
      LIMIT 1
      `,
      [namespace, consumer]
    );
    return row?.last_cursor ?? null;
  }

  async readItemByFingerprint(urlFingerprint: string, namespaceInput?: string): Promise<ExistingItemRow | undefined> {
    await this.writeQueue;
    const db = await this.openDatabase();
    const namespace = normalizeNamespace(namespaceInput);
    return firstRow<ExistingItemRow>(
      db,
      `
      SELECT title, snippet, source_host, score, kind, query, provider, published_at
      FROM openclaw_rss_items
      WHERE namespace = ? AND url_fingerprint = ?
      `,
      [namespace, urlFingerprint]
    );
  }
}

export type { NormalizedItem };
