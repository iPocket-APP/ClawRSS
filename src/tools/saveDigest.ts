import type { OpenClawRSSDatabase, SaveDigestInput } from "../db.js";
import { makeToolResponse } from "./response.js";

export const saveDigestDefinition = {
  name: "openclaw_rss_save_digest",
  description: "Persist an OpenClaw-generated digest article into SQLite and normalize it for ClawRSS rendering.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
      jobID: { type: "string" },
      scheduledFor: { type: "string" },
      title: { type: "string" },
      bodyRaw: { type: "string" },
      bodyFormat: { type: "string", enum: ["html", "markdown", "plain_text"] },
      sourceItems: {},
      metadata: {},
    },
    required: ["jobID", "scheduledFor", "title", "bodyRaw", "bodyFormat"],
  },
} as const;

export async function runSaveDigest(db: OpenClawRSSDatabase, params: SaveDigestInput) {
  return makeToolResponse(await db.saveDigest(params));
}
