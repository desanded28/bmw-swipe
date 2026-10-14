import type { NextRequest } from "next/server";
import { LOCALES } from "@/i18n/config";

/**
 * Per-request security headers, applied by src/proxy.ts on every response (redirects included).
 * `request` headers are forwarded to the app; `response` headers go to the browser.
 *
 * Content-Security-Policy with a fresh nonce per request:
 *   script-src 'self' 'nonce-…' 'strict-dynamic' — only Next's own scripts (it reads the nonce
 *   from the content-security-policy request header and puts it on every script it renders) and
 *   what they load; no inline handlers, no third-party scripts.
 *   frame-ancestors 'none', except on the embeddable widget (/{locale}/embed/…): https:.
 * The static headers (HSTS, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, COOP,
 * no-referrer/no-store on patient links) are in next.config.ts.
 *
 * A per-request nonce needs every HTML page to be rendered dynamically: a page prerendered at
 * build time has no nonce, and the browser would block its scripts. Runs in the proxy, so no
 * Node-only APIs (Web Crypto only) and no database.
 */
export type SecurityHeaders = { request: Record<string, string>; response: Record<string, string> };

/** Request headers the app relies on; always overwritten, so a client can't send its own. */
export const NONCE_HEADER = "x-nonce";

const EMBED_PATH = new RegExp(`^/(${LOCALES.join("|")})/embed(/|$)`);

export function isEmbedPath(pathname: string): boolean {
  return EMBED_PATH.test(pathname);
}

/** 128 random bits, base64 (no characters Next's nonce check rejects). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/** The OpenStreetMap embed behind the clinic page's click-to-load map. */
export const MAP_FRAME_ORIGIN = "https://www.openstreetmap.org";

export function buildCsp(opts: { nonce: string; embed: boolean; dev?: boolean }): string {
  const directives: [string, string[]][] = [
    ["default-src", ["'self'"]],
    // 'unsafe-eval' only in development (React Refresh); never in production.
    ["script-src", ["'self'", `'nonce-${opts.nonce}'`, "'strict-dynamic'", ...(opts.dev ? ["'unsafe-eval'"] : [])]],
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["img-src", ["'self'", "data:"]],
    ["font-src", ["'self'"]],
    ["connect-src", ["'self'"]],
    ["frame-src", [MAP_FRAME_ORIGIN]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'none'"]],
    ["form-action", ["'self'"]],
    ["frame-ancestors", [opts.embed ? "https:" : "'none'"]],
  ];
  return directives.map(([name, values]) => `${name} ${values.join(" ")}`).join("; ");
}

export function securityHeaders(req: NextRequest): SecurityHeaders {
  const nonce = createNonce();
  const csp = buildCsp({ nonce, embed: isEmbedPath(req.nextUrl.pathname), dev: process.env.NODE_ENV === "development" });
  return {
    // Next.js takes the nonce for its own scripts from the content-security-policy request header.
    request: { [NONCE_HEADER]: nonce, "content-security-policy": csp },
    response: { "content-security-policy": csp },
  };
}
