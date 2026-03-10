# OpenClaw Testing Install Guide

This guide covers the fastest way to install the local `clawrss-plugin` build into OpenClaw for testing.

It is written for local development and integration testing, not for public release distribution.

## Scope

Use this guide when you want to:

- test a local plugin change in a real OpenClaw gateway
- verify the ClawRSS sync tools are loaded
- verify workspace-isolated digest save/pull/get flows
- verify push relay configuration before running real cron jobs

## Prerequisites

Before you start, make sure the OpenClaw host already has:

- Node.js 20 or newer
- `openclaw` CLI installed and working
- a running OpenClaw gateway
- access to this repository on disk

Recommended local checks:

```bash
cd /absolute/path/to/clawrss-plugin
npm install
npm run check
```

## Choose a workspace first

The current ClawRSS integration is workspace-based.

Before you install or test anything, choose a workspace ID for the user you are testing. Example:

```text
clawrss-demo-a
```

Rules:

- one workspace ID isolates one user's synced feeds, digests, and push fanout
- use different workspace IDs for different users on the same OpenClaw Gateway
- use the same workspace ID on multiple devices only when those devices should share the same ClawRSS data
- all future ClawRSS tool calls and all cron jobs for this user must include `namespace = "<workspaceID>"`
- for sync-oriented calls such as `openclaw_rss_pull` and `openclaw_rss_mark`, use the same value as both `namespace` and `consumer`

The examples below use `clawrss-demo-a`. Replace it with the real workspace ID from the ClawRSS app when testing a real device.

## Recommended install path: local `.tgz`

For testing, the safest approach is to package the current workspace and install that package into OpenClaw.

### 1. Build a local package

```bash
cd /absolute/path/to/clawrss-plugin
npm run pack:release
ls -1 dist/*.tgz
```

This creates a local package in `dist/`.

### 2. Install the package into OpenClaw

Replace the file name below with the actual `.tgz` created in `dist/`.

```bash
openclaw plugins install /absolute/path/to/clawrss-plugin/dist/<package-name>.tgz
openclaw plugins enable clawrss
```

Important behavior:

- if `clawrss` is not installed yet, you can install directly
- if the host already has the same plugin directory, OpenClaw will not overwrite it
- this applies to both local test archives (`.tgz`) and local development installs (`openclaw plugins install -l ...`) because they target the same plugin id and extension directory
- for deterministic testing, treat local development installs as a clean reinstall whenever you change install source or package type

### 2a. Recommended host-side checks before install

Run these checks on the OpenClaw host if you are installing on a remote machine instead of your local dev box:

```bash
whoami
echo "$HOME"
openclaw plugins list
openclaw plugins info clawrss || true
ls -la ~/.openclaw/extensions || true
```

What to confirm:

- you are logged in as the same user that runs the OpenClaw gateway
- `HOME` matches the plugin path you expect
- you know whether `clawrss` is already installed

This matters because OpenClaw installs the plugin under the current user's OpenClaw directory. In your test host, the collision path may look like:

```text
/home/admin/.openclaw/extensions/clawrss
```

### 2b. If install fails with `plugin already exists`

If you see this error:

```text
plugin already exists: /home/admin/.openclaw/extensions/clawrss (delete it first)
```

OpenClaw is refusing to overwrite the existing plugin directory. In practice, this means the old install must be removed first before reinstalling the new package.

Short answer to the common question "do I need to uninstall the development package first?":

- yes, if the previous install already created `~/.openclaw/extensions/clawrss`
- no, only when the plugin is not installed yet
- when switching between npm, `.tgz`, and `-l` local development installs, use a clean reinstall

Preferred uninstall flow from the official OpenClaw CLI docs:

```bash
openclaw plugins uninstall clawrss
openclaw plugins install /home/admin/<package-name>.tgz
openclaw plugins enable clawrss
```

Useful variants:

```bash
openclaw plugins uninstall clawrss --dry-run
openclaw plugins uninstall clawrss --keep-files
```

What `uninstall` does:

- removes plugin records from `plugins.entries`
- removes install metadata from `plugins.installs`
- removes linked `plugins.load.paths` entries when applicable
- removes the on-disk plugin directory under `$OPENCLAW_STATE_DIR/extensions/clawrss` by default

Use manual directory deletion only as a fallback when the uninstall command cannot clean up the broken install correctly.

