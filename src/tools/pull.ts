import type { OpenClawRSSDatabase, PullInput } from "../db.js";
import { makeToolResponse } from "./response.js";

export const pullDefinition = {
  name: "openclaw_rss_pull",
  description: "Pull incremental RSS/article records in ClawRSS-compatible shape.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
      consumer: { type: "string" },
      cursor: { type: ["string", "null"] },
      limit: { type: "integer", minimum: 1, maximum: 500 },
      kind: { type: "string", enum: ["all", "rss", "article"] }
    }
  }
} as const;

export async function runPull(db: OpenClawRSSDatabase, params: PullInput, defaultLimit: number) {
  return makeToolResponse(await db.pull(params, defaultLimit));
}
