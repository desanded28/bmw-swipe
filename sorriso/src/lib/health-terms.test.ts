import { describe, expect, it } from "vitest";
import { foldText, holdFindings, reviewFlags, scanHealthTerms, segmentsOf } from "./health-terms";

describe("health-term flagger", () => {
  it.each([
    ["The implant failed after two months.", "health.outcome"],
    ["L'impianto è fallito dopo due mesi", "health.outcome"],
    ["Das Implantat ist verloren gegangen", "health.outcome"],
    ["l'implant a échoué", "health.outcome"],
    ["el implante ha fallado", "health.outcome"],
    ["o implante falhou", "health.outcome"],
    ["implantul a eșuat", "health.outcome"],
    ["implant się nie przyjął", "health.outcome"],
    ["Ho avuto un'infezione", "health.infection"],
    ["Sono diabetica e mi hanno seguita bene", "health.condition"],
    ["I'm pregnant and they were careful", "health.pregnancy"],
    ["Prendo anticoagulanti", "health.medication"],
    ["Mi hanno prescritto antibiotici", "health.medication"],
  ])("holds %j (%s)", (text, rule) => {
    expect(reviewFlags(text)).toContain(rule);
  });

  it("holds phone numbers, emails and links but not prices, years or dates", () => {
    expect(reviewFlags("Chiamatemi al 333 123 4567")).toEqual(["contact.phone"]);
    expect(reviewFlags("call +39 02 1234 5678 anytime")).toEqual(["contact.phone"]);
    expect(reviewFlags("scrivete a mario.rossi@example.com")).toEqual(["contact.email"]);
    expect(reviewFlags("see www.example.com/x")).toEqual(["contact.link"]);
    expect(reviewFlags("Pagato 1.200 € nel 2024, dal 2019-2020 sono paziente. Visita il 12/03/2024 10:30")).toEqual([]);
  });

  it("only warns about treatments and symptoms", () => {
    const found = scanHealthTerms("Root canal done without pain, great dentist");
    expect(found.map((f) => [f.rule, f.severity])).toEqual([
      ["health.treatment", "warn"],
      ["health.symptom", "warn"],
    ]);
    expect(reviewFlags("Root canal done without pain")).toEqual([]);
  });

  it("passes an ordinary review", () => {
    expect(scanHealthTerms("Very kind and on time. The practice is spotless, I recommend it.")).toEqual([]);
    expect(scanHealthTerms("Gentilissimi e puntuali, studio pulito. Consigliato!")).toEqual([]);
  });

  it("reports one finding per overlap, the hold one, with spans in the original text", () => {
    const text = "Après 3 mois, l’implant a échoué.";
    const [f, ...rest] = holdFindings(text);
    expect(rest).toEqual([]);
    expect(f.rule).toBe("health.outcome");
    expect(text.slice(f.span.start, f.span.end)).toBe("implant a échoué");
    expect(f.text).toBe("implant a échoué");
  });

  it("folds diacritics, case and curly apostrophes, keeping a map to the original", () => {
    const { folded, map } = foldText("Łódź’S É");
    expect(folded).toBe("lodz's e");
    expect(map).toHaveLength(folded.length + 1);
    expect(map[map.length - 1]).toBe(8);
  });

  it("splits text into plain and matched segments for highlighting", () => {
    const text = "My implant failed, call 3331234567";
    const segments = segmentsOf(text, holdFindings(text));
    expect(segments.map((s) => [s.text, s.finding?.rule ?? null])).toEqual([
      ["My ", null],
      ["implant failed", "health.outcome"],
      [", call ", null],
      ["3331234567", "contact.phone"],
    ]);
    expect(segments.map((s) => s.text).join("")).toBe(text);
  });
});
