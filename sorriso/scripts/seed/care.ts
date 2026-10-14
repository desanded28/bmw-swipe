import { and, asc, desc, eq, gt, inArray, isNotNull, lte } from "drizzle-orm";
import {
  appointments,
  formSubmissions,
  memberships,
  organizations,
  patients,
  recalls,
  services,
  type Recall,
  type ServiceCategory,
} from "../../src/db/schema";
import { findSlots, loadAvailabilityContext, rangeForDates } from "../../src/lib/availability";
import { createAppointment } from "../../src/lib/booking";
import { DEFAULT_ANAMNESIS_V1, ensureDefaultTemplate, redFlagsOf } from "../../src/lib/forms";
import { newId } from "../../src/lib/ids";
import { addMonthsToDate } from "../../src/lib/recalls";
import { refreshAppointmentRisk } from "../../src/lib/risk";
import { fakePhone } from "../../src/lib/security/seed-guard";
import { resolveSettings } from "../../src/lib/settings";
import { addDays, todayIn, zonedParts } from "../../src/lib/time";
import type { SeedContext } from "../seed";

/**
 * Continuity-of-care demo data (WP8), run by scripts/seed.ts after the core seed:
 * - recall suggestions on the services (hygiene 6 months, check-ups 12, orthodontic checks 3);
 * - the flagship practice uses no-show risk and collects the medical history online;
 * - recalls from completed visits: due soon, overdue, to call, waiting for a clinician, booked
 *   (demo due dates are spread around today so every list of /dashboard/recalls has rows);
 * - risk computed for the upcoming visits;
 * - a child under 14 booked by a parent (guardian routing, "parental consent required");
 * - one signed medical history with a red flag (anticoagulants) on an upcoming visit;
 * - a pair of possible duplicates for /dashboard/patients/duplicates.
 * Deterministic in shape: rows are picked by date order, not at random.
 */

const TZ = "Europe/Rome";
const RECALL_MONTHS: Partial<Record<ServiceCategory, number>> = { hygiene: 6, checkup: 12, orthodontics: 3 };
const DAY_MS = 86_400_000;

