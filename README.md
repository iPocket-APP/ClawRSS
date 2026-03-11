# @ipocket/clawrss

English | [Chinese (Simplified)](README.zh-CN.md)

OpenClaw plugin that stores ClawRSS sync data in SQLite, keeps feed and digest data isolated by workspace, and sends Apple push notifications through either a relay fanout endpoint or a legacy single-device push URL.

## Plugin Identity

- npm package: `@ipocket/clawrss`
- plugin id: `clawrss`
- default SQLite path: `~/.openclaw/clawrss-sync.db`
- runtime requirement: `Node.js >= 22.13` (`node:sqlite`)

## Workspace Model

This plugin is workspace-based.

- every ClawRSS user should have a stable workspace ID such as `clawrss-demo-a`
- all feed, digest, sync cursor, and push fanout data is isolated by workspace
- every future ClawRSS tool call and every cron job for that user must include `namespace = "<workspaceID>"`
- for sync-oriented calls such as `openclaw_rss_pull` and `openclaw_rss_mark`, use the same value as both `namespace` and `consumer`
- if the same user wants to share data across multiple devices, use the same workspace ID on those devices

## Exposed Tools

- `openclaw_rss_upsert_feed`
- `openclaw_rss_ingest`
- `openclaw_rss_pull`
- `openclaw_rss_delete_feed`
- `openclaw_rss_list_feeds`
- `openclaw_rss_mark`
- `openclaw_rss_save_digest`
- `openclaw_rss_pull_digests`
- `openclaw_rss_get_digest`
- `openclaw_push_notify`
- `openclaw_push_notify_digest`
- `openclaw_push_get_status`

## Agent Tool Policy

If the active agent uses a restricted tool policy, loading the `clawrss` plugin is not enough by itself. The plugin can show as `loaded` while chat requests still fail with `Tool not available` for `openclaw_rss_*`.

Recommended additive allowlist:

```json
{
  "agents": {
    "list": [
      {
        "tools": {
          "alsoAllow": [
            "web_search",
            "openclaw_push_get_status",
            "openclaw_push_notify",
            "openclaw_push_notify_digest",
            "openclaw_rss_delete_feed",
            "openclaw_rss_mark",
            "openclaw_rss_list_feeds",
            "openclaw_rss_ingest",
            "openclaw_rss_get_digest",
            "openclaw_rss_pull",
            "openclaw_rss_pull_digests",
            "openclaw_rss_save_digest",
            "openclaw_rss_upsert_feed"
          ]
        }
      }
    ]
  }
}
```

CLI example for `agents.list[0]`:

```bash
openclaw config set agents.list[0].tools.alsoAllow '["web_search","openclaw_push_get_status","openclaw_push_notify","openclaw_push_notify_digest","openclaw_rss_delete_feed","openclaw_rss_mark","openclaw_rss_list_feeds","openclaw_rss_ingest","openclaw_rss_get_digest","openclaw_rss_pull","openclaw_rss_pull_digests","openclaw_rss_save_digest","openclaw_rss_upsert_feed"]' --strict-json
```

## One-Line Setup (npm)

Replace `clawrss-demo-a` with the real workspace ID shown in the ClawRSS iOS app.

```bash
WORKSPACE_ID="clawrss-demo-a" && RELAY_BASE_URL="https://push.ipocket.xyz" && openclaw plugins install @ipocket/clawrss@latest && openclaw plugins enable clawrss && openclaw config set plugins.entries.clawrss.config.dbPath "~/.openclaw/clawrss-sync.db" && openclaw config set plugins.entries.clawrss.config.pushRelayBaseURL "$RELAY_BASE_URL" && openclaw config set plugins.entries.clawrss.config.pushAppID "$WORKSPACE_ID" && openclaw config set plugins.entries.clawrss.config.pushTimeoutMs "10000" && openclaw gateway restart
```

## One-Line Setup (release tgz)

```bash
WORKSPACE_ID="clawrss-demo-a" && RELAY_BASE_URL="https://push.ipocket.xyz" && curl -fL "https://github.com/<owner>/clawrss-plugin/releases/latest/download/clawrss.tgz" -o /tmp/clawrss.tgz && openclaw plugins install /tmp/clawrss.tgz && openclaw plugins enable clawrss && openclaw config set plugins.entries.clawrss.config.dbPath "~/.openclaw/clawrss-sync.db" && openclaw config set plugins.entries.clawrss.config.pushRelayBaseURL "$RELAY_BASE_URL" && openclaw config set plugins.entries.clawrss.config.pushAppID "$WORKSPACE_ID" && openclaw config set plugins.entries.clawrss.config.pushTimeoutMs "10000" && openclaw gateway restart
```

