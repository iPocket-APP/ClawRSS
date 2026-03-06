export type PushDeliveryMode = "alert" | "background";
export type PushRelayMode = "bark_url" | "app_fanout";

export type PushRelayRequest = {
  pushType?: PushDeliveryMode;
  title?: string;
  body?: string;
  threadId?: string;
  category?: string;
  sound?: string;
  badge?: number;
  collapseId?: string;
  data?: Record<string, unknown>;
};

export type PushRelaySendResult = {
  deviceKey?: string;
  ok: boolean;
  apnsId?: string;
  status?: number;
  reason?: string;
  disabled?: boolean;
};

export type PushRelaySendResponse = {
  ok: boolean;
  mode: PushRelayMode;
  requested: number;
  sent: number;
  failed: number;
  disabled: number;
  results: PushRelaySendResult[];
};

function normalizeURL(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

function buildErrorMessage(status: number, payload: unknown): string {
  return payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
    ? payload.error
    : `Push relay request failed with status ${status}.`;
}

export class PushRelayClient {
  private readonly targetURL: string;
  private readonly relayBaseURL: string;
  private readonly appID: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: {
    targetURL?: string;
    relayBaseURL?: string;
    appID?: string;
    timeoutMs?: number;
    fetchImpl?: typeof fetch;
  }) {
    this.targetURL = normalizeURL(options.targetURL ?? "");
    this.relayBaseURL = normalizeURL(options.relayBaseURL ?? "");
    this.appID = (options.appID ?? "").trim();
    this.timeoutMs = Math.max(1000, options.timeoutMs ?? 10000);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  canFanout(): boolean {
    return Boolean(this.relayBaseURL && this.appID);
  }

  canFanoutTo(appID?: string): boolean {
    return Boolean(this.relayBaseURL && (appID?.trim() || this.appID));
  }

  isConfigured(): boolean {
    return this.canFanout() || Boolean(this.targetURL);
  }

  mode(): PushRelayMode | "none" {
    return this.modeFor();
  }

  modeFor(appIDOverride?: string): PushRelayMode | "none" {
    if (this.canFanoutTo(appIDOverride)) return "app_fanout";
    if (this.targetURL) return "bark_url";
    return "none";
  }

  pushURL(appIDOverride?: string): string {
    const effectiveAppID = appIDOverride?.trim() || this.appID;
    if (this.relayBaseURL && effectiveAppID) {
      return `${this.relayBaseURL}/api/apps/${encodeURIComponent(effectiveAppID)}/push`;
    }
    return this.targetURL;
  }

  serviceURL(): string {
    const raw = this.canFanout() ? this.relayBaseURL : this.targetURL;
    if (!raw) return "";
    try {
      return new URL(raw).origin;
    } catch {
      return "";
    }
  }

  async send(
    request: PushRelayRequest,
    options: { preferFanout?: boolean; appID?: string } = {}
  ): Promise<PushRelaySendResponse> {
    const preferFanout = options.preferFanout ?? true;
    const effectiveAppID = options.appID?.trim() || this.appID;
    const canFanout = Boolean(this.relayBaseURL && effectiveAppID);
    const endpointMode: PushRelayMode | null = preferFanout && canFanout
      ? "app_fanout"
      : this.targetURL
        ? "bark_url"
        : canFanout
          ? "app_fanout"
          : null;

    if (!endpointMode) {
      throw new Error("Push relay is not configured: missing pushTargetURL or pushRelayBaseURL + pushAppID.");
    }

    const pushURL = endpointMode === "app_fanout"
      ? `${this.relayBaseURL}/api/apps/${encodeURIComponent(effectiveAppID)}/push`
      : this.targetURL;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(pushURL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(buildErrorMessage(response.status, payload));
      }
      if (!payload || typeof payload !== "object") {
        throw new Error("Push relay returned an invalid JSON payload.");
      }

      if (endpointMode === "app_fanout") {
        const rawResults = Array.isArray(payload.results) ? payload.results as Array<Record<string, unknown>> : [];
        return {
          ok: Boolean("ok" in payload ? payload.ok : true),
          mode: endpointMode,
          requested: typeof payload.requested === "number" ? payload.requested : rawResults.length,
          sent: typeof payload.sent === "number" ? payload.sent : 0,
          failed: typeof payload.failed === "number" ? payload.failed : 0,
          disabled: typeof payload.disabled === "number" ? payload.disabled : 0,
          results: rawResults.map((entry): PushRelaySendResult => ({
            deviceKey: typeof entry?.deviceKey === "string" ? entry.deviceKey : undefined,
            ok: Boolean(entry?.ok),
            apnsId: typeof entry?.apnsId === "string" ? entry.apnsId : undefined,
            status: typeof entry?.status === "number" ? entry.status : undefined,
            reason: typeof entry?.reason === "string" ? entry.reason : undefined,
            disabled: Boolean(entry?.disabled),
          })),
        };
      }

      return {
        ok: Boolean("ok" in payload ? payload.ok : true),
        mode: endpointMode,
        requested: 1,
        sent: Boolean(payload.delivered) ? 1 : 0,
        failed: Boolean(payload.delivered) ? 0 : 1,
        disabled: Boolean(payload.disabled) ? 1 : 0,
        results: [{
          deviceKey: typeof payload.deviceKey === "string" ? payload.deviceKey : undefined,
          ok: Boolean(payload.delivered),
          apnsId: typeof payload.apnsId === "string" ? payload.apnsId : undefined,
          status: typeof payload.status === "number" ? payload.status : undefined,
          reason: typeof payload.reason === "string" ? payload.reason : undefined,
          disabled: Boolean(payload.disabled),
        }],
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
