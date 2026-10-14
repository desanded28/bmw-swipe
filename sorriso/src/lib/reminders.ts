import { and, asc, eq, inArray, lte } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { reminders, reviews, type Appointment, type Channel, type OrgSettings, type Patient, type Reminder } from "@/db/schema";
import {
  appointmentLinks,
  canReachByEmail,
  getAppointmentDetails,
  templateData,
  textChannelFor,
  type AppointmentDetails,
} from "./appointments";
import { practitionerName } from "./format";
import { recipientFor } from "./contact";
import { buildIcs } from "./ics";
import { newId } from "./ids";
import { deliver } from "./messaging";
import { templates, whenLabel } from "./messaging/templates";

/** How long a claimed reminder is hidden from other workers before it's retried. */
const LEASE_MS = 10 * 60_000;
const MAX_ATTEMPTS = 3;

/**
 * (Re)create the timed reminders for an appointment from the org's rules.
 * Returns true if at least one reminder will ask the patient to confirm.
 */
export async function scheduleReminders(
  tx: Tx,
  appointment: Appointment,
  settings: OrgSettings,
  now = new Date(),
): Promise<boolean> {
  await cancelPendingReminders(tx, appointment.id, ["reminder"]);
  if (appointment.status !== "scheduled") return false;

  const rows = settings.reminders.rules
    .map((rule) => ({
      id: newId(),
      appointmentId: appointment.id,
      kind: "reminder" as const,
      channel: rule.channel,
      askConfirmation: rule.askConfirmation,
      fallbackToEmail: rule.fallbackToEmail,
      sendAt: new Date(appointment.startsAt.getTime() - rule.offsetMinutes * 60_000),
    }))
    .filter((r) => r.sendAt.getTime() > now.getTime());

  if (rows.length) await tx.insert(reminders).values(rows);
  return rows.some((r) => r.askConfirmation);
}

export async function cancelPendingReminders(tx: Tx, appointmentId: string, kinds?: Reminder["kind"][]) {
  const conditions = [eq(reminders.appointmentId, appointmentId), eq(reminders.status, "pending")];
  if (kinds?.length) conditions.push(inArray(reminders.kind, kinds));
  await tx
    .update(reminders)
    .set({ status: "cancelled" })
    .where(and(...conditions));
}

export async function enqueueNow(
  tx: Tx,
  appointmentId: string,
  kind: Reminder["kind"],
  channel: Channel = "email",
  sendAt = new Date(),
) {
  const id = newId();
  await tx.insert(reminders).values({ id, appointmentId, kind, channel, sendAt, fallbackToEmail: true });
  return id;
}

/**
 * Pick the channel for a patient. A text rule ("sms" or "whatsapp") means "a text message": which
 * one is `text`, the patient's text channel from textChannelFor() (WhatsApp only where the practice
 * enabled it and the patient consented), never the rule's own word.
 */
export function resolveChannel(
  rule: Channel,
  patient: Patient,
  fallbackToEmail: boolean,
  text: "sms" | "whatsapp" | null,
): Channel | null {
  if (rule === "email") return canReachByEmail(patient) ? "email" : null;
  if (text && patient.preferredChannel !== "email") return text;
  if (fallbackToEmail && canReachByEmail(patient)) return "email";
  // Rule says email-fallback off but patient explicitly prefers email: respect that.
  if (patient.preferredChannel === "email" && canReachByEmail(patient)) return "email";
  return null;
}

/** The address for `channel`: the guardian's for a patient under 14 with guardian contacts (contact.ts). */
function recipient(channel: Channel, patient: Patient): string {
  const to = recipientFor(patient);
  return channel === "email" ? to.email! : to.phone!;
}

function appointmentIcs(d: AppointmentDetails, status: "CONFIRMED" | "TENTATIVE" = "CONFIRMED") {
  return buildIcs({
    name: d.org.name,
    events: [
      {
        uid: `${d.appointment.id}@sorriso`,
        start: d.appointment.startsAt,
        end: d.appointment.endsAt,
        summary: `${d.service.name} — ${d.org.name}`,
        description: `${practitionerName(d.practitioner)}\n${appointmentLinks(d).manageUrl}`,
        location: `${d.location.name}, ${d.location.address}, ${d.location.city}`,
        url: appointmentLinks(d).manageUrl,
        status,
        sequence: Math.floor(d.appointment.updatedAt.getTime() / 1000),
        alarmsMinutesBefore: [24 * 60, 60],
      },
    ],
  });
}

type Outcome = { status: "sent" | "skipped" | "failed" | "retry"; reason?: string; messageId?: string };

