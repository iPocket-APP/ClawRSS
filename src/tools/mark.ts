import type { MarkInput, OpenClawRSSDatabase } from "../db.js";
import { makeToolResponse } from "./response.js";

export const markDefinition = {
  name: "openclaw_rss_mark",
  description: "Mark a cursor as consumed by a consumer.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
      consumer: { type: "string" },
      cursor: { type: ["string", "null"] },
      count: { type: "integer", minimum: 0 }
    }
  }
} as const;

export async function runMark(db: OpenClawRSSDatabase, params: MarkInput) {
  return makeToolResponse(await db.mark(params));
}
