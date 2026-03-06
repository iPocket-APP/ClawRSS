import { canonicalizeURL } from "./fingerprint.js";

export type ItemKind = "rss" | "article";

export type IncomingItem = {
  title?: unknown;
  url?: unknown;
  kind?: unknown;
  snippet?: unknown;
  sourceHost?: unknown;
  score?: unknown;
  publishedAt?: unknown;
};

export type NormalizedItem = {
  kind: ItemKind;
  title: string;
  url: string;
  snippet: string;
  sourceHost: string;
  score: number;
  publishedAt: string | null;
};

function normalizeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function sanitizeSnippet(value: string): string {
  const cleaned = value
    .replace(/EXTERNAL_UNTRUSTED_CONTENT/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 500 ? `${cleaned.slice(0, 500)}…` : cleaned;
}

function normalizeKind(value: unknown): ItemKind {
  if (typeof value === "string" && value.toLowerCase() === "rss") return "rss";
  return "article";
}

function normalizeScore(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizePublishedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function normalizeItems(input: unknown): NormalizedItem[] {
  if (!Array.isArray(input)) return [];

  const byCanonical = new Map<string, NormalizedItem>();

  for (const raw of input) {
    const item = (raw ?? {}) as IncomingItem;
    const canonical = canonicalizeURL(normalizeString(item.url));
    if (!canonical) continue;

    const title = normalizeString(item.title) || new URL(canonical).hostname;
    const snippet = sanitizeSnippet(normalizeString(item.snippet));
    const sourceHost = normalizeString(item.sourceHost) || new URL(canonical).hostname.replace(/^www\./i, "");
    const normalized: NormalizedItem = {
      kind: normalizeKind(item.kind),
      title,
      url: canonical,
      snippet,
      sourceHost,
      score: normalizeScore(item.score),
      publishedAt: normalizePublishedAt(item.publishedAt),
    };

    const existing = byCanonical.get(canonical);
    if (!existing || normalized.score > existing.score) {
      byCanonical.set(canonical, normalized);
    }
  }

  return [...byCanonical.values()];
}
