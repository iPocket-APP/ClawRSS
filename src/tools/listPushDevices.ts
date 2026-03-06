import type { OpenClawRSSDatabase } from "../db.js";
import { makeToolResponse } from "./response.js";

export const listPushDevicesDefinition = {
  name: "openclaw_push_list_devices",
  description: "List registered Apple push devices for debugging.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      appID: { type: "string" },
    },
  },
} as const;

export async function runListPushDevices(
  db: OpenClawRSSDatabase,
  params: { appID?: string },
  defaults: { appID: string }
) {
  return makeToolResponse(await db.listPushDevices(params.appID?.trim() || defaults.appID));
}
