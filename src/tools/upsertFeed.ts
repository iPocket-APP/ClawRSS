import type { OpenClawRSSDatabase, UpsertFeedInput } from "../db.js";
import { makeToolResponse } from "./response.js";

export const upsertFeedDefinition = {
  name: "openclaw_rss_upsert_feed",
  description: "Upsert a manual RSS feed subscription from iOS into OpenClaw SQLite.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
      feedURL: { type: "string" },
      feedName: { type: "string" },
      category: { type: "string" },
      source: { type: "string" }
    },
    required: ["feedURL"]
  }
} as const;

export async function runUpsertFeed(db: OpenClawRSSDatabase, params: UpsertFeedInput) {
  return makeToolResponse(await db.upsertFeed(params));
}
