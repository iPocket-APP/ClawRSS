---
name: clawrss-openclaw-push
description: Use Apple push notifications for ClawRSS when the user asks to notify them immediately or after a task/cron completes.
metadata:
  openclaw:
    always: true
    requires:
      config:
        - plugins.entries.openclaw-rss.enabled
---

# ClawRSS OpenClaw Push

## Goal

When the user explicitly asks for an Apple/iPhone push notification, call the push tool. This skill assumes the plugin already has a Bark-style `pushTargetURL` configured from the ClawRSS app.

## Required tools

- `openclaw_push_notify`

## Trigger rules

If the user says any of:

- "send me an Apple push notification"
- "send me an iPhone notification"
- "notify me when it is done"
- "remind me when the task completes"

Then:

1. Finish the main task first if there is one.
2. Call `openclaw_push_notify` as the last step.
3. Keep the push short and factual.

If creating a cron job that should notify on completion, explicitly include the push tool call in the cron instructions.
