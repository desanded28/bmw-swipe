"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { practitioners } from "@/db/schema";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { audit } from "@/lib/audit";
import { requirePlatformAdmin, type StaffSession } from "@/lib/auth";
import { logError } from "@/lib/log";
import { askAuthor, decideHeldReview, decideReport, type ModerationError } from "@/lib/reviews";
import { fail, ok, type ActionResult } from "./_shared";

/**
 * Platform-admin actions (WP7): Albo verification and review moderation. Sorriso staff only:
 * every action starts with requirePlatformAdmin() (which also audits platform.access), and each
 * decision is audited on the practice's chain with the platform admin as actor.
 */

/** The staff member's language. Outside a request (tests, scripts) the default: never fails the action. */
async function staffLocale(): Promise<Locale> {
  try {
    return await getStaffLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Like guard(), for platform admins. Next.js redirects (not an admin) propagate. */
async function platform(fn: (s: StaffSession) => Promise<ActionResult>): Promise<ActionResult> {
  try {
    const s = await requirePlatformAdmin();
    const result = await fn(s);
    if (result.ok) revalidatePath("/dashboard/platform", "layout");
    return result;
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err) throw err;
    logError("platform action", err);
    const t = getT(await staffLocale(), "reviews");
    return fail(t("errors.generic"));
  }
}

/** Mark a practitioner's Albo registration as checked in the public FNOMCeO register. */
export async function verifyAlbo(practitionerId: string): Promise<ActionResult> {
  return platform(async (s) => {
    const t = getT(await staffLocale(), "marketplace");
    const [p] = await db.select().from(practitioners).where(eq(practitioners.id, practitionerId));
    if (!p) return fail(t("errors.notFound"), "not_found");
    if (!p.alboProvince || !p.alboNumber) return fail(t("platform.alboQueue.missing"), "invalid");
    await db.update(practitioners).set({ alboVerifiedAt: new Date(), alboVerifiedByUserId: s.user.id }).where(eq(practitioners.id, p.id));
    await audit({
      orgId: p.orgId,
      actor: { type: "platform_admin", id: s.user.id },
      action: "practitioner.albo.verify",
      entity: { type: "practitioner", id: p.id },
      metadata: { verified: true },
    });
    return ok(t("platform.alboQueue.verified"));
  });
}

/** Withdraw the verification (wrong number, struck off): the badge and specialisations disappear. */
export async function revokeAlbo(practitionerId: string): Promise<ActionResult> {
  return platform(async (s) => {
    const t = getT(await staffLocale(), "marketplace");
    const [p] = await db.select().from(practitioners).where(eq(practitioners.id, practitionerId));
    if (!p) return fail(t("errors.notFound"), "not_found");
    await db.update(practitioners).set({ alboVerifiedAt: null, alboVerifiedByUserId: null }).where(eq(practitioners.id, p.id));
    await audit({
      orgId: p.orgId,
      actor: { type: "platform_admin", id: s.user.id },
      action: "practitioner.albo.verify",
      entity: { type: "practitioner", id: p.id },
      metadata: { verified: false },
    });
    return ok(t("platform.alboQueue.revoked"));
  });
}

async function moderationMessage(code: ModerationError): Promise<string> {
  const t = getT(await staffLocale(), "reviews");
  if (code === "reason_required") return t("moderation.reasonRequired");
  if (code === "not_allowed") return t("moderation.otherModerator");
  return t("moderation.notFound");
}

/** Ask a review's author for their side of a report (7 days to reply). */
export async function askReviewAuthor(reportId: string): Promise<ActionResult> {
  return platform(async (s) => {
    const t = getT(await staffLocale(), "reviews");
    const res = await askAuthor({ id: s.user.id }, reportId);
    if (!res.ok) return fail(await moderationMessage(res.code), res.code);
    return res.sent ? ok(t("moderation.asked")) : fail(t("moderation.askFailed"), "unreachable");
  });
}

/** Keep or remove a reported review (or decide an appeal), with the statement of reasons. */
export async function decideReviewReport(reportId: string, decision: "keep" | "remove", reason: string): Promise<ActionResult> {
  return platform(async (s) => {
    if (decision !== "keep" && decision !== "remove") return fail(await moderationMessage("not_found"));
    const res = await decideReport({ id: s.user.id }, { reportId, decision, reason });
    if (!res.ok) return fail(await moderationMessage(res.code), res.code);
    return ok(getT(await staffLocale(), "reviews")("moderation.decided"));
  });
}

/** Publish or keep off a review the automatic check held, with the statement of reasons. */
export async function decideHeldReviewAction(reviewId: string, decision: "keep" | "remove", reason: string): Promise<ActionResult> {
  return platform(async (s) => {
    if (decision !== "keep" && decision !== "remove") return fail(await moderationMessage("not_found"));
    const res = await decideHeldReview({ id: s.user.id }, { reviewId, decision, reason });
    if (!res.ok) return fail(await moderationMessage(res.code), res.code);
    return ok(getT(await staffLocale(), "reviews")("moderation.decided"));
  });
}
