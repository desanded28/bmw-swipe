import { scanWith, segmentsOf, type Finding, type PatternRule } from "../health-terms";

/**
 * Health advertising rules for the texts a practice publishes on Sorriso (service names and
 * descriptions, "price includes", practitioner bios and areas of interest). Pure and
 * client-safe: the dashboard forms highlight matches while typing, and the save actions run the
 * same check on the server.
 *
 * Italian law (Legge 30 dicembre 2018 n. 145, art. 1 c. 525, on top of Legge 248/2006 art. 2 and
 * the dental Code of Ethics) allows health-care communications to carry only information useful
 * to the safety of treatment, "excluding any promotional or suggestive element". In practice the
 * Ordini (and the Garante for the market, AGCM) object to superlatives, discounts and "free"
 * offers, guaranteed results, before/after pictures and comparisons. So:
 *  - "block": promotional wording. The text can't be saved until it is rephrased.
 *  - "warn":  suggestive or context-dependent wording (e.g. "painless", "specialist" for a field
 *             that isn't a legal specialisation): saved, with a visible warning.
 *
 * The lists are per language and all of them apply to every text (practices write in Italian,
 * but also in English or German). This is a guardrail, not legal advice: the practice and its
 * Ordine remain responsible for what it publishes (see docs/marketplace.md, to be reviewed by a
 * lawyer).
 */

export const AD_RULES = ["superlative", "discount", "free", "guarantee", "before_after", "comparative", "suggestive", "specialist_title", "percentage"] as const;
export type AdRule = (typeof AD_RULES)[number];
export type AdSeverity = "block" | "warn";
export type AdFinding = Finding<AdRule, AdSeverity>;

