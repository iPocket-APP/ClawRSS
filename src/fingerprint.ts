import crypto from "node:crypto";

const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "srsltid",
  "ref",
  "ref_src",
]);

export function canonicalizeURL(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();

  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) {
    url.port = "";
  }

  url.hash = "";

  const filtered = new URLSearchParams();
  const sortedPairs = [...url.searchParams.entries()].filter(([key]) => {
    const lower = key.toLowerCase();
    return !lower.startsWith("utm_") && !TRACKING_PARAMS.has(lower);
  }).sort(([aKey, aVal], [bKey, bVal]) => {
    if (aKey === bKey) return aVal.localeCompare(bVal);
    return aKey.localeCompare(bKey);
  });

  for (const [key, value] of sortedPairs) {
    filtered.append(key, value);
  }

  url.search = filtered.toString() ? `?${filtered.toString()}` : "";

  if (!url.pathname) {
    url.pathname = "/";
  }

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return url.toString();
}

export function fingerprintURL(input: string): string | null {
  const canonical = canonicalizeURL(input);
  if (!canonical) return null;
  return crypto.createHash("sha256").update(canonical).digest("hex");
}
