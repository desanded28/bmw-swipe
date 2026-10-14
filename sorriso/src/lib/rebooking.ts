import { and, asc, eq, gt, inArray, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  locations,
  organizations,
  patients,
  practitioners,
  services,
  timeOff,
  type Appointment,
  type TimeOff,
} from "@/db/schema";
import { fmtWhen } from "@/i18n/datefmt";
import { getAppointmentDetails, getOrgAppointmentDetails, type AppointmentDetails } from "./appointments";
import { audit, type AuditEvent } from "./audit";
import { BookingError, cancelAppointment, proposeAlternatives, rescheduleAppointment, type Alternative } from "./booking";
import { absoluteUrl } from "./config";
import { recipientFor } from "./contact";
import { practitionerName } from "./format";
import { manageTokenOf } from "./links";
import { logError } from "./log";
import { sendPatientMessage } from "./messaging";
import { getPrivacy } from "./privacy/settings";
import { cancelPendingReminders, scheduleReminders } from "./reminders";
import { resolveSettings } from "./settings";

/**
 * Rebooking assistant (WP8): the practice closes (time off for a practitioner, an office, a chair
 * or the whole practice) and some patients are booked in that time. See docs/care.md.
 *
 *   1. addTimeOff returns the appointments the closure covers; staff open "Rebook N patients".
 *   2. sendRebookOffers: each patient gets a discreet "we need to move your appointment" message
 *      in their language with a link to /{locale}/a/<token>/rebook; the visit is flagged
 *      needsAttention and its reminders stop (they would announce a visit that can't happen).
 *   3. The patient picks one of proposeAlternatives() in one tap (rescheduleAppointment with
 *      practiceMoved: the patient policies don't apply), or asks to be called.
 *   4. Or staff cancel instead: cancelledBy 'staff', reason 'practice_unavailable' (the marketplace
 *      reliability metric counts these).
 * Whether a visit needs rebooking is never stored: it is "a closure covers it", checked live, so
 * removing the closure ends it (and brings the reminders back).
 */

/** The reason stored on visits staff cancel because the practice is closed. */
export const PRACTICE_UNAVAILABLE = "practice_unavailable";
/** confirmedVia of a visit whose patient asked to be called instead of picking a time. */
export const CALL_REQUESTED = "rebook_call";

type Closure = Pick<TimeOff, "practitionerId" | "locationId" | "roomId" | "startsAt" | "endsAt">;
type Visit = Pick<Appointment, "practitionerId" | "locationId" | "roomId" | "startsAt" | "endsAt">;

/**
 * Does the closure take this visit? The same scopes as the availability engine and addTimeOff: a
 * chair closure takes visits in that chair, a practitioner's time off their visits, an office
 * closure every visit at that office, a practice closure every visit.
 */
export function closureCovers(t: Closure, a: Visit): boolean {
  if (!(a.startsAt.getTime() < t.endsAt.getTime() && t.startsAt.getTime() < a.endsAt.getTime())) return false;
  if (t.roomId) return a.roomId === t.roomId;
  if (t.practitionerId) return a.practitionerId === t.practitionerId;
  return !t.locationId || t.locationId === a.locationId;
}

const UPCOMING = ["scheduled", "requested"] as const;

/** Upcoming visits of the org that `closure` covers (ids, by start). */
export async function clashingAppointments(orgId: string, closure: Closure, now: Date = new Date()): Promise<string[]> {
  const rows = await db
    .select({
      id: appointments.id,
      practitionerId: appointments.practitionerId,
      locationId: appointments.locationId,
      roomId: appointments.roomId,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.orgId, orgId),
        inArray(appointments.status, UPCOMING),
        lt(appointments.startsAt, closure.endsAt),
        gt(appointments.endsAt, closure.startsAt),
        gt(appointments.startsAt, now),
      ),
    )
    .orderBy(asc(appointments.startsAt));
  return rows.filter((a) => closureCovers(closure, a)).map((a) => a.id);
}

