import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/provider";
// Tests render on the server: the dictionaries come from the server-side loader.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getMessages, getT } from "@/i18n/t";
import { ReviewForm } from "./ReviewForm";

const render = (initial?: { rating: number; comment: string | null; display: "pseudonym" }) =>
  renderToStaticMarkup(
    h(I18nProvider, {
      locale: "en",
      messages: getMessages("en", ["reviews", "consents"]),
      children: h(ReviewForm, { action: async () => null, practice: "Studio", practitioner: "Dr. Rossi", firstInitialName: null, initial }),
    }),
  );

describe("ReviewForm rating", () => {
  const t = getT("en", "reviews");

  it("outlines unselected stars at 3:1 or more and says the chosen value in text", () => {
    const html = render();
    expect(html).not.toContain("text-slate-300");
    expect(html).toContain("text-slate-500");
    expect(html).toContain(t("form.ratingNone"));
    expect(render({ rating: 4, comment: null, display: "pseudonym" })).toContain(t("form.ratingChosen", { count: 4 }));
  });

  it("never disables the submit button silently while no rating is chosen", () => {
    const button = /<button[^>]*type="submit"[^>]*>/.exec(render())?.[0] ?? "";
    expect(button).not.toMatch(/\sdisabled(=""|\s|>)/);
  });
});
