# Publish the `install-clawrss` Skill to ClawHub

This document explains how to publish the standalone `install-clawrss` helper skill to ClawHub.

Official references:

- [ClawHub](https://docs.openclaw.ai/tools/clawhub)
- [Skills](https://docs.openclaw.ai/tools/skills)

## Purpose

This skill is meant to improve natural-language discovery for requests like:

- install ClawRSS
- help me install ClawRSS
- 安装 ClawRSS

It is separate from the actual Gateway plugin.

The skill tells OpenClaw how to map that request to:

- npm package: `@ipocket/clawrss`
- plugin id: `clawrss`

## Skill location

The standalone skill lives here:

- [SKILL.md](../clawhub-skills/install-clawrss/SKILL.md)
- [openai.yaml](../clawhub-skills/install-clawrss/agents/openai.yaml)

## Before publishing

Verify:

1. The npm package `@ipocket/clawrss` exists.
2. The plugin install command is correct:

```bash
openclaw plugins install @ipocket/clawrss
```

3. The skill text still matches the real installation flow.

## Suggested publish flow

Run the ClawHub publish command from the skill directory or pass the skill path explicitly.

Example:

```bash
clawhub publish /absolute/path/to/clawrss-plugin/clawhub-skills/install-clawrss
```

If your ClawHub setup needs metadata flags such as title, slug, or visibility, use your local `clawhub` CLI defaults and publish policy.

## Suggested listing text

Title:

```text
Install ClawRSS
```

Short description:

```text
Install and configure the ClawRSS OpenClaw Gateway plugin.
```

Suggested tags:

- openclaw
- plugin
- install
- clawrss

## Expected behavior after publishing

Once the skill is published and discoverable in ClawHub:

- OpenClaw can discover a skill specifically for “install ClawRSS”
- the skill can map the natural-language request to the exact package and plugin id
- the actual plugin installation still happens through `openclaw plugins install ...`

## Important limitation

Publishing the skill to ClawHub does **not** publish the actual Gateway plugin.

You still need both:

1. the plugin package on npm
2. the helper skill on ClawHub

That combination is what gives you the best chance of successful natural-language install flows.
