import type { NotifyPushInput } from "../db.js";
import type { PushRelayClient, PushRelayRequest } from "../push/client.js";
import { makeToolResponse } from "./response.js";

export const pushNotifyDefinition = {
  name: "openclaw_push_notify",
  description: "Send an Apple push notification to the configured Bark-style push URL.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      body: { type: "string" },
      sound: { type: "string" },
      badge: { type: "integer", minimum: 0 },
      threadID: { type: "string" },
      category: { type: "string" },
      collapseID: { type: "string" },
      data: {
        type: "object",
        additionalProperties: true,
      },
    },
    required: ["title", "body"],
  },
} as const;

function sanitizeData(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function buildNotification(input: NotifyPushInput): PushRelayRequest {
  const title = input.title?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  if (!title) throw new Error("Invalid title: a non-empty notification title is required.");
  if (!body) throw new Error("Invalid body: a non-empty notification body is required.");

  return {
    pushType: "alert",
    title,
    body,
    sound: input.sound?.trim() || "default",
    badge: typeof input.badge === "number" && Number.isFinite(input.badge) ? Math.max(0, Math.trunc(input.badge)) : undefined,
    threadId: input.threadID?.trim() || undefined,
    category: input.category?.trim() || undefined,
    collapseId: input.collapseID?.trim() || undefined,
    data: sanitizeData(input.data),
  };
}

export async function runPushNotify(
  relayClient: PushRelayClient,
  params: NotifyPushInput
) {
  const notification = buildNotification(params);
  const response = await relayClient.send(notification);

  return makeToolResponse({
    mode: response.mode,
    requested: response.requested,
    sent: response.sent,
    failed: response.failed,
    disabled: response.disabled,
    results: response.results,
  });
}
