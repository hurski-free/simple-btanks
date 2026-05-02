import http from "http";

/** Origins allowed for browser HTTP (ping API, etc.). Set on Render, e.g. `https://example.onrender.com` or comma-separated list. If unset, CORS uses `*`. */
export function readAllowedCorsOriginsFromEnv(): string[] {
  const raw = process.env.SITE_DOMAIN;
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function corsHeaders(req: http.IncomingMessage, allowedOrigins: string[]): Record<string, string> {
  if (allowedOrigins.length === 0) {
    return { "Access-Control-Allow-Origin": "*" };
  }
  const origin = req.headers.origin;
  if (typeof origin === "string") {
    const o = origin.trim().replace(/\/+$/, "");
    if (allowedOrigins.includes(o)) {
      return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
    }
  }
  return {};
}
