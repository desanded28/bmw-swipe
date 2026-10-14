/**
 * Health-term flagger for patient reviews and practice replies (WP7). Pure and client-safe: the
 * review form and the reply editor run it live for a just-in-time warning, and the server runs it
 * again before anything is stored.
 *
 * A review is public. Health details in it (a diagnosis, a complication, a medicine, a pregnancy)
 * are special-category data (GDPR Art. 9) about the author or, worse, about someone else, and a
 * phone number or email address is contact data nobody should publish. So:
 *  - "hold"  findings send the review to moderation (status under_review): it is not public until
 *            a person has checked it;
 *  - "warn"  findings (treatment names, symptoms) only show the author a reminder while typing.
 *
 * The lexicons cover the 8 UI languages and are all applied to every text: people write reviews
 * in the language they like, not the page's. A false positive costs a moderator a minute; a false
 * negative publishes health data, so the lists lean towards catching. Names of third parties
 * can't be detected reliably by patterns (critique 53): moderation and the "report" route cover
 * them.
 *
 * Patterns are written lowercase without diacritics: the text is folded the same way first
 * (foldText), and findings carry spans in the original text for highlighting.
 */

export type TextSpan = { start: number; end: number };

export type PatternRule<R extends string, S extends string> = {
  rule: R;
  severity: S;
  /** Regex sources over folded text; each is matched as a whole word (no letter or digit around it). */
  patterns: readonly string[];
  /** Matched as written, without the whole-word guard (contact data). */
  raw?: boolean;
  /** Extra check on the matched folded text (e.g. a digit count). */
  accept?: (match: string) => boolean;
};

export type Finding<R extends string, S extends string> = {
  rule: R;
  severity: S;
  /** Offsets in the original text (end exclusive). */
  span: TextSpan;
  /** The original text of the match. */
  text: string;
};

