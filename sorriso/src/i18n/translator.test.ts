import { describe, expect, it } from "vitest";
import { EN_MESSAGES } from "./messages";
import { p } from "./plural";
import { messagesFor } from "./registry";
import { getMessages, getT } from "./server";
import { createTranslator, interpolate, mergeMessages } from "./translator";
import type { Messages, Plural, Vars, WideLeaves } from "./types";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function expectType<T extends true>(_ok: T) {}

const common = EN_MESSAGES.common as Messages["common"];

describe("interpolate", () => {
  it("replaces known placeholders and keeps unknown ones visible", () => {
    expect(interpolate("{a} and {b}", { a: "x", b: 2 })).toBe("x and 2");
    expect(interpolate("{a} and {b}", { a: "x" })).toBe("x and {b}");
    expect(interpolate("no vars")).toBe("no vars");
  });
});

describe("createTranslator", () => {
  const t = createTranslator("en", "common", common);

  it("reads nested keys and interpolates", () => {
    expect(t("actions.save")).toBe("Save");
    expect(t("price.from", { price: "€25" })).toBe("from €25");
    expect(t("otp.sms", { code: "123456" })).toMatch(/^123456 is your Sorriso verification code\./);
  });

  it("selects the plural form from vars.count", () => {
    expect(t("units.days", { count: 1 })).toBe("1 day");
    expect(t("units.days", { count: 0 })).toBe("0 days");
    expect(t("units.days", { count: 5 })).toBe("5 days");
  });

  it("uses each locale's plural rules", () => {
    const forms = { units: { days: p({ one: "{count} dzień", few: "{count} dni (few)", many: "{count} dni", other: "{count} dnia" }) } };
    const pl = createTranslator("pl", "common", mergeMessages(common, forms));
    expect(pl("units.days", { count: 1 })).toBe("1 dzień");
    expect(pl("units.days", { count: 3 })).toBe("3 dni (few)");
    expect(pl("units.days", { count: 5 })).toBe("5 dni");
    expect(pl("units.days", { count: 22 })).toBe("22 dni (few)");
    expect(pl("units.days", { count: 1.5 })).toBe("1,5 dnia");
  });

  it("shows the count with the locale's separators", () => {
    const de = createTranslator("de", "common", mergeMessages(common, { units: { days: p({ one: "{count} Tag", other: "{count} Tage" }) } }));
    expect(de("units.days", { count: 1500 })).toBe("1.500 Tage");
    expect(de("units.days", { count: 1 })).toBe("1 Tag");
    expect(createTranslator("it", "common", common)("units.hours", { count: 1.5 })).toBe("1,5 hours");
    expect(t("units.days", { count: 2500 })).toBe("2,500 days");
  });

  it("has() narrows computed keys", () => {
    const status: string = "no_show";
    // `as const` keeps the template type, so has() narrows to the status keys (no vars needed).
    const key = `appointmentStatus.${status}` as const;
    expect(t.has(key)).toBe(true);
    expect(t.has("appointmentStatus.bogus")).toBe(false);
    expect(t.has("appointmentStatus")).toBe(false); // a group, not a leaf
    if (t.has(key)) expect(t(key)).toBe("No-show");
    expect(t.locale).toBe("en");
    expect(t.ns).toBe("common");
  });

  it("returns the key itself when even English lacks it", () => {
    const loose = t as unknown as (k: string) => string;
    expect(loose("actions.doesNotExist")).toBe("actions.doesNotExist");
    expect(loose("actions.save.deeper")).toBe("actions.save.deeper");
  });
});

describe("fallback to English", () => {
  it("mergeMessages keeps English for missing or empty keys and replaces plurals whole", () => {
    const merged = mergeMessages(common, {
      actions: { save: "Salva", cancel: "" },
      units: { days: p({ one: "{count} giorno", other: "{count} giorni" }) },
      notInEnglish: { x: "dropped" },
    });
    expect(merged.actions.save).toBe("Salva");
    expect(merged.actions.cancel).toBe("Cancel");
    expect(merged.actions.back).toBe("Back");
    expect(merged.units.days).toEqual({ __plural: true, one: "{count} giorno", other: "{count} giorni" });
    expect("notInEnglish" in merged).toBe(false);
  });

  it("a locale without a translation renders English through the registry", () => {
    const de = getT("de", "common");
    expect(de("actions.save")).toBe(EN_MESSAGES.common.actions.save);
    expect(de.locale).toBe("de");
  });

  it("uses the locale's own text where it exists (Italian consents)", () => {
    const it_ = getT("it", "consents");
    expect(it_("marketing.label", { practice: "Studio Bianchi" })).toBe("Desidero ricevere novità e offerte da Studio Bianchi.");
    const en = getT("en", "consents");
    expect(en("marketing.label", { practice: "Studio Bianchi" })).toBe("I would like to receive news and offers from Studio Bianchi.");
  });

  it("memoises translators and merged trees", () => {
    expect(getT("it", "common")).toBe(getT("it", "common"));
    expect(messagesFor("pl")).toBe(messagesFor("pl"));
  });

  it("getMessages returns only the requested namespaces and refuses server-only ones", () => {
    const m = getMessages("it", ["common", "consents"]);
    expect(Object.keys(m).sort()).toEqual(["common", "consents"]);
    expect(JSON.parse(JSON.stringify(m))).toEqual(m);
    expect(() => getMessages("it", ["patientMessages" as "common"])).toThrow(/server-only/);
  });
});

describe("types", () => {
  it("checks keys, placeholders and plural counts at compile time", () => {
    const t = createTranslator("en", "common", common);
    // @ts-expect-error unknown key
    expect(t("actions.nope")).toBe("actions.nope");
    // @ts-expect-error placeholder argument missing
    expect(t("price.from")).toBe("from {price}");
    // @ts-expect-error wrong placeholder name
    expect(t("price.from", { cost: 1 })).toBe("from {price}");
    // @ts-expect-error a plural needs a numeric count
    expect(t("units.days", { count: "2" })).toBe("2 days");
    expect(t("units.days", { count: 2 })).toBe("2 days");
  });

  it("refuses variables for a key without placeholders", () => {
    const t = createTranslator("en", "common", common);
    expect(t("actions.save")).toBe("Save");
    expect(t("actions.save", {})).toBe("Save");
    // @ts-expect-error the text has no {bogus}: the value would silently disappear
    expect(t("actions.save", { bogus: 1 })).toBe("Save");
    // @ts-expect-error extra variable next to a real one
    expect(t("price.from", { price: "x", bogus: 1 })).toBe("from x");
  });

  it("lists the leaves that lost their literal type (English files without `as const`)", () => {
    type Tree = { booking: { title: string; slots: Plural; ok: "Book" }; site: { nav: { home: string } } };
    expectType<Equal<WideLeaves<Tree>, "booking.title" | "site.nav.home">>(true);
    expectType<Equal<WideLeaves<typeof EN_MESSAGES>, never>>(true);
  });

  it("keeps placeholders from every plural form (p() preserves literal types)", () => {
    const leaf = p({ one: "{count} file in {folder}", other: "{count} files by {owner}" });
    expectType<Equal<Vars<typeof leaf>, "count" | "folder" | "owner">>(true);
    expectType<Equal<Vars<"Hello {name}, see {link}">, "name" | "link">>(true);
    expectType<Equal<Vars<"plain">, never>>(true);
    // @ts-expect-error unknown plural category
    p({ one: "a", other: "b", plenty: "c" });
    expect(leaf.__plural).toBe(true);
  });
});
