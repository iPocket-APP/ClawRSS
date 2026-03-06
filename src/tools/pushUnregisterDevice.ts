import type { OpenClawRSSDatabase, UnregisterPushDeviceInput } from "../db.js";
import { makeToolResponse } from "./response.js";

export const pushUnregisterDeviceDefinition = {
  name: "openclaw_push_unregister_device",
  description: "Disable Apple push notifications for the current app installation.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      appID: { type: "string" },
      installationID: { type: "string" },
    },
    required: ["installationID"],
  },
} as const;

export async function runPushUnregisterDevice(
  db: OpenClawRSSDatabase,
  params: UnregisterPushDeviceInput,
  defaults: { appID: string }
) {
  return makeToolResponse(await db.unregisterPushDevice({
    ...params,
    appID: params.appID?.trim() || defaults.appID,
  }));
}
