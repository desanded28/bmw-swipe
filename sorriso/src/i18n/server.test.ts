import { beforeEach, describe, expect, it, vi } from "vitest";

// Request state the mocked next/headers and auth modules serve to the code under test.
const req = vi.hoisted(() => ({
  headers: new Map<string, string>(),
  cookies: new Map<string, string>(),
  session: null as null | { user: { locale: string | null }; org: { defaultLocale: string } | null },
}));

vi.mock("next/headers", () => ({
  headers: async () => ({ get: (k: string) => req.headers.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ get: (k: string) => (req.cookies.has(k) ? { name: k, value: req.cookies.get(k)! } : undefined) }),
}));
vi.mock("@/lib/auth", () => ({ getSession: async () => req.session }));

const { getRequestLocale, getStaffLocale } = await import("./server");

beforeEach(() => {
  req.headers.clear();
  req.cookies.clear();
  req.session = null;
});

describe("getRequestLocale", () => {
  it("prefers the URL locale set by the proxy, then the cookie, then Accept-Language, then it", async () => {
    req.headers.set("x-sorriso-locale", "pl");
    req.cookies.set("NEXT_LOCALE", "de");
    req.headers.set("accept-language", "fr");
    expect(await getRequestLocale()).toBe("pl");

    req.headers.delete("x-sorriso-locale");
    expect(await getRequestLocale()).toBe("de");

    req.cookies.set("NEXT_LOCALE", "xx");
    expect(await getRequestLocale()).toBe("fr");

    req.headers.set("accept-language", "zh-CN");
    expect(await getRequestLocale()).toBe("it");
  });

  it("never needs the cookie (the embed is localised by URL)", async () => {
    req.headers.set("x-sorriso-locale", "ro");
    expect(await getRequestLocale()).toBe("ro");
  });
});

describe("getStaffLocale", () => {
  it("prefers the user's own choice", async () => {
    req.session = { user: { locale: "de" }, org: { defaultLocale: "es" } };
    req.cookies.set("NEXT_LOCALE", "fr");
    expect(await getStaffLocale()).toBe("de");
  });

  it("then the cookie, Accept-Language, the practice default and Italian", async () => {
    req.session = { user: { locale: null }, org: { defaultLocale: "es" } };
    req.cookies.set("NEXT_LOCALE", "fr");
    req.headers.set("accept-language", "pt-BR,pt;q=0.9");
    expect(await getStaffLocale()).toBe("fr");

    req.cookies.clear();
    expect(await getStaffLocale()).toBe("pt");

    req.headers.clear();
    expect(await getStaffLocale()).toBe("es");

    req.session = { user: { locale: null }, org: null };
    expect(await getStaffLocale()).toBe("it");

    req.session = null;
    expect(await getStaffLocale()).toBe("it");
  });
});
