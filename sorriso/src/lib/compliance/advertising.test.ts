import { describe, expect, it } from "vitest";
import { advertisingVerdict, checkAdvertising, checkAdvertisingFields } from "./advertising";

const verdict = (text: string) => advertisingVerdict(checkAdvertising(text));

describe("health advertising check (L. 145/2018 c. 525)", () => {
  it("blocks 'il miglior dentista, sconto 50%' and points at the words", () => {
    const text = "il miglior dentista, sconto 50%";
    const findings = checkAdvertising(text);
    expect(advertisingVerdict(findings)).toBe("block");
    const blocking = findings.filter((f) => f.severity === "block");
    expect(blocking.map((f) => [f.rule, f.text])).toEqual([
      ["superlative", "miglior"],
      ["discount", "sconto"],
    ]);
    for (const f of findings) expect(text.slice(f.span.start, f.span.end)).toBe(f.text);
  });

  it("passes a neutral bio", () => {
    const bio =
      "Laureata in Odontoiatria e Protesi Dentaria all'Università di Milano nel 2008. Si occupa di conservativa, endodonzia e protesi fissa. Riceve a Milano e a Monza.";
    expect(checkAdvertising(bio)).toEqual([]);
    expect(checkAdvertising("Graduated in dentistry in Milan; general and conservative dentistry, root canals and prevention.")).toEqual([]);
  });

  it.each([
    ["Prima visita gratuita", "free"],
    ["Risultati garantiti", "guarantee"],
    ["Foto prima/dopo", "before_after"],
    ["Offerta sbiancamento", "discount"],
    ["The best dentist in town", "superlative"],
    ["20% off whitening", "discount"],
    ["Der beste Zahnarzt", "superlative"],
    ["Consultation gratuite", "free"],
    ["El mejor dentista", "superlative"],
    ["Os preços mais baratos", "comparative"],
    ["Cel mai bun dentist", "superlative"],
    ["Najlepszy dentysta", "superlative"],
  ])("blocks %j (%s)", (text, rule) => {
    const findings = checkAdvertising(text);
    expect(advertisingVerdict(findings)).toBe("block");
    expect(findings.some((f) => f.rule === rule && f.severity === "block")).toBe(true);
  });

  it.each(["Igiene indolore", "Specialista in implantologia", "Istruzioni prima e dopo la seduta", "Promozione della salute orale"])(
    "only warns about %j",
    (text) => {
      expect(verdict(text)).toBe("warn");
    },
  );

  it("does not trip on words that merely contain a banned one", () => {
    expect(checkAdvertising("Per migliorare l'igiene a casa")).toEqual([]);
    expect(checkAdvertising("Garantiamo la sterilizzazione degli strumenti")).toEqual([]);
  });

  it("checks several fields and reports where each finding is", () => {
    const res = checkAdvertisingFields({ name: "Pulizia", description: "Pulizia gratis per i nuovi pazienti", includes: null });
    expect(res.verdict).toBe("block");
    expect(Object.keys(res.byField)).toEqual(["description"]);
  });
});