/** For each closure of the org, how many upcoming visits it covers. */
export async function closureClashCounts(orgId: string, closureIds: readonly string[], now: Date = new Date()): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!closureIds.length) return out;
  const rows = await db
    .select()
    .from(timeOff)
    .where(and(eq(timeOff.orgId, orgId), inArray(timeOff.id, [...closureIds]), gt(timeOff.endsAt, now)));
  for (const t of rows) out.set(t.id, (await clashingAppointments(orgId, t, now)).length);
  return out;
}

/** The closures (of its org) that cover this visit now. */
async function coveringClosures(a: Pick<Appointment, "orgId"> & Visit): Promise<TimeOff[]> {
  const rows = await db
    .select()
    .from(timeOff)
    .where(and(eq(timeOff.orgId, a.orgId), lt(timeOff.startsAt, a.endsAt), gt(timeOff.endsAt, a.startsAt)));
  return rows.filter((t) => closureCovers(t, a));
}

/** Does this upcoming visit need a new time because the practice closed? */
export async function needsRebooking(a: Pick<Appointment, "orgId" | "status"> & Visit, now: Date = new Date()): Promise<boolean> {
  if (!(UPCOMING as readonly string[]).includes(a.status) || a.startsAt <= now) return false;
  return (await coveringClosures(a)).length > 0;
}

export type ClashRow = {
  id: string;
  start: Date;
  end: Date;
  timezone: string;
  patientName: string;
  practitionerName: string;
  locationName: string;
  /** An offer went out (or something else needs a look). */
  needsAttention: boolean;
  callRequested: boolean;
  /** The patient (or their guardian) has a phone or email we may use. */
  reachable: boolean;
};

/** The visits one closure covers, for the "Rebook N patients" drawer. Org-scoped. */
export async function listClosureClashes(orgId: string, closureId: string, now: Date = new Date()): Promise<ClashRow[]> {
  const [t] = await db.select().from(timeOff).where(and(eq(timeOff.id, closureId), eq(timeOff.orgId, orgId)));
  if (!t) return [];
  const ids = await clashingAppointments(orgId, t, now);
  if (!ids.length) return [];
  const rows = await db
    .select({ a: appointments, p: patients, pr: practitioners, l: locations })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .where(and(eq(appointments.orgId, orgId), inArray(appointments.id, ids)))
    .orderBy(asc(appointments.startsAt));
  return rows.map(({ a, p, pr, l }) => {
    const to = recipientFor(p, now);
    return {
      id: a.id,
      start: a.startsAt,
      end: a.endsAt,
      timezone: l.timezone,
      patientName: `${p.firstName} ${p.lastName}`.trim(),
      practitionerName: practitionerName(pr),
      locationName: l.name,
      needsAttention: a.needsAttention,
      callRequested: a.confirmedVia === CALL_REQUESTED,
      reachable: Boolean((to.phone && p.smsOptIn) || (to.email && p.emailOptIn)),
    };
  });
}

/** The link in the "we need to move your appointment" message: short and unprefixed. */
export function rebookUrl(token: string): string {
  return absoluteUrl(`/a/${token}/rebook`);
}

export type RebookOffersResult = { sent: string[]; unreachable: string[]; skipped: string[] };

/**
 * Offer new times to the patients of these visits (the practice closed). Only upcoming visits of
 * this org that a closure covers get one; each is flagged needsAttention, its pending reminders
 * are cancelled, and the patient (the guardian for a child under 14) gets careMessages.practiceMoved
 * in their language with the rebooking link. Restricted patients get nothing (unreachable: call
 * them). Audited per visit as appointment.update.
 */
