import crypto from "node:crypto";

export function hashPayload(body: string): string {
  return crypto.createHash("sha256").update(body).digest("hex");
}

export function signPushPayload(body: string, secret: string, timestamp: string): string {
  const canonical = `${timestamp}.${hashPayload(body)}`;
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex");
}
