import type { Locale } from "@/i18n/config";

/**
 * SMS cost control: GSM-7 detection, segment counting, the ASCII fallback and the segment budget.
 *
 * An SMS is billed per segment. A message written only in the GSM 03.38 alphabet (GSM-7) fits 160
 * characters in one segment, or 153 per segment once it is split; one character outside it (a
 * Polish "ą", a curly quote, an emoji) turns the whole message into UCS-2: 70 characters, or 67 per
 * segment. Extension characters (€ [ ] { } ~ ^ | \ and form feed) take two GSM-7 septets.
 */

/** GSM 03.38 basic character set (without the escape code). */
const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
/** Extension table: each costs two septets (escape + character). */
const GSM_EXTENSION = new Set("\f^{}\\[~]|€");

export type SmsEncoding = "GSM-7" | "UCS-2";

export type SmsSegments = {
  encoding: SmsEncoding;
  /** Septets (GSM-7) or UTF-16 code units (UCS-2). */
  units: number;
  segments: number;
  /** Characters still free in the last segment. */
  remaining: number;
};

export function isGsmChar(ch: string): boolean {
  return GSM_BASIC.has(ch) || GSM_EXTENSION.has(ch);
}

/** True when the whole text can be sent in the GSM-7 alphabet. */
export function isGsm7(text: string): boolean {
  for (const ch of text) if (!isGsmChar(ch)) return false;
  return true;
}

/**
 * Segment count as carriers bill it. Multipart messages carry a header (153 septets or 67 UCS-2
 * units per segment), and a two-unit character (a GSM-7 escape pair, a UTF-16 surrogate pair) is
 * never split across two segments.
 */
export function segments(text: string): SmsSegments {
  const gsm = isGsm7(text);
  const sizes = [...text].map((ch) => (gsm ? (GSM_EXTENSION.has(ch) ? 2 : 1) : ch.length));
  const units = sizes.reduce((a, b) => a + b, 0);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  const encoding: SmsEncoding = gsm ? "GSM-7" : "UCS-2";
  if (units === 0) return { encoding, units, segments: 0, remaining: single };
  if (units <= single) return { encoding, units, segments: 1, remaining: single - units };
  let count = 1;
  let used = 0;
  for (const size of sizes) {
    if (used + size > multi) {
      count++;
      used = 0;
    }
    used += size;
  }
  return { encoding, units, segments: count, remaining: multi - used };
}

/** At most 2 GSM-7 segments (306 characters) or 3 UCS-2 segments (201 characters). */
export const SMS_BUDGET: Record<SmsEncoding, number> = { "GSM-7": 2, "UCS-2": 3 };

export function withinBudget(text: string): boolean {
  const s = segments(text);
  return s.segments <= SMS_BUDGET[s.encoding];
}

/**
 * Typography that has a GSM-7 twin. Applied to every SMS, in every language: dictionary texts
 * already use straight quotes, but practice names and addresses come from a form ("Studio
 * Sant’Anna") and one curly apostrophe would switch the whole message to UCS-2.
 */
const TYPOGRAPHY: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": "'",
  "ʼ": "'",
  "´": "'",
  "`": "'",
  "“": '"',
  "”": '"',
  "„": '"',
  "«": '"',
  "»": '"',
  "–": "-",
  "—": "-",
  "‑": "-",
  "…": "...",
  " ": " ",
  " ": " ",
  " ": " ",
  "·": "-",
  "•": "-",
};

const TYPOGRAPHY_CHARS = new RegExp(`[${Object.keys(TYPOGRAPHY).join("")}]`, "g");

export function gsmTypography(text: string): string {
  return text.replace(TYPOGRAPHY_CHARS, (c) => TYPOGRAPHY[c]);
}

/** Letters that NFD doesn't decompose. */
const SPECIAL: Record<string, string> = {
  ł: "l", Ł: "L", đ: "d", Đ: "D", ı: "i", œ: "oe", Œ: "OE", ŀ: "l", Ŀ: "L", ħ: "h", Ħ: "H",
};

/** Locales whose texts the ASCII fallback may transliterate (settings.reminders.smsAsciiFallback). */
export const ASCII_FALLBACK_LOCALES: readonly Locale[] = ["es", "pt", "fr", "ro", "pl"];

/**
 * Strip diacritics (NFD minus combining marks, ł -> l) from every character GSM-7 lacks. Characters
 * GSM-7 already has stay as they are: Spanish "ñ" and "é", French "è" and "à" are free, and
 * stripping "ñ" would turn "año" into "ano".
 */
export function asciiFallback(text: string): string {
  let out = "";
  for (const ch of text) {
    if (isGsmChar(ch)) out += ch;
    else if (SPECIAL[ch]) out += SPECIAL[ch];
    else out += ch.normalize("NFD").replace(/\p{M}/gu, "");
  }
  return out;
}

/**
 * The text as it will be sent: GSM-7 typography always, and the ASCII fallback for es, pt, fr, ro
 * and pl when the practice turned it on (Italian, German and English texts are GSM-7 already).
 */
export function prepareSms(text: string, locale: Locale, opts: { asciiFallback?: boolean } = {}): string {
  const plain = gsmTypography(text);
  return opts.asciiFallback && ASCII_FALLBACK_LOCALES.includes(locale) ? asciiFallback(plain) : plain;
}

/**
 * The first candidate within the segment budget, else the one with the fewest segments (ties go to
 * the earlier, fuller text). Candidates go from the fullest wording to the shortest.
 */
export function fitSmsBudget(candidates: string[]): string {
  const usable = candidates.filter((c) => c.trim().length > 0);
  if (!usable.length) return "";
  const fit = usable.find(withinBudget);
  if (fit !== undefined) return fit;
  return usable.reduce((best, c) => (segments(c).segments < segments(best).segments ? c : best));
}
