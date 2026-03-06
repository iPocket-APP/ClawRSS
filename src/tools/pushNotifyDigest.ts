import { normalizeNamespace, type GetDigestInput, type OpenClawRSSDatabase } from "../db.js";
import type { PushRelayClient, PushRelayRequest, PushRelaySendResponse } from "../push/client.js";
import { makeToolResponse } from "./response.js";

type DigestDelivery = "alert" | "background" | "background_then_alert";

function normalizeDelivery(value: unknown): DigestDelivery {
  if (value === "alert" || value === "background" || value === "background_then_alert") {
    return value;
  }
  return "background_then_alert";
}

function notificationBody(previewText: string): string {
  const trimmed = previewText.trim();
  return trimmed || "Open ClawRSS to read the latest digest.";
}

function safeThreadID(jobID: string): string {
  return `openclaw.digest.${jobID.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 48) || "job"}`;
}

function buildDigestData(digest: NonNullable<Awaited<ReturnType<OpenClawRSSDatabase["getDigest"]>>>) {
  return {
    kind: "openclaw_digest",
    digestID: digest.digestID,
    jobID: digest.jobID,
    scheduledFor: digest.scheduledFor,
    virtualURL: digest.virtualURL,
  };
}

function buildBackgroundRequest(
  digest: NonNullable<Awaited<ReturnType<OpenClawRSSDatabase["getDigest"]>>>
): PushRelayRequest {
  return {
    pushType: "background",
    collapseId: digest.digestID,
    data: buildDigestData(digest),
  };
}

function buildAlertRequest(
  digest: NonNullable<Awaited<ReturnType<OpenClawRSSDatabase["getDigest"]>>>
): PushRelayRequest {
  return {
    pushType: "alert",
    title: digest.title,
    body: notificationBody(digest.previewText),
    threadId: safeThreadID(digest.jobID),
    category: "OPENCLAW_DIGEST",
    sound: "default",
    collapseId: digest.digestID,
    data: buildDigestData(digest),
  };
}

export const pushNotifyDigestDefinition = {
  name: "openclaw_push_notify_digest",
  description: "Send a digest push notification through the configured ClawRSS push relay.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      namespace: { type: "string" },
      digestID: { type: "string" },
      delivery: { type: "string", enum: ["alert", "background", "background_then_alert"] },
    },
    required: ["digestID"],
  },
} as const;

export async function runPushNotifyDigest(
  db: OpenClawRSSDatabase,
  relayClient: PushRelayClient,
  params: GetDigestInput & { namespace?: string; delivery?: DigestDelivery }
) {
  const namespace = normalizeNamespace(params.namespace);
  const digest = await db.getDigest({ namespace, digestID: params.digestID });
  if (!digest) {
    throw new Error("Digest not found.");
  }

  const delivery = normalizeDelivery(params.delivery);
  const phases: Array<{
    delivery: Exclude<DigestDelivery, "background_then_alert">;
    mode: PushRelaySendResponse["mode"];
    requested: number;
    sent: number;
    failed: number;
    disabled: number;
    results: PushRelaySendResponse["results"];
  }> = [];

  const sendPhase = async (
    phaseDelivery: "alert" | "background",
    request: PushRelayRequest
  ) => {
    const response = await relayClient.send(request, {
      preferFanout: true,
      appID: namespace
    });
    phases.push({
      delivery: phaseDelivery,
      mode: response.mode,
      requested: response.requested,
      sent: response.sent,
      failed: response.failed,
      disabled: response.disabled,
      results: response.results,
    });
  };

  if (delivery === "background" || delivery === "background_then_alert") {
    await sendPhase("background", buildBackgroundRequest(digest));
  }
  if (delivery === "alert" || delivery === "background_then_alert") {
    await sendPhase("alert", buildAlertRequest(digest));
  }

  return makeToolResponse({
    namespace,
    digestID: digest.digestID,
    delivery,
    requested: phases.reduce((sum, phase) => sum + phase.requested, 0),
    sent: phases.reduce((sum, phase) => sum + phase.sent, 0),
    failed: phases.reduce((sum, phase) => sum + phase.failed, 0),
    disabled: phases.reduce((sum, phase) => sum + phase.disabled, 0),
    phases,
  });
}