Safe backup-first flow:

```bash
mv /home/admin/.openclaw/extensions/clawrss \
  /home/admin/.openclaw/extensions/clawrss.bak.$(date +%Y%m%d-%H%M%S)
openclaw plugins install /home/admin/<package-name>.tgz
openclaw plugins enable clawrss
```

Hard delete flow:

```bash
rm -rf /home/admin/.openclaw/extensions/clawrss
openclaw plugins install /home/admin/<package-name>.tgz
openclaw plugins enable clawrss
```

Notes:

- use the exact path reported by the error if it differs from `/home/admin/...`
- remove the old directory as the same user that owns that OpenClaw home
- after reinstall, always restart the gateway before testing tools

### 2c. Full clean reinstall example on a remote test host

If your package was uploaded to the test machine as `/home/admin/ipocket-clawrss-2026.3.10.tgz`, the full flow is:

```bash
whoami
echo "$HOME"
ls -l /home/admin/ipocket-clawrss-2026.3.10.tgz
openclaw plugins uninstall clawrss
openclaw plugins install /home/admin/ipocket-clawrss-2026.3.10.tgz
openclaw plugins enable clawrss
openclaw plugins info clawrss
openclaw gateway restart
```

Use this when you want a deterministic test install and do not care about keeping the previously installed copy.

## Configure the plugin

At minimum, set the SQLite path:

```bash
openclaw config set plugins.entries.clawrss.config.dbPath "~/.openclaw/clawrss-sync.db"
```

### Recommended config for digest fanout testing

This is the preferred setup for the new digest workflow because `openclaw_push_notify_digest` should normally push to all registered ClawRSS devices through the relay.

Use the same value for `pushAppID` as the workspace ID you selected above.

```bash
openclaw config set plugins.entries.clawrss.config.pushRelayBaseURL "https://push.ipocket.xyz"
openclaw config set plugins.entries.clawrss.config.pushAppID "clawrss-demo-a"
openclaw config set plugins.entries.clawrss.config.pushTimeoutMs "10000"
```

### Optional fallback config for single-device push testing

If you want to test the older single-device push mode instead of app-wide fanout, set `pushTargetURL`.

```bash
openclaw config set plugins.entries.clawrss.config.pushTargetURL "https://push.ipocket.xyz/p/<deviceKey>"
```

Notes:

- `pushRelayBaseURL + pushAppID` is the preferred setup for digest notifications.
- `pushAppID` should normally match the user's workspace ID.
- namespace-aware tools can override the target appID at request time, but keeping `pushAppID = workspaceID` makes status checks and manual testing less confusing.
- `pushTargetURL` is mainly useful for direct single-device testing.
- If both are configured, the digest flow prefers app fanout.
- If you are testing an older pre-workspace database file, delete that SQLite file first and let the plugin create a fresh one.

## Restart the gateway

After installation or config changes:

```bash
openclaw gateway restart
```

The plugin manifest already exposes the `skills/` folder, so enabling the plugin is enough for OpenClaw to discover those skills on restart.

## Smoke test checklist

After restart, verify the plugin from an OpenClaw chat or test session.

### 1. Verify the plugin can answer status

Ask OpenClaw to call:

```json
{
  "tool": "openclaw_push_get_status",
  "arguments": {
    "namespace": "clawrss-demo-a"
  }
}
```

Expected result:

- `configured: true`
- `mode: "app_fanout"` if `pushRelayBaseURL + pushAppID` is configured
- `appID: "clawrss-demo-a"`
- `mode: "bark_url"` if only `pushTargetURL` is configured

### 2. Verify basic SQLite write/read

Ask OpenClaw to call:

```json
{
  "tool": "openclaw_rss_save_digest",
  "arguments": {
    "namespace": "clawrss-demo-a",
    "jobID": "manual-test",
    "scheduledFor": "2026-03-06T09:00:00.000Z",
    "title": "Manual Test Digest",
    "bodyRaw": "# Test Digest\n\nThis is a local test.",
    "bodyFormat": "markdown",
    "sourceItems": [
      {
        "title": "OpenAI News Update",
        "url": "https://openai.com/news/",
        "publishedAt": "2026-03-06T08:30:00.000Z"
      }
    ],
    "metadata": {
      "source": "manual-test"
    }
  }
}
```

