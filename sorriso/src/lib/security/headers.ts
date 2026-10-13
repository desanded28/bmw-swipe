import type { NextRequest } from "next/server";

/**
 * Per-request security headers, applied by src/proxy.ts on every response (redirects included).
 * `request` headers are forwarded to the app (e.g. x-nonce for inline scripts); `response`
 * headers go to the browser (Content-Security-Policy with that nonce, frame-ancestors…).
 *
 * Stub with its final signature: WP6 fills it in. A per-request nonce makes every page that
 * reads it dynamically rendered.
 */
export type SecurityHeaders = { request: Record<string, string>; response: Record<string, string> };

export function securityHeaders(req: NextRequest): SecurityHeaders {
  void req;
  return { request: {}, response: {} };
}