export async function sendRebookOffers(
  orgId: string,
  ids: readonly string[],
  actor: AuditEvent["actor"],
  now: Date = new Date(),
): Promise<RebookOffersResult> {
  const out: RebookOffersResult = { sent: [], unreachable: [], skipped: [] };
  for (const id of [...new Set(ids)]) {
    try {
      const d = await getOrgAppointmentDetails(orgId, id);
      const token = d ? manageTokenOf(d.appointment) : null;
      if (!d || !token || !(await needsRebooking(d.appointment, now))) {
        out.skipped.push(id);
        continue;
      }
      await db.transaction(async (tx) => {
        await tx
          .update(appointments)
          .set({ needsAttention: true, updatedAt: now })
          .where(and(eq(appointments.id, id), eq(appointments.orgId, orgId)));
        // Reminders would announce a visit that can't take place.
        await cancelPendingReminders(tx, id, ["reminder"]);
      });
      const to = recipientFor(d.patient, now);
      const url = rebookUrl(token);
      const res = await sendPatientMessage({
        orgId,
        patient: d.patient,
        ns: "careMessages",
        kind: "practiceMoved",
        vars: { clinic: d.org.name, when: fmtWhen(d.appointment.startsAt, d.location.timezone, to.locale), url },
        url,
        appointmentId: id,
        now,
      });
      const delivered = res.ok && res.message.status !== "failed";
      (delivered ? out.sent : out.unreachable).push(id);
      await audit({
        orgId,
        actor,
        action: "appointment.update",
        entity: { type: "appointment", id },
        metadata: { rebook: "offer", delivered, skipReason: res.ok ? null : res.reason },
        at: now,
      });
    } catch (err) {
      logError("care", err, { step: "rebook-offer", appointmentId: id });
      out.skipped.push(id);
    }
  }
  return out;
}

/**
 * Cancel these visits because the practice is closed (instead of offering new times): cancelled by
 * staff with reason practice_unavailable; the patient gets the usual cancellation message with a
 * link to book again. Only visits a closure covers. Returns the ids cancelled.
 */
export async function cancelForClosure(orgId: string, ids: readonly string[], actor: AuditEvent["actor"], now: Date = new Date()): Promise<string[]> {
  const done: string[] = [];
  for (const id of [...new Set(ids)]) {
    const [a] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.orgId, orgId)));
    if (!a || !(await needsRebooking(a, now))) continue;
    const res = await cancelAppointment(id, { by: "staff", reason: PRACTICE_UNAVAILABLE, notifyPatient: true, now });
    if (!res) continue;
    done.push(id);
    await audit({ orgId, actor, action: "appointment.cancel", entity: { type: "appointment", id }, metadata: { reason: PRACTICE_UNAVAILABLE }, at: now });
  }
  return done;
}

/**
 * A closure was removed: its visits that no other closure covers are on again. Their reminders
 * come back (sendRebookOffers had stopped them); needsAttention stays for staff to clear, since the
 * patient may have been told the visit moves.
 */
export async function afterClosureRemoved(orgId: string, closure: Closure, now: Date = new Date()): Promise<number> {
  let restored = 0;
  const ids = await clashingAppointments(orgId, closure, now);
  if (!ids.length) return 0;
  const [org] = await db.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, orgId));
  const settings = resolveSettings(org?.settings);
  for (const id of ids) {
    const [a] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.orgId, orgId)));
    if (!a || (await coveringClosures(a)).length) continue;
    await db.transaction((tx) => scheduleReminders(tx, a, settings, now));
    restored++;
  }
  return restored;
}

// ---------------------------------------------------------------- the patient's page

export type RebookChoice = Alternative & { key: string; practitionerName: string; locationName: string };

export type RebookState =
  | { kind: "invalid" }
  | { kind: "not_needed"; d: AppointmentDetails }
  | { kind: "needed"; d: AppointmentDetails; choices: RebookChoice[]; callRequested: boolean };

/** A choice's form value: practitioner, office and start, so the click books exactly what was shown. */
export function choiceKey(c: Pick<Alternative, "practitionerId" | "locationId" | "start">): string {
  return `${c.practitionerId}|${c.locationId}|${c.start.getTime()}`;
}

