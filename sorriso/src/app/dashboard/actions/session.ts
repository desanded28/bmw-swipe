"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { LOCALES, type Locale } from "@/i18n/config";
import { getT } from "@/i18n/server";
import { zodErrorMap } from "@/i18n/zod";
import { staffLocaleOf } from "@/lib/dashboard";
import { fail, guard, ok, staff, type ActionResult } from "./_shared";

/** Staff session actions (WP2): switching practice and the dashboard language. */

/** Make another of the user's practices the active one. */
export async function switchOrg(orgId: string) {
  const s = await staff();
  if (!s.orgs.some((o) => o.org.id === orgId)) return;
  await db.update(sessions).set({ orgId }).where(eq(sessions.id, s.sessionId));
  redirect("/dashboard");
}

/**
 * The signed-in user's dashboard language (users.locale), or null to follow the browser and the
 * practice default again. Applies to every practice the user belongs to. guard() revalidates the
 * dashboard layout, so the next response renders <html lang> and every text in the new language.
 * No cookie is set: the choice lives with the account, not the device.
 */
export async function updateMyLocale(locale: Locale | null): Promise<ActionResult> {
  return guard(async (s) => {
    const current = await staffLocaleOf(s);
    const parsed = z.enum(LOCALES).nullable().safeParse(locale, { error: zodErrorMap(current) });
    if (!parsed.success) return fail(getT(current, "dashboard")("language.invalid"), "invalid");
    await db.update(users).set({ locale: parsed.data }).where(eq(users.id, s.user.id));
    // Confirm in the language just chosen ("automatic" takes effect on the next page).
    return ok(getT(parsed.data ?? current, "dashboard")("language.saved"), { locale: parsed.data });
  });
}
