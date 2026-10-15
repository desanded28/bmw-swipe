import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import type { MembershipRole } from "@/db/enums";
import { appointments, auditLog, organizations, patients, users } from "@/db/schema";
import type { StaffSession } from "@/lib/auth";
import { newId } from "@/lib/ids";
import { createPractice } from "@/test/fixtures";
import { cancelByStaff, confirmByPhone, moveAppointment, openRestrictedAppointment, recordOutcome, saveInternalNote } from "./appointments";

const state = vi.hoisted(() => ({ session: null as StaffSession | null }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-real-ip": "203.0.113.7" }), cookies: async () => new Map() }));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  requireStaff: async () => {
    if (!state.session) throw new Error("no session in test");
    return state.session;
  },
  requireStepUp: async () => {},
}));

let practice: Awaited<ReturnType<typeof createPractice>>;
const userIds: Partial<Record<MembershipRole, string>> = {};

async function signIn(role: MembershipRole) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, practice.orgId));
  if (!userIds[role]) {
    userIds[role] = newId();
    await db.insert(users).values({ id: userIds[role]!, email: `${role}-${userIds[role]}@example.org`, name: role, passwordHash: "x" });
  }
  state.session = { sessionId: "s1", user: { id: userIds[role]!, name: role, email: "x@example.org", isPlatformAdmin: false, locale: null }, org, role, orgs: [{ org, role }] };
  return state.session;
}

/** A visit an hour ago, still 'scheduled', of an Art. 18-restricted patient. */
async function restrictedVisit() {
  const patientId = newId();
  await db.insert(patients).values({ id: patientId, orgId: practice.orgId, firstName: "Valentina", lastName: "Russo", phone: "+390000017845", restrictedAt: new Date(), restrictionReason: "Contesta l'esattezza" });
  const id = newId();
  const startsAt = new Date(Date.now() - 60 * 60_000);
  const endsAt = new Date(startsAt.getTime() + 30 * 60_000);
  await db.insert(appointments).values({
    id,
    orgId: practice.orgId,
    locationId: practice.milano,
    practitionerId: practice.drA,
    serviceId: practice.visit,
    patientId,
    startsAt,
    endsAt,
    blockedUntil: endsAt,
    status: "scheduled",
    source: "staff",
    manageToken: `h:${id}`,
  });
  return { id, patientId };
}

const statusOf = async (id: string) => (await db.select({ s: appointments.status }).from(appointments).where(eq(appointments.id, id)))[0].s;

beforeAll(async () => {
  practice = await createPractice();
});

describe("a restricted patient's appointment (Art. 18)", () => {
  it("can't be changed by the front desk, who can't open restricted records", async () => {
    const v = await restrictedVisit();
    await signIn("reception");
    for (const res of [
      await recordOutcome(v.id, "no_show"),
      await cancelByStaff(v.id, "", false),
      await confirmByPhone(v.id),
      await saveInternalNote(v.id, "chiamare"),
      await moveAppointment({ id: v.id, date: "2030-03-04", time: "10:00", notifyPatient: false, force: true }),
    ]) {
      expect(res).toMatchObject({ ok: false, code: "restricted_reason_required" });
    }
    expect(await statusOf(v.id)).toBe("scheduled");
  });

  it("is changed by someone who may open it only after giving a reason, which the change's audit row carries", async () => {
    const v = await restrictedVisit();
    const owner = await signIn("owner");
    expect(await recordOutcome(v.id, "no_show")).toMatchObject({ ok: false, code: "restricted_reason_required" });
    expect(await openRestrictedAppointment(v.id, "Il paziente ha chiamato per disdire")).toMatchObject({ ok: true });
    expect(await recordOutcome(v.id, "no_show")).toMatchObject({ ok: true });
    expect(await statusOf(v.id)).toBe("no_show");
    const [row] = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.action, "appointment.update"), eq(auditLog.entityId, v.id), eq(auditLog.actorId, owner.user.id)));
    expect(row).toMatchObject({ reason: "Il paziente ha chiamato per disdire" });
    expect(row.metadata).toMatchObject({ change: "outcome", outcome: "no_show" });
  });
});
