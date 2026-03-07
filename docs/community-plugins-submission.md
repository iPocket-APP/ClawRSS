# Community Plugins Submission Draft

This file is a ready-to-use draft for submitting `openclaw-rss` to the official OpenClaw `Community plugins` page.

Official reference:

- [Community plugins](https://docs.openclaw.ai/plugins/community)
- [Plugins CLI](https://docs.openclaw.ai/cli/plugins)

## What the official page requires

According to the OpenClaw docs, a community plugin listing should meet these requirements:

- the plugin package is published on npm and installable via `openclaw plugins install <npm-spec>`
- the source code is in a public GitHub repository
- the repository includes setup/use docs and an issue tracker
- the plugin shows active maintenance

The candidate entry format on the official page is:

```text
Plugin Name — short description npm: `@scope/package` repo: `https://github.com/org/repo` install: `openclaw plugins install @scope/package`
```

## Ready-to-paste listing entry

Replace the GitHub URL below with the real public repository URL before opening the PR.

```text
ClawRSS — Sync RSS/article records for ClawRSS, persist digests in SQLite, and deliver Apple push notifications through OpenClaw tools. npm: `@ipocket/clawrss` repo: `https://github.com/<org>/openclaw-rss-plugin` install: `openclaw plugins install @ipocket/clawrss`
```

## Suggested PR note

Use this as the PR body or the summary comment on the OpenClaw docs repo:

```markdown
Add `@ipocket/clawrss` to the Community plugins page.

- Plugin name: ClawRSS
- npm package: `@ipocket/clawrss`
- Repository: `https://github.com/<org>/openclaw-rss-plugin`
- Install command: `openclaw plugins install @ipocket/clawrss`

The plugin provides:

- RSS/article persistence tools for OpenClaw
- digest save/pull/get tools backed by SQLite
- Apple push notification tools for ClawRSS delivery flows

The repository includes setup documentation and active maintenance.
```

## Submission checklist

Before submitting the PR, make sure these are true:

1. `@ipocket/clawrss` is published on npm.
2. The GitHub repository is public.
3. The repository has install and usage docs.
4. Issues are enabled on the repository.
5. The install command works:

```bash
openclaw plugins install @ipocket/clawrss
openclaw plugins enable openclaw-rss
openclaw gateway restart
```

## Important install note

The OpenClaw plugins CLI treats npm specs as registry-only package specs. Use the explicit scoped package name:

```bash
openclaw plugins install @ipocket/clawrss
```

Do not rely on a bare unscoped name for this plugin.
