import "server-only";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { organizations, type OrgSettings } from "@/db/schema";
import { getOrgAppointmentDetails } from "@/lib/appointments";
import { auditStaff, type AuditAction, type AuditEvent } from "@/lib/audit";
import { requireStaff, type StaffSession } from "@/lib/auth";
import { BookingError } from "@/lib/booking";
import { logError } from "@/lib/log";
import { assertPermission, PermissionError, type Permission } from "@/lib/permissions";
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
 * Run a dashboard action: loads the staff session, checks the permission, turns domain errors
 * into ActionResults, revalidates the dashboard after a success, and audits it.
 * Next.js redirects and notFound() propagate.
 */
export async function guard(fn: (s: StaffSession) => Promise<ActionResult>, opts: GuardOptions = {}): Promise<ActionResult> {
  try {
    const s = await staff(opts.permission);
    const result = await fn(s);
    if (result.ok) {
      if (opts.audit) await auditStaff(s, opts.audit, opts.entity);
      revalidatePath("/dashboard", "layout");
    }
    return result;
  } catch (err) {
    if (err instanceof PermissionError) return fail("You don't have permission to do that.", "forbidden");
    if (err instanceof BookingError) return fail(err.message, err.code);
    if (err instanceof z.ZodError) return fail(err.issues[0]?.message ?? "Invalid input");
    // Let Next.js redirects / notFound propagate.
    if (err && typeof err === "object" && "digest" in err) throw err;
    logError("dashboard action", err);
    return fail("Something went wrong.");
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

/** Read-modify-write of the org's settings JSON (resolved over the defaults first). */
export async function updateSettings(orgId: string, patch: (s: OrgSettings) => OrgSettings) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  await db.update(organizations).set({ settings: patch(resolveSettings(org.settings)) }).where(eq(organizations.id, orgId));
}
