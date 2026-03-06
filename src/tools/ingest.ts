import type { IngestInput, OpenClawRSSDatabase } from "../db.js";
import { makeToolResponse } from "./response.js";

export const ingestDefinition = {
  name: "openclaw_rss_ingest",
  description: "Persist normalized RSS/article search results into OpenClaw SQLite.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
      query: { type: "string" },
      provider: { type: "string" },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            kind: { type: "string" },
            snippet: { type: "string" },
            sourceHost: { type: "string" },
            score: { type: "number" },
            publishedAt: { type: "string" }
          }
        }
      }
    }
  }
} as const;

export async function runIngest(db: OpenClawRSSDatabase, params: IngestInput) {
  return makeToolResponse(await db.ingest(params));
}
