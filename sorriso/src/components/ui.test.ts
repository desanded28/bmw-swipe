import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field, Input, Select, Stars, Textarea } from "./ui";

const render = (el: React.ReactElement) => renderToStaticMarkup(el);
const attr = (html: string, tag: string, name: string) => new RegExp(`<${tag}[^>]*\\s${name}="([^"]*)"`).exec(html)?.[1];

describe("Field", () => {
  it("links the label to the control by id and keeps hint and error outside the label", () => {
    const html = render(h(Field, { label: "Email", hint: "We never share it", error: "Enter a valid email", id: "email", children: h(Input, {}) }));
    expect(attr(html, "label", "for")).toBe("email");
    expect(attr(html, "input", "id")).toBe("email");
    expect(attr(html, "input", "aria-invalid")).toBe("true");
    expect(attr(html, "input", "aria-describedby")).toBe("email-error email-hint");
    expect(html).toContain('id="email-hint"');
    expect(html).toContain('id="email-error"');
    // The label's text is the accessible name: hint and error are not inside it.
    const label = /<label[^>]*>(.*?)<\/label>/.exec(html)![1];
    expect(label).toBe("Email");
  });

  it("generates an id when none is given, and leaves valid fields un-flagged", () => {
    const html = render(h(Field, { label: "Name", children: h(Input, {}) }));
    const id = attr(html, "input", "id");
    expect(id).toBeTruthy();
    expect(attr(html, "label", "for")).toBe(id);
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain("aria-describedby");
  });

  it("wires selects, textareas and native controls, keeping the child's own describedby", () => {
    for (const control of [h(Select, {}), h(Textarea, {}), h("input", { "aria-describedby": "extra" })]) {
      const html = render(h(Field, { label: "X", hint: "Hint", id: "x", children: control }));
      expect(html).toMatch(/id="x"/);
      expect(html).toMatch(/aria-describedby="(extra )?x-hint"/);
    }
  });

  it("hands the control props to a render function for composite controls", () => {
    const html = render(
      h(Field, {
        label: "Mobile",
        error: "Required",
        id: "phone",
        children: (control: object) => h("span", null, h(Select, { "aria-label": "Country code" }), h(Input, control)),
      }),
    );
    expect(attr(html, "label", "for")).toBe("phone");
    expect(attr(html, "input", "id")).toBe("phone");
    expect(attr(html, "input", "aria-invalid")).toBe("true");
    expect(attr(html, "input", "aria-describedby")).toBe("phone-error");
  });

  it("keeps the legacy wrapping label for other children", () => {
    const html = render(h(Field, { label: "Pick", hint: "Hint", children: h("span", null, h("input", { type: "checkbox" })) }));
    expect(html).toMatch(/<label class="block"><span[^>]*>Pick<\/span><span><input/);
    expect(html).toContain("Hint");
  });
});

describe("Stars", () => {
  it("is one image with the label it is given", () => {
    const html = render(h(Stars, { value: 4.5, label: "Valutazione 4,5 su 5" }));
    expect(html).toMatch(/^<span role="img" aria-label="Valutazione 4,5 su 5"/);
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(5);
  });

  it("requires a label (no unlocalised fallback) and gives each instance its own gradients", () => {
    // @ts-expect-error: label is required; a caller without one doesn't compile.
    expect(render(h(Stars, { value: 3 }))).not.toContain("3.0/5");
    const html = render(h("div", null, h(Stars, { value: 3, label: "3 su 5" }), h(Stars, { value: 3, label: "3 su 5" })));
    const ids = [...html.matchAll(/linearGradient id="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(10);
  });
});

/** WCAG 2.x relative luminance contrast. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("form control contrast (WCAG 1.4.11)", () => {
  const css = readFileSync(path.join(__dirname, "../app/globals.css"), "utf8");
  const line = /--color-line-strong:\s*(#[0-9a-fA-F]{6})/.exec(css)?.[1];

  it("input boundaries are at least 3:1 against white and the page background", () => {
    expect(line).toBeTruthy();
    expect(contrast(line!, "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(contrast(line!, "#f7f9fb")).toBeGreaterThanOrEqual(3);
    expect(contrast(line!, "#f8fafc")).toBeGreaterThanOrEqual(3);
    const html = render(h(Input, {}));
    expect(html).toContain("ring-line-strong");
    expect(html).not.toContain("ring-slate-200");
  });

  it("placeholders and the focus ring meet their contrast minimums", () => {
    // slate-500 placeholder text (4.5:1) and the brand-600 focus ring (3:1).
    expect(contrast("#64748b", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#0a8172", "#ffffff")).toBeGreaterThanOrEqual(3);
    expect(contrast("#0a8172", "#0b1324")).toBeGreaterThanOrEqual(3);
    expect(render(h(Input, {}))).toContain("placeholder:text-slate-500");
  });
});

describe("form control width", () => {
  /** Every .tsx file under src. */
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith(".tsx") ? [path.join(dir, e.name)] : [],
    );

  it("is narrowed with max-w-*, never w-*: a w-* class loses to the controls' own w-full", () => {
    // Input/Select/Textarea join classes with clsx (no merging): w-full and w-24 both apply, and the
    // stylesheet's order makes w-full win, so e.g. a country-code select took the whole phone field.
    const offenders: string[] = [];
    for (const file of files(path.join(__dirname, ".."))) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/<(?:Input|Select|Textarea)\b[^>]*?className="([^"]*)"/g)) {
        if (/(^|\s)w-\S+/.test(m[1])) offenders.push(`${path.relative(path.join(__dirname, ".."), file)}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("horizontal scrollers", () => {
  it("are positioned, so the sr-only (absolute) texts inside them are clipped instead of widening the page", () => {
    // An absolutely positioned descendant escapes overflow clipping when its containing block is
    // outside the scroller: a table's sr-only "Open" made /dashboard/privacy 623px wide on a phone.
    const root = path.join(__dirname, "..");
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".tsx") ? [path.join(dir, e.name)] : [],
      );
    const offenders: string[] = [];
    for (const file of walk(root)) {
      for (const m of readFileSync(file, "utf8").matchAll(/className="([^"]*\boverflow-x-auto\b[^"]*)"/g)) {
        if (!/(^|\s)(relative|absolute|fixed|sticky)(\s|$)/.test(m[1])) offenders.push(`${path.relative(root, file)}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
