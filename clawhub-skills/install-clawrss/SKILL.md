---
name: install-clawrss
description: Install and configure the ClawRSS OpenClaw Gateway plugin when the user asks to install ClawRSS, the ClawRSS plugin, or ClawRSS tools in OpenClaw.
---

# Install ClawRSS

Use this skill when the user asks to:

- install ClawRSS in OpenClaw
- install the ClawRSS plugin
- set up ClawRSS tools in the OpenClaw Gateway
- reinstall or upgrade the ClawRSS OpenClaw plugin

## Canonical mapping

Map the user request to this plugin:

- package: `@ipocket/clawrss`
- plugin id: `clawrss`

Do not substitute a different package unless the user explicitly asks for a different source.

## Primary workflow

When command execution is available on the Gateway host:

1. Install the plugin:

```bash
openclaw plugins install @ipocket/clawrss
```

2. Enable it:

```bash
openclaw plugins enable clawrss
```

3. Ensure the minimum config exists:

```bash
openclaw config set plugins.entries.clawrss.config.dbPath "~/.openclaw/clawrss-sync.db"
```

4. Restart the Gateway:

```bash
openclaw gateway restart
```

5. Verify installation:

```bash
openclaw plugins info clawrss
```

## Optional digest push config

If the user wants digest notifications or app-wide push fanout, also configure:

```bash
openclaw config set plugins.entries.clawrss.config.pushRelayBaseURL "https://push.ipocket.xyz"
openclaw config set plugins.entries.clawrss.config.pushAppID "<workspaceID>"
openclaw config set plugins.entries.clawrss.config.pushTimeoutMs "10000"
openclaw gateway restart
```

Use the exact ClawRSS workspace ID for `<workspaceID>`. Do not collapse different users into a shared `claw-rss` bucket.

## Local development fallback

If the user wants to test a local working tree instead of npm, install from a local `.tgz` or local plugin directory.

Examples:

```bash
openclaw plugins install /absolute/path/to/openclaw-rss-plugin/dist/<package>.tgz
```

Or:

```bash
openclaw plugins install -l /absolute/path/to/openclaw-rss-plugin
```

Then still run:

```bash
openclaw plugins enable clawrss
openclaw gateway restart
```

## Failure handling

If you cannot execute commands directly:

- return the exact commands the user should run
- use the explicit scoped npm package
- keep the response short and operational

If install succeeds but the tools are missing:

- verify the plugin is enabled
- verify the Gateway was restarted
- verify `openclaw plugins info clawrss` reports the installed package

## Guardrails

- Use `@ipocket/clawrss`, not a guessed package name.
- Reuse the exact ClawRSS workspace ID for `pushAppID`, future `namespace`, and sync `consumer`.
- Do not install from a GitHub URL unless the user explicitly asks for a local or archive-based install path.
- Do not claim success without checking the command result.
