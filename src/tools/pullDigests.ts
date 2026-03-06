import type { OpenClawRSSDatabase, PullDigestsInput } from "../db.js";
import { makeToolResponse } from "./response.js";

export const pullDigestsDefinition = {
  name: "openclaw_rss_pull_digests",
  description: "Pull incremental OpenClaw digest records for ClawRSS.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
      cursor: { type: ["string", "null"] },
      limit: { type: "integer", minimum: 1, maximum: 500 },
    },
  },
} as const;

export async function runPullDigests(
  db: OpenClawRSSDatabase,
  params: PullDigestsInput,
  defaultLimit: number
) {
  return makeToolResponse(await db.pullDigests(params, defaultLimit));
}
