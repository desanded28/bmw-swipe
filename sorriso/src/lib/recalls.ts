import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  appointments,
  locations,
  organizations,
  patients,
  practitioners,
  recalls,
  services,
  type GuardianRelation,
  type Locale,
  type Recall,
  type RecallStatus,
} from "@/db/schema";
import { RECALL_INTERVALS } from "@/components/care/types";
import { zonedDate } from "@/i18n/datefmt";
import { lhref } from "@/i18n/href";
import { audit, type AuditEvent } from "./audit";
import { absoluteUrl } from "./config";
import { isMinor, isRestricted, recipientFor } from "./contact";
import { practitionerName } from "./format";
import { listSubmissions, mayReadPatient, sendFormInvites, type SubmissionSummary } from "./forms";
import { newId } from "./ids";
import { logError } from "./log";
import { sendPatientMessage } from "./messaging";
import type { Permission } from "./permissions";
import { signPracticeRef } from "./privacy/context";
import { getCare } from "./privacy/settings";
import { refreshRisks } from "./risk";
import { addDays, todayIn } from "./time";

/**
 * Clinical recalls (WP8): "it's time for your check-up". See docs/care.md.
 *
 * A recall follows a completed visit. The service's recallMonths only suggests the interval; a
 * recall is SENT only once a clinician set or confirmed the interval for this patient
 * (setByUserId, Art. 9(2)(h)): a suggestion nobody confirmed shows up on the dashboard, never in a
 * patient's phone. That interval then carries over to the patient's next visits for the same
 * treatment until a clinician changes it.
 *
 * Lifecycle: due -> sent (one message per attempt, every RECALL_RESEND_DAYS, at most
 * care.recallMaxAttempts) -> call (the front desk phones) ; booked as soon as the patient books
 * the same kind of treatment ; dismissed by staff, by the patient's objection to recalls, or when
 * nobody booked RECALL_EXPIRY_DAYS after the due date. Messages are discreet (careMessages.recall:
 * no treatment, no reason), carry an opt-out, go to the guardian for a child under 14, and never
 * to a restricted patient. reasonCode is internal and never put in a message.
 */

export { RECALL_INTERVALS };
export const RECALL_MONTHS_MIN = RECALL_INTERVALS[0];
export const RECALL_MONTHS_MAX = RECALL_INTERVALS[RECALL_INTERVALS.length - 1];
/** Days between two recall messages (and between the last one and the call list). */
export const RECALL_RESEND_DAYS = 14;
/** An unbooked recall is closed this long after its due date. */
export const RECALL_EXPIRY_DAYS = 180;
/** Statuses still waiting for the patient to book. */
export const OPEN_RECALL_STATUSES = ["due", "sent", "call"] as const satisfies readonly RecallStatus[];
const LEASE_MS = 10 * 60_000;
const DAY_MS = 86_400_000;

export function clampRecallMonths(n: number): number {
  return Math.max(RECALL_MONTHS_MIN, Math.min(RECALL_MONTHS_MAX, Math.round(n)));
}

