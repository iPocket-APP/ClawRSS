---
name: clawrss-openclaw-sync
description: For latest/news requests, search the web first, then persist items/feeds with openclaw_rss tools.
metadata:
  openclaw:
    always: true
    requires:
      config:
        - plugins.entries.openclaw-rss.enabled
---

# ClawRSS OpenClaw Sync

## Goal

When the user asks for "latest/new/today/hot/news/trending" information, default to:
1) web search
2) save results into openclaw-rss SQLite
3) return a concise summary + saved count

## Required tools

- `openclaw_rss_upsert_feed`
- `openclaw_rss_ingest`
- `openclaw_rss_pull`
- `openclaw_rss_mark`
- `web_search`

## Trigger rules (must follow)

If user intent contains any of:
- latest / newest / today / breaking / hot / trending / news
- "fetch the latest"
- "latest updates"
- "latest AI news"

Then you MUST:
1. Call `web_search` with the user topic.
2. Normalize each result to:
   - `title` (non-empty)
   - `url` (absolute http/https)
   - `kind` (`article` by default; `rss` only when URL is a feed)
   - `snippet`
   - optional `sourceHost`, `score`, `publishedAt`
3. Call `openclaw_rss_ingest` to persist normalized items.
4. If feed URLs are detected, also call `openclaw_rss_upsert_feed` for each feed URL.
5. Return:
   - short human summary
   - persisted stats (`inserted/updated/duplicate/failed`)
   - (optional) a small preview list

## Pull-from-DB behavior

If the user asks to "sync" / "pull" / "show the latest from the database":
1. Call `openclaw_rss_pull` with:
   - `consumer: "claw-rss"`
   - `cursor: null` (latest-first)
   - `limit: 50`
   - `kind: "all"`
2. Return items in ClawRSS shape: `title/url/kind/snippet`.

## Safety and quality

- Never fabricate URLs.
- Skip invalid/duplicate URLs.
- Keep snippets short and readable.
- If write fails, still return preview and explicit error text.

Output contract for ClawRSS import:
- `title`
- `url`
- `kind` (`rss` or `article`)
- `snippet`