/** Letters that NFD doesn't decompose but that people type without the stroke. */
const EXTRA_FOLD: Record<string, string> = { ł: "l", đ: "d", ø: "o", ħ: "h", ı: "i" };
const APOSTROPHES = /[’‘ʼ`´]/;

/**
 * Lowercase and strip diacritics, keeping a map from each folded UTF-16 unit back to its
 * original index (map has one extra entry: the original length).
 */
export function foldText(text: string): { folded: string; map: number[] } {
  let folded = "";
  const map: number[] = [];
  for (let i = 0; i < text.length; ) {
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    let out = APOSTROPHES.test(ch) ? "'" : ch.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
    out = EXTRA_FOLD[out] ?? out;
    for (let k = 0; k < out.length; k++) {
      folded += out[k];
      map.push(i);
    }
    i += ch.length;
  }
  map.push(text.length);
  return { folded, map };
}

const compiled = new WeakMap<object, RegExp>();

function regexFor(r: PatternRule<string, string>): RegExp {
  let re = compiled.get(r);
  if (!re) {
    const body = r.patterns.join("|");
    re = new RegExp(r.raw ? `(?:${body})` : `(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`, "gu");
    compiled.set(r, re);
  }
  re.lastIndex = 0;
  return re;
}

/**
 * Every match of every rule, in text order. Where matches overlap, the one listed first in
 * `severityOrder` wins (then the longer one), so "implant failed" is reported once, as a hold.
 */
export function scanWith<R extends string, S extends string>(
  text: string,
  rules: readonly PatternRule<R, S>[],
  severityOrder: readonly S[],
): Finding<R, S>[] {
  if (!text) return [];
  const { folded, map } = foldText(text);
  const all: Finding<R, S>[] = [];
  for (const r of rules) {
    for (const m of folded.matchAll(regexFor(r))) {
      if (!m[0] || (r.accept && !r.accept(m[0]))) continue;
      const start = map[m.index];
      const end = map[m.index + m[0].length];
      all.push({ rule: r.rule, severity: r.severity, span: { start, end }, text: text.slice(start, end) });
    }
  }
  const rank = (f: Finding<R, S>) => severityOrder.indexOf(f.severity);
  all.sort((a, b) => rank(a) - rank(b) || b.span.end - b.span.start - (a.span.end - a.span.start) || a.span.start - b.span.start);
  const kept: Finding<R, S>[] = [];
  for (const f of all) {
    if (!kept.some((k) => f.span.start < k.span.end && k.span.start < f.span.end)) kept.push(f);
  }
  return kept.sort((a, b) => a.span.start - b.span.start);
}

/** Text split into plain and matched parts, for highlighting findings with <mark>. */
export function segmentsOf<F extends { span: TextSpan }>(text: string, findings: readonly F[]): { text: string; finding: F | null }[] {
  const out: { text: string; finding: F | null }[] = [];
  let at = 0;
  for (const f of [...findings].sort((a, b) => a.span.start - b.span.start)) {
    if (f.span.start < at) continue;
    if (f.span.start > at) out.push({ text: text.slice(at, f.span.start), finding: null });
    out.push({ text: text.slice(f.span.start, f.span.end), finding: f });
    at = f.span.end;
  }
  if (at < text.length) out.push({ text: text.slice(at), finding: null });
  return out;
}

// ---------------------------------------------------------------- rules

export const HEALTH_RULES = [
  "contact.phone",
  "contact.email",
  "contact.link",
  "health.outcome",
  "health.infection",
  "health.condition",
  "health.pregnancy",
  "health.medication",
  "health.treatment",
  "health.symptom",
] as const;
export type HealthRule = (typeof HEALTH_RULES)[number];
export type HealthSeverity = "hold" | "warn";
export type HealthFinding = Finding<HealthRule, HealthSeverity>;

const digits = (s: string) => s.replace(/\D/g, "").length;
/** "12/03/2024 10" is a date and an hour, not a phone number. */
const DATE_LIKE = /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/;

const RULES: PatternRule<HealthRule, HealthSeverity>[] = [
  {
    rule: "contact.email",
    severity: "hold",
    raw: true,
    patterns: ["[\\p{L}\\p{N}._%+-]+@[\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)+"],
  },
  {
    rule: "contact.link",
    severity: "hold",
    raw: true,
    patterns: ["(?:https?:\\/\\/|www\\.)[^\\s]+"],
  },
  {
    // 9 to 15 digits, optionally grouped (up to 3 separators between digits, as in "333 - 123 -
    // 4567" or "+39 (02) 1234"): phone numbers, never prices, years or dates.
    rule: "contact.phone",
    severity: "hold",
    raw: true,
    patterns: ["(?<![\\p{L}\\p{N}])(?:\\+|00)?\\d(?:[\\s().\\-/]{0,3}\\d){8,16}(?![\\p{N}])"],
    accept: (m) => digits(m) >= 9 && digits(m) <= 15 && !DATE_LIKE.test(m),
  },
  {
    rule: "health.outcome",
    severity: "hold",
    patterns: [
      // en
      "implants? (?:has |have |had |was |were |got )?(?:failed|failing|fell out|came out|rejected|come loose|came loose)",
      "(?:failed|failing|rejected|lost) implants?",
      "(?:lost|rejected) (?:my |an |the |two |both |all )?implants?",
      "implant (?:failure|rejection|loss)",
      "nerve damage",
      "damaged (?:a |the |my )?nerve",
      "complications?",
      // it
      "impiant[oi] (?:(?:e|sono|si e|si sono|mi e|mi sono) )?(?:fallit[oi]|saltat[oi]|cadut[oi]|rigettat[oi]|staccat[oi])",
      "impiant[oi] (?:non ha|non hanno) (?:retto|attecchito|tenuto)",
      // verb first: "mi è caduto l'impianto", "si è staccato l'impianto", "ho perso l'impianto"
      "(?:(?:mi |si |mi si |gli |le )?(?:e |sono )?)(?:fallit[oaie]|saltat[oaie]|cadut[oaie]|rigettat[oaie]|staccat[oaie]|uscit[oaie]) (?:l'|il |gli |i |un |due |tutti gli )?impiant[oi]",
      "(?:ho |abbiamo |hanno )?pers[oi] (?:l'|il |gli |i |un |due )?impiant[oi]",
      "(?:rigetto|fallimento|perdita) (?:dell'|del |degli |di un )?impiant[oi]",
      "(?:danno|lesione) (?:al |del )?nervo",
      "nervo (?:lesionato|danneggiato|toccato)",
      "complicazion[ei]",
      "complicanz[ae]",
      // de
      "implantat(?:e)? (?:ist |sind |wurde |wurden |hat |haben )?(?:mir |uns |ihm |ihr )?(?:verloren|gescheitert|abgesto(?:ss|ß)en|rausgefallen|herausgefallen|ausgefallen|locker)",
      "(?:ist |sind )(?:mir |uns |ihm |ihr )?(?:das |die |ein |mein |meine )?implantat(?:e)? (?:rausgefallen|herausgefallen|ausgefallen|abgesto(?:ss|ß)en)",
      "implantat(?:verlust|versagen)",
      "nerv(?:en)?schad(?:en|igung)",
      "nerv (?:verletzt|beschadigt)",
      "komplikation(?:en)?",
      // fr
      "implants? (?:a |ont |est |sont |s'est |se sont )?(?:echoue|rate|ete rejetes?|rejetes?|tombes?|perdus?|detaches?)",
      "(?:perdu|rejete) (?:mon |mes |l'|un |deux |les )?implants?",
      "(?:echec|rejet|perte) (?:de l'|d'un |du |des )?implants?",
      "lesion (?:du |d'un )?nerf",
      "nerf (?:touche|abime|lese)",
      "complications?",
      // es
      "implantes? (?:ha |han |se )?(?:me |le )?(?:fallado|fallo|fallidos?|rechazados?|caido|cayo|cayeron)",
      "(?:se (?:me |le )?)?(?:cayo|cayeron|ha caido|han caido|fallo|fallaron|perdi) (?:el |los |un |mi |mis |dos )?implantes?",
      "(?:fracaso|rechazo|perdida) (?:del |de un |de los )?implantes?",
      "dano (?:en el |al |del )nervio",
      "nervio (?:danado|lesionado)",
      "complicacion(?:es)?",
      // pt
      "implantes? (?:falhou|falharam|falhado|rejeitados?|caiu|cairam|perdidos?)",
      "(?:caiu|cairam|falhou|falharam|perdi) (?:o |os |um |meu |meus |o meu |dois )?implantes?",
      "(?:falha|perda|rejeicao) (?:do |de um |dos )?implantes?",
      "lesao (?:no |do |de um )nervo",
      "nervo (?:danificado|lesionado|lesado)",
      "complicac(?:ao|oes)",
      // ro
      "implant(?:ul|uri|urile)? (?:a |au )?(?:esuat|cazut|respins|nu a prins|nu au prins)",
      "(?:mi-a |mi-au |a |au )?(?:cazut|esuat|pierdut) implant(?:ul|urile)?",
      "respingerea implantului",
      "lezarea nervului",
      "nerv(?:ul)? (?:lezat|afectat)",
      "complicati(?:e|i|ile)",
      // pl
      "implant(?:y)? (?:sie nie przyjal|nie przyjal sie|zostal odrzucony|wypadl|odpadl)",
      "(?:wypadl|wypadly|odpadl|stracil(?:em|am)?) (?:mi )?implant(?:y)?",
      "nieudany implant",
      "odrzucenie implantu",
      "uszkodzeni(?:e|a) nerwu",
      "uszkodzony nerw",
      "powiklani(?:e|a|ami)",
    ],
  },
  {
    rule: "health.infection",
    severity: "hold",
    patterns: [
      "infections?",
      "infected",
      "abscess(?:es)?",
      "infezion[ei]",
      "infett[oaie]",
      "ascess[oi]",
      "infektion(?:en)?",
      "infiziert",
      "abszess(?:e)?",
      "eiter",
      "infecte(?:e|s|es)?",
      "abces",
      "infeccion(?:es)?",
      "infectad[oa]s?",
      "abscesos?",
      "flemon",
      "infecc?ao",
      "infecc?oes",
      "infec?tad[oa]s?",
      "abc?essos?",
      "infecti(?:e|i|a)",
      "infectat(?:a|e)?",
      "abces(?:ul)?",
      "infekcj(?:a|i)",
      "zakazeni(?:e|a)",
      "zakazon(?:y|a|e)",
      "ropie(?:n|nia)",
    ],
  },
  {
    rule: "health.condition",
    severity: "hold",
    patterns: [
      // en
      "diabet(?:es|ic)",
      "hiv",
      "hepatitis",
      "cancer",
      "tumou?rs?",
      "leuka?emia",
      "epilep(?:sy|tic)",
      "osteoporosis",
      "periodontitis",
      "gum disease",
      "depression",
      "panic attacks?",
      "anxiety disorder",
      "allerg(?:y|ies|ic)",
      "heart (?:condition|disease|attack)",
      // it
      "diabet(?:e|ico|ica|ici|iche)",
      "sieropositiv[oaie]",
      "epatite",
      "cancro",
      "tumor[ei]",
      "leucemia",
      "epiless(?:ia|ico|ica)",
      "osteoporosi",
      "parodontite",
      "piorrea",
      "depressione",
      "attacch?[oi] di panico",
      "allergi(?:a|e|co|ca|ci|che)",
      "cardiopatic[oa]",
      "infarto",
      // de
      "diabetiker(?:in)?",
      "krebs",
      "tumor(?:e|en)?",
      "leukamie",
      "epilepsie",
      "osteoporose",
      "parodont(?:itis|ose)",
      "depression(?:en)?",
      "panikattacke(?:n)?",
      "allergie(?:n)?",
      "allergisch",
      "herzinfarkt",
      "herzkrank",
      // fr
      "diabete",
      "diabetique",
      "vih",
      "sida",
      "hepatite",
      "tumeurs?",
      "leucemie",
      "epileptique",
      "parodontite",
      "crises? d'angoisse",
      "crises? de panique",
      "allergi(?:e|es|que|ques)",
      "maladie cardiaque",
      "infarctus",
      // es
      "diabetic[oa]s?",
      "tumor(?:es)?",
      "epilepsia",
      "epileptic[oa]",
      "piorrea",
      "depresion",
      "ataques? de panico",
      "alergi(?:a|as|co|ca)",
      "cardiopatia",
      // pt
      "depressao",
      "enfarte",
      // ro
      "diabet(?:ic|ica)?",
      "hepatita",
      "tumor(?:a|i)",
      "leucemie",
      "osteoporoza",
      "parodont(?:oza|ita)",
      "depresie",
      "atac(?:uri)? de panica",
      "alergi(?:e|c|ca)",
      "infarct",
      // pl
      "cukrzyc(?:a|e|y)",
      "cukrzyk",
      "zoltaczk(?:a|e|i)",
      "zapalenie watroby",
      "rak(?:a|iem)?",
      "nowotw(?:or|oru|ory)",
      "bialaczk(?:a|i)",
      "padaczk(?:a|i)",
      "epilepsj(?:a|i)",
      "osteoporoz(?:a|y)",
      "zapaleni(?:e|a) przyzebia",
      "pa[rd]odontoz(?:a|y)",
      "depresj(?:a|i)",
      "atak(?:i)? paniki",
      "alergi(?:a|i)",
      "uczuleni(?:e|a)",
      "zawal(?:u)? serca",
    ],
  },
  {
    rule: "health.pregnancy",
    severity: "hold",
    patterns: [
      "pregnan(?:t|cy)",
      "incinta",
      "gravidanza",
      "schwanger(?:schaft)?",
      "enceinte",
      "grossesse",
      "embarazad[oa]",
      "embarazo",
      "gravida",
      "gravidez",
      "insarcinata",
      "graviditate",
      "w ciazy",
      "ciaz(?:a|y)",
    ],
  },
  {
    rule: "health.medication",
    severity: "hold",
    patterns: [
      // en
      "anticoagulants?",
      "blood thinners?",
      "warfarin",
      "bisphosphonates?",
      "antibiotics?",
      "chemo(?:therapy)?",
      "radiotherapy",
      "radiation therapy",
      "medications?",
      "painkillers?",
      "antidepressants?",
      // it
      "anticoagulant[ei]",
      "coumadin",
      "bifosfonat[io]",
      "antibiotic[oi]",
      "chemioterapia",
      "radioterapia",
      "farmac[oi]",
      "antidolorific[oi]",
      "antidepressiv[oi]",
      "cortison[ei]",
      // de
      "blutverdunner",
      "gerinnungshemmer",
      "marcumar",
      "bisphosphonat(?:e)?",
      "antibiotik(?:um|a)",
      "chemotherapie",
      "strahlentherapie",
      "medikament(?:e|en)?",
      "schmerzmittel",
      "antidepressiv(?:a|um)",
      // fr
      "antibiotiques?",
      "chimio(?:therapie)?",
      "radiotherapie",
      "medicaments?",
      "antidouleurs?",
      "antidepresseurs?",
      // es / pt
      "anticoagulantes?",
      "bifosfonatos?",
      "antibioticos?",
      "quimio(?:terapia)?",
      "medicamentos?",
      "medicacion",
      "medicacao",
      "analgesicos?",
      "antidepresivos?",
      "antidepressivos?",
      // ro
      "anticoagulant(?:e)?",
      "bifosfonat(?:i)?",
      "antibiotic(?:e)?",
      "chimioterapie",
      "radioterapie",
      "medicament(?:e|ele)?",
      "analgezic(?:e)?",
      "antidepresiv(?:e)?",
      // pl
      "antykoagulant(?:y)?",
      "leki przeciwzakrzepowe",
      "bisfosfonian(?:y)?",
      "antybiotyk(?:i|u)?",
      "chemioterapi(?:a|i)",
      "radioterapi(?:a|i)",
      "leki",
      "lekow",
      "lekarstw(?:o|a)",
      "przeciwbolow(?:e|y)",
      "antydepresant(?:y)?",
    ],
  },
  {
    rule: "health.treatment",
    severity: "warn",
    patterns: [
      // en
      "implants?",
      "root canals?",
      "extractions?",
      "extracted",
      "wisdom (?:tooth|teeth)",
      "fillings?",
      "caries",
      "cavit(?:y|ies)",
      "x-?rays?",
      "an(?:a)?esthe(?:sia|tic)",
      "sedation",
      "sedated",
      // it
      "impiant[oi]",
      "devitalizza(?:zion[ei]|t[oa]|re)",
      "estrazion[ei]",
      "estratt[oi]",
      "dent[ei] del giudizio",
      "otturazion[ei]",
      "carie",
      "radiografi[ae]",
      "panoramica",
      "anestesi(?:a|e)",
      "sedazione",
      // de
      "implantat(?:e)?",
      "wurzelbehandlung",
      "extraktion",
      "gezogen",
      "weisheitszahn(?:e)?",
      "fullung(?:en)?",
      "karies",
      "rontgen",
      "betaubung",
      "narkose",
      "sedierung",
      // fr
      "devitalisation",
      "traitement de canal",
      "dents? de sagesse",
      "plombages?",
      "radiographies?",
      "anesthesie",
      // es
      "implantes?",
      "endodoncia",
      "extraccion(?:es)?",
      "muelas? del juicio",
      "empastes?",
      "radiografias?",
      "anestesia",
      "sedacion",
      // pt
      "desvitalizacao",
      "tratamento de canal",
      "extrac?(?:ao|oes)",
      "dentes? do siso",
      "obturac(?:ao|oes)",
      "sedacao",
      // ro
      "implant(?:ul|uri|urile)?",
      "tratament de canal",
      "extracti(?:e|a)",
      "masea de minte",
      "maselele de minte",
      "plomb(?:a|e)",
      "radiografi(?:e|a)",
      "anestezi(?:e|a)",
      "sedare",
      // pl
      "leczenie kanalowe",
      "ekstrakcj(?:a|i)",
      "usuniecie zeba",
      "zab madrosci",
      "zeby madrosci",
      "plomb(?:a|y)",
      "wypelnieni(?:e|a)",
      "prochnic(?:a|y)",
      "rtg",
      "znieczuleni(?:e|a)",
      "sedacj(?:a|i)",
    ],
  },
  {
    rule: "health.symptom",
    severity: "warn",
    patterns: [
      "pain(?:ful)?",
      "hurt(?:s|ing)?",
      "swelling",
      "swollen",
      "bleed(?:ing)?",
      "inflam(?:ed|mation)",
      "dolor[ei]",
      "doloros[oa]",
      "gonfiore",
      "sanguinament[oi]",
      "infiammazion[ei]",
      "infiammat[oa]",
      "schmerz(?:en|haft)?",
      "schwellung",
      "geschwollen",
      "blutung",
      "entzundung",
      "entzundet",
      "douleurs?",
      "douloureu(?:x|se)",
      "gonflement",
      "saignements?",
      "enflamme(?:e)?",
      "dolor(?:es)?",
      "hinchazon",
      "hinchad[oa]",
      "sangrado",
      "inflamacion",
      "inflamad[oa]",
      "dor(?:es)?",
      "inchaco",
      "inchad[oa]",
      "sangramento",
      "hemorragia",
      "inflamac(?:ao|oes)",
      "durer(?:e|i|ea)",
      "dureros",
      "umflatur(?:a|i)",
      "sangerare",
      "inflamati(?:e|a)",
      "bol(?:u)?",
      "bolesn(?:y|a|e)",
      "obrzek",
      "spuchniet(?:y|a|e)",
      "krwawieni(?:e|a)",
      "stan zapalny",
    ],
  },
];

const ORDER: HealthSeverity[] = ["hold", "warn"];

/** Every finding in `text`, in order. */
export function scanHealthTerms(text: string | null | undefined): HealthFinding[] {
  return scanWith(text ?? "", RULES, ORDER);
}

/**
 * The flags stored on a review (reviews.flags): the distinct hold rules found, never the text
 * itself. Non-empty means the review waits for moderation.
 */
export function reviewFlags(text: string | null | undefined): HealthRule[] {
  return [...new Set(scanHealthTerms(text).filter((f) => f.severity === "hold").map((f) => f.rule))];
}

/** Hold-level findings first: what the author must look at. */
export function holdFindings(text: string | null | undefined): HealthFinding[] {
  return scanHealthTerms(text).filter((f) => f.severity === "hold");
}
