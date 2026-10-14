import { DEFAULT_COUNTRY_CODE } from "./config";

/** A country calling code: 1-3 digits, never starting with 0 ("39", "44", "351"). An optional "+" is accepted. */
const DIAL_CODE_SHAPE = /^\+?([1-9]\d{0,2})$/;

/** The dial code without "+", or null when `value` is not one. */
export function parseDialCode(value: string | null | undefined): string | null {
  const m = value?.trim().match(DIAL_CODE_SHAPE);
  return m ? m[1] : null;
}

/**
 * What happens to a national number's leading 0 when the country code is put in front of it.
 *
 * - "drop": the 0 is a trunk prefix, dialled only inside the country (UK 07700 -> +44 7700,
 *   Germany 0151 -> +49 151, France 06 -> +33 6, Romania 0722 -> +40 722).
 * - "keep": the 0 is part of the number. Italy dropped its trunk prefix in 1998: landlines keep
 *   the 0 after +39 (02 1234 5678 -> +39 02 1234 5678), mobiles start with 3.
 * - "none": the country has no trunk prefix (Spain, Portugal, Poland); a typed 0 is left alone,
 *   and a number that is then too short or too long is rejected by the E.164 check.
 *
 * Countries not listed use "drop", the convention of most of the world's numbering plans.
 */
const TRUNK_ZERO: Record<string, "drop" | "keep" | "none"> = {
  "39": "keep",
  "44": "drop",
  "49": "drop",
  "33": "drop",
  "40": "drop",
  "34": "none",
  "351": "none",
  "48": "none",
};

/**
 * Normalize a phone number to E.164. Numbers without an international prefix ("+" or "00") are
 * taken as national numbers of `dialCode` (the booking form's country select, e.g. "49"), with
 * that country's trunk-prefix rule applied (TRUNK_ZERO). A missing or malformed dial code falls
 * back to DEFAULT_COUNTRY_CODE (Italy). A number that already carries a country code is kept as
 * it is, whatever `dialCode` says; the "(0)" some people write after it ("+44 (0)7700") is dropped.
 * Returns null if the result doesn't look like a phone number.
 */
export function normalizePhone(input: string | null | undefined, dialCode: string | null = DEFAULT_COUNTRY_CODE): string | null {
  if (!input) return null;
  const countryCode = parseDialCode(dialCode) ?? DEFAULT_COUNTRY_CODE;
  let raw = input.trim().replace(/^whatsapp:/i, "");
  // "+44 (0)7700 900123": the bracketed trunk 0 is never dialled from abroad.
  raw = raw.replace(/^(\+|00)(\d{1,3})\s*\(0\)/, "$1$2");
  raw = raw.replace(/[\s().\-/]/g, "");
  if (raw.startsWith("00")) raw = `+${raw.slice(2)}`;
  if (!raw.startsWith("+")) {
    const rule = TRUNK_ZERO[countryCode] ?? "drop";
    const national = rule === "drop" ? raw.replace(/^0/, "") : raw;
    raw = `+${countryCode}${national}`;
  }
  if (!/^\+[1-9]\d{6,14}$/.test(raw)) return null;
  return raw;
}

export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = e164.match(/^\+39(\d{3})(\d{3,4})(\d{3,4})$/);
  if (m) return `+39 ${m[1]} ${m[2]} ${m[3]}`;
  return e164;
}
