import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { lhref, stripLocale, swapLocale } from "./href";
import { EN_MESSAGES } from "./messages";
import { rich } from "./rich";
import { alternatesFor } from "./seo";
import { createTranslator } from "./translator";
import type { Messages } from "./types";

describe("lhref", () => {
  it.each([
    ["/", "/de"],
    ["/c/studio", "/de/c/studio"],
    ["/c/studio?service=x#slots", "/de/c/studio?service=x#slots"],
    ["/?via=marketplace", "/de?via=marketplace"],
    ["/it/c/studio", "/de/c/studio"],
    ["/dashboard/calendar", "/dashboard/calendar"],
    ["/api/v1/clinics", "/api/v1/clinics"],
    ["/apiary", "/de/apiary"],
    ["https://example.com/x", "https://example.com/x"],
    ["//evil.example/x", "//evil.example/x"],
    ["#top", "#top"],
  ])("%s -> %s", (path, expected) => {
    expect(lhref("de", path)).toBe(expected);
  });
});

describe("swapLocale and stripLocale", () => {
  it("switches or adds the prefix, keeping the query", () => {
    expect(swapLocale("/it/c/x?y=1", "pl")).toBe("/pl/c/x?y=1");
    expect(swapLocale("/it", "fr")).toBe("/fr");
    expect(swapLocale("/c/x", "ro")).toBe("/ro/c/x");
    expect(swapLocale("/italy", "en")).toBe("/en/italy");
  });

  it("never turns a locale path into an off-site URL", () => {
    expect(swapLocale("/it//evil.com/x", "de")).toBe("/de/evil.com/x");
    expect(swapLocale("/it/\\evil.com", "de")).toBe("/de/evil.com");
    expect(swapLocale("/it///evil.com?next=1", "de")).toBe("/de/evil.com?next=1");
    expect(stripLocale("/it//evil.com").path).toBe("/evil.com");
  });

  it("splits a pathname", () => {
    expect(stripLocale("/pt/a/tok")).toEqual({ locale: "pt", path: "/a/tok" });
    expect(stripLocale("/pt")).toEqual({ locale: "pt", path: "/" });
    expect(stripLocale("/pt?x=1")).toEqual({ locale: "pt", path: "/?x=1" });
    expect(stripLocale("/search")).toEqual({ locale: null, path: "/search" });
  });
});

describe("alternatesFor", () => {
  it("gives a canonical URL, one alternate per locale and x-default", () => {
    const a = alternatesFor("/c/studio", "es");
    expect(a.canonical).toBe("/es/c/studio");
    expect(a.languages).toEqual({
      it: "/it/c/studio",
      en: "/en/c/studio",
      de: "/de/c/studio",
      fr: "/fr/c/studio",
      es: "/es/c/studio",
      pt: "/pt/c/studio",
      ro: "/ro/c/studio",
      pl: "/pl/c/studio",
      "x-default": "/c/studio",
    });
    expect(alternatesFor("/", "it").canonical).toBe("/it");
  });

  it("accepts a prefixed path (x-pathname) and still points x-default at the unprefixed URL", () => {
    expect(alternatesFor("/it/c/x", "de")).toEqual(alternatesFor("/c/x", "de"));
    expect(alternatesFor("/it/c/x", "de").languages).toMatchObject({ "x-default": "/c/x", it: "/it/c/x" });
    expect(alternatesFor("/pl", "pl")).toMatchObject({ canonical: "/pl", languages: { "x-default": "/" } });
  });
});

describe("rich", () => {
  const html = (nodes: ReactNode[]) => renderToStaticMarkup(createElement(Fragment, null, ...nodes));
  const link = (c: ReactNode) => createElement("a", { href: "/x" }, c);
  const strong = (c: ReactNode) => createElement("strong", null, c);

  it("wraps tagged chunks, nested ones too", () => {
    expect(html(rich("Read the <link>terms</link>.", { link }))).toBe('Read the <a href="/x">terms</a>.');
    expect(html(rich("<b>Hi <link>there</link></b>!", { b: strong, link }))).toBe('<strong>Hi <a href="/x">there</a></strong>!');
  });

  it("never interprets HTML and degrades gracefully", () => {
    expect(html(rich("a <i>b</i> c", {}))).toBe("a b c"); // unknown tag: text kept, wrapper dropped
    expect(html(rich("x </link> y", { link }))).toBe("x &lt;/link&gt; y"); // stray closing tag stays text
    expect(html(rich('<img src=x onerror="alert(1)">', { link }))).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html(rich("open <link>to the end", { link }))).toBe('open <a href="/x">to the end</a>');
    expect(html(rich("plain", { link }))).toBe("plain");
  });

  it("fills variables after parsing, so values can't add, close or swallow tags", () => {
    const text = "Thanks {name}, read our <link>terms</link>.";
    expect(html(rich(text, { link }, { name: "Mario <link>click here</link>" }))).toBe(
      'Thanks Mario &lt;link&gt;click here&lt;/link&gt;, read our <a href="/x">terms</a>.',
    );
    expect(html(rich(text, { link, b: strong }, { name: "<b>Mario" }))).toBe('Thanks &lt;b&gt;Mario, read our <a href="/x">terms</a>.');
    expect(html(rich("<link>{name}</link>", { link }, { name: "Ann" }))).toBe('<a href="/x">Ann</a>');
  });

  it("takes a translator and a key, with typed variables", () => {
    const t = createTranslator("en", "common", EN_MESSAGES.common as Messages["common"]);
    expect(html(rich(t, "price.from", { b: strong }, { price: "<b>€25</b>" }))).toBe("from &lt;b&gt;€25&lt;/b&gt;");
    expect(html(rich(t, "units.days", {}, { count: 1500 }))).toBe("1,500 days");
    expect(html(rich(t, "actions.save", {}))).toBe("Save");
    // @ts-expect-error the key's placeholders are required, as for t()
    expect(html(rich(t, "price.from", {}))).toBe("from {price}");
  });
});