/** YYYY-MM-DD plus whole months, clamped to the target month's length (31 Jan + 1 = 28/29 Feb). */
export function addMonthsToDate(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12;
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, last))}`;
}

/** An upcoming visit of this patient for the same treatment (same service or same category). */
async function upcomingVisitFor(tx: Tx, orgId: string, patientId: string, serviceId: string, now: Date): Promise<string | null> {
  const [svc] = await tx.select({ category: services.category }).from(services).where(eq(services.id, serviceId));
  if (!svc) return null;
  const [row] = await tx
    .select({ id: appointments.id })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(
      and(
        eq(appointments.orgId, orgId),
        eq(appointments.patientId, patientId),
        inArray(appointments.status, ["scheduled", "requested"]),
        gt(appointments.startsAt, now),
        or(eq(appointments.serviceId, serviceId), eq(services.category, svc.category)),
      ),
    )
    .orderBy(asc(appointments.startsAt))
    .limit(1);
  return row?.id ?? null;
}

// ---------------------------------------------------------------- creating and updating recalls

export type UpsertRecallInput = {
  orgId: string;
  /** The completed visit the recall follows. */
  appointmentId: string;
  /** A clinician's choice (clamped to 3–24 months). Omitted: the patient's interval, else the service's suggestion. */
  months?: number | null;
  /** The clinician who set it (with `months`). */
  setByUserId?: string | null;
  now?: Date;
};

/**
 * Create or update the recall that follows a completed visit (setOutcome calls it inside its
 * transaction; the recall picker calls it with the clinician's interval). Without an interval
 * from anywhere (no clinician choice, no earlier interval, no service suggestion) there is none.
 * An open recall for the same treatment is superseded by the newer visit rather than duplicated.
 */
export async function upsertRecall(tx: Tx, i: UpsertRecallInput): Promise<Recall | null> {
  const now = i.now ?? new Date();
  const [row] = await tx
    .select({ a: appointments, s: services, timezone: locations.timezone })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .innerJoin(locations, eq(locations.id, appointments.locationId))
    .where(and(eq(appointments.id, i.appointmentId), eq(appointments.orgId, i.orgId)));
  if (!row || row.a.status !== "completed") return null;
  const { a, s } = row;
  const [own] = await tx
    .select()
    .from(recalls)
    .where(and(eq(recalls.orgId, i.orgId), eq(recalls.sourceAppointmentId, a.id)))
    .limit(1);
  const [previous] = own
    ? []
    : await tx
        .select()
        .from(recalls)
        .where(and(eq(recalls.orgId, i.orgId), eq(recalls.patientId, a.patientId), eq(recalls.serviceId, s.id), ne(recalls.status, "dismissed")))
        .orderBy(desc(recalls.updatedAt))
        .limit(1);

  const explicit = i.months != null && i.months > 0;
  const carried = own ?? (previous?.setByUserId ? previous : null);
  const months = explicit ? clampRecallMonths(i.months!) : (carried?.intervalMonths ?? (s.recallMonths ? clampRecallMonths(s.recallMonths) : null));
  if (!months) return null;
  const setByUserId = explicit ? (i.setByUserId ?? null) : (carried?.setByUserId ?? null);
  const dueDate = addMonthsToDate(zonedDate(a.startsAt, row.timezone), months);
  const booked = await upcomingVisitFor(tx, i.orgId, a.patientId, s.id, now);
  const fresh = booked
    ? { status: "booked" as const, bookedAppointmentId: booked, attempts: 0, lastSentAt: null, leaseUntil: null }
    : { status: "due" as const, bookedAppointmentId: null, attempts: 0, lastSentAt: null, leaseUntil: null };
  const base = {
    serviceId: s.id,
    practitionerId: a.practitionerId,
    sourceAppointmentId: a.id,
    dueDate,
    intervalMonths: months,
    setByUserId,
    reasonCode: s.category,
    updatedAt: now,
  };

  const target = own ?? (previous && (OPEN_RECALL_STATUSES as readonly string[]).includes(previous.status) ? previous : null);
  if (target) {
    const reset =
      target !== own ||
      (own.status === "dismissed" && explicit) ||
      ((OPEN_RECALL_STATUSES as readonly string[]).includes(own.status) && own.dueDate !== dueDate);
    const [updated] = await tx
      .update(recalls)
      .set({ ...base, ...(reset ? fresh : {}) })
      .where(and(eq(recalls.id, target.id), eq(recalls.orgId, i.orgId)))
      .returning();
    return updated;
  }
  const [created] = await tx
    .insert(recalls)
    .values({ id: newId(), orgId: i.orgId, patientId: a.patientId, ...base, ...fresh, createdAt: now })
    .returning();
  return created;
}

/**
 * The clinician's decision after a visit: a recall in `months` (3–24), or none (null). Audited as
 * patient.update on the recall. Returns the recall, or null when none applies.
 */
export async function setRecallInterval(i: {
  orgId: string;
  appointmentId: string;
  months: number | null;
  actor: { userId: string } & Pick<AuditEvent, "headers">;
  now?: Date;
}): Promise<Recall | null> {
  const now = i.now ?? new Date();
  return db.transaction(async (tx) => {
    let recall: Recall | null;
    if (i.months == null) {
      const [own] = await tx
        .update(recalls)
        .set({ status: "dismissed", setByUserId: i.actor.userId, leaseUntil: null, updatedAt: now })
        .where(and(eq(recalls.orgId, i.orgId), eq(recalls.sourceAppointmentId, i.appointmentId), ne(recalls.status, "booked")))
        .returning();
      recall = own ?? null;
    } else {
      recall = await upsertRecall(tx, { orgId: i.orgId, appointmentId: i.appointmentId, months: i.months, setByUserId: i.actor.userId, now });
    }
    if (recall) {
      await audit(
        {
          orgId: i.orgId,
          actor: { type: "user", id: i.actor.userId },
          action: "patient.update",
          entity: { type: "recall", id: recall.id },
          metadata: { patientId: recall.patientId, appointmentId: i.appointmentId, months: i.months, status: recall.status },
          headers: i.actor.headers,
          at: now,
        },
        tx,
      );
    }
    return recall;
  });
}

/** A visit was un-completed (an outcome set by mistake): its recall goes, unless messages went out already. */
export async function dropRecallForVisit(tx: Tx, orgId: string, appointmentId: string): Promise<void> {
  await tx
    .delete(recalls)
    .where(
      and(
        eq(recalls.orgId, orgId),
        eq(recalls.sourceAppointmentId, appointmentId),
        eq(recalls.attempts, 0),
        inArray(recalls.status, ["due", "dismissed"]),
      ),
    );
}

/**
 * A new booking: open recalls of this patient for the same treatment (same service, or a service
 * of the same category) are booked, and stop sending. Called inside createAppointment's transaction.
 */
export async function markRecallBooked(
  tx: Tx,
  i: { orgId: string; patientId: string; serviceId: string; appointmentId: string; now?: Date },
): Promise<number> {
  const [svc] = await tx.select({ category: services.category }).from(services).where(eq(services.id, i.serviceId));
  if (!svc) return 0;
  const sameKind = await tx
    .select({ id: recalls.id })
    .from(recalls)
    .innerJoin(services, eq(services.id, recalls.serviceId))
    .where(
      and(
        eq(recalls.orgId, i.orgId),
        eq(recalls.patientId, i.patientId),
        inArray(recalls.status, OPEN_RECALL_STATUSES),
        or(eq(recalls.serviceId, i.serviceId), eq(services.category, svc.category)),
      ),
    );
  if (!sameKind.length) return 0;
  await tx
    .update(recalls)
    .set({ status: "booked", bookedAppointmentId: i.appointmentId, leaseUntil: null, updatedAt: i.now ?? new Date() })
    .where(and(eq(recalls.orgId, i.orgId), inArray(recalls.id, sameKind.map((r) => r.id))));
  return sameKind.length;
}

/** The visit a recall was booked for was cancelled: the recall is open again. */
export async function reopenRecallsFor(tx: Tx, orgId: string, appointmentId: string, now: Date = new Date()): Promise<void> {
  await tx
    .update(recalls)
    .set({ status: sql`case when ${recalls.attempts} > 0 then 'sent' else 'due' end`, bookedAppointmentId: null, updatedAt: now })
    .where(and(eq(recalls.orgId, orgId), eq(recalls.bookedAppointmentId, appointmentId), eq(recalls.status, "booked")));
}

// ---------------------------------------------------------------- sending

/** The booking link in a recall: the practice's booking page, in the practice's context (?ref). */
export function recallBookingUrl(
  org: { id: string; slug: string },
  r: { serviceId: string | null; practitionerId: string | null },
  locale: Locale,
): string {
  const params = new URLSearchParams();
  if (r.serviceId) params.set("service", r.serviceId);
  if (r.practitionerId) params.set("practitioner", r.practitionerId);
  params.set("via", "recall");
  params.set("ref", signPracticeRef(org.id));
  return absoluteUrl(lhref(locale, `/book/${org.slug}?${params.toString()}`));
}

/** Where a patient stops recall messages: the privacy center (objection to "recalls"). */
export function recallOptOutUrl(locale: Locale): string {
  return absoluteUrl(lhref(locale, "/privacy"));
}

export type RecallRunSummary = { sent: number; toCall: number; booked: number; dismissed: number };

/**
 * Send the recalls that are due, for every practice with recalls enabled (or one, `orgId`).
 * Each recall is leased while it is handled (like reminders), so parallel runners never send the
 * same one twice. Only clinician-set recalls are sent; restricted, erased and merged patients
 * are skipped. See the lifecycle at the top of this file.
 */
export async function processDueRecalls(now: Date = new Date(), opts: { orgId?: string; limit?: number } = {}): Promise<RecallRunSummary> {
  const summary: RecallRunSummary = { sent: 0, toCall: 0, booked: 0, dismissed: 0 };
  const orgs = await db
    .select()
    .from(organizations)
    .where(opts.orgId ? eq(organizations.id, opts.orgId) : undefined);
  let budget = opts.limit ?? 200;
  for (const org of orgs) {
    const care = getCare(org);
    if (!care.recallsEnabled || budget <= 0) continue;
    const today = todayIn(org.timezone, now);
    // Closed when nobody booked long after the due date.
    const expired = await db
      .update(recalls)
      .set({ status: "dismissed", leaseUntil: null, updatedAt: now })
      .where(
        and(
          eq(recalls.orgId, org.id),
          inArray(recalls.status, OPEN_RECALL_STATUSES),
          lt(recalls.dueDate, addDays(today, -RECALL_EXPIRY_DAYS)),
          or(isNull(recalls.leaseUntil), lt(recalls.leaseUntil, now)),
        ),
      )
      .returning({ id: recalls.id });
    summary.dismissed += expired.length;

    const due = await db
      .select({ r: recalls, p: patients })
      .from(recalls)
      .innerJoin(patients, eq(patients.id, recalls.patientId))
      .where(
        and(
          eq(recalls.orgId, org.id),
          isNotNull(recalls.setByUserId),
          lte(recalls.dueDate, today),
          or(
            eq(recalls.status, "due"),
            and(eq(recalls.status, "sent"), or(isNull(recalls.lastSentAt), lte(recalls.lastSentAt, new Date(now.getTime() - RECALL_RESEND_DAYS * DAY_MS)))),
          ),
          or(isNull(recalls.leaseUntil), lt(recalls.leaseUntil, now)),
          isNull(patients.restrictedAt),
          isNull(patients.erasedAt),
          isNull(patients.mergedIntoId),
        ),
      )
      .orderBy(asc(recalls.dueDate))
      .limit(budget);

    for (const { r, p } of due) {
      budget--;
      const [claimed] = await db
        .update(recalls)
        .set({ leaseUntil: new Date(now.getTime() + LEASE_MS) })
        .where(
          and(
            eq(recalls.id, r.id),
            eq(recalls.status, r.status),
            eq(recalls.attempts, r.attempts),
            or(isNull(recalls.leaseUntil), lt(recalls.leaseUntil, now)),
          ),
        )
        .returning({ id: recalls.id });
      if (!claimed) continue; // another runner has it
      const finish = (set: Partial<Recall>) =>
        db
          .update(recalls)
          .set({ ...set, leaseUntil: null, updatedAt: now })
          .where(and(eq(recalls.id, r.id), eq(recalls.orgId, org.id)));
      try {
        const booked = await upcomingVisitFor(db, org.id, r.patientId, r.serviceId, now);
        if (booked) {
          await finish({ status: "booked", bookedAppointmentId: booked });
          summary.booked++;
          continue;
        }
        if (r.attempts >= care.recallMaxAttempts) {
          await finish({ status: "call" });
          summary.toCall++;
          continue;
        }
        const [svc] = await db.select().from(services).where(eq(services.id, r.serviceId));
        const [doc] = r.practitionerId
          ? await db.select({ id: practitioners.id, active: practitioners.active }).from(practitioners).where(eq(practitioners.id, r.practitionerId))
          : [];
        const locale = recipientFor(p, now).locale;
        const url = recallBookingUrl(
          org,
          // Only what the patient can actually book online goes into the link.
          { serviceId: svc?.active && svc.onlineBookable ? r.serviceId : null, practitionerId: doc?.active ? doc.id : null },
          locale,
        );
        const res = await sendPatientMessage({
          orgId: org.id,
          patient: p,
          ns: "careMessages",
          kind: "recall",
          vars: { clinic: org.name, url, optout: recallOptOutUrl(locale) },
          url,
          purpose: "recalls",
          now,
        });
        if (res.ok) {
          await finish({ status: "sent", attempts: r.attempts + 1, lastSentAt: now });
          summary.sent++;
        } else if (res.reason === "not_allowed") {
          // The patient objected to recalls (Art. 21): stop for good.
          await finish({ status: "dismissed" });
          summary.dismissed++;
        } else if (res.reason === "restricted") {
          await finish({});
        } else {
          // No contact we may use: the front desk calls instead.
          await finish({ status: "call" });
          summary.toCall++;
        }
      } catch (err) {
        logError("care", err, { step: "recall", recallId: r.id });
        await finish({}).catch(() => {});
      }
    }
  }
  return summary;
}

// ---------------------------------------------------------------- jobs

export type CareJobsSummary = { recallsSent: number; risksRefreshed: number; formInvites: number };

/**
 * Care jobs run on a schedule: recall invitations ("time for your check-up"), refreshing no-show
 * risk for upcoming visits, and anamnesis form invitations. Called every 15 minutes by
 * src/instrumentation.ts, the reminders cron route and scripts/run-reminders.ts. A failing job is
 * logged and doesn't stop the others.
 */
export async function runCareJobs(now: Date = new Date()): Promise<CareJobsSummary> {
  const out: CareJobsSummary = { recallsSent: 0, risksRefreshed: 0, formInvites: 0 };
  try {
    out.recallsSent = (await processDueRecalls(now)).sent;
  } catch (err) {
    logError("care", err, { step: "recalls" });
  }
  try {
    out.risksRefreshed = await refreshRisks(now);
  } catch (err) {
    logError("care", err, { step: "risk" });
  }
  try {
    out.formInvites = await sendFormInvites(now);
  } catch (err) {
    logError("care", err, { step: "forms" });
  }
  return out;
}

// ---------------------------------------------------------------- dashboard

export type RecallRow = {
  id: string;
  patientId: string;
  patientName: string;
  /** null unless the viewer may read contacts. */
  phone: string | null;
  serviceName: string;
  practitionerName: string | null;
  dueDate: string;
  status: RecallStatus;
  attempts: number;
  lastSentAt: Date | null;
  intervalMonths: number;
  /** A clinician set or confirmed the interval: the recall may be sent. */
  confirmed: boolean;
};

export type RecallDashboard = {
  /** Due in the next 30 days. */
  dueSoon: RecallRow[];
  /** Past their due date, not booked yet. */
  overdue: RecallRow[];
  toCall: RecallRow[];
  /** Suggestions (service recallMonths) due within 30 days that no clinician confirmed: never sent. */
  awaitingClinician: RecallRow[];
  /** Recalls due in the last 12 months. */
  stats: { due: number; contacted: number; booked: number; messages: number };
};

/** The recalls page's lists. Org-scoped; restricted, erased and merged patients are left out. */
export async function recallDashboard(orgId: string, timezone: string, now: Date, opts: { contacts: boolean }): Promise<RecallDashboard> {
  const today = todayIn(timezone, now);
  const horizon = addDays(today, 30);
  const rows = await db
    .select({ r: recalls, p: patients, s: services, pr: practitioners })
    .from(recalls)
    .innerJoin(patients, eq(patients.id, recalls.patientId))
    .innerJoin(services, eq(services.id, recalls.serviceId))
    .leftJoin(practitioners, eq(practitioners.id, recalls.practitionerId))
    .where(
      and(
        eq(recalls.orgId, orgId),
        inArray(recalls.status, OPEN_RECALL_STATUSES),
        lte(recalls.dueDate, horizon),
        isNull(patients.restrictedAt),
        isNull(patients.erasedAt),
        isNull(patients.mergedIntoId),
      ),
    )
    .orderBy(asc(recalls.dueDate))
    .limit(500);
  const toRow = ({ r, p, s, pr }: (typeof rows)[number]): RecallRow => ({
    id: r.id,
    patientId: p.id,
    patientName: `${p.firstName} ${p.lastName}`.trim(),
    phone: opts.contacts ? (recipientFor(p, now).phone ?? null) : null,
    serviceName: s.name,
    practitionerName: pr ? practitionerName(pr) : null,
    dueDate: r.dueDate,
    status: r.status,
    attempts: r.attempts,
    lastSentAt: r.lastSentAt,
    intervalMonths: r.intervalMonths,
    confirmed: Boolean(r.setByUserId),
  });
  const all = rows.map(toRow);

  const since = addDays(today, -365);
  const [stats] = await db
    .select({
      due: sql<number>`count(*)`,
      contacted: sql<number>`coalesce(sum(case when ${recalls.attempts} > 0 or ${recalls.status} = 'call' then 1 else 0 end), 0)`,
      booked: sql<number>`coalesce(sum(case when ${recalls.status} = 'booked' then 1 else 0 end), 0)`,
      messages: sql<number>`coalesce(sum(${recalls.attempts}), 0)`,
    })
    .from(recalls)
    .where(and(eq(recalls.orgId, orgId), isNotNull(recalls.setByUserId), gte(recalls.dueDate, since), lte(recalls.dueDate, today)));

  return {
    dueSoon: all.filter((r) => r.confirmed && r.status !== "call" && r.dueDate >= today),
    overdue: all.filter((r) => r.confirmed && r.status !== "call" && r.dueDate < today),
    toCall: all.filter((r) => r.status === "call"),
    awaitingClinician: all.filter((r) => !r.confirmed && r.status !== "call"),
    stats: {
      due: Number(stats?.due ?? 0),
      contacted: Number(stats?.contacted ?? 0),
      booked: Number(stats?.booked ?? 0),
      messages: Number(stats?.messages ?? 0),
    },
  };
}

type StaffActor = { userId: string; headers?: Headers };

/** Staff closes a recall (the patient declined, moved away...). Audited. */
export async function dismissRecall(orgId: string, id: string, actor: StaffActor, now: Date = new Date()): Promise<boolean> {
  return changeRecall(orgId, id, actor, now, { status: "dismissed" }, "dismissed");
}

/**
 * The front desk phoned the patient without a booking (no answer, will call back): the recall
 * leaves the call list and comes back to it after RECALL_RESEND_DAYS if still not booked. No
 * further message is sent.
 */
export async function markRecallCalled(orgId: string, id: string, actor: StaffActor, now: Date = new Date()): Promise<boolean> {
  return changeRecall(orgId, id, actor, now, { status: "sent", lastSentAt: now }, "called");
}

/** A clinician confirms a suggested interval: from now on the recall may be sent. */
export async function confirmRecall(orgId: string, id: string, actor: StaffActor, now: Date = new Date()): Promise<boolean> {
  return changeRecall(orgId, id, actor, now, { setByUserId: actor.userId }, "confirmed");
}

async function changeRecall(orgId: string, id: string, actor: StaffActor, now: Date, set: Partial<Recall>, change: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(recalls)
      .set({ ...set, leaseUntil: null, updatedAt: now })
      .where(and(eq(recalls.id, id), eq(recalls.orgId, orgId), inArray(recalls.status, OPEN_RECALL_STATUSES)))
      .returning({ id: recalls.id, patientId: recalls.patientId });
    if (!row) return false;
    await audit(
      {
        orgId,
        actor: { type: "user", id: actor.userId },
        action: "patient.update",
        entity: { type: "recall", id: row.id },
        metadata: { patientId: row.patientId, change },
        headers: actor.headers,
        at: now,
      },
      tx,
    );
    return true;
  });
}

/** The recall that follows one visit, and the interval to pre-fill the picker with. */
export async function appointmentRecall(
  orgId: string,
  appointmentId: string,
): Promise<{ recall: Pick<Recall, "id" | "intervalMonths" | "dueDate" | "status"> & { confirmed: boolean }; suggestedMonths: number | null } | { recall: null; suggestedMonths: number | null } | null> {
  const [a] = await db
    .select({ patientId: appointments.patientId, serviceId: appointments.serviceId, recallMonths: services.recallMonths })
    .from(appointments)
    .innerJoin(services, eq(services.id, appointments.serviceId))
    .where(and(eq(appointments.id, appointmentId), eq(appointments.orgId, orgId)));
  if (!a) return null;
  const [own] = await db
    .select()
    .from(recalls)
    .where(and(eq(recalls.orgId, orgId), eq(recalls.sourceAppointmentId, appointmentId)))
    .limit(1);
  // The patient's own interval for this treatment beats the service's suggestion.
  const [previous] = await db
    .select({ intervalMonths: recalls.intervalMonths })
    .from(recalls)
    .where(and(eq(recalls.orgId, orgId), eq(recalls.patientId, a.patientId), eq(recalls.serviceId, a.serviceId), isNotNull(recalls.setByUserId)))
    .orderBy(desc(recalls.updatedAt))
    .limit(1);
  // Services accept 1–60 months; the picker and upsertRecall work in 3–24.
  const raw = own?.intervalMonths ?? previous?.intervalMonths ?? a.recallMonths ?? null;
  const suggestedMonths = raw ? clampRecallMonths(raw) : null;
  if (!own) return { recall: null, suggestedMonths };
  return {
    recall: { id: own.id, intervalMonths: own.intervalMonths, dueDate: own.dueDate, status: own.status, confirmed: Boolean(own.setByUserId) },
    suggestedMonths,
  };
}

// ---------------------------------------------------------------- the patient page

export type PatientCare = {
  recalls: { id: string; serviceName: string; dueDate: string; status: RecallStatus; intervalMonths: number; confirmed: boolean; attempts: number }[];
  /** Under 18 on this day. */
  minor: boolean;
  /** Under 14: messages go to the guardian. */
  viaGuardian: boolean;
  guardian: { name: string | null; relation: GuardianRelation | null; phone: string | null; email: string | null } | null;
  /** alerts: how many red flags the form raised; null unless the viewer has patient.clinical.read. */
  submissions: (Omit<SubmissionSummary, "redFlags"> & { alerts: number | null })[];
  /** This record may duplicate another one (or others point at it). */
  duplicate: { ofId: string | null; ofName: string | null; ofRestricted: boolean; flaggedBy: number } | null;
};

/**
 * Everything the patient page's care panel shows, for this viewer: guardian contacts only with
 * patient.contact.read, the number of medical alerts per form only with patient.clinical.read
 * (which alerts, and the answers, only through the audited loadAnamnesis). A restricted or erased
 * patient's care data only after a restricted-access reason (mayReadPatient): null otherwise,
 * like an unknown patient.
 */
export async function loadPatientCare(
  orgId: string,
  patientId: string,
  perms: readonly Permission[],
  opts: { viewer?: { userId: string } | null; now?: Date } = {},
): Promise<PatientCare | null> {
  const now = opts.now ?? new Date();
  const [p] = await db.select().from(patients).where(and(eq(patients.id, patientId), eq(patients.orgId, orgId)));
  if (!p) return null;
  if (!(await mayReadPatient({ orgId, patient: p, permissions: perms, userId: opts.viewer?.userId, now }))) return null;
  const recallRows = await db
    .select({ r: recalls, serviceName: services.name })
    .from(recalls)
    .innerJoin(services, eq(services.id, recalls.serviceId))
    .where(and(eq(recalls.orgId, orgId), eq(recalls.patientId, patientId)))
    .orderBy(desc(recalls.dueDate))
    .limit(20);
  // Only how many alerts each form raised, never which ones: the conditions themselves are shown
  // only when a clinician opens the form (loadAnamnesis, audited as patient.clinical.view).
  const submissions = (await listSubmissions(orgId, patientId, perms.includes("patient.clinical.read"))).map(({ redFlags, ...rest }) => ({
    ...rest,
    alerts: redFlags ? redFlags.length : null,
  }));
  const [of] = p.possibleDuplicateOfId
    ? await db
        .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, restrictedAt: patients.restrictedAt, erasedAt: patients.erasedAt })
        .from(patients)
        .where(and(eq(patients.id, p.possibleDuplicateOfId), eq(patients.orgId, orgId), isNull(patients.mergedIntoId)))
    : [];
  // The other record's name stays hidden when it is restricted and the viewer may not read it.
  const ofMasked = Boolean(of && isRestricted(of) && !perms.includes("patient.restricted.read"));
  const [flagged] = await db
    .select({ n: sql<number>`count(*)` })
    .from(patients)
    .where(and(eq(patients.orgId, orgId), eq(patients.possibleDuplicateOfId, patientId), isNull(patients.mergedIntoId)));
  const contacts = perms.includes("patient.contact.read");
  const hasGuardian = Boolean(p.guardianName || p.guardianPhone || p.guardianEmail);
  return {
    recalls: recallRows.map(({ r, serviceName }) => ({
      id: r.id,
      serviceName,
      dueDate: r.dueDate,
      status: r.status,
      intervalMonths: r.intervalMonths,
      confirmed: Boolean(r.setByUserId),
      attempts: r.attempts,
    })),
    minor: isMinor(p, now),
    viaGuardian: !isRestricted(p) && recipientFor(p, now).viaGuardian,
    guardian: hasGuardian
      ? {
          name: p.guardianName,
          relation: p.guardianRelation,
          phone: contacts ? p.guardianPhone : null,
          email: contacts ? p.guardianEmail : null,
        }
      : null,
    submissions,
    duplicate:
      of || Number(flagged?.n ?? 0) > 0
        ? {
            ofId: of?.id ?? null,
            ofName: of && !ofMasked ? `${of.firstName} ${of.lastName}`.trim() : null,
            ofRestricted: ofMasked,
            flaggedBy: Number(flagged?.n ?? 0),
          }
        : null,
  };
}
