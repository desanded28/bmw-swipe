import { DEFAULT_COUNTRY_CODE } from "./config";

/** A country calling code: 1-3 digits, never starting with 0 ("39", "44", "351"). An optional "+" is accepted. */
const DIAL_CODE_SHAPE = /^\+?([1-9]\d{0,2})$/;

/** The dial code without "+", or null when `value` is not one. */
export function parseDialCode(value: string | null | undefined): string | null {
  const m = value?.trim().match(DIAL_CODE_SHAPE);
  return m ? m[1] : null;
}

/**
 * Normalize a phone number to E.164. Numbers without an international prefix are taken as local
 * to `dialCode` (the booking form's country, e.g. "49"); a missing or malformed dial code falls back
 * to DEFAULT_COUNTRY_CODE (Italy by default). Returns null if it doesn't look like a phone number.
 */
export function normalizePhone(input: string | null | undefined, dialCode?: string | null): string | null {
  if (!input) return null;
  const countryCode = parseDialCode(dialCode) ?? DEFAULT_COUNTRY_CODE;
  let raw = input.trim().replace(/^whatsapp:/i, "");
  raw = raw.replace(/[\s().-]/g, "");
  if (raw.startsWith("00")) raw = `+${raw.slice(2)}`;
  if (!raw.startsWith("+")) {
    // Italian numbers keep their leading 0 after +39 (landlines); most countries drop it.
    const national = countryCode === "39" ? raw : raw.replace(/^0/, "");
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
