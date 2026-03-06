import type { DeleteFeedInput, OpenClawRSSDatabase } from "../db.js";
import { makeToolResponse } from "./response.js";

export const deleteFeedDefinition = {
  name: "openclaw_rss_delete_feed",
  description: "Delete an RSS subscription by feed URL fingerprint.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
      feedURL: { type: "string" },
    },
    required: ["feedURL"]
  }
} as const;

export async function runDeleteFeed(db: OpenClawRSSDatabase, params: DeleteFeedInput) {
  return makeToolResponse(await db.deleteFeed(params));
}
