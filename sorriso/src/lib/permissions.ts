import { redirect } from "next/navigation";
import { MEMBERSHIP_ROLES, type MembershipRole } from "@/db/enums";
import { requireStaff, type StaffSession } from "./auth";

/**
 * Role-based access control for the dashboard (least privilege, GDPR Art. 25 and 32).
 *
 * Pages call requirePermission(); actions call assertPermission() (guard() turns the
 * PermissionError into fail("forbidden")). Client components never import this module:
 * the server passes them booleans or permissionsFor(role).
 */

export const PERMISSIONS = [
  "calendar.read",
  "appointment.write",
  "appointment.notes.read",
  "appointment.notes.write",
  "patient.read",
  "patient.contact.read",
  "patient.write",
  "patient.notes.read",
  "patient.clinical.read",
  "patient.export",
  "patient.erase",
  "patient.restrict",
  "patient.restricted.read",
  "privacy.requests",
  "privacy.settings",
  "audit.read",
  "legal.accept",
  "settings.manage",
  "team.manage",
  "apikeys.manage",
  "reminders.manage",
  "reminders.run",
  "messages.read",
  "messages.simulate",
  "reviews.reply",
  "reviews.report",
  "catalog.manage",
  "recalls.manage",
  "analytics.read",
  "org.export",
  "org.close",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Shared by practitioners and the front desk: the calendar, appointments with their notes, and
 * patients' identities. Appointment notes (the patient's booking note and the staff note) are
 * front-desk material by F6 and are shown to reception; clinical findings belong in the
 * patient's notes and clinical record (patient.notes.read, patient.clinical.read), which are not.
 * Whether the staff note should move behind a clinician-only permission is an open decision.
 */
const FRONT_LINE = [
  "calendar.read",
  "appointment.write",
  "appointment.notes.read",
  "appointment.notes.write",
  "patient.read",
  "patient.contact.read",
  "recalls.manage",
  "messages.read",
] as const satisfies readonly Permission[];

export const ROLE_PERMISSIONS: Record<MembershipRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  // Everything except closing the practice's account, which is irreversible.
  admin: PERMISSIONS.filter((p) => p !== "org.close"),
  // Clinical notes and anamnesis are for the treating clinician.
  practitioner: [...FRONT_LINE, "patient.notes.read", "patient.clinical.read"],
  // Front desk: books and edits patient details; no patient notes or clinical record.
  reception: [...FRONT_LINE, "patient.write"],
};

const SETS = new Map<MembershipRole, ReadonlySet<Permission>>(MEMBERSHIP_ROLES.map((r) => [r, new Set(ROLE_PERMISSIONS[r])]));

export function can(role: MembershipRole | null | undefined, p: Permission): boolean {
  return !!role && (SETS.get(role)?.has(p) ?? false);
}

/**
 * Patient fields that need more than patient.read (clinical free text). Loaders that return a
 * patient row to a page pass it through visiblePatient() so a role without the permission never
 * receives the value, not just never sees it rendered.
 */
export const PATIENT_FIELD_PERMISSIONS = { notes: "patient.notes.read" } as const satisfies Record<string, Permission>;

/** A copy of the patient row with the fields this role may not read set to null. */
export function visiblePatient<T extends { notes?: string | null }>(role: MembershipRole | null | undefined, patient: T): T {
  return can(role, PATIENT_FIELD_PERMISSIONS.notes) ? patient : { ...patient, notes: null };
}

/** The role's permissions, for handing to client components (e.g. which sidebar entries to show). */
export function permissionsFor(role: MembershipRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export class PermissionError extends Error {
  readonly code = "forbidden";
  constructor(public permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "PermissionError";
  }
}

/** For server actions: throws PermissionError when the signed-in role lacks `p`. */
export function assertPermission(s: Pick<StaffSession, "role">, p: Permission): void {
  if (!can(s.role, p)) throw new PermissionError(p);
}

/**
 * For dashboard pages and loaders: like requireStaff() (redirects to /login when signed
 * out), then redirects to /dashboard?denied=1 when the role lacks `p`.
 */
export async function requirePermission(p: Permission): Promise<StaffSession> {
  const s = await requireStaff();
  if (!can(s.role, p)) redirect("/dashboard?denied=1");
  return s;
}
