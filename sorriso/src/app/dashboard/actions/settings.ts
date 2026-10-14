"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { memberships, organizations, users } from "@/db/schema";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import type { StaffSession } from "@/lib/auth";
import { logError } from "@/lib/log";
import { recordPracticeNotices } from "@/lib/privacy/notices";
import { sendPracticeEmailVerification } from "@/lib/security/emails";
import { fail, guard, ok, optional, str, updateSettings, type ActionResult } from "./_shared";

/** Practice profile, controller identity and booking rules (WP5). */

type T = ReturnType<typeof getT<"privacyAdmin">>;
/** The staff member's language (outside a request, e.g. in tests: the default). */
const staffLocale = () => getStaffLocale().catch(() => DEFAULT_LOCALE);
const tr = async (): Promise<T> => getT(await staffLocale(), "privacyAdmin");

/** An http(s) URL, "https://" added when the scheme is missing; null when empty; false when invalid. */
function website(raw: string | null): string | null | false {
  if (!raw) return null;
  const v = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(v);
    if ((u.protocol !== "https:" && u.protocol !== "http:") || !u.hostname.includes(".") || u.username || u.password) return false;
    return u.toString().replace(/\/$/, "");
  } catch {
    return false;
  }
}

const validEmail = (v: string | null) => !v || z.email().safeParse(v).success;

/** Is this the verified sign-in address of one of the practice's owners? */
async function isVerifiedOwnerEmail(orgId: string, email: string): Promise<boolean> {
  const [row] = await db
    .select({ id: users.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner"), isNotNull(users.emailVerifiedAt), sql`lower(${users.email}) = ${email}`))
    .limit(1);
  return Boolean(row);
}

/**
 * The practice email gates online booking (canAcceptOnlineBookings needs emailVerifiedAt) and
 * receives patients' replies and privacy answers, so changing it drops the verification — unless
 * the new address is the verified sign-in address of an owner. When an owner saves it, a
 * confirmation link goes to the new address (WP6's sendPracticeEmailVerification: the practice's
 * own message, and confirming it marks only the practice email verified, while it still matches
 * and the owner is still an owner).
 */
async function reverifyPracticeEmail(s: StaffSession, email: string | null): Promise<"verified" | "sent" | "unverified"> {
  if (email && (await isVerifiedOwnerEmail(s.org.id, email))) {
    await db.update(organizations).set({ emailVerifiedAt: new Date() }).where(eq(organizations.id, s.org.id));
    return "verified";
  }
  await db.update(organizations).set({ emailVerifiedAt: null }).where(eq(organizations.id, s.org.id));
  if (!email || s.role !== "owner") return "unverified";
  try {
    await sendPracticeEmailVerification({ org: s.org, owner: { id: s.user.id, name: s.user.name, locale: s.user.locale }, email });
    return "sent";
  } catch (err) {
    logError("settings", err, { step: "practice-email-verify", orgId: s.org.id });
    return "unverified";
  }
}

/**
 * Put the practice's privacy notices, as they now read, on record in every language (WP4's
 * recordPracticeNotices): they name the controller, its contacts and its DPO. Never fails the save.
 */
async function recordNotices(orgId: string) {
  try {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (org) await recordPracticeNotices(org);
  } catch (err) {
    logError("settings", err, { step: "record-notices", orgId });
  }
}

export async function saveProfile(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const name = str(fd, "name").slice(0, 120);
      if (!name) return fail(t("settings.errors.name_required"), "invalid");
      const site = website(optional(fd, "website"));
      if (site === false) return fail(t("settings.errors.invalid_website"), "invalid_website");
      const email = optional(fd, "email")?.toLowerCase() ?? null;
      const privacyEmail = optional(fd, "privacyEmail")?.toLowerCase() ?? null;
      const dpoEmail = optional(fd, "dpoEmail")?.toLowerCase() ?? null;
      if (![email, privacyEmail, dpoEmail].every(validEmail)) return fail(t("settings.errors.invalid_email"), "invalid_email");
      const color = str(fd, "brandColor");
      const text = (k: string, max = 200) => optional(fd, k)?.slice(0, max) ?? null;
      await db
        .update(organizations)
        .set({
          name,
          description: text("description", 2000),
          phone: text("phone", 40),
          email,
          website: site,
          brandColor: /^#[0-9a-f]{6}$/i.test(color) ? color : s.org.brandColor,
          listed: fd.get("listed") === "on",
          legalName: text("legalName"),
          vatNumber: text("vatNumber", 32),
          registeredAddress: text("registeredAddress", 300),
          privacyEmail,
          dpoName: text("dpoName"),
          dpoEmail,
          medicalDirector: text("medicalDirector"),
        })
        .where(eq(organizations.id, s.org.id));
      await recordNotices(s.org.id);
      if ((email ?? "") === (s.org.email ?? "").toLowerCase()) return ok(t("settings.profile.saved"));
      const verification = await reverifyPracticeEmail(s, email);
      if (verification === "verified") return ok(t("settings.profile.saved"));
      return ok(verification === "sent" ? t("settings.profile.savedVerify") : t("settings.profile.savedUnverified"));
    },
    { permission: "settings.manage", audit: "settings.update" },
  );
}

export async function saveBookingPolicy(_prev: unknown, fd: FormData): Promise<ActionResult> {
  return guard(
    async (s) => {
      const t = await tr();
      const num = (k: string, min: number, max: number) => Math.max(min, Math.min(max, Math.round(Number(str(fd, k)) || 0)));
      const step = Number(str(fd, "slotStepMinutes"));
      // One transaction; keys outside the resolved shape (the register's free rows) are kept.
      await updateSettings(s.org.id, (resolved) => ({
        ...resolved,
        booking: {
          minNoticeMinutes: num("minNoticeHours", 0, 24 * 14) * 60,
          maxAdvanceDays: num("maxAdvanceDays", 1, 365),
          slotStepMinutes: [5, 10, 15, 20, 30, 60].includes(step) ? step : 15,
          cancelUntilHours: num("cancelUntilHours", 0, 24 * 7),
          requireApproval: fd.get("requireApproval") === "on",
        },
      }));
      return ok(t("settings.booking.saved"));
    },
    { permission: "settings.manage", audit: "settings.update" },
  );
}
