import { describe, expect, it } from "vitest";
import { asciiFallback, fitSmsBudget, gsmTypography, isGsm7, prepareSms, segments, withinBudget } from "./sms-encoding";

describe("GSM-7 detection", () => {
  it("accepts the GSM 03.38 alphabet, Italian and German accents included", () => {
    expect(isGsm7("Studio: promemoria appuntamento lunedì, è già confermato. Ü ö ß € [x]")).toBe(true);
    expect(isGsm7("Ñoño ¿qué? ¡sí!")).toBe(false); // á, í: not GSM-7 (é, ñ, ¿, ¡ are)
    expect(isGsm7("wtorek, 13 października")).toBe(false);
    expect(isGsm7("l’appuntamento")).toBe(false); // curly apostrophe
    expect(isGsm7("ok 👍")).toBe(false);
  });
});

describe("segments", () => {
  it("counts 160 / 153 septets for GSM-7 and 70 / 67 units for UCS-2", () => {
    expect(segments("a".repeat(160))).toMatchObject({ encoding: "GSM-7", segments: 1, units: 160 });
    expect(segments("a".repeat(161))).toMatchObject({ encoding: "GSM-7", segments: 2 });
    expect(segments("a".repeat(306))).toMatchObject({ segments: 2 });
    expect(segments("a".repeat(307))).toMatchObject({ segments: 3 });
    expect(segments("ą".repeat(70))).toMatchObject({ encoding: "UCS-2", segments: 1 });
    expect(segments("ą".repeat(71))).toMatchObject({ encoding: "UCS-2", segments: 2 });
    expect(segments("ą".repeat(201))).toMatchObject({ segments: 3 });
    expect(segments("ą".repeat(202))).toMatchObject({ segments: 4 });
    expect(segments("")).toMatchObject({ segments: 0 });
  });

  it("counts GSM-7 extension characters as two septets and never splits them", () => {
    expect(segments("€".repeat(80))).toMatchObject({ encoding: "GSM-7", units: 160, segments: 1 });
    expect(segments("€".repeat(81))).toMatchObject({ units: 162, segments: 2 });
    // 152 plain septets + "€": the escape pair can't straddle the segment boundary.
    expect(segments(`${"a".repeat(152)}€${"a".repeat(10)}`).segments).toBe(2);
    expect(segments(`${"a".repeat(152)}€${"a".repeat(152)}`).segments).toBe(3);
  });

  it("counts an emoji as two UCS-2 units", () => {
    expect(segments("👍".repeat(35))).toMatchObject({ encoding: "UCS-2", units: 70, segments: 1 });
  });

  it("knows the budget: 2 GSM-7 or 3 UCS-2 segments", () => {
    expect(withinBudget("a".repeat(306))).toBe(true);
    expect(withinBudget("a".repeat(307))).toBe(false);
    expect(withinBudget("ą".repeat(201))).toBe(true);
    expect(withinBudget("ą".repeat(202))).toBe(false);
  });
});

describe("ASCII fallback", () => {
  it("strips diacritics GSM-7 lacks, maps ł to l, and keeps the GSM-7 ones", () => {
    expect(asciiFallback("Przypomnienie: środa, 13 października, odwołuję, Łódź")).toBe("Przypomnienie: sroda, 13 pazdziernika, odwoluje, Lodz");
    expect(asciiFallback("marți, 13 octombrie, și ț ă î â")).toBe("marti, 13 octombrie, si t a i a");
    expect(asciiFallback("terça-feira, março, não")).toBe("terca-feira, marco, nao");
    expect(asciiFallback("mañana miércoles sábado")).toBe("mañana miércoles sabado");
    expect(asciiFallback("août, cœur, déjà")).toBe("aout, coeur, déjà");
    for (const s of ["środa", "marți", "março", "sábado", "août"]) expect(isGsm7(asciiFallback(s))).toBe(true);
  });

  it("applies only to es, pt, fr, ro and pl, and only when the practice turned it on", () => {
    expect(prepareSms("środa", "pl", { asciiFallback: true })).toBe("sroda");
    expect(prepareSms("środa", "pl", { asciiFallback: false })).toBe("środa");
    expect(prepareSms("środa", "pl")).toBe("środa");
    expect(prepareSms("Città", "it", { asciiFallback: true })).toBe("Città");
    expect(prepareSms("Grüße", "de", { asciiFallback: true })).toBe("Grüße");
  });

  it("turns typographic quotes, dashes and ellipses into GSM-7 in every language", () => {
    expect(gsmTypography("Studio Sant’Anna – “Centro”… a b")).toBe("Studio Sant'Anna - \"Centro\"... a b");
    expect(isGsm7(prepareSms("Studio Sant’Anna – via Roma", "it"))).toBe(true);
  });
});

describe("fitSmsBudget", () => {
  it("takes the fullest text within the budget, else the one with the fewest segments", () => {
    const long = "a".repeat(400);
    expect(fitSmsBudget([long, "short"])).toBe("short");
    expect(fitSmsBudget(["full text", "short"])).toBe("full text");
    expect(fitSmsBudget(["a".repeat(500), "b".repeat(350)])).toBe("b".repeat(350)); // 4 vs 3 segments
    expect(fitSmsBudget([long, "b".repeat(350)])).toBe(long); // both 3: the fuller one
    expect(fitSmsBudget(["", "x"])).toBe("x");
  });
});
