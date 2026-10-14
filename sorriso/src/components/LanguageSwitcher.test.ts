import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/provider";
// Tests run in Node and load the dictionaries directly; components themselves use useT().
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getMessages } from "@/i18n/t";

/** useSearchParams before the query is known: it suspends, so the server HTML is the Suspense fallback. */
const nav = vi.hoisted(() => ({ suspend: true, search: "" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/it/c/studio-bianchi",
  useSearchParams: () => {
    if (nav.suspend) throw new Promise(() => {});
    return new URLSearchParams(nav.search);
  },
}));

const { LanguageSwitcher } = await import("./LanguageSwitcher");

function render(props: Parameters<typeof LanguageSwitcher>[0]) {
  return renderToStaticMarkup(
    h(I18nProvider, { locale: "it", messages: getMessages("it", ["common", "a11y"]), children: h(LanguageSwitcher, props) }),
  );
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&"));

describe("LanguageSwitcher without JavaScript", () => {
  it("keeps the query the server saw (x-search) in the links rendered before the query is known", () => {
    nav.suspend = true;
    const links = hrefs(render({ search: "?service=sv1&ref=abc" }));
    expect(links).toHaveLength(8);
    expect(links).toContain(`/api/locale?${new URLSearchParams({ to: "de", next: "/de/c/studio-bianchi?service=sv1&ref=abc" })}`);
    // The embed's URL mode keeps it too (?parent= decides whether the frame may show the flow).
    expect(hrefs(render({ mode: "url", search: "parent=https%3A%2F%2Fhost.example" }))).toContain(
      "/fr/c/studio-bianchi?parent=https%3A%2F%2Fhost.example",
    );
  });

  it("drops the query only when the server passed none", () => {
    nav.suspend = true;
    expect(hrefs(render({}))).toContain(`/api/locale?${new URLSearchParams({ to: "de", next: "/de/c/studio-bianchi" })}`);
  });

  it("uses the live query once it is known", () => {
    nav.suspend = false;
    nav.search = "service=sv2";
    expect(hrefs(render({ search: "?service=stale" }))).toContain(
      `/api/locale?${new URLSearchParams({ to: "de", next: "/de/c/studio-bianchi?service=sv2" })}`,
    );
  });
});
