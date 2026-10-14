import { buildCustomRoute } from "next/dist/lib/build-custom-route";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import nextConfig, { securityHeaderRules } from "../../../next.config";
import { proxy } from "../../proxy";
import { buildCsp, createNonce, isEmbedPath, securityHeaders } from "./headers";

const ORIGIN = "https://sorriso.test";
const req = (path: string, headers: Record<string, string> = {}) => new NextRequest(`${ORIGIN}${path}`, { headers });

/** The request headers a NextResponse.next() forwards to the app. */
function forwarded(res: Response, name: string): string | null {
  const names = (res.headers.get("x-middleware-override-headers") ?? "").split(",");
  return names.includes(name) ? res.headers.get(`x-middleware-request-${name}`) : null;
}

const directive = (csp: string, name: string) =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));

describe("securityHeaders (per-request CSP)", () => {
  it("builds the policy with a fresh nonce each time", () => {
    const a = securityHeaders(req("/dashboard"));
    const b = securityHeaders(req("/dashboard"));
    const nonce = a.request["x-nonce"];
    expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(b.request["x-nonce"]).not.toBe(nonce);
    const csp = a.response["content-security-policy"];
    // Next.js reads the nonce for its own scripts from the request's CSP header: both must agree.
    expect(a.request["content-security-policy"]).toBe(csp);
    expect(directive(csp, "script-src")).toBe(`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("frame-src https://www.openstreetmap.org");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  });

  it("lets only the embed be framed, by any https site", () => {
    for (const path of ["/it/embed/studio", "/pl/embed/x?service=y", "/en/embed"]) {
      expect(isEmbedPath(new URL(`${ORIGIN}${path}`).pathname)).toBe(true);
      expect(directive(securityHeaders(req(path)).response["content-security-policy"], "frame-ancestors")).toBe("frame-ancestors https:");
    }
    for (const path of ["/embed/studio", "/it/embedded", "/it/c/embed", "/xx/embed/a", "/dashboard"]) {
      expect(directive(securityHeaders(req(path)).response["content-security-policy"], "frame-ancestors")).toBe("frame-ancestors 'none'");
    }
  });

  it("never allows eval outside development", () => {
    expect(buildCsp({ nonce: "n", embed: false })).not.toContain("unsafe-eval");
    expect(buildCsp({ nonce: "n", embed: false, dev: true })).toContain("'unsafe-eval'");
    expect(createNonce()).not.toMatch(/[&<>"']/);
  });
});

describe("proxy with the real security headers", () => {
  it("/dashboard gets a CSP with a nonce, and the app gets the same nonce (a client-sent one is replaced)", () => {
    const res = proxy(req("/dashboard", { "x-nonce": "forged", "content-security-policy": "script-src *" }));
    const nonce = forwarded(res, "x-nonce")!;
    expect(nonce).not.toBe("forged");
    expect(res.headers.get("content-security-policy")).toContain(`'nonce-${nonce}'`);
    expect(forwarded(res, "content-security-policy")).toBe(res.headers.get("content-security-policy"));
  });

  it("/it/embed/x may be framed by https sites; locale pages and redirects carry the CSP too", () => {
    expect(proxy(req("/it/embed/x")).headers.get("content-security-policy")).toContain("frame-ancestors https:");
    expect(proxy(req("/it/c/studio")).headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    const redirect = proxy(req("/c/studio"));
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });
});

/** The headers next.config.ts applies to a path, as Next does: every matching rule, later rules winning. */
function staticHeaders(path: string, production = true): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rule of securityHeaderRules(production)) {
    const { regex } = buildCustomRoute("header", { source: rule.source, headers: rule.headers });
    if (!new RegExp(regex).test(path)) continue;
    for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

describe("next.config.ts headers()", () => {
  it("hides the framework and returns the rules", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(await nextConfig.headers!()).toEqual(securityHeaderRules(process.env.NODE_ENV === "production"));
  });

  it("/dashboard responses have X-Frame-Options DENY and the baseline headers", () => {
    const h = staticHeaders("/dashboard");
    expect(h).toMatchObject({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    });
    expect(staticHeaders("/dashboard/patients/abc")["X-Frame-Options"]).toBe("DENY");
  });

  it("/it/embed/x has no X-Frame-Options; everything else is DENY", () => {
    expect(staticHeaders("/it/embed/x")["X-Frame-Options"]).toBeUndefined();
    expect(staticHeaders("/de/embed")["X-Frame-Options"]).toBeUndefined();
    for (const p of ["/", "/it", "/it/c/studio", "/it/embedx", "/embed/x", "/api/v1/clinics/x"]) {
      expect(staticHeaders(p)["X-Frame-Options"], p).toBe("DENY");
    }
  });

  it("/a/x and /it/a/x (and the other patient-record paths) have no-referrer, noindex and no-store", () => {
    for (const p of ["/a/x", "/it/a/x", "/it/a/x/review", "/api/ics/practitioner/t.ics", "/api/ics/appointment/t", "/api/v1/appointments/t/cancel", "/it/privacy", "/pl/privacy/requests"]) {
      expect(staticHeaders(p), p).toMatchObject({
        "Referrer-Policy": "no-referrer",
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "private, no-store, max-age=0",
      });
    }
    expect(staticHeaders("/it/c/studio")["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(staticHeaders("/it/c/studio")["Cache-Control"]).toBeUndefined();
  });

  it("sends HSTS in production only", () => {
    expect(staticHeaders("/", false)["Strict-Transport-Security"]).toBeUndefined();
    expect(staticHeaders("/", true)["Strict-Transport-Security"]).toBeDefined();
  });
});
