/**
 * The request's language (next/headers, the session). getT and getMessages live in t.ts, which
 * scripts can load too, and are re-exported here so pages need one import. Code reachable from
 * a tsx script (lib/messaging, lib/otp, jobs) imports "@/i18n/t" instead of this module.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { getSession } from "@/lib/auth";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "./config";
import { negotiate } from "./negotiate";

export { getMessages, getT } from "./t";

async function cookieLocale(): Promise<Locale | null> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : null;
}

async function acceptLanguageLocale(): Promise<Locale | null> {
  return negotiate((await headers()).get("accept-language"));
}

/**
 * The language of a public request: the locale the proxy took from the URL, then the
 * NEXT_LOCALE cookie, then Accept-Language, then Italian. Nothing here needs the cookie: in the
 * embed (a cross-site iframe, where cookies are blocked) the URL decides.
 */
export const getRequestLocale = cache(async (): Promise<Locale> => {
  const fromUrl = (await headers()).get(LOCALE_HEADER);
  if (isLocale(fromUrl)) return fromUrl;
  return (await cookieLocale()) ?? (await acceptLanguageLocale()) ?? DEFAULT_LOCALE;
});

/**
 * The dashboard language of the signed-in staff member: their own choice (users.locale), then
 * the NEXT_LOCALE cookie, then Accept-Language, then the practice default, then Italian.
 */
export const getStaffLocale = cache(async (): Promise<Locale> => {
  const session = await getSession();
  if (isLocale(session?.user.locale)) return session.user.locale;
  const orgDefault = session?.org?.defaultLocale;
  return (
    (await cookieLocale()) ?? (await acceptLanguageLocale()) ?? (isLocale(orgDefault) ? orgDefault : DEFAULT_LOCALE)
  );
});
