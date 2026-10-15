import "server-only";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { organizations, type OrgSettings } from "@/db/schema";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { getStaffLocale, getT } from "@/i18n/server";
import { getOrgAppointmentDetails } from "@/lib/appointments";
import { auditStaff, type AuditAction, type AuditEvent } from "@/lib/audit";
import { requireStaff, type StaffSession } from "@/lib/auth";
import { BookingError } from "@/lib/booking";
import { logError } from "@/lib/log";
import { assertPermission, PermissionError, type Permission } from "@/lib/permissions";
import { isStepUpRequired, STEP_UP_REQUIRED } from "@/lib/security/errors";
import { resolveSettings } from "@/lib/settings";

/**
 * Helpers for the dashboard's server actions (src/app/dashboard/actions/*.ts). [frozen]
 *
 * Not a "use server" module: nothing here is callable from the browser. Each package keeps its
 * actions in its own "use server" file, which may export only async functions (and types).
 * There is deliberately no barrel file: import an action from the file that defines it.
 *
 *   export async function saveThing(id: string): Promise<ActionResult> {
 *     return guard(async (s) => {
 *       ...queries scoped by s.org.id...
 *       return ok("Saved.");
 *     }, { permission: "catalog.manage", audit: "settings.update", entity: { type: "org", id } });
 *   }
 */

export type ActionResult = { ok: true; message?: string; data?: unknown } | { ok: false; error: string; code?: string };

export const ok = (message?: string, data?: unknown): ActionResult => ({ ok: true, message, data });
export const fail = (error: string, code?: string): ActionResult => ({ ok: false, error, code });

/** The signed-in staff member (redirects to /login when signed out); with `perm`, throws PermissionError without it. */
export async function staff(perm?: Permission): Promise<StaffSession> {
  const s = await requireStaff();
  if (perm) assertPermission(s, perm);
  return s;
}

export type GuardOptions = {
  /** Checked before `fn` runs; a missing permission returns fail(..., "forbidden"). */
  permission?: Permission;
  /** Recorded with auditStaff() after `fn` succeeds. Audit inside `fn` when the entity is created there. */
  audit?: AuditAction;
  /** The audited record, e.g. { type: "appointment", id }. */
  entity?: AuditEvent["entity"];
};

/**
 * The language of guard()'s own messages: the staff member's choice, else getStaffLocale()
 * (cookie, browser, practice default), else the practice default when there is no request.
 */
async function actionLocale(s: StaffSession | null): Promise<Locale> {
  if (s && isLocale(s.user.locale)) return s.user.locale;
  try {
    return await getStaffLocale();
  } catch {
    return s && isLocale(s.org.defaultLocale) ? s.org.defaultLocale : DEFAULT_LOCALE;
  }
}

/**
 * Run a dashboard action: loads the staff session, checks the permission, turns domain errors
 * into ActionResults, revalidates the dashboard after a success, and audits it.
 * Next.js redirects and notFound() propagate.
 *
 * Failure codes the UI can act on:
 * - "forbidden": the role lacks the permission (message from common.errors.forbidden);
 * - "step_up_required": requireStepUp() wants a fresh second factor; send the user to
 *   /dashboard/account/security/verify?next=<this page> (useSecureAction does);
 * - a BookingError's code, with calendar.errors.<code> (or .reasons.<reason>) as the message: the
 *   domain's own messages are English fallbacks, never shown to staff;
 * - a ZodError: common.errors.invalidInput (zod's default texts are English and technical; an
 *   action that wants to name the field validates it itself and returns fail()).
 * Its own messages are in the staff member's language.
 */
export async function guard(fn: (s: StaffSession) => Promise<ActionResult>, opts: GuardOptions = {}): Promise<ActionResult> {
  let s: StaffSession | null = null;
  try {
    s = await requireStaff();
    if (opts.permission) assertPermission(s, opts.permission);
    const result = await fn(s);
    if (result.ok) {
      if (opts.audit) await auditStaff(s, opts.audit, opts.entity);
      revalidatePath("/dashboard", "layout");
    }
    return result;
  } catch (err) {
    const t = async () => getT(await actionLocale(s), "common");
    if (err instanceof PermissionError) return fail((await t())("errors.forbidden"), "forbidden");
    // Before BookingError, which it extends: its message comes from requireStepUp(), localised.
    if (isStepUpRequired(err)) return fail(err.message || (await t())("errors.stepUp"), STEP_UP_REQUIRED);
    if (err instanceof BookingError) {
      const tc = getT(await actionLocale(s), "calendar");
      const reasonKey = `errors.reasons.${err.reason ?? ""}` as const;
      const codeKey = `errors.${err.code}` as const;
      const message = err.reason && tc.has(reasonKey) ? tc(reasonKey) : tc.has(codeKey) ? tc(codeKey) : (await t())("errors.unexpected");
      return fail(message, err.code);
    }
    if (err instanceof z.ZodError) return fail((await t())("errors.invalidInput"));
    // Let Next.js redirects / notFound propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    logError("dashboard action", err);
    return fail((await t())("errors.unexpected"));
  }
}

/** A trimmed form field ("" when missing). */
export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
/** A trimmed form field, or null when empty. */
export const optional = (fd: FormData, key: string) => str(fd, key) || null;

/** The appointment with its details, if it belongs to the org; BookingError not_found otherwise. */
export async function ownAppointment(orgId: string, id: string) {
  const d = await getOrgAppointmentDetails(orgId, id);
  if (!d) throw new BookingError("not_found", "Appointment not found.");
  return d;
}

/**
 * Read-modify-write of the org's settings JSON, in one write transaction. `patch` sees the
 * settings resolved over the defaults; stored keys it doesn't know (e.g. `register`, the Art. 30
 * register's free rows kept by WP5) are written back unchanged.
 */
export async function updateSettings(orgId: string, patch: (s: OrgSettings) => OrgSettings) {
  await db.transaction(async (tx) => {
    const [org] = await tx.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, orgId));
    if (!org) return;
    const stored = (org.settings ?? {}) as Record<string, unknown>;
    await tx
      .update(organizations)
      .set({ settings: { ...stored, ...patch(resolveSettings(org.settings)) } })
      .where(eq(organizations.id, orgId));
  });
}
