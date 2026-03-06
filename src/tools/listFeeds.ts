import type { ListFeedsInput, OpenClawRSSDatabase } from "../db.js";
import { makeToolResponse } from "./response.js";

export const listFeedsDefinition = {
  name: "openclaw_rss_list_feeds",
  description: "List feed subscriptions with cursor pagination for remote snapshot sync.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
      cursor: { type: ["string", "null"] },
      limit: { type: "integer", minimum: 1, maximum: 500 },
    }
  }
} as const;

export async function runListFeeds(db: OpenClawRSSDatabase, params: ListFeedsInput) {
  return makeToolResponse(await db.listFeeds(params));
}
