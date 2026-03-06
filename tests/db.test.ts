import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import initSqlJs from "sql.js";

import { OpenClawRSSDatabase } from "../src/db.js";
import { PushRelayClient } from "../src/push/client.js";
import { runPushNotifyDigest } from "../src/tools/pushNotifyDigest.js";
import { runPushNotify } from "../src/tools/pushNotify.js";

function makeTempDB(): { db: OpenClawRSSDatabase; dbPath: string } {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-rss-plugin-"));
  const dbPath = path.join(tempDir, "test.db");
  return { db: new OpenClawRSSDatabase(dbPath), dbPath };
}

async function writeLegacySchemaDB(dbPath: string) {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  db.exec(`
    CREATE TABLE openclaw_rss_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
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
      raw_json TEXT
    );
    CREATE TABLE openclaw_rss_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      feed_url TEXT NOT NULL,
      feed_name TEXT NOT NULL,
      url_fingerprint TEXT NOT NULL,
      category TEXT,
      source TEXT NOT NULL DEFAULT 'ios_manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE openclaw_rss_digests (
      digest_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      scheduled_for TEXT NOT NULL,
      title TEXT NOT NULL,
      body_raw TEXT NOT NULL,
      body_format TEXT NOT NULL,
      render_html TEXT NOT NULL,
      preview_text TEXT NOT NULL,
      virtual_url TEXT NOT NULL,
      source_json TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE openclaw_rss_sync_state (
      consumer TEXT PRIMARY KEY,
      last_cursor TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
  db.close();
}

test("ingest deduplicates by URL fingerprint", async () => {
  const { db } = makeTempDB();

  const first = await db.ingest({
    namespace: "workspace-a",
    query: "ai",
    provider: "brave",
    items: [
      { title: "A", url: "https://example.com/post/1?utm_source=x", kind: "article", snippet: "hello" }
    ]
  });
  assert.equal(first.inserted, 1);

  const second = await db.ingest({
    namespace: "workspace-a",
    query: "ai",
    provider: "brave",
    items: [
      { title: "A", url: "https://example.com/post/1", kind: "article", snippet: "hello" }
    ]
  });
  assert.equal(second.duplicate, 1);

  await db.close();
});

test("pull returns cursor and hasMore", async () => {
  const { db } = makeTempDB();

  await db.ingest({
    namespace: "workspace-a",
    items: Array.from({ length: 3 }, (_, i) => ({
      title: `Item ${i}`,
      url: `https://example.com/post/${i}`,
      kind: "article",
      snippet: "test"
    }))
  });

  const page1 = await db.pull({
    namespace: "workspace-a",
    consumer: "workspace-a",
    limit: 2,
    kind: "all"
  }, 50);
  assert.equal(page1.results.length, 2);
  assert.equal(page1.hasMore, true);
  assert.ok(page1.nextCursor);

  const page2 = await db.pull({
    namespace: "workspace-a",
    consumer: "workspace-a",
    limit: 2,
    kind: "all",
    cursor: page1.nextCursor
  }, 50);
  assert.equal(page2.results.length, 1);

  await db.close();
});

test("saveDigest upserts by job and schedule and renders markdown", async () => {
  const { db } = makeTempDB();

  const first = await db.saveDigest({
    namespace: "workspace-a",
    jobID: "daily-v2ex",
    scheduledFor: "2026-03-06T01:00:00.000Z",
    title: "V2EX Daily",
    bodyRaw: "# Summary\n\n- Item A\n- Item B",
    bodyFormat: "markdown",
    sourceItems: [{ title: "A" }],
    metadata: { query: "v2ex latest" },
  });

  assert.equal(first.created, true);
  assert.equal(first.updated, false);
  assert.match(first.renderHTML, /<h1[^>]*>Summary<\/h1>/);
  assert.match(first.renderHTML, /<li>Item A<\/li>/);

  const second = await db.saveDigest({
    namespace: "workspace-a",
    jobID: "daily-v2ex",
    scheduledFor: "2026-03-06T01:00:00Z",
    title: "V2EX Daily Updated",
    bodyRaw: "Latest update",
    bodyFormat: "plain_text",
    sourceItems: [{ title: "B" }],
  });

  assert.equal(second.digestID, first.digestID);
  assert.equal(second.created, false);
  assert.equal(second.updated, true);
  assert.match(second.renderHTML, /<p>Latest update<\/p>/);

  const digest = await db.getDigest({ namespace: "workspace-a", digestID: first.digestID });
  assert.ok(digest);
  assert.equal(digest?.title, "V2EX Daily Updated");
  assert.equal(digest?.bodyFormat, "plain_text");
  assert.equal(Array.isArray(digest?.sourceItems), true);

  const page = await db.pullDigests({ namespace: "workspace-a", cursor: null, limit: 10 }, 50);
  assert.equal(page.results.length, 1);
  assert.equal(page.results[0]?.digestID, first.digestID);
  assert.equal(page.results[0]?.title, "V2EX Daily Updated");

  await db.close();
});

