import "server-only";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import type { StaffSession } from "../auth";

/**
 * The dashboard language for an action's messages: getStaffLocale() (the user's choice, then the
 * cookie, Accept-Language and the practice default), or, outside a request (tests, jobs), the
 * user's choice and then the practice default.
 */
export async function actionLocale(s: Pick<StaffSession, "user" | "org">): Promise<Locale> {
  try {
    return await getStaffLocale();
  } catch {
    if (isLocale(s.user.locale)) return s.user.locale;
    return isLocale(s.org.defaultLocale) ? s.org.defaultLocale : DEFAULT_LOCALE;
  }
}

/** The security namespace in the action's language. */
export async function securityTexts(s: Pick<StaffSession, "user" | "org">) {
  return getT(await actionLocale(s), "security");
}
