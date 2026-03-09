---
name: clawrss-openclaw-sync
description: For latest/news requests, search the web first, then persist articles and confirmed feed URLs with openclaw_rss tools. Do not use this skill for explicit add-feed or subscribe-feed requests.
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

This skill is for news retrieval and result persistence.

If the user explicitly asks to:
- add a feed
- subscribe to a source
- follow an RSS/Atom feed
- add a source into ClawRSS/OpenClaw

then do not improvise with article ingestion only. Use the dedicated add-feed flow and make the feed write observable through `openclaw_rss_upsert_feed` plus verification.

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
4. If confirmed feed URLs are detected, also call `openclaw_rss_upsert_feed` for each feed URL.
5. Return:
   - short human summary
   - persisted stats (`inserted/updated/duplicate/failed`)
   - (optional) a small preview list

Feed confirmation rule:
- treat a URL as `kind = "rss"` only when it is clearly a feed URL or the response is confirmed as an RSS/Atom feed
- do not treat a normal article page or a generic website news page as a subscribed feed
- do not claim a feed was added unless `openclaw_rss_upsert_feed` was actually called

## Pull-from-DB behavior

If the user asks to "sync" / "pull" / "show the latest from the database":
1. Call `openclaw_rss_pull` with:
   - the same workspace value as both `namespace` and `consumer`
   - `cursor: null` (latest-first)
   - `limit: 50`
   - `kind: "all"`
2. Return items in ClawRSS shape: `title/url/kind/snippet`.

## Safety and quality

- Reuse the exact ClawRSS workspace as `namespace` for every tool call. Do not silently fall back to a shared or guessed namespace when the workspace is known.
- Never fabricate URLs.
- Skip invalid/duplicate URLs.
- Keep snippets short and readable.
- If write fails, still return preview and explicit error text.
- If a page is not a confirmed feed, say so plainly instead of claiming "feed added".

Output contract for ClawRSS import:
- `title`
- `url`
- `kind` (`rss` or `article`)
- `snippet`
