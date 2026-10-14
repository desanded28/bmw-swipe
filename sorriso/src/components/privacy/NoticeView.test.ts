import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NoticeBody } from "./NoticeView";

const html = (text: string) => renderToStaticMarkup(createElement(NoticeBody, { text }));

describe("NoticeBody", () => {
  it("renders paragraphs, line breaks and lists from plain text", () => {
    const out = html("First line\nSecond line\n\n- one;\n- two.\n\nLast.");
    expect(out).toBe("<p>First line<br/>Second line</p><ul class=\"list-disc space-y-1.5 pl-5 marker:text-slate-400\"><li>one;</li><li>two.</li></ul><p>Last.</p>");
  });

  it("links URLs, www addresses and emails, leaving trailing punctuation as text", () => {
    const out = html("See https://sorriso.test/it/privacy. Write to privacy@studio.test, or www.garanteprivacy.it).");
    expect(out).toContain('href="https://sorriso.test/it/privacy"');
    expect(out).toContain(">https://sorriso.test/it/privacy</a>.");
    expect(out).toContain('href="mailto:privacy@studio.test"');
    expect(out).toContain('href="https://www.garanteprivacy.it"');
    expect(out).toContain("</a>).");
  });

  it("never renders markup from the text", () => {
    const out = html("<script>alert(1)</script> and <b>bold</b>");
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;");
  });
});

describe("NoticeView", () => {
  it("shows the version, the date, the Italian-prevails banner, the first layer and anchored sections", async () => {
    const { NoticeView } = await import("./NoticeView");
    const out = renderToStaticMarkup(
      createElement(NoticeView, {
        title: "Privacy notice: Studio",
        sections: [
          { id: "summary", title: "In short", body: "Short version." },
          { id: "controller", title: "Who is responsible", body: "Controller: Studio S.r.l." },
          { id: "rights", title: "Your rights", body: "- access;\n- erasure." },
        ],
        version: "Version 2026-10",
        updated: "In force since 14 October 2026",
        labels: { contents: "Contents", backToTop: "Back to the top", otherNotices: "Other notices" },
        italian: { text: "In case of discrepancy the Italian version prevails.", linkLabel: "Read the Italian version", href: "/it/c/studio/privacy" },
      }),
    );
    expect(out).toContain("Version 2026-10");
    expect(out).toContain("In force since 14 October 2026");
    expect(out).toContain("the Italian version prevails");
    expect(out).toContain('href="/it/c/studio/privacy"');
    expect(out).toContain('id="summary"');
    expect(out).toContain('href="#controller"');
    expect(out).toContain('id="rights"');
    expect(out).toMatch(/<h1[^>]*>Privacy notice: Studio<\/h1>/);
  });

  it("has no banner in Italian", async () => {
    const { NoticeView } = await import("./NoticeView");
    const out = renderToStaticMarkup(
      createElement(NoticeView, {
        title: "Informativa",
        sections: [{ id: "summary", title: "In breve", body: "Testo." }],
        version: "Versione 2026-10",
        updated: "In vigore dal 14 ottobre 2026",
        labels: { contents: "Indice", backToTop: "Torna su", otherNotices: "Altre informative" },
        italian: null,
      }),
    );
    expect(out).not.toContain('role="note"');
  });
});
