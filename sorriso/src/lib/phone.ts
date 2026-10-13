import { DEFAULT_COUNTRY_CODE } from "./config";

/**
 * Normalize a phone number to E.164. Numbers without an international prefix
 * are assumed to be local to DEFAULT_COUNTRY_CODE (Italy by default).
 * Returns null if it doesn't look like a phone number.
 */
export function normalizePhone(input: string | null | undefined, countryCode = DEFAULT_COUNTRY_CODE): string | null {
  if (!input) return null;
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
