import test from "node:test";
import assert from "node:assert/strict";

import { canonicalizeURL, fingerprintURL } from "../src/fingerprint.js";

test("canonicalizeURL strips tracking params and fragment", () => {
  const input = "https://Example.com/path/?utm_source=x&b=2&a=1#hash";
  const canonical = canonicalizeURL(input);
  assert.equal(canonical, "https://example.com/path?a=1&b=2");
});

test("fingerprintURL returns stable sha256 hash for equivalent URLs", () => {
  const a = fingerprintURL("https://example.com/a/?utm_source=x");
  const b = fingerprintURL("https://example.com/a");
  assert.ok(a);
  assert.equal(a, b);
});
