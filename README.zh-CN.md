# @ipocket/clawrss

[English](README.md) | 简体中文

一个 OpenClaw 插件，用于把 ClawRSS 的同步数据保存在 SQLite 中，按 workspace 隔离 feed 和 digest 数据，并通过 relay fanout 或兼容的单设备 push URL 发送 Apple 推送通知。

## 插件标识

- npm package: `@ipocket/clawrss`
- plugin id: `openclaw-rss`
- 默认 SQLite 路径: `~/.openclaw/clawrss-sync.db`

## Workspace 模型

这个插件基于 workspace 工作。

- 每个 ClawRSS 用户都应该有一个稳定的 workspace ID，例如 `clawrss-demo-a`
- 所有 feed、digest、同步游标和推送 fanout 数据都按 workspace 隔离
- 后续所有 ClawRSS tool 调用和所有 cron job 都必须带 `namespace = "<workspaceID>"`
- 对于 `openclaw_rss_pull` 和 `openclaw_rss_mark` 这类同步调用，`namespace` 和 `consumer` 应使用同一个值
- 如果同一个用户希望多台设备共享数据，这些设备应使用相同的 workspace ID

## 暴露的工具

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

## 一行安装（npm）

把 `clawrss-demo-a` 替换成 ClawRSS iOS App 中显示的真实 workspace ID。

```bash
WORKSPACE_ID="clawrss-demo-a" && RELAY_BASE_URL="https://push.ipocket.xyz" && openclaw plugins install @ipocket/clawrss@latest && openclaw plugins enable openclaw-rss && openclaw config set plugins.entries.openclaw-rss.config.dbPath "~/.openclaw/clawrss-sync.db" && openclaw config set plugins.entries.openclaw-rss.config.pushRelayBaseURL "$RELAY_BASE_URL" && openclaw config set plugins.entries.openclaw-rss.config.pushAppID "$WORKSPACE_ID" && openclaw config set plugins.entries.openclaw-rss.config.pushTimeoutMs "10000" && openclaw gateway restart
```

## 一行安装（release tgz）

```bash
WORKSPACE_ID="clawrss-demo-a" && RELAY_BASE_URL="https://push.ipocket.xyz" && curl -fL "https://github.com/<owner>/openclaw-rss-plugin/releases/latest/download/openclaw-rss.tgz" -o /tmp/openclaw-rss.tgz && openclaw plugins install /tmp/openclaw-rss.tgz && openclaw plugins enable openclaw-rss && openclaw config set plugins.entries.openclaw-rss.config.dbPath "~/.openclaw/clawrss-sync.db" && openclaw config set plugins.entries.openclaw-rss.config.pushRelayBaseURL "$RELAY_BASE_URL" && openclaw config set plugins.entries.openclaw-rss.config.pushAppID "$WORKSPACE_ID" && openclaw config set plugins.entries.openclaw-rss.config.pushTimeoutMs "10000" && openclaw gateway restart
```

## 旧版单设备 Push 兼容方式

如果你只是测试一台设备，暂时不想启用 app-wide fanout，也可以配置直接 push URL：

```bash
openclaw config set plugins.entries.openclaw-rss.config.pushTargetURL "https://push.ipocket.xyz/p/<deviceKey>"
openclaw gateway restart
```

这只是兼容的手动测试路径。推荐配置仍然是 `pushRelayBaseURL + pushAppID = <workspaceID>`。

## 面向 OpenClaw 的聊天安装模板

把 `<workspaceID>` 替换成 ClawRSS iOS App 中显示的真实值。

```text
请在当前 OpenClaw 网关环境中安装并配置 ClawRSS。要求如下：1. 安装并启用插件 `@ipocket/clawrss`，插件 id 是 `openclaw-rss`。2. 设置 `plugins.entries.openclaw-rss.config.dbPath` 为 `~/.openclaw/clawrss-sync.db`。3. 设置 `plugins.entries.openclaw-rss.config.pushRelayBaseURL` 为 `https://push.ipocket.xyz`。4. 设置 `plugins.entries.openclaw-rss.config.pushAppID` 为 `<workspaceID>`。5. 重启 gateway。6. 通过调用 `openclaw_push_get_status` 并传入 `{ "namespace": "<workspaceID>" }` 验证配置成功。7. 从现在开始，所有 ClawRSS tool 调用和未来的 cron job 都必须带 `namespace = "<workspaceID>"`，其中 `openclaw_rss_pull` 和 `openclaw_rss_mark` 还必须把同一个值同时用作 `consumer`。8. 不要在这一步创建 cron job，只做安装、配置和验证。执行后请返回安装状态、启用状态、dbPath、pushRelayBaseURL、workspaceID 和验证结果。
```

## 文档

- 测试安装指南: [docs/openclaw-testing-install-guide.md](docs/openclaw-testing-install-guide.md)
- 面向 Agent 的安装映射文档: [docs/openclaw-agent-install-clawrss.md](docs/openclaw-agent-install-clawrss.md)
- Community plugins 提交草稿: [docs/community-plugins-submission.md](docs/community-plugins-submission.md)
- install skill 的 ClawHub 发布指南: [docs/clawhub-install-skill-publish.md](docs/clawhub-install-skill-publish.md)
- 独立的 ClawHub skill 源文件: [clawhub-skills/install-clawrss/SKILL.md](clawhub-skills/install-clawrss/SKILL.md)

## Tool 合约

下面所有示例都使用 `clawrss-demo-a` 作为 workspace ID。实际使用时请替换成目标用户的真实 workspace。

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

返回：

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

返回：

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
  "jobID": "openai-daily-0900-cn",
  "scheduledFor": "2026-03-07T01:00:00.000Z",
  "title": "OpenAI 每日摘要 - 2026-03-07",
  "bodyRaw": "# 今日概览\n\n- OpenAI 发布了新的研究与产品更新\n- 值得关注的 AI 文章已整理完成",
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

返回：

```json
{
  "ok": true,
  "result": {
    "results": [
      {
        "digestID": "...",
        "jobID": "openai-daily-0900-cn",
        "scheduledFor": "2026-03-07T01:00:00.000Z",
        "title": "OpenAI 每日摘要 - 2026-03-07",
        "bodyFormat": "markdown",
        "renderHTML": "<h1>今日概览</h1>",
        "previewText": "OpenAI 发布了新的研究与产品更新",
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

返回：

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

返回：

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

## 兼容性说明

- 这个插件不支持从 pre-workspace SQLite schema 原地迁移
- 如果你之前用过旧测试版本，请删除旧 SQLite 文件后让插件重新创建
- 推荐的发布路径是按 workspace 走 relay fanout
- `pushTargetURL` 只保留给 legacy 单设备测试