test("upsert -> list -> delete -> list", async () => {
  const { db } = makeTempDB();

  await db.upsertFeed({
    namespace: "workspace-a",
    feedURL: "https://www.v2ex.com/index.xml",
    feedName: "V2EX",
    source: "ios_manual",
  });

  const listed = await db.listFeeds({ namespace: "workspace-a", cursor: null, limit: 200 });
  assert.equal(listed.results.length, 1);
  assert.equal(listed.results[0]?.feedURL, "https://www.v2ex.com/index.xml");
  assert.equal(listed.results[0]?.feedName, "V2EX");

  const deleted = await db.deleteFeed({ namespace: "workspace-a", feedURL: "https://www.v2ex.com/index.xml" });
  assert.equal(deleted.deleted, 1);

  const listedAfterDelete = await db.listFeeds({ namespace: "workspace-a", cursor: null, limit: 200 });
  assert.equal(listedAfterDelete.results.length, 0);

  await db.close();
});

test("delete feed is idempotent", async () => {
  const { db } = makeTempDB();

  await db.upsertFeed({
    namespace: "workspace-a",
    feedURL: "https://example.com/feed.xml",
    feedName: "Example",
  });

  const firstDelete = await db.deleteFeed({ namespace: "workspace-a", feedURL: "https://example.com/feed.xml" });
  assert.equal(firstDelete.deleted, 1);

  const secondDelete = await db.deleteFeed({ namespace: "workspace-a", feedURL: "https://example.com/feed.xml" });
  assert.equal(secondDelete.deleted, 0);

  await db.close();
});

test("namespace isolates feeds, items, and digests", async () => {
  const { db } = makeTempDB();

  const firstInsert = await db.ingest({
    namespace: "workspace-a",
    items: [{ title: "Shared item", url: "https://example.com/shared", kind: "article" }]
  });
  const secondInsert = await db.ingest({
    namespace: "workspace-b",
    items: [{ title: "Shared item", url: "https://example.com/shared", kind: "article" }]
  });
  assert.equal(firstInsert.inserted, 1);
  assert.equal(secondInsert.inserted, 1);

  await db.upsertFeed({
    namespace: "workspace-a",
    feedURL: "https://example.com/feed.xml",
    feedName: "Feed A"
  });
  await db.upsertFeed({
    namespace: "workspace-b",
    feedURL: "https://example.com/feed.xml",
    feedName: "Feed B"
  });

  const digestA = await db.saveDigest({
    namespace: "workspace-a",
    jobID: "daily",
    scheduledFor: "2026-03-06T01:00:00.000Z",
    title: "Digest A",
    bodyRaw: "Hello A",
    bodyFormat: "plain_text"
  });
  const digestB = await db.saveDigest({
    namespace: "workspace-b",
    jobID: "daily",
    scheduledFor: "2026-03-06T01:00:00.000Z",
    title: "Digest B",
    bodyRaw: "Hello B",
    bodyFormat: "plain_text"
  });

  assert.notEqual(digestA.digestID, digestB.digestID);

  const pullA = await db.pull({ namespace: "workspace-a", consumer: "workspace-a", limit: 10, kind: "all" }, 50);
  const pullB = await db.pull({ namespace: "workspace-b", consumer: "workspace-b", limit: 10, kind: "all" }, 50);
  assert.equal(pullA.results.length, 2);
  assert.equal(pullB.results.length, 2);

  const feedsA = await db.listFeeds({ namespace: "workspace-a", cursor: null, limit: 10 });
  const feedsB = await db.listFeeds({ namespace: "workspace-b", cursor: null, limit: 10 });
  assert.equal(feedsA.results[0]?.feedName, "Feed A");
  assert.equal(feedsB.results[0]?.feedName, "Feed B");

  const pulledDigestsA = await db.pullDigests({ namespace: "workspace-a", cursor: null, limit: 10 }, 50);
  const pulledDigestsB = await db.pullDigests({ namespace: "workspace-b", cursor: null, limit: 10 }, 50);
  assert.equal(pulledDigestsA.results[0]?.title, "Digest A");
  assert.equal(pulledDigestsB.results[0]?.title, "Digest B");

  await db.close();
});

test("mark keeps sync state isolated by namespace and consumer", async () => {
  const { db } = makeTempDB();

  await db.mark({ namespace: "workspace-a", consumer: "workspace-a", cursor: "cursor-a" });
  await db.mark({ namespace: "workspace-b", consumer: "workspace-b", cursor: "cursor-b" });

  assert.equal(await db.readSyncCursor({ namespace: "workspace-a", consumer: "workspace-a" }), "cursor-a");
  assert.equal(await db.readSyncCursor({ namespace: "workspace-b", consumer: "workspace-b" }), "cursor-b");
  assert.equal(await db.readSyncCursor({ namespace: "workspace-a", consumer: "workspace-b" }), null);

  await db.close();
});