function parseChoiceKey(key: string): { practitionerId: string; locationId: string; start: Date } | null {
  const [practitionerId, locationId, ms] = key.split("|");
  const start = new Date(Number(ms));
  if (!practitionerId || !locationId || !/^\d{10,15}$/.test(ms ?? "") || Number.isNaN(start.getTime())) return null;
  return { practitionerId, locationId, start };
}

/** What the rebooking page shows for this link. */
export async function rebookState(token: string, now: Date = new Date(), n = 3): Promise<RebookState> {
  const d = await getAppointmentDetails({ token });
  if (!d) return { kind: "invalid" };
  if (!(await needsRebooking(d.appointment, now))) return { kind: "not_needed", d };
  const alternatives = await proposeAlternatives(d.appointment.id, n, { now, orgId: d.org.id });
  const pIds = [...new Set(alternatives.map((a) => a.practitionerId))];
  const lIds = [...new Set(alternatives.map((a) => a.locationId))];
  const people = pIds.length ? await db.select().from(practitioners).where(and(eq(practitioners.orgId, d.org.id), inArray(practitioners.id, pIds))) : [];
  const offices = lIds.length ? await db.select().from(locations).where(and(eq(locations.orgId, d.org.id), inArray(locations.id, lIds))) : [];
  return {
    kind: "needed",
    d,
    callRequested: d.appointment.confirmedVia === CALL_REQUESTED,
    choices: alternatives.map((a) => {
      const p = people.find((x) => x.id === a.practitionerId);
      return {
        ...a,
        key: choiceKey(a),
        practitionerName: p ? practitionerName(p) : "",
        locationName: offices.find((x) => x.id === a.locationId)?.name ?? "",
      };
    }),
  };
}

export type AcceptResult =
  | { ok: true; d: AppointmentDetails }
  | { ok: false; reason: "invalid" | "not_needed" | "not_offered" | "taken" };

/**
 * The patient picked a new time. The choice must keep the practitioner or the office (what the
 * assistant offers); the slot is checked again by rescheduleAppointment (practiceMoved), so a
 * time taken in the meantime is refused ("taken") and the page shows fresh choices.
 */
export async function acceptAlternative(token: string, key: string, opts: { headers?: Headers; now?: Date } = {}): Promise<AcceptResult> {
  const now = opts.now ?? new Date();
  const d = await getAppointmentDetails({ token });
  if (!d) return { ok: false, reason: "invalid" };
  if (!(await needsRebooking(d.appointment, now))) return { ok: false, reason: "not_needed" };
  const choice = parseChoiceKey(key);
  const a = d.appointment;
  if (!choice || (choice.practitionerId !== a.practitionerId && choice.locationId !== a.locationId)) return { ok: false, reason: "not_offered" };
  try {
    const after = await rescheduleAppointment(a.id, {
      startsAt: choice.start,
      practitionerId: choice.practitionerId,
      locationId: choice.locationId,
      by: "patient",
      practiceMoved: true,
      now,
    });
    await audit({
      orgId: d.org.id,
      actor: { type: "patient_link", id: a.id },
      action: "appointment.update",
      entity: { type: "appointment", id: a.id },
      metadata: { rebook: "accepted", samePractitioner: choice.practitionerId === a.practitionerId },
      headers: opts.headers,
      at: now,
    });
    return { ok: true, d: after };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, reason: "taken" };
    throw err;
  }
}

