import type { GetDigestInput, OpenClawRSSDatabase } from "../db.js";
import { makeToolResponse } from "./response.js";

export const getDigestDefinition = {
  name: "openclaw_rss_get_digest",
  description: "Fetch a single digest article by digestID.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
      digestID: { type: "string" },
    },
    required: ["digestID"],
  },
} as const;

export async function runGetDigest(db: OpenClawRSSDatabase, params: GetDigestInput) {
  return makeToolResponse(await db.getDigest(params));
}