Then verify with:

```json
{
  "tool": "openclaw_rss_pull_digests",
  "arguments": {
    "namespace": "clawrss-demo-a",
    "cursor": null,
    "limit": 10
  }
}
```

And optionally:

```json
{
  "tool": "openclaw_rss_get_digest",
  "arguments": {
    "namespace": "clawrss-demo-a",
    "digestID": "<digestID returned by save_digest>"
  }
}
```

### 3. Verify push delivery path

Ask OpenClaw to call:

```json
{
  "tool": "openclaw_push_notify_digest",
  "arguments": {
    "namespace": "clawrss-demo-a",
    "digestID": "<digestID returned by save_digest>",
    "delivery": "background_then_alert"
  }
}
```

Expected result:

- `requested > 0`
- `sent > 0`
- `failed = 0` for a healthy relay/device setup
- the notification is sent only to devices registered under workspace appID `clawrss-demo-a`

## Fast update loop during testing

When you change plugin code and want OpenClaw to load the new version:

```bash
cd /absolute/path/to/clawrss-plugin
npm run check
npm run pack:release
openclaw plugins install /absolute/path/to/clawrss-plugin/dist/<package-name>.tgz
openclaw gateway restart
```

If OpenClaw still appears to use old behavior, make sure you actually installed the newly generated `.tgz` and restarted the gateway after the install.

For development packages, assume the safe rule is:

```text
old clawrss directory exists -> remove old install first -> install new package -> enable -> restart
```

If the host already has an old test copy installed, use this clean update loop instead:

```bash
cd /absolute/path/to/clawrss-plugin
npm run check
npm run pack:release
scp dist/<package-name>.tgz <host>:/home/admin/
ssh <host>
openclaw plugins uninstall clawrss
openclaw plugins install /home/admin/<package-name>.tgz
openclaw plugins enable clawrss
openclaw gateway restart
openclaw plugins info clawrss
```

## Common issues

### Plugin installs but tools do not appear

Check:

- the plugin was enabled with `openclaw plugins enable clawrss`
- the gateway was restarted after install
- the package was built from the latest local source

### Install fails with `plugin already exists`

This means the target plugin directory already exists and OpenClaw will not overwrite it automatically.

For test installs, answer the question "should I uninstall the development package first?" like this:

- yes, if `~/.openclaw/extensions/clawrss` already exists
- yes, if you are switching from `-l` local install to `.tgz`
- yes, if you are switching from npm install to local development package
- no, if this is the first install and no existing `clawrss` directory is present

Fix:

- prefer `openclaw plugins uninstall clawrss`
- if uninstall cannot clean it up, remove or move the old directory manually
- reinstall from the new `.tgz`
- run `openclaw plugins info clawrss`
- restart the gateway

Example:

```bash
openclaw plugins uninstall clawrss
openclaw plugins install /home/admin/<package-name>.tgz
openclaw plugins enable clawrss
openclaw gateway restart
```

### Digest push returns not configured

Check:

- `pushRelayBaseURL` is set
- you passed `namespace` in the tool call
- `pushAppID` is set to the same workspace ID you are testing, for example `clawrss-demo-a`
- or `pushTargetURL` is set for single-device testing

If the relay status still looks wrong, call `openclaw_push_get_status` with the same workspace namespace you plan to use for digest notifications.

### Push succeeds from OpenClaw but the iPhone does not update

Check the other two systems too:

- `ipocket-apns` is deployed with correct App Attest and APNs settings
- the iOS app is registered successfully and has a valid device token
- the app has OpenClaw base URL and token configured

### SQLite file is not updating

Check:

- `dbPath` points to a writable location
- the OpenClaw process has permission to write that directory

## Recommended test order

Use this order to narrow failures quickly:

1. `npm run check`
2. install local `.tgz`
3. choose a workspace ID
4. set `dbPath`
5. set `pushRelayBaseURL`
6. set `pushAppID = <workspaceID>`
7. restart gateway
8. test `openclaw_push_get_status` with `namespace = <workspaceID>`
9. test `openclaw_rss_save_digest` with `namespace = <workspaceID>`
10. test `openclaw_rss_pull_digests` with `namespace = <workspaceID>`
11. test `openclaw_push_notify_digest` with `namespace = <workspaceID>`

Once the steps above pass, you can move on to real cron jobs.
