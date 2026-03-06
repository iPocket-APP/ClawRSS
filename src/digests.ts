import { marked } from "marked";

export type DigestBodyFormat = "html" | "markdown" | "plain_text";

export type RenderedDigestBody = {
  bodyRaw: string;
  bodyFormat: DigestBodyFormat;
  renderHTML: string;
  previewText: string;
};

const PREVIEW_LIMIT = 240;

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripHTML(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, "\"");
}

function plainTextToHTML(value: string): string {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((chunk) => normalizeWhitespace(chunk))
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return "<p></p>";
  }

  return paragraphs.map((paragraph) => `<p>${escapeHTML(paragraph)}</p>`).join("\n");
}

function markdownToHTML(value: string): string {
  const rendered = marked.parse(value, {
    async: false,
    breaks: true,
    gfm: true,
  });

  return typeof rendered === "string" && rendered.trim() ? rendered.trim() : "<p></p>";
}

function buildPreviewText(renderHTML: string): string {
  const plain = normalizeWhitespace(stripHTML(renderHTML));
  if (!plain) return "";
  return plain.length > PREVIEW_LIMIT ? `${plain.slice(0, PREVIEW_LIMIT)}…` : plain;
}

export function normalizeDigestBodyFormat(value: unknown): DigestBodyFormat {
  if (value === "html" || value === "markdown" || value === "plain_text") {
    return value;
  }
  throw new Error("Invalid bodyFormat: expected html, markdown, or plain_text.");
}

export function renderDigestBody(bodyRawInput: unknown, bodyFormatInput: unknown): RenderedDigestBody {
  if (typeof bodyRawInput !== "string" || !bodyRawInput.trim()) {
    throw new Error("Invalid bodyRaw: a non-empty digest body is required.");
  }

  const bodyRaw = bodyRawInput.trim();
  const bodyFormat = normalizeDigestBodyFormat(bodyFormatInput);

  let renderHTML: string;
  switch (bodyFormat) {
  case "html":
    renderHTML = bodyRaw;
    break;
  case "markdown":
    renderHTML = markdownToHTML(bodyRaw);
    break;
  case "plain_text":
    renderHTML = plainTextToHTML(bodyRaw);
    break;
  }

  return {
    bodyRaw,
    bodyFormat,
    renderHTML,
    previewText: buildPreviewText(renderHTML),
  };
}
