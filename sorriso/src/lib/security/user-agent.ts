import type { Locale } from "@/i18n/config";
import { getT } from "@/i18n/t";

/**
 * A rough, human label for a User-Agent ("Chrome on macOS") for the signed-in devices list and the
 * new-device email. Deliberately coarse: no versions, nothing that fingerprints further.
 */

const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/Firefox\/|FxiOS\//, "Firefox"],
  [/Chrome\/|CriOS\//, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/iPhone|iPad|iPod/, "iOS"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/CrOS/, "ChromeOS"],
  [/Linux/, "Linux"],
];

export function parseUserAgent(ua: string | null | undefined): { browser: string | null; os: string | null } {
  if (!ua) return { browser: null, os: null };
  return {
    browser: BROWSERS.find(([re]) => re.test(ua))?.[1] ?? null,
    os: SYSTEMS.find(([re]) => re.test(ua))?.[1] ?? null,
  };
}

export function describeUserAgent(ua: string | null | undefined, locale: Locale): string {
  const t = getT(locale, "security");
  const { browser, os } = parseUserAgent(ua);
  return t("sessions.device", { browser: browser ?? t("sessions.unknownBrowser"), os: os ?? t("sessions.unknownOs") });
}