export async function seedCare(ctx: SeedContext): Promise<void> {
  const { db, now } = ctx;
  const today = todayIn(TZ, now);

  for (const orgId of ctx.orgIds) {
    for (const [category, months] of Object.entries(RECALL_MONTHS)) {
      await db
        .update(services)
        .set({ recallMonths: months })
        .where(and(eq(services.orgId, orgId), eq(services.category, category as ServiceCategory)));
    }
  }

  const orgId = ctx.orgIds[0];
  if (!orgId) return;
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  const settings = resolveSettings(org.settings);
  await db
    .update(organizations)
    .set({
      settings: {
        ...settings,
        privacy: { ...settings.privacy, riskBasedReminders: true },
        care: { ...settings.care, anamnesisEnabled: true, recallsEnabled: true },
      },
    })
    .where(eq(organizations.id, orgId));
  const [owner] = await db
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.role, "owner")));
  const clinician = owner?.userId ?? null;

  // ---- recalls: the latest completed visit per patient and treatment with a suggested interval.
  const done = await db
    .select({ a: appointments, months: services.recallMonths, category: services.category })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.orgId, orgId), eq(appointments.status, "completed"), isNotNull(services.recallMonths)))
    .orderBy(desc(appointments.startsAt));
  const seen = new Set<string>();
  const latest = done.filter(({ a }) => {
    const key = `${a.patientId}|${a.serviceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  type Shape = Pick<Recall, "dueDate" | "status" | "attempts" | "lastSentAt" | "setByUserId">;
  const ago = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const shapes: Shape[] = [
    // Due soon (confirmed by a clinician).
    ...[3, 8, 15, 21].map((d) => ({ dueDate: addDays(today, d), status: "due" as const, attempts: 0, lastSentAt: null, setByUserId: clinician })),
    // Overdue: one message sent.
    ...[12, 20, 30].map((d) => ({ dueDate: addDays(today, -d), status: "sent" as const, attempts: 1, lastSentAt: ago(d - 1), setByUserId: clinician })),
    // To call: two messages, no booking.
    ...[35, 50].map((d) => ({ dueDate: addDays(today, -d), status: "call" as const, attempts: 2, lastSentAt: ago(d - 16), setByUserId: clinician })),
    // Suggested by the treatment, waiting for a clinician (never sent).
    ...[5, -2].map((d) => ({ dueDate: addDays(today, d), status: "due" as const, attempts: 0, lastSentAt: null, setByUserId: null })),
  ];
  const recallRows: (typeof recalls.$inferInsert)[] = latest.map(({ a, months, category }, i) => {
    const shape: Shape = shapes[i] ?? {
      dueDate: addMonthsToDate(zonedParts(a.startsAt, TZ).date, months!),
      status: "due",
      attempts: 0,
      lastSentAt: null,
      setByUserId: clinician,
    };
    return {
      id: newId(),
      orgId,
      patientId: a.patientId,
      serviceId: a.serviceId,
      practitionerId: a.practitionerId,
      sourceAppointmentId: a.id,
      intervalMonths: months!,
      reasonCode: category,
      createdAt: a.endsAt,
      updatedAt: now,
      ...shape,
    };
  });
  // One recall the patient already booked from.
  const [nextCleaning] = await db
    .select({ a: appointments })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.orgId, orgId), eq(appointments.status, "scheduled"), eq(services.category, "hygiene"), gt(appointments.startsAt, now)))
    .orderBy(asc(appointments.startsAt))
    .limit(1);
  const bookedShape = nextCleaning
    ? { status: "booked" as const, bookedAppointmentId: nextCleaning.a.id, dueDate: addDays(today, -4), attempts: 1, lastSentAt: ago(6), setByUserId: clinician }
    : null;
  const already = nextCleaning ? recallRows.find((r) => r.patientId === nextCleaning.a.patientId && r.serviceId === nextCleaning.a.serviceId) : undefined;
  if (already && bookedShape) Object.assign(already, bookedShape);
  else if (nextCleaning && bookedShape) {
    recallRows.push({
      id: newId(),
      orgId,
      patientId: nextCleaning.a.patientId,
      serviceId: nextCleaning.a.serviceId,
      practitionerId: nextCleaning.a.practitionerId,
      sourceAppointmentId: null,
      intervalMonths: 6,
      reasonCode: "hygiene",
      createdAt: ago(60),
      updatedAt: now,
      ...bookedShape,
    });
  }
  for (let i = 0; i < recallRows.length; i += 100) await db.insert(recalls).values(recallRows.slice(i, i + 100));

  // ---- a child under 14, booked by a parent: messages go to the parent.
  let minorBooked = false;
  const [kids] = await db
    .select({ id: services.id })
    .from(services)
    .where(and(eq(services.orgId, orgId), eq(services.category, "pediatric")));
  if (kids) {
    const from = addDays(today, 2);
    const actx = await loadAvailabilityContext({ orgId, serviceId: kids.id, ...rangeForDates(from, 6, TZ) });
    const slot = actx ? findSlots(actx, { fromDate: from, days: 6, now, enforcePolicy: false }).find((s) => zonedParts(s.start, TZ).minutes >= 15 * 60) : undefined;
    if (slot) {
      const birth = addDays(today, -Math.round(9.4 * 365));
      await createAppointment({
        orgId,
        serviceId: kids.id,
        practitionerId: slot.practitionerId,
        locationId: slot.locationId,
        startsAt: slot.start,
        patient: {
          firstName: "Matteo",
          lastName: "Ferri",
          birthDate: birth,
          locale: "it",
          guardianName: "Laura Ferri",
          guardianRelation: "parent",
          guardianPhone: fakePhone(9_900_001),
          guardianEmail: "laura.ferri@example.com",
        },
        relation: { bookedFor: "minor", guardian: { name: "Laura Ferri", relation: "parent", phone: fakePhone(9_900_001), email: "laura.ferri@example.com" } },
        source: "staff",
        online: false,
        isNewPatient: true,
        now,
      });
      minorBooked = true;
    }
  }

  // ---- a patient who missed earlier visits, unconfirmed for a visit in the next two days: the
  // call list's "high no-show risk" row.
  const soon = await db
    .select({ id: appointments.id, patientId: appointments.patientId })
    .from(appointments)
    .where(
      and(
        eq(appointments.orgId, orgId),
        eq(appointments.status, "scheduled"),
        gt(appointments.startsAt, now),
        lte(appointments.startsAt, new Date(now.getTime() + 2 * DAY_MS)),
      ),
    )
    .orderBy(asc(appointments.startsAt));
  for (const s of soon) {
    const past = await db
      .select({ id: appointments.id, status: appointments.status })
      .from(appointments)
      .where(and(eq(appointments.orgId, orgId), eq(appointments.patientId, s.patientId), lte(appointments.endsAt, now), inArray(appointments.status, ["completed", "no_show"])))
      .orderBy(desc(appointments.startsAt))
      .limit(3);
    if (past.length < 2) continue;
    await db.update(appointments).set({ confirmation: "pending", confirmedAt: null, confirmedVia: null }).where(eq(appointments.id, s.id));
    await db.update(appointments).set({ status: "no_show" }).where(inArray(appointments.id, past.map((a) => a.id)));
    const added = past.filter((a) => a.status !== "no_show").length;
    const [pt] = await db.select({ n: patients.noShowCount }).from(patients).where(eq(patients.id, s.patientId));
    await db.update(patients).set({ noShowCount: (pt?.n ?? 0) + added }).where(eq(patients.id, s.patientId));
    break;
  }

  // ---- no-show risk for the next two weeks of visits.
  const upcoming = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.orgId, orgId),
        inArray(appointments.status, ["scheduled", "requested"]),
        gt(appointments.startsAt, now),
        lte(appointments.startsAt, new Date(now.getTime() + 14 * DAY_MS)),
      ),
    );
  for (const { id } of upcoming) await refreshAppointmentRisk(db, id, now);

  // ---- one signed medical history, with a red flag, on the next visit of an adult patient.
  const template = await ensureDefaultTemplate(db);
  const [next] = await db
    .select({ a: appointments, p: patients })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .where(and(eq(appointments.orgId, orgId), eq(appointments.status, "scheduled"), gt(appointments.startsAt, new Date(now.getTime() + 3_600_000))))
    .orderBy(asc(appointments.startsAt))
    .limit(1);
  if (next) {
    const answers = {
      anticoagulants: "yes",
      bisphosphonates: "no",
      otherMedication: "Apixaban 5 mg twice a day",
      allergies: "yes",
      allergiesDetail: "Penicillin",
      cardiac: "no",
      diabetes: "no",
      pregnancy: "not_applicable",
      smoking: "former",
      dentalAnxiety: "some",
    };
    await db.insert(formSubmissions).values({
      id: newId(),
      orgId,
      patientId: next.p.id,
      appointmentId: next.a.id,
      templateId: template.id,
      version: template.version,
      locale: next.p.locale,
      answers: JSON.stringify(answers),
      redFlags: redFlagsOf(DEFAULT_ANAMNESIS_V1, answers),
      signerName: `${next.p.firstName} ${next.p.lastName}`,
      signedAt: ago(1),
      signedVia: "otp_sms",
      createdAt: ago(1),
    });
  }

  // ---- a possible duplicate: same name and phone, another birth date.
  const [twin] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.orgId, orgId), isNotNull(patients.phone), isNotNull(patients.birthDate)))
    .orderBy(asc(patients.createdAt), asc(patients.lastName))
    .limit(1);
  if (twin) {
    await db.insert(patients).values({
      id: newId(),
      orgId,
      firstName: twin.firstName,
      lastName: twin.lastName,
      phone: twin.phone,
      email: null,
      birthDate: "1999-12-31",
      locale: twin.locale,
      possibleDuplicateOfId: twin.id,
      createdAt: now,
    });
  }

  console.log(
    `  care: ${recallRows.length} recalls, ${upcoming.length} visits risk-scored, ${minorBooked ? 1 : 0} minor with guardian, ${next ? 1 : 0} medical history, ${twin ? 1 : 0} possible duplicate`,
  );
}