/** Build and send the message for one reminder. Pure decision logic + delivery. */
async function sendForReminder(r: Reminder, d: AppointmentDetails, now: Date): Promise<Outcome> {
  const { appointment: a, patient } = d;
  const data = templateData(d);
  const links = appointmentLinks(d);
  const base = { orgId: d.org.id, appointmentId: a.id, patientId: patient.id, fromName: d.org.name, replyTo: d.org.email };
  const text = await textChannelFor(patient, d.org);

  const send = async (channel: Channel, email: { subject: string; text: string; html: string } | null, text: string, ics?: string) => {
    const msg = await deliver(
      channel === "email"
        ? {
            ...base,
            channel,
            to: recipient(channel, patient),
            subject: email!.subject,
            text: email!.text,
            html: email!.html,
            attachments: ics ? [{ filename: "appointment.ics", content: ics, contentType: "text/calendar; charset=utf-8" }] : undefined,
          }
        : {
            ...base,
            channel,
            to: recipient(channel, patient),
            text,
            whatsappVariables: {
              "1": patient.firstName,
              "2": whenLabel(data, "short"),
              "3": d.org.name,
              "4": links.manageUrl,
            },
          },
    );
    if (msg.status === "failed") return { status: "retry", reason: msg.error ?? "delivery failed" } as Outcome;
    return { status: "sent", messageId: msg.id } as Outcome;
  };

  switch (r.kind) {
    case "booking_confirmation": {
      if (!["scheduled", "requested"].includes(a.status)) return { status: "skipped", reason: `appointment ${a.status}` };
      const channel = resolveChannel("email", patient, true, text) ?? resolveChannel("sms", patient, false, text);
      if (!channel) return { status: "skipped", reason: "patient has no reachable contact" };
      if (a.status === "requested") {
        if (channel !== "email") return { status: "skipped", reason: "request receipts are email-only" };
        return send(channel, templates.bookingRequested(data), "");
      }
      return send(channel, templates.bookingConfirmation(data), templates.bookingConfirmationSms(data), appointmentIcs(d));
    }

    case "approval": {
      if (a.status !== "scheduled") return { status: "skipped", reason: `appointment ${a.status}` };
      const channel = resolveChannel("email", patient, true, text) ?? resolveChannel("sms", patient, false, text);
      if (!channel) return { status: "skipped", reason: "patient has no reachable contact" };
      return send(channel, templates.bookingApproved(data), templates.bookingConfirmationSms(data), appointmentIcs(d));
    }

    case "reminder": {
      if (a.status !== "scheduled") return { status: "skipped", reason: `appointment ${a.status}` };
      if (a.startsAt.getTime() <= now.getTime()) return { status: "skipped", reason: "appointment already started" };
      const channel = resolveChannel(r.channel, patient, r.fallbackToEmail, text);
      if (!channel) return { status: "skipped", reason: `can't reach patient by ${r.channel}` };
      // Don't ask again once they've confirmed: just remind.
      const ask = r.askConfirmation && a.confirmation === "pending";
      return send(channel, templates.reminderEmail(data, ask), templates.reminderSms(data, ask));
    }

    case "review_request": {
      if (a.status !== "completed") return { status: "skipped", reason: `appointment ${a.status}` };
      const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.appointmentId, a.id));
      if (existing) return { status: "skipped", reason: "already reviewed" };
      if (!canReachByEmail(patient)) return { status: "skipped", reason: "review requests are email-only" };
      return send("email", templates.reviewRequest(data, links.reviewUrl), "");
    }
  }
}

/** Claim a reminder (lease), send it, and record the outcome. */
export async function processReminder(r: Reminder, now = new Date()): Promise<Outcome> {
  const claimed = await db
    .update(reminders)
    .set({ attempts: r.attempts + 1, sendAt: new Date(now.getTime() + LEASE_MS) })
    .where(and(eq(reminders.id, r.id), eq(reminders.status, "pending"), eq(reminders.attempts, r.attempts)))
    .returning({ id: reminders.id });
  if (!claimed.length) return { status: "skipped", reason: "claimed by another worker" };

  const details = await getAppointmentDetails({ id: r.appointmentId });
  let outcome: Outcome;
  if (!details) outcome = { status: "skipped", reason: "appointment deleted" };
  else {
    try {
      outcome = await sendForReminder(r, details, now);
    } catch (err) {
      outcome = { status: "retry", reason: err instanceof Error ? err.message : String(err) };
    }
  }

  if (outcome.status === "retry") {
    const final = r.attempts + 1 >= MAX_ATTEMPTS;
    await db
      .update(reminders)
      .set(final ? { status: "failed", error: outcome.reason } : { error: outcome.reason })
      .where(eq(reminders.id, r.id));
    return final ? { status: "failed", reason: outcome.reason } : outcome;
  }

  await db
    .update(reminders)
    .set({
      status: outcome.status,
      sentAt: outcome.status === "sent" ? now : null,
      messageId: outcome.messageId ?? null,
      error: outcome.status === "skipped" ? outcome.reason : null,
    })
    .where(eq(reminders.id, r.id));
  return outcome;
}

/** Send everything that's due. Called by the cron endpoint / background worker. */
export async function processDueReminders(opts: { now?: Date; limit?: number; appointmentId?: string } = {}) {
  const now = opts.now ?? new Date();
  const conditions = [eq(reminders.status, "pending"), lte(reminders.sendAt, now)];
  if (opts.appointmentId) conditions.push(eq(reminders.appointmentId, opts.appointmentId));
  const due = await db
    .select()
    .from(reminders)
    .where(and(...conditions))
    .orderBy(asc(reminders.sendAt))
    .limit(opts.limit ?? 100);

  const summary = { due: due.length, sent: 0, skipped: 0, failed: 0, retry: 0 };
  for (const r of due) {
    const outcome = await processReminder(r, now);
    summary[outcome.status]++;
  }
  return summary;
}
