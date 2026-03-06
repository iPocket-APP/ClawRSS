type ToolContentText = {
  type: "text";
  text: string;
};

export type ToolResponse<T> = {
  ok: true;
  content: ToolContentText[];
  result: T;
};

function safeJSONString(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "{\"ok\":false,\"error\":\"serialization_failed\"}";
  }
}

export function makeToolResponse<T>(result: T): ToolResponse<T> {
  return {
    ok: true,
    // Agent runtime can consume `content`; ClawRSS sync path consumes `result`.
    content: [{ type: "text", text: safeJSONString(result) }],
    result,
  };
}