/** The patient would rather be called than pick a time: the visit shows on the front desk's call list. */
export async function requestCallBack(token: string, opts: { headers?: Headers; now?: Date } = {}): Promise<"ok" | "invalid" | "not_needed"> {
  const now = opts.now ?? new Date();
  const d = await getAppointmentDetails({ token });
  if (!d) return "invalid";
  if (!(await needsRebooking(d.appointment, now))) return "not_needed";
  await db.transaction(async (tx) => {
    await tx
      .update(appointments)
      .set({ needsAttention: true, confirmation: "declined", confirmedVia: CALL_REQUESTED, confirmedAt: now, updatedAt: now })
      .where(and(eq(appointments.id, d.appointment.id), eq(appointments.orgId, d.org.id)));
    await audit(
      {
        orgId: d.org.id,
        actor: { type: "patient_link", id: d.appointment.id },
        action: "appointment.update",
        entity: { type: "appointment", id: d.appointment.id },
        metadata: { rebook: "call_requested" },
        headers: opts.headers,
        at: now,
      },
      tx,
    );
  });
  return "ok";
}

// ---------------------------------------------------------------- the front desk's call list

export type CallRow = {
  appointmentId: string;
  patientId: string;
  patientName: string;
  /** null unless the viewer may read contacts. */
  phone: string | null;
  start: Date;
  timezone: string;
  practitionerName: string;
  serviceName: string;
  reason: "rebook" | "rebook_call" | "risk";
  riskReasons: string[];
};

/**
 * Who the front desk should phone: visits the practice must move (closure) whose patient hasn't
 * picked a new time — first those who asked to be called — and, where the practice uses no-show
 * risk, unconfirmed high-risk visits in the next 48 hours. Help only: nothing here blocks anything.
 */
export async function frontDeskCallList(orgId: string, now: Date, opts: { contacts: boolean }): Promise<CallRow[]> {
  const [org] = await db.select({ settings: organizations.settings }).from(organizations).where(eq(organizations.id, orgId));
  if (!org) return [];
  const rows = await db
    .select({ a: appointments, p: patients, pr: practitioners, l: locations, s: services })
    .from(appointments)
    .innerJoin(patients, eq(patients.id, appointments.patientId))
    .innerJoin(practitioners, eq(practitioners.id, appointments.practitionerId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(
      and(
        eq(appointments.orgId, orgId),
        inArray(appointments.status, UPCOMING),
        gt(appointments.startsAt, now),
        lte(appointments.startsAt, new Date(now.getTime() + 60 * 86_400_000)),
        sql`(${appointments.needsAttention} = 1 or (${appointments.riskLevel} = 'high' and ${appointments.confirmation} <> 'confirmed' and ${appointments.startsAt} <= ${now.getTime() + 48 * 3_600_000}))`,
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(300);
  const showRisk = getPrivacy(org).riskBasedReminders;
  const out: CallRow[] = [];
  for (const { a, p, pr, l, s } of rows) {
    const rebook = a.needsAttention && (await needsRebooking(a, now));
    const risky = showRisk && a.riskLevel === "high" && a.confirmation !== "confirmed" && a.startsAt.getTime() <= now.getTime() + 48 * 3_600_000;
    if (!rebook && !risky) continue;
    out.push({
      appointmentId: a.id,
      patientId: p.id,
      patientName: `${p.firstName} ${p.lastName}`.trim(),
      phone: opts.contacts ? recipientFor(p, now).phone : null,
      start: a.startsAt,
      timezone: l.timezone,
      practitionerName: practitionerName(pr),
      serviceName: s.name,
      reason: rebook ? (a.confirmedVia === CALL_REQUESTED ? "rebook_call" : "rebook") : "risk",
      riskReasons: risky ? a.riskReasons : [],
    });
  }
  const order = { rebook_call: 0, rebook: 1, risk: 2 } as const;
  return out.sort((x, y) => order[x.reason] - order[y.reason] || x.start.getTime() - y.start.getTime());
}

/** For the appointment drawer: does the visit need rebooking, and did the patient ask for a call? */
export async function rebookStatus(orgId: string, appointmentId: string, now: Date = new Date()): Promise<{ needed: boolean; callRequested: boolean }> {
  const [a] = await db.select().from(appointments).where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)));
  if (!a) return { needed: false, callRequested: false };
  const needed = await needsRebooking(a, now);
  return { needed, callRequested: needed && a.confirmedVia === CALL_REQUESTED };
}
