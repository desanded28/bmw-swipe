import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { appointments, patients } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { negotiate } from "@/i18n/negotiate";
import { hashToken } from "@/lib/links";

/**
 * Short patient links (/a/<token>) stay unprefixed so SMS texts stay short. They redirect to
 * the patient's language: an explicit choice (cookie) first, then the language the patient
 * booked in, then the browser's. Unknown tokens go to the negotiated locale, where the page
 * shows the generic "link invalid or expired" screen.
 */
export async function legacyRedirect(req: NextRequest, token: string, rest: string[] = []): Promise<NextResponse> {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  let locale: Locale | null = isLocale(cookie) ? cookie : null;
  if (!locale && /^[A-Za-z0-9_-]{8,128}$/.test(token)) {
    const [row] = await db
      .select({ locale: patients.locale })
      .from(appointments)
      .innerJoin(patients, eq(patients.id, appointments.patientId))
      .where(eq(appointments.manageTokenHash, hashToken(token)))
      .limit(1);
    if (isLocale(row?.locale)) locale = row.locale;
  }
  locale ??= negotiate(req.headers.get("accept-language")) ?? DEFAULT_LOCALE;

  const tail = rest.map(encodeURIComponent).join("/");
  const url = req.nextUrl.clone();
  url.pathname = `/${locale}/a/${encodeURIComponent(token)}${tail ? `/${tail}` : ""}`;
  const res = NextResponse.redirect(url, 307);
  res.headers.set("Cache-Control", "private, no-store");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Vary", "Accept-Language, Cookie");
  return res;
}
