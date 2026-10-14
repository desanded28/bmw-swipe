import { DIAL_CODE, LOCALES } from "@/i18n/config";

/**
 * Country codes offered next to a phone field, for numbers typed without "+": Italy's first (the
 * practices' country, never the page language), then those of the site's languages, then other
 * communities common among patients in Italy.
 */
export const DIAL_CODES = [...new Set(["39", ...LOCALES.map((l) => DIAL_CODE[l]), "41", "43", "355", "380", "212", "86", "1"])];
