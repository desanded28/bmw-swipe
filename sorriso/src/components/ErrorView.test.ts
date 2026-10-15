import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/provider";
// Tests render on the server: the dictionaries come from the server-side loader.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getMessages, getT } from "@/i18n/t";
import { ErrorView } from "./ErrorView";

describe("error boundaries", () => {
  it("exist for public pages and the dashboard, inside their layouts (not only global-error's fixed Italian page)", () => {
    const app = path.join(__dirname, "../app");
    for (const f of ["[locale]/error.tsx", "[locale]/(site)/error.tsx", "dashboard/error.tsx"]) {
      const file = path.join(app, f);
      expect(existsSync(file), f).toBe(true);
      expect(readFileSync(file, "utf8")).toContain("ErrorView");
    }
  });

  it("speak the page's language and offer a retry and a way home", () => {
    const t = getT("en", "common");
    const html = renderToStaticMarkup(
      h(I18nProvider, { locale: "en", messages: getMessages("en", ["common"]), children: h(ErrorView, { reset: () => {}, homeHref: "/en" }) }),
    );
    expect(html).toMatch(new RegExp(`<h1[^>]*tabindex="-1"[^>]*>${t("pages.errorTitle")}</h1>`, "i"));
    expect(html).toContain(t("actions.retry"));
    expect(html).toContain('href="/en"');
  });
});