const RULES: PatternRule<AdRule, AdSeverity>[] = [
  {
    rule: "superlative",
    severity: "block",
    patterns: [
      // it
      "miglior[ei]?",
      "il piu bravo",
      "la piu brava",
      "i piu bravi",
      "numero uno",
      "primi in italia",
      // en
      "the best",
      "best[- ]rated",
      "best (?:dentists?|dental|clinic|practice|care|prices?|results?)",
      "number one",
      "#1",
      "top[- ]rated",
      // de
      "(?:der|die|das|den|dem) beste[nrsm]?",
      "beste[nrsm]? (?:zahnarzt|zahnarztin|praxis|preise?|ergebnisse)",
      "nummer eins",
      // fr
      "(?:le|la|les) meilleur(?:e|s|es)?",
      "meilleur(?:e|s|es)? (?:dentistes?|cabinet|prix|resultats?)",
      "numero un",
      // es
      "(?:el|la|los|las) mejor(?:es)?",
      "numero uno",
      // pt
      "(?:o|a|os|as) melhor(?:es)?",
      "numero um",
      // ro
      "(?:cel|cea|cei|cele) mai bun(?:a|i|e)?",
      "numarul unu",
      // pl
      "najlepsz(?:y|a|e|ych|ego)",
      "numer jeden",
    ],
  },
  {
    rule: "discount",
    severity: "block",
    patterns: [
      // it
      "scont[oi]",
      "scontat[oaie]",
      "promo",
      "offert[ae]",
      "prezz[oi] (?:bassi|stracciati|imbattibili|speciali)",
      "coupon",
      "groupon",
      "saldi",
      // en
      "discounts?",
      "discounted",
      "special offers?",
      "limited offer",
      "on sale",
      // any language: "-20%", "20% off", "20% di sconto"
      "\\d{1,2} ?% (?:off|di sconto|sconto|rabatt|de (?:remise|reduction|descuento|desconto)|reducere|znizki|rabatu)",
      "-\\s?\\d{1,2} ?%",
      // de
      "rabatt(?:e)?",
      "sonderangebot(?:e)?",
      "aktionspreis(?:e)?",
      "gutschein(?:e)?",
      // fr
      "offres? (?:speciales?|promotionnelles?|exceptionnelles?)",
      "soldes",
      // es / pt
      "descuentos?",
      "ofertas?",
      "rebajas?",
      "descontos?",
      // ro
      "reduceri?",
      "ofert(?:a|e)",
      // pl
      "znizk(?:a|i)",
      "rabat(?:y|u)?",
    ],
  },
  {
    // Words that are often promotional but also have neutral uses ("promozione della salute").
    rule: "discount",
    severity: "warn",
    patterns: ["promozion[ei]", "promotions?", "promocion(?:es)?", "promoc(?:ao|oes)", "promoti(?:e|i)", "promocj(?:a|e)", "remises?", "reductions?"],
  },
  {
    rule: "free",
    severity: "block",
    patterns: [
      "gratis",
      "gratuit[oaie]",
      "in omaggio",
      "omaggio",
      "free (?:of charge|consultations?|visits?|check-?ups?|first visit|whitening|cleaning)",
      "for free",
      "complimentary",
      "at no cost",
      "kostenlos(?:e|er|en)?",
      "umsonst",
      "gratuit(?:e|s|es)?",
      "(?:consultation|visite|bilan) offert(?:e)?",
      "gratuit[oa]s?",
      "bezplatn(?:y|a|e)",
      "za darmo",
    ],
  },
  {
    rule: "guarantee",
    severity: "block",
    patterns: [
      "garantit[oaie]",
      "garanzia",
      "soddisfatti o rimborsati",
      "risultat[oi] (?:certi|sicuri|assicurati)",
      "guaranteed?",
      "money[- ]back",
      "garantiert(?:e|er|en)?",
      "garantie",
      "geld[- ]zuruck",
      "garanti(?:e|s|es)?",
      "satisfait ou rembourse",
      "garantizad[oa]s?",
      "garantia",
      "garantid[oa]s?",
      "garantat(?:a|e|i)?",
      "gwarantowan(?:y|a|e)",
      "gwarancj(?:a|i)",
    ],
  },
  {
    // Before/after pictures and results. The plain phrase ("instructions before and after the
    // visit") is only a warning; the slashed form and "photos before and after" are promotional.
    rule: "before_after",
    severity: "block",
    patterns: [
      "prima ?/ ?dopo",
      "(?:foto|fotografie|immagini) (?:del |di )?prima e dopo",
      "before ?(?:/|&) ?after",
      "before and after (?:photos?|pictures?|images?|results?)",
      "vorher ?/ ?nachher",
      "vorher-nachher",
      "avant ?/ ?apres",
      "avant-apres",
      "photos? avant (?:et )?apres",
      "antes ?/ ?(?:despues|depois)",
      "fotos? (?:del |de )?antes (?:y|e) (?:despues|depois)",
      "inainte ?/ ?dupa",
      "przed ?/ ?po",
    ],
  },
  {
    rule: "before_after",
    severity: "warn",
    patterns: [
      "prima e dopo",
      "before and after",
      "vorher und nachher",
      "avant et apres",
      "antes (?:y|e) (?:despues|depois)",
      "inainte si dupa",
      "przed i po",
    ],
  },
  {
    rule: "comparative",
    severity: "block",
    patterns: [
      "piu economic[oi]",
      "prezzi piu bassi",
      "cheap(?:er|est)",
      "lowest prices?",
      "gunstigste[nrs]?",
      "billigste[nrs]?",
      "(?:le )?moins cher(?:s)?",
      "mas barat[oa]s?",
      "mais barat[oa]s?",
      "cel mai ieftin",
      "najtan(?:iej|szy|sza|sze)",
    ],
  },
  {
    rule: "suggestive",
    severity: "warn",
    patterns: [
      "indolore",
      "senza dolore",
      "rivoluzionari[oaie]",
      "miracolos[oaie]",
      "esclusiv[oaie]",
      "unic[oa] in",
      "all'avanguardia",
      "leader",
      "eccellenza",
      "sorriso perfetto",
      "denti perfetti",
      "painless",
      "pain-free",
      "revolutionary",
      "miracle",
      "exclusive",
      "cutting[- ]edge",
      "state[- ]of[- ]the[- ]art",
      "perfect smile",
      "best",
      "schmerzfrei",
      "revolutionar",
      "wunder",
      "exklusiv",
      "einzigartig",
      "perfektes lacheln",
      "beste[nrsm]?",
      "sans douleur",
      "revolutionnaire",
      "miracle",
      "exclusi(?:f|ve)",
      "sourire parfait",
      "meilleur(?:e|s|es)?",
      "indoloro",
      "sin dolor",
      "revolucionari[oa]",
      "milagr(?:o|oso)",
      "exclusiv[oa]",
      "sonrisa perfecta",
      "mejor(?:es)?",
      "indolor",
      "sem dor",
      "milagr(?:e|oso)",
      "sorriso perfeito",
      "melhor(?:es)?",
      "fara durere",
      "nedureros",
      "revolutionar",
      "miraculos",
      "zambet perfect",
      "bezbolesn(?:y|a|e|ie)",
      "bez bolu",
      "rewolucyjn(?:y|a|e)",
      "cudown(?:y|a|e)",
      "idealny usmiech",
      "top",
    ],
  },
  {
    rule: "specialist_title",
    severity: "warn",
    patterns: [
      "specialist(?:a|i|s)?",
      "specializzat[oaie]",
      "specializzazione",
      "speciali[sz]ed",
      "spezialist(?:in)?",
      "fachzahnarzt(?:in)?",
      "speciali(?:ste|se|see)",
      "especialista",
      "especializad[oa]",
      "specializat(?:a)?",
      "specjalist(?:a|ka)",
      "specjalizacj(?:a|i)",
    ],
  },
  {
    rule: "percentage",
    severity: "warn",
    patterns: ["\\d{1,3} ?%"],
  },
];

const ORDER: AdSeverity[] = ["block", "warn"];

/** Every finding in `text`, in order; overlapping matches keep the blocking one. */
export function checkAdvertising(text: string | null | undefined): AdFinding[] {
  return scanWith(text ?? "", RULES, ORDER);
}

/** The strongest severity among the findings, or null when the text is fine. */
export function advertisingVerdict(findings: readonly AdFinding[]): AdSeverity | null {
  if (findings.some((f) => f.severity === "block")) return "block";
  return findings.length ? "warn" : null;
}

/** Check several fields at once: the findings per field, and the overall verdict. */
export function checkAdvertisingFields<K extends string>(fields: Partial<Record<K, string | null | undefined>>): {
  verdict: AdSeverity | null;
  byField: Partial<Record<K, AdFinding[]>>;
} {
  const byField: Partial<Record<K, AdFinding[]>> = {};
  const all: AdFinding[] = [];
  for (const [field, text] of Object.entries(fields) as [K, string | null | undefined][]) {
    const found = checkAdvertising(text);
    if (found.length) {
      byField[field] = found;
      all.push(...found);
    }
  }
  return { verdict: advertisingVerdict(all), byField };
}

export { segmentsOf };
