---
name: clawrss-openclaw-subscribe-feed
description: Use when the user asks to add a feed, subscribe to a source, follow an RSS/Atom URL, or add sources into ClawRSS/OpenClaw. Persist the subscription with openclaw_rss_upsert_feed, always include the exact workspace namespace, and verify with openclaw_rss_list_feeds before claiming success.
metadata:
  openclaw:
    always: true
    requires:
      config:
        - plugins.entries.clawrss.enabled
---

# ClawRSS OpenClaw Subscribe Feed

## Goal

This skill is for explicit feed subscription requests.

Use it when the user asks to:
- add a feed
- subscribe to a source
- follow a site in ClawRSS
- save RSS feeds into OpenClaw
- add one or more RSS/Atom URLs

This is not the same as article ingestion.

## Required tools

- `openclaw_rss_upsert_feed`
- `openclaw_rss_list_feeds`
- optional `web_search`

## Required workflow

When the user wants to add a feed, you MUST:

1. Reuse the exact ClawRSS workspace ID as `namespace`.
2. Determine the real feed URL to store.
3. Call `openclaw_rss_upsert_feed` for every confirmed feed URL.
4. Call `openclaw_rss_list_feeds` with the same `namespace` to verify the subscription is present.
5. Return the exact URLs that were verified as saved.

## Feed URL rules

- Prefer direct RSS or Atom URLs.
- If the user gives a normal website page, do not assume it is a feed.
- If you can discover a real feed URL with high confidence, store that feed URL instead of the page URL.
- If you cannot confirm a real feed URL, stop and say the source was not subscribed yet.
- Do not claim success based only on `web_search`, shell output, or a page title.

## Namespace rules

- Every tool call in this flow must use the same `namespace`.
- If the ClawRSS workspace ID is known, do not replace it with a generic value such as `default` or `claw-rss`.
- If the workspace ID is missing and cannot be inferred from the current ClawRSS context, ask for it before writing.

## Output rules

Return:
- which feeds were requested
- which feeds were actually saved
- which feeds failed and why
- the verification result from `openclaw_rss_list_feeds`

If any requested source is only a website page and not a confirmed feed, say that explicitly.

## Never do this

- Do not call only `openclaw_rss_ingest` and then say the feed was added.
- Do not save article URLs as feed subscriptions unless they are confirmed feed URLs.
- Do not skip the verification step.
