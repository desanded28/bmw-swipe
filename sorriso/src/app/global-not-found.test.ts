import { isValidElement, type ReactElement, type ReactNode } from "react";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * Unmatched URLs are answered by global-not-found.tsx, which Next renders on the server (a page's
 * own notFound() is painted on the client by Next 16, so the catch-all pages that called it are
 * gone): the 404 HTML must carry <html lang>, the "Page not found" title and the h1.
 */
let requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders, cookies: async () => ({ get: () => undefined }) }));
vi.mock("./fonts", () => ({ jakarta: { variable: "font-jakarta" } }));
vi.mock("./globals.css", () => ({}));
vi.mock("@/lib/auth", async (orig) => ({ ...(await orig<typeof import("@/lib/auth")>()), getSession: async () => null }));

const { default: GlobalNotFound } = await import("./global-not-found");
const { default: LocaleNotFound } = await import("./[locale]/not-found");

/** Every element in a rendered tree (server components are not run). */
function elements(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement(node)) return [];
  return [node, ...elements((node.props as { children?: ReactNode }).children)];
}
const text = (node: ReactNode): string =>
  Array.isArray(node) ? node.map(text).join("") : isValidElement(node) ? text((node.props as { children?: ReactNode }).children) : typeof node === "string" ? node : "";

describe("404 pages", () => {
  it("public: <html lang> of the URL's locale, and the not-found content with its title and h1", async () => {
    requestHeaders = new Headers({ "x-pathname": "/pl/c/nobody/x", "x-sorriso-locale": "pl" });
    const html = (await GlobalNotFound()) as ReactElement<{ lang: string }>;
    expect(html.type).toBe("html");
    expect(html.props.lang).toBe("pl");
    expect(elements(html).some((e) => e.type === LocaleNotFound)).toBe(true);
    const content = elements(await LocaleNotFound());
    expect(text(content.find((e) => e.type === "title"))).toMatch(/^Page not found · Sorriso$/);
    expect(text(content.find((e) => e.type === "h1"))).toBe("Page not found");
  });

  it("dashboard: its own page, with the staff language, title and a way back", async () => {
    requestHeaders = new Headers({ "x-pathname": "/dashboard/nonexistent", "accept-language": "de-DE,de;q=0.9" });
    const html = (await GlobalNotFound()) as ReactElement<{ lang: string }>;
    expect(html.props.lang).toBe("de");
    const all = elements(html);
    expect(text(all.find((e) => e.type === "title"))).toContain("Page not found");
    expect(text(all.find((e) => e.type === "h1"))).toBe("Page not found");
    expect(all.some((e) => (e.props as { href?: string }).href === "/dashboard")).toBe(true);
  });

  it("no catch-all page sends unknown URLs to the client-rendered notFound() path", () => {
    expect(existsSync(path.join(__dirname, "[locale]/[...rest]/page.tsx"))).toBe(false);
    expect(existsSync(path.join(__dirname, "dashboard/[...rest]/page.tsx"))).toBe(false);
  });
});