## Legacy Single-Device Push Fallback

If you are only testing one device and do not want app-wide fanout yet, you can configure a direct push URL instead:

```bash
openclaw config set plugins.entries.clawrss.config.pushTargetURL "https://push.ipocket.xyz/p/<deviceKey>"
openclaw gateway restart
```

This is a compatibility path for manual testing. The recommended setup is still `pushRelayBaseURL + pushAppID = <workspaceID>`.

## Chat One-Liner Template

Replace `<workspaceID>` with the exact value shown in the ClawRSS iOS app.

```text
Please install and configure ClawRSS in the current OpenClaw environment. Requirements: 1. Install and enable the plugin `@ipocket/clawrss`; the plugin id is `clawrss`. 2. Set `plugins.entries.clawrss.config.dbPath` to `~/.openclaw/clawrss-sync.db`. 3. Set `plugins.entries.clawrss.config.pushRelayBaseURL` to `https://push.ipocket.xyz`. 4. Set `plugins.entries.clawrss.config.pushAppID` to `<workspaceID>`. 5. Set `agents.list[0].tools.alsoAllow` to `["web_search","openclaw_push_get_status","openclaw_push_notify","openclaw_push_notify_digest","openclaw_rss_delete_feed","openclaw_rss_mark","openclaw_rss_list_feeds","openclaw_rss_ingest","openclaw_rss_get_digest","openclaw_rss_pull","openclaw_rss_pull_digests","openclaw_rss_save_digest","openclaw_rss_upsert_feed"]`. 6. Restart the gateway. 7. Verify the setup by calling `openclaw_push_get_status` with `{ "namespace": "<workspaceID>" }`. 8. From now on, every ClawRSS tool call and every future cron job must include `namespace = "<workspaceID>"`; `openclaw_rss_pull` and `openclaw_rss_mark` must also use the same value as `consumer`. 9. Do not create any cron job in this step; this prompt is only for install, config, and verification. Return the install status, enabled status, dbPath, pushRelayBaseURL, workspaceID, whether `agents.list[0].tools.alsoAllow` was updated, and verification result.
```

## Docs

- Testing install guide: [docs/openclaw-testing-install-guide.md](docs/openclaw-testing-install-guide.md)
- Agent install mapping: [docs/openclaw-agent-install-clawrss.md](docs/openclaw-agent-install-clawrss.md)
- Community plugins submission draft: [docs/community-plugins-submission.md](docs/community-plugins-submission.md)
- ClawHub publish guide for the install skill: [docs/clawhub-install-skill-publish.md](docs/clawhub-install-skill-publish.md)
- Standalone ClawHub skill source: [clawhub-skills/install-clawrss/SKILL.md](clawhub-skills/install-clawrss/SKILL.md)

## Tool Contracts

All examples below use `clawrss-demo-a` as the workspace ID. Replace it with the real workspace for the target user.

### openclaw_rss_upsert_feed

```json
{
  "namespace": "clawrss-demo-a",
  "feedURL": "https://example.com/rss.xml",
  "feedName": "Example Feed",
  "category": "AI",
  "source": "ios_manual"
}
```

### openclaw_rss_ingest

```json
{
  "namespace": "clawrss-demo-a",
  "query": "ai rss",
  "provider": "brave",
  "items": [
    {
      "title": "Example",
      "url": "https://example.com/post/1",
      "kind": "article",
      "snippet": "summary",
      "sourceHost": "example.com",
      "score": 0.87,
      "publishedAt": "2026-03-07T10:00:00.000Z"
    }
  ]
}
```

### openclaw_rss_pull

```json
{
  "namespace": "clawrss-demo-a",
  "consumer": "clawrss-demo-a",
  "cursor": null,
  "limit": 50,
  "kind": "all"
}
```

Response:

```json
{
  "ok": true,
  "result": {
    "results": [
      {
        "title": "...",
        "url": "https://...",
        "kind": "rss",
        "snippet": "..."
      }
    ],
    "nextCursor": "2026-03-07T10:00:00.000Z#12345",
    "hasMore": false
  }
}
```

### openclaw_rss_mark

```json
{
  "namespace": "clawrss-demo-a",
  "consumer": "clawrss-demo-a",
  "cursor": "2026-03-07T10:00:00.000Z#12345",
  "count": 20
}
```

### openclaw_rss_delete_feed

```json
{
  "namespace": "clawrss-demo-a",
  "feedURL": "https://openai.com/news/rss.xml"
}
```

### openclaw_rss_list_feeds

```json
{
  "namespace": "clawrss-demo-a",
  "cursor": null,
  "limit": 200
}
```

Response:

```json
{
  "ok": true,
  "result": {
    "results": [
      {
        "feedName": "OpenAI News",
        "feedURL": "https://openai.com/news/rss.xml",
        "urlFingerprint": "...",
        "updatedAt": "2026-03-07T16:13:38.769Z",
        "source": "ios_manual",
        "category": "AI"
      }
    ],
    "nextCursor": "2026-03-07T16:13:38.769Z#2",
    "hasMore": false
  }
}
```

### openclaw_rss_save_digest

```json
{
  "namespace": "clawrss-demo-a",
  "jobID": "openai-daily-0900-en",
  "scheduledFor": "2026-03-07T01:00:00.000Z",
  "title": "OpenAI Daily Digest - 2026-03-07",
  "bodyRaw": "# Overview\n\n- OpenAI published new research and product updates\n- Notable AI posts were collected for review",
  "bodyFormat": "markdown",
  "sourceItems": [
    {
      "title": "OpenAI News Update",
      "url": "https://openai.com/news/",
      "publishedAt": "2026-03-07T00:40:00.000Z"
    }
  ],
  "metadata": {
    "source": "openai",
    "schedule": "daily-09:00",
    "timezone": "Asia/Shanghai"
  }
}
```

### openclaw_rss_pull_digests

```json
{
  "namespace": "clawrss-demo-a",
  "cursor": null,
  "limit": 20
}
```

Response:

```json
{
  "ok": true,
  "result": {
    "results": [
      {
        "digestID": "...",
        "jobID": "openai-daily-0900-en",
        "scheduledFor": "2026-03-07T01:00:00.000Z",
        "title": "OpenAI Daily Digest - 2026-03-07",
        "bodyFormat": "markdown",
        "renderHTML": "<h1>Overview</h1>",
        "previewText": "OpenAI published new research and product updates",
        "virtualURL": "openclaw://digest/...",
        "updatedAt": "2026-03-07T01:00:01.000Z"
      }
    ],
    "nextCursor": "2026-03-07T01:00:01.000Z#1",
    "hasMore": false
  }
}
```

### openclaw_rss_get_digest

```json
{
  "namespace": "clawrss-demo-a",
  "digestID": "<digestID>"
}
```

### openclaw_push_notify

```json
{
  "title": "AI sync finished",
  "body": "Five new items were imported.",
  "threadID": "openclaw.jobs",
  "category": "OPENCLAW_GENERIC",
  "sound": "default",
  "data": {
    "kind": "job_completed"
  }
}
```

Response:

```json
{
  "ok": true,
  "result": {
    "mode": "app_fanout",
    "requested": 2,
    "sent": 2,
    "failed": 0,
    "disabled": 0,
    "results": [
      {
        "deviceKey": "abcdef123456",
        "ok": true,
        "apnsId": "..."
      }
    ]
  }
}
```

### openclaw_push_notify_digest

```json
{
  "namespace": "clawrss-demo-a",
  "digestID": "<digestID>",
  "delivery": "background_then_alert"
}
```

### openclaw_push_get_status

```json
{
  "namespace": "clawrss-demo-a"
}
```

Response:

```json
{
  "ok": true,
  "result": {
    "configured": true,
    "mode": "app_fanout",
    "serviceURL": "https://push.ipocket.xyz",
    "pushURL": "https://push.ipocket.xyz/api/apps/clawrss-demo-a/push",
    "appID": "clawrss-demo-a"
  }
}
```

## Compatibility Notes

- this plugin does not support in-place migration from the pre-workspace SQLite schema
- if you used an older test build, delete the old SQLite file and let the plugin recreate it
- the recommended release path is relay fanout by workspace
- `pushTargetURL` remains available only for legacy single-device testing
