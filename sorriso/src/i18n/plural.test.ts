import { describe, expect, it } from "vitest";
import { isPlural, p, plural, pluralCategories, pluralCategory } from "./plural";

describe("p()", () => {
  it("marks the leaf as a plural and keeps the forms", () => {
    const leaf = p({ one: "{count} day", other: "{count} days" });
    expect(leaf).toEqual({ __plural: true, one: "{count} day", other: "{count} days" });
    expect(isPlural(leaf)).toBe(true);
    expect(isPlural({ one: "x", other: "y" })).toBe(false);
    expect(isPlural("x")).toBe(false);
    expect(isPlural(null)).toBe(false);
  });
});

describe("plural()", () => {
  const forms = p({ one: "one", few: "few", many: "many", other: "other" });

  it("follows CLDR per locale", () => {
    expect([0, 1, 2, 5].map((n) => plural("en", n, forms))).toEqual(["other", "one", "other", "other"]);
    expect([0, 1, 2, 5].map((n) => plural("it", n, forms))).toEqual(["other", "one", "other", "other"]);
    expect([0, 1, 2, 5, 12, 22, 25, 101].map((n) => pluralCategory("pl", n))).toEqual([
      "many",
      "one",
      "few",
      "many",
      "many",
      "few",
      "many",
      "many",
    ]);
    expect([0, 1, 2, 19, 20, 101].map((n) => pluralCategory("ro", n))).toEqual(["few", "one", "few", "few", "other", "few"]);
    expect(pluralCategory("fr", 0)).toBe("one");
    expect(pluralCategory("fr", 1)).toBe("one");
  });

  it("uses pt-PT rules, where 0 is plural (pt-BR would say one)", () => {
    expect(pluralCategory("pt", 0)).toBe("other");
    expect(pluralCategory("pt", 1)).toBe("one");
  });

  it("falls back to other when the dictionary lacks the category", () => {
    const two = p({ one: "1 zi", other: "{count} zile" });
    expect(plural("ro", 5, two)).toBe("{count} zile");
    expect(plural("pl", 5, two)).toBe("{count} zile");
    expect(plural("en", Number.NaN, two)).toBe("{count} zile");
  });

  it("knows each locale's categories", () => {
    expect(pluralCategories("pl")).toEqual(expect.arrayContaining(["one", "few", "many", "other"]));
    expect(pluralCategories("ro")).toEqual(expect.arrayContaining(["one", "few", "other"]));
    expect(pluralCategories("en").sort()).toEqual(["one", "other"]);
  });
});
