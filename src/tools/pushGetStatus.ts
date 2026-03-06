import { normalizeNamespace } from "../db.js";
import type { PushRelayClient } from "../push/client.js";
import { makeToolResponse } from "./response.js";

export const pushGetStatusDefinition = {
  name: "openclaw_push_get_status",
  description: "Return whether a Bark-style Apple push URL is configured for OpenClaw notifications.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
    },
  },
} as const;

export async function runPushGetStatus(
  relayClient: PushRelayClient,
  params: { namespace?: string }
) {
  const appID = params.namespace ? normalizeNamespace(params.namespace) : undefined;
  return makeToolResponse({
    configured: relayClient.canFanoutTo(appID) || relayClient.isConfigured(),
    mode: relayClient.modeFor(appID),
    serviceURL: relayClient.serviceURL(),
    pushURL: relayClient.pushURL(appID),
    appID: appID ?? undefined,
  });
}
