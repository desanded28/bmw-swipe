import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";
import { GET } from "./route";

const ORIGIN = "https://sorriso.test";

function get(query: string) {
  return GET(new NextRequest(`${ORIGIN}/api/locale${query}`));
}

describe("GET /api/locale", () => {
  it("redirects with 303 to the same page in the chosen language and sets NEXT_LOCALE", async () => {
    const res = await get("?to=de&next=%2Fit%2Fc%2Fstudio-bianchi%3Fservice%3Dx");
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/de/c/studio-bianchi?service=x");
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^NEXT_LOCALE=de;/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=31536000/);
    // Not production in tests: Secure is added only there.
    expect(cookie).not.toMatch(/Secure/i);
  });

  it("sets Secure in production", async () => {
    const env = process.env as Record<string, string | undefined>;
    const before = env.NODE_ENV;
    env.NODE_ENV = "production";
    try {
      const res = await get("?to=pl&next=%2F");
      expect(res.headers.get("set-cookie")).toMatch(/Secure/i);
    } finally {
      env.NODE_ENV = before;
    }
  });

  it.each([
    ["?to=en&next=%2F", "/en"],
    ["?to=fr", "/fr"],
    ["?to=pt&next=%2Fsearch%3Fcity%3DMilano%26category%3Dhygiene", "/pt/search?city=Milano&category=hygiene"],
    ["?to=ro&next=%2Fde%2Flegal%2Faccessibility%23feedback", "/ro/legal/accessibility#feedback"],
    ["?to=it&next=%2Fen%2F%2Fevil.example", "/it/evil.example"],
  ])("%s -> %s", async (query, location) => {
    const res = await get(query);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(location);
  });

  it.each([
    "?to=de&next=%2F%2Fevil.example",
    "?to=de&next=%2F%5Cevil.example",
    "?to=de&next=https%3A%2F%2Fevil.example%2F",
    "?to=de&next=evil.example",
    "?to=de&next=%2Fit%0D%0ASet-Cookie%3Ax",
    "?to=xx&next=%2Fit",
    "?to=&next=%2Fit",
    "?next=%2Fit",
    "?to=DE&next=%2Fit",
  ])("refuses %s with 400 and no cookie", async (query) => {
    const res = await get(query);
    expect(res.status).toBe(400);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("query from the Referer (switcher used without JavaScript)", () => {
  const withReferer = (query: string, referer: string, host = "sorriso.test") =>
    GET(new NextRequest(`${ORIGIN}/api/locale${query}`, { headers: { referer, host } }));

  it("keeps the query of the same page on this host", async () => {
    const res = await withReferer("?to=fr&next=%2Fde%2Fsearch", `${ORIGIN}/de/search?city=Milano&category=hygiene`);
    expect(res.headers.get("location")).toBe("/fr/search?city=Milano&category=hygiene");
  });

  it("ignores another page, another host, or a next that has its own query", async () => {
    expect((await withReferer("?to=fr&next=%2Fde%2Fsearch", `${ORIGIN}/de/c/x?y=1`)).headers.get("location")).toBe("/fr/search");
    expect((await withReferer("?to=fr&next=%2Fde%2Fsearch", "https://evil.example/de/search?x=1")).headers.get("location")).toBe(
      "/fr/search",
    );
    expect(
      (await withReferer("?to=fr&next=%2Fde%2Fsearch%3Fq%3Da", `${ORIGIN}/de/search?q=b`)).headers.get("location"),
    ).toBe("/fr/search?q=a");
  });
});

describe("automatic language detection", () => {
  it.each(["/", "/it", "/it/search", "/c/studio-bianchi", "/de/c/studio-bianchi"])(
    "never sets NEXT_LOCALE on %s",
    (path) => {
      const req = new NextRequest(`${ORIGIN}${path}`, { headers: { "accept-language": "de-DE,de;q=0.9" } });
      const res = proxy(req);
      expect(res.headers.get("set-cookie") ?? "").not.toMatch(/NEXT_LOCALE/);
    },
  );
});
