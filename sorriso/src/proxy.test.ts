import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { config, proxy } from "./proxy";

// Stand-in for WP6's securityHeaders(), to check the proxy applies it on every branch.
vi.mock("@/lib/security/headers", () => ({
  securityHeaders: () => ({
    request: { "x-nonce": "test-nonce" },
    response: { "content-security-policy": "default-src 'self'", "x-content-type-options": "nosniff" },
  }),
}));

const ORIGIN = "https://sorriso.test";

type RequestOptions = { cookie?: string; acceptLanguage?: string; headers?: Record<string, string> };

function request(path: string, opts: RequestOptions = {}) {
  const headers = new Headers(opts.headers);
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.acceptLanguage) headers.set("accept-language", opts.acceptLanguage);
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

/** The request headers a NextResponse.next() forwards to the app (null when the header is dropped). */
function forwarded(res: Response, name: string): string | null {
  const names = (res.headers.get("x-middleware-override-headers") ?? "").split(",");
  return names.includes(name) ? res.headers.get(`x-middleware-request-${name}`) : null;
}

const isPassThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("proxy matcher", () => {
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  const pages = [
    "/",
    "/c/x",
    "/de/c/x",
    "/api/v1/x",
    "/api/ics/practitioner/tok.ics",
    "/dashboard",
    "/dashboard/patients/abc",
    "/a/tok",
    "/search?q=a",
  ];
  const files = ["/widget.js", "/icon.svg", "/_next/static/x.js", "/_next/image", "/_next/image?url=%2Fx.png", "/.well-known/x"];

  it.each(pages)("runs on %s", (url) => expect(matches(url)).toBe(true));
  it.each(files)("skips %s", (url) => expect(matches(url)).toBe(false));
});

describe("proxy redirects unprefixed pages", () => {
  const cases: { path: string; cookie?: string; acceptLanguage?: string; to: string }[] = [
    // The cookie (an explicit choice) wins over the browser's languages.
    { path: "/c/x", cookie: "NEXT_LOCALE=fr", acceptLanguage: "de-CH,de;q=0.9", to: "/fr/c/x" },
    // Then Accept-Language, matched on the primary subtag and honouring q-values.
    { path: "/c/x", acceptLanguage: "de-CH,de;q=0.9,en;q=0.8", to: "/de/c/x" },
    { path: "/c/x", acceptLanguage: "zh-CN, pl;q=0.9, en;q=0.5", to: "/pl/c/x" },
    { path: "/c/x", cookie: "NEXT_LOCALE=xx", acceptLanguage: "pt-BR", to: "/pt/c/x" },
    // Then the default.
    { path: "/c/x", to: "/it/c/x" },
    { path: "/c/x", acceptLanguage: "zh-CN", to: "/it/c/x" },
    { path: "/", to: "/it" },
    { path: "/", acceptLanguage: "en-US", to: "/en" },
    // The query is kept.
    { path: "/book/s?service=x&via=marketplace", cookie: "NEXT_LOCALE=ro", to: "/ro/book/s?service=x&via=marketplace" },
    { path: "/search?q=igiene&city=Milano", to: "/it/search?q=igiene&city=Milano" },
    { path: "/embed/studio", acceptLanguage: "es", to: "/es/embed/studio" },
  ];

  it.each(cases)("$path (cookie: $cookie, accept-language: $acceptLanguage) -> $to", ({ path, to, ...opts }) => {
    const res = proxy(request(path, opts));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`${ORIGIN}${to}`);
    expect(res.headers.get("vary")).toBe("Accept-Language, Cookie");
    expect(res.headers.get("content-security-policy")).toBe("default-src 'self'");
  });
});

describe("proxy passes through", () => {
  it("locale paths, with the locale and path forwarded to the app", () => {
    const res = proxy(request("/de/c/x?service=y", { acceptLanguage: "fr" }));
    expect(isPassThrough(res)).toBe(true);
    expect(res.headers.get("location")).toBeNull();
    expect(forwarded(res, "x-sorriso-locale")).toBe("de");
    expect(forwarded(res, "x-pathname")).toBe("/de/c/x");
    expect(forwarded(res, "x-nonce")).toBe("test-nonce");
    expect(res.headers.get("content-security-policy")).toBe("default-src 'self'");
  });

  it("a bare locale", () => {
    const res = proxy(request("/pl"));
    expect(isPassThrough(res)).toBe(true);
    expect(forwarded(res, "x-sorriso-locale")).toBe("pl");
  });

  const unlocalised = ["/api/v1/x", "/dashboard", "/dashboard/settings", "/a/tok", "/a/tok/review"];

  it.each(unlocalised)("%s, without a locale", (path) => {
    const res = proxy(request(path, { cookie: "NEXT_LOCALE=de", acceptLanguage: "de" }));
    expect(isPassThrough(res)).toBe(true);
    expect(forwarded(res, "x-pathname")).toBe(path);
    expect(forwarded(res, "x-sorriso-locale")).toBeNull();
    expect(forwarded(res, "x-nonce")).toBe("test-nonce");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("strips a client-sent locale header", () => {
    const spoofed = { headers: { "x-sorriso-locale": "fr" } };
    expect(forwarded(proxy(request("/dashboard", spoofed)), "x-sorriso-locale")).toBeNull();
    expect(forwarded(proxy(request("/api/v1/clinics/x", spoofed)), "x-sorriso-locale")).toBeNull();
    expect(forwarded(proxy(request("/de/c/x", spoofed)), "x-sorriso-locale")).toBe("de");
  });

  it("forwards the query string (x-search), overwriting a client-sent one", () => {
    expect(forwarded(proxy(request("/de/c/x?service=y&via=z")), "x-search")).toBe("?service=y&via=z");
    expect(forwarded(proxy(request("/de/c/x", { headers: { "x-search": "?spoofed=1" } })), "x-search")).toBe("");
    expect(forwarded(proxy(request("/dashboard/patients?q=1")), "x-search")).toBe("?q=1");
    expect(forwarded(proxy(request("/de/c/x", { headers: { "x-pathname": "/dashboard/legal" } })), "x-pathname")).toBe("/de/c/x");
  });

  it("keeps the client's other request headers", () => {
    const res = proxy(request("/it/c/x", { cookie: "NEXT_LOCALE=it", acceptLanguage: "it" }));
    expect(forwarded(res, "cookie")).toBe("NEXT_LOCALE=it");
    expect(forwarded(res, "accept-language")).toBe("it");
  });
});
