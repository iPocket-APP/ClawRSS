# Install ClawRSS Plugin in OpenClaw

This document is written for both humans and OpenClaw agents.

Its purpose is to make the intent unambiguous when a user says things like:

- install ClawRSS
- help me install ClawRSS
- install the ClawRSS OpenClaw plugin
- 帮我安装 ClawRSS
- 安装 ClawRSS 插件

## Canonical mapping

If the user asks to install **ClawRSS** in OpenClaw, the default plugin mapping is:

- product name: `ClawRSS`
- npm package: `@ipocket/clawrss`
- plugin id: `clawrss`

ClawRSS is now workspace-based.

If the request comes from the ClawRSS iOS app, reuse the exact workspace ID shown in the app or provided in the copied setup prompt.

Do not collapse all users into a global `claw-rss` app bucket.

Do not map this request to a skill package or a different plugin unless the user explicitly asks for something else.

## Preferred install path

OpenClaw plugin installs should use the npm package when available.

Preferred command:

```bash
npx -y @ipocket/clawrss setup --workspace <workspaceID> --restart
```

Notes:

- Plugin installs run on the machine hosting the OpenClaw Gateway.
- If the Gateway is remote, install the plugin on the remote Gateway host, not only on the local client machine.
- The ClawRSS plugin now requires `Node.js >= 22.13` because it uses the built-in `node:sqlite` module.
- OpenClaw plugin installs support npm specs, local folders, and local archives. They do not install arbitrary plugins from a GitHub URL directly.
- The setup CLI writes `plugins.entries.clawrss.config.*` and merges the required tool allowlist into `agents.list[0].tools.alsoAllow`.

## Required minimum config

If the setup CLI is not available, configure the SQLite path after install:

```bash
openclaw config set plugins.entries.clawrss.config.dbPath "~/.openclaw/clawrss-sync.db"
```

If the user already has a workspace ID, also configure the relay base URL and set `pushAppID` to that same workspace ID:

```bash
openclaw config set plugins.entries.clawrss.config.pushRelayBaseURL "https://push.ipocket.xyz"
openclaw config set plugins.entries.clawrss.config.pushAppID "<workspaceID>"
openclaw config set plugins.entries.clawrss.config.pushTimeoutMs "10000"
openclaw gateway restart
```

## Recommended config for ClawRSS digest notifications

For app-wide push fanout, use the user's workspace ID as the app fanout bucket:

```bash
openclaw config set plugins.entries.clawrss.config.pushRelayBaseURL "https://push.ipocket.xyz"
openclaw config set plugins.entries.clawrss.config.pushAppID "<workspaceID>"
openclaw config set plugins.entries.clawrss.config.pushTimeoutMs "10000"
openclaw gateway restart
```

This keeps different users isolated even when they share the same OpenClaw Gateway.

## Workspace rule for all future tool calls

Every future ClawRSS tool call and every cron job created for that user must include:

```text
namespace = "<workspaceID>"
```

For sync-oriented calls, use the same workspace value as both:

- `namespace`
- `consumer`

This is required for workspace-isolated feeds, digests, sync cursors, and push fanout.

## Agent tool allowlist

If the active OpenClaw agent uses a restrictive tool policy, the plugin may be `loaded` but its tools can still be hidden from chat sessions. In that case, update `agents.list[0].tools.alsoAllow` before testing:

```bash
openclaw config set agents.list[0].tools.alsoAllow '["openclaw_push_get_status","openclaw_push_notify","openclaw_push_notify_digest","openclaw_rss_delete_feed","openclaw_rss_mark","openclaw_rss_list_feeds","openclaw_rss_ingest","openclaw_rss_get_digest","openclaw_rss_pull","openclaw_rss_pull_digests","openclaw_rss_save_digest","openclaw_rss_upsert_feed"]' --strict-json
```

This is the minimum list that keeps ClawRSS install, sync, digest, and push flows callable from the default agent profile.

## Verification steps

After installation, verify:

```bash
openclaw plugins list
openclaw plugins info clawrss
```

If the plugin is loaded correctly, OpenClaw should expose these tool families:

- `openclaw_rss_*`
- `openclaw_push_*`

If chat calls still return `Tool not available`, check `agents.list[0].tools.alsoAllow` before debugging the plugin itself.

Useful smoke tests:

```json
{
  "tool": "openclaw_push_get_status",
  "arguments": {
    "namespace": "<workspaceID>"
  }
}
```

```json
{
  "tool": "openclaw_rss_save_digest",
  "arguments": {
    "namespace": "<workspaceID>",
    "jobID": "install-check",
    "scheduledFor": "2026-03-06T09:00:00.000Z",
    "title": "Install Check Digest",
    "bodyRaw": "# Install Check\n\nThis is a workspace verification digest.",
    "bodyFormat": "markdown",
    "sourceItems": []
  }
}
```

```json
{
  "tool": "openclaw_rss_pull_digests",
  "arguments": {
    "namespace": "<workspaceID>",
    "cursor": null,
    "limit": 5
  }
}
```

## Local development fallback

If the npm package is unavailable, install from a local tarball or local plugin directory.

Examples:

```bash
openclaw plugins install /absolute/path/to/clawrss-plugin/dist/<package>.tgz
openclaw plugins enable clawrss
openclaw gateway restart
```

Or:

```bash
openclaw plugins install -l /absolute/path/to/clawrss-plugin
openclaw plugins enable clawrss
openclaw gateway restart
```

## Agent behavior guidance

When the user asks to install ClawRSS:

1. Prefer the setup CLI `npx -y @ipocket/clawrss setup --workspace <workspaceID> --restart`.
2. Reuse the workspace ID from the user's ClawRSS app or copied setup prompt. If the workspace is missing, ask for it instead of silently using a global shared value.
3. If the setup CLI cannot be used, fall back to manual `openclaw plugins install` plus config patching.
4. Verify `openclaw_push_get_status` with that workspace namespace.
5. From then on, keep using the same workspace namespace in every ClawRSS tool call and every cron job for that user.
6. Report the exact commands executed, the workspace used, whether `agents.list[0].tools.alsoAllow` was updated, and whether install/config/restart/verification succeeded.

If the environment does not allow command execution, return the exact commands the user should run.

## Search and discovery notes

This document improves discoverability when:

- it exists in a local `docs/` directory visible to OpenClaw
- or it is published on a public site that search engines can index

For best search results, keep these exact strings in public documentation:

- `ClawRSS`
- `OpenClaw plugin`
- `@ipocket/clawrss`
- `clawrss`
- `openclaw plugins install @ipocket/clawrss`

## Important limitation

ClawHub is a registry for **skills**, not general Gateway plugins.

That means:

- publishing a skill to ClawHub can help OpenClaw discover a helper skill
- but the actual ClawRSS Gateway plugin still installs through `openclaw plugins install ...`

If you want fully reliable natural-language install behavior, do not rely on generic web search alone. Keep the npm package published, keep this install document public, and optionally provide a separate install helper skill.
