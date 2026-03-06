import type { OpenClawRSSDatabase, PushEnvironment, RegisterPushDeviceInput } from "../db.js";
import { makeToolResponse } from "./response.js";

export const pushRegisterDeviceDefinition = {
  name: "openclaw_push_register_device",
  description: "Register or refresh the current iOS app installation for Apple push notifications.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      appID: { type: "string" },
      installationID: { type: "string" },
      deviceToken: { type: "string" },
      topic: { type: "string" },
      environment: { type: "string", enum: ["sandbox", "production"] },
      locale: { type: "string" },
      appVersion: { type: "string" },
      buildNumber: { type: "string" },
    },
    required: ["installationID", "deviceToken"],
  },
} as const;

export async function runPushRegisterDevice(
  db: OpenClawRSSDatabase,
  params: RegisterPushDeviceInput,
  defaults: { appID: string; topic: string; environment: PushEnvironment }
) {
  return makeToolResponse(await db.registerPushDevice({
    ...params,
    appID: params.appID?.trim() || defaults.appID,
    topic: params.topic?.trim() || defaults.topic,
    environment: params.environment ?? defaults.environment,
  }));
}