test("register push device updates existing installation", async () => {
  const { db } = makeTempDB();

  const first = await db.registerPushDevice({
    appID: "claw-rss",
    installationID: "install-1",
    deviceToken: "a".repeat(64),
    topic: "xyz.ipocket.clawrss",
    environment: "sandbox",
    locale: "zh-CN",
    appVersion: "1.0",
    buildNumber: "1",
  });
  assert.equal(first.registered, 1);

  await db.registerPushDevice({
    appID: "claw-rss",
    installationID: "install-1",
    deviceToken: "b".repeat(64),
    topic: "xyz.ipocket.clawrss",
    environment: "production",
    locale: "en-US",
    appVersion: "1.1",
    buildNumber: "2",
  });

  const listed = await db.listPushDevices("claw-rss");
  assert.equal(listed.results.length, 1);
  assert.equal(listed.results[0]?.installationID, "install-1");
  assert.equal(listed.results[0]?.environment, "production");
  assert.equal(listed.results[0]?.enabled, true);

  await db.close();
});

test("unregister push device disables installation", async () => {
  const { db } = makeTempDB();

  await db.registerPushDevice({
    appID: "claw-rss",
    installationID: "install-2",
    deviceToken: "c".repeat(64),
    topic: "xyz.ipocket.clawrss",
    environment: "sandbox",
  });

  const result = await db.unregisterPushDevice({
    appID: "claw-rss",
    installationID: "install-2",
  });
  assert.equal(result.disabled, 1);

  const enabledCount = await db.countEnabledPushDevices("claw-rss");
  assert.equal(enabledCount, 0);

  await db.close();
});

test("push notify posts to configured Bark-style push URL", async () => {
  const relayClient = new PushRelayClient({
    targetURL: "https://push.example.com/p/device-key",
    fetchImpl: async () => new Response(JSON.stringify({
      ok: true,
      deviceKey: "device-key",
      delivered: true,
      apnsId: "apns-ok",
      disabled: false,
      reason: undefined,
      status: undefined,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });

  const response = await runPushNotify(relayClient, {
    title: "任务完成",
    body: "测试",
    data: { kind: "job_completed" },
  });

  assert.equal(response.result.sent, 1);
  assert.equal(response.result.failed, 0);
  assert.equal(response.result.disabled, 0);
  assert.equal(response.result.results[0]?.deviceKey, "device-key");
});

test("push notify digest sends background then alert through app fanout relay", async () => {
  const { db } = makeTempDB();
  await db.saveDigest({
    namespace: "workspace-alpha",
    jobID: "daily-v2ex",
    scheduledFor: "2026-03-06T01:00:00.000Z",
    title: "Digest title",
    bodyRaw: "Digest body",
    bodyFormat: "plain_text",
  });

  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const relayClient = new PushRelayClient({
    relayBaseURL: "https://push.example.com",
    appID: "claw-rss",
    fetchImpl: async (input, init) => {
      calls.push({
        url: String(input),
        body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
      });
      return new Response(JSON.stringify({
        ok: true,
        requested: 2,
        sent: 2,
        failed: 0,
        disabled: 0,
        results: [
          { deviceKey: "a", ok: true, apnsId: "1", disabled: false },
          { deviceKey: "b", ok: true, apnsId: "2", disabled: false },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  const digestPage = await db.pullDigests({ namespace: "workspace-alpha", cursor: null, limit: 1 }, 50);
  const digestID = digestPage.results[0]?.digestID;
  assert.ok(digestID);

  const response = await runPushNotifyDigest(db, relayClient, {
    namespace: "workspace-alpha",
    digestID,
    delivery: "background_then_alert",
  });

  assert.equal(response.result.delivery, "background_then_alert");
  assert.equal(response.result.namespace, "workspace-alpha");
  assert.equal(response.result.phases.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, "https://push.example.com/api/apps/workspace-alpha/push");
  assert.equal(calls[0]?.body.pushType, "background");
  assert.equal(calls[1]?.body.pushType, "alert");
  assert.equal(calls[1]?.body.title, "Digest title");

  await db.close();
});

test("legacy pre-workspace database surfaces actionable reset error", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-rss-legacy-"));
  const dbPath = path.join(tempDir, "legacy.db");
  await writeLegacySchemaDB(dbPath);

  const db = new OpenClawRSSDatabase(dbPath);

  try {
    await db.pull({ namespace: "workspace-a", consumer: "workspace-a", limit: 10, kind: "all" }, 50);
    assert.fail("Expected legacy schema check to throw.");
  } catch (error) {
    assert.equal(error instanceof Error, true);
    assert.match(
      (error as Error).message,
      /Legacy openclaw-rss database schema detected\./
    );
    assert.match(
      (error as Error).message,
      /Delete the SQLite file at .*legacy\.db and restart the plugin\./
    );
    assert.match(
      (error as Error).message,
      /no such column: namespace|missing required column namespace/
    );
  }

  await db.close();
});
