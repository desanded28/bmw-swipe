import { and, asc, eq, inArray, isNotNull, isNull, like, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  appointments,
  messages,
  organizations,
  reminders,
  reviews,
  type Appointment,
  type Channel,
  type OrgSettings,
  type Patient,
  type Reminder,
  type RiskLevel,
} from "@/db/schema";
import {
  appointmentLinks,
  appointmentWhatsApp,
  canReachByEmail,
  getAppointmentDetails,
  templateData,
  textChannelFor,
  type AppointmentDetails,
} from "./appointments";
import { isRestricted, recipientFor } from "./contact";
import { buildIcs } from "./ics";
import { newId } from "./ids";
import { logError, logInfo, redact } from "./log";
import { deliver } from "./messaging";
import { canDeleteProviderCopies, deleteProviderMessage } from "./messaging/providers";
import { templates } from "./messaging/templates";
import { isAllowed } from "./privacy/consent";
import { DEFAULT_PRIVACY, getPrivacy } from "./privacy/settings";

/** How long a claimed reminder is hidden from other workers before it's retried. */
const LEASE_MS = 10 * 60_000;
const MAX_ATTEMPTS = 3;

// ---------------------------------------------------------------- risk-gated rules

const RISK_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

/**
 * A rule's onlyIfRisk travels with its reminder rows (reminders.only_if_risk). Like the rule's
 * channel and askConfirmation, it is fixed when the reminders are scheduled; rows without it are
 * ungated. Rows scheduled before the column existed carried it as an id suffix ("<id>.risk-high");
 * migration 0003 copied those into the column, and the suffix is still read as a fallback.
 */
export function reminderRiskGate(r: Pick<Reminder, "id" | "onlyIfRisk">): Exclude<RiskLevel, "low"> | null {
  if (r.onlyIfRisk) return r.onlyIfRisk;
  const m = /\.risk-(medium|high)$/.exec(r.id);
  return m ? (m[1] as "medium" | "high") : null;
}

/**
 * The risk level reminders may act on. A patient who objected to adaptive reminders (Art. 21),
 * or a practice that has not turned on risk-based reminders, counts as no risk: their
 * appointments get no risk-gated reminder.
 */
export async function effectiveRisk(
  a: Pick<Appointment, "riskLevel">,
  patient: Pick<Patient, "id">,
  org: { settings: unknown },
  tx: Tx = db,
): Promise<RiskLevel | null> {
  if (!a.riskLevel || !getPrivacy(org).riskBasedReminders) return null;
  return (await isAllowed(patient.id, "adaptive_reminders", tx)) ? a.riskLevel : null;
}

export function meetsRisk(risk: RiskLevel | null, threshold: Exclude<RiskLevel, "low">): boolean {
  return risk !== null && RISK_RANK[risk] >= RISK_RANK[threshold];
}

// ---------------------------------------------------------------- scheduling

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
      onlyIfRisk: rule.onlyIfRisk ?? null,
    }))
    .filter((r) => r.sendAt.getTime() > now.getTime());

  if (rows.length) await tx.insert(reminders).values(rows);
  // A risk-gated rule may never be sent, so it is not counted on to ask for confirmation.
  return rows.some((r) => r.askConfirmation && !r.onlyIfRisk);
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
 * enabled it, the patient consented and a template exists in their language), never the rule's
 * own word.
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

/**
 * The patient's calendar invite: "Appointment – {clinic}" in their language, the address and the
 * practice's phone. No treatment, practitioner or link: calendars sync to other devices and
 * accounts, and an invite is often forwarded.
 */
export function appointmentIcs(d: AppointmentDetails, status: "CONFIRMED" | "TENTATIVE" | "CANCELLED" = "CONFIRMED") {
  const texts = templates.ics(templateData(d));
  return buildIcs({
    name: d.org.name,
    events: [
      {
        uid: `${d.appointment.id}@sorriso`,
        start: d.appointment.startsAt,
        end: d.appointment.endsAt,
        summary: texts.summary,
        description: texts.description,
        location: texts.location,
        status,
        sequence: Math.floor(d.appointment.updatedAt.getTime() / 1000),
        alarmsMinutesBefore: [24 * 60, 60],
      },
    ],
  });
}

type Outcome = { status: "sent" | "skipped" | "failed" | "retry"; reason?: string; messageId?: string };

/** The WhatsApp template kind for each message (TWILIO_WHATSAPP_CONTENT_SIDS keys). */
type TextKind = "booked" | "approved" | "reminder" | "reminderAsk";

/** Build and send the message for one reminder. Pure decision logic + delivery. */
async function sendForReminder(r: Reminder, d: AppointmentDetails, now: Date): Promise<Outcome> {
  const { appointment: a, patient } = d;
  // Restricted (Art. 18) or erased: no messages at all.
  if (isRestricted(patient)) return { status: "skipped", reason: "patient restricted" };
  const data = templateData(d, now);
  const links = appointmentLinks(d);
  const to = recipientFor(patient, now);
  const base = {
    orgId: d.org.id,
    appointmentId: a.id,
    patientId: patient.id,
    fromName: d.org.name,
    replyTo: d.org.email,
    locale: to.locale,
  };

  const send = async (
    channel: Channel,
    content: { email: { subject: string; text: string; html: string } | null; text: string; kind: TextKind | null },
    ics?: string,
  ): Promise<Outcome> => {
    const address = channel === "email" ? to.email : to.phone;
    if (!address) return { status: "skipped", reason: `no ${channel} contact` };
    const msg = await deliver(
      channel === "email"
        ? {
            ...base,
            channel,
            to: address,
            subject: content.email!.subject,
            text: content.email!.text,
            html: content.email!.html,
            attachments: ics
              ? [{ filename: "appointment.ics", content: ics, contentType: "text/calendar; charset=utf-8" }]
              : undefined,
          }
        : {
            ...base,
            channel,
            to: address,
            text: content.text,
            ...(channel === "whatsapp" && content.kind ? appointmentWhatsApp(d, content.kind) : {}),
          },
    );
    if (msg.status === "failed") return { status: "retry", reason: msg.error ?? "delivery failed" };
    return { status: "sent", messageId: msg.id };
  };

  switch (r.kind) {
    case "booking_confirmation": {
      if (!["scheduled", "requested"].includes(a.status)) return { status: "skipped", reason: `appointment ${a.status}` };
      const text = await textChannelFor(patient, d.org, now, "booked");
      const channel = resolveChannel("email", patient, true, text) ?? resolveChannel("sms", patient, false, text);
      if (!channel) return { status: "skipped", reason: "patient has no reachable contact" };
      if (a.status === "requested") {
        if (channel !== "email") return { status: "skipped", reason: "request receipts are email-only" };
        return send(channel, { email: templates.bookingRequested(data), text: "", kind: null });
      }
      return send(
        channel,
        { email: templates.bookingConfirmation(data), text: templates.bookingConfirmationSms(data), kind: "booked" },
        appointmentIcs(d),
      );
    }

    case "approval": {
      if (a.status !== "scheduled") return { status: "skipped", reason: `appointment ${a.status}` };
      const text = await textChannelFor(patient, d.org, now, "approved");
      const channel = resolveChannel("email", patient, true, text) ?? resolveChannel("sms", patient, false, text);
      if (!channel) return { status: "skipped", reason: "patient has no reachable contact" };
      return send(
        channel,
        { email: templates.bookingApproved(data), text: templates.bookingApprovedSms(data), kind: "approved" },
        appointmentIcs(d),
      );
    }

    case "reminder": {
      if (a.status !== "scheduled") return { status: "skipped", reason: `appointment ${a.status}` };
      if (a.startsAt.getTime() <= now.getTime()) return { status: "skipped", reason: "appointment already started" };
      const gate = reminderRiskGate(r);
      if (gate && !meetsRisk(await effectiveRisk(a, patient, d.org), gate)) {
        return { status: "skipped", reason: `only for ${gate} no-show risk` };
      }
      // Don't ask again once they've confirmed: just remind.
      const ask = r.askConfirmation && a.confirmation === "pending";
      // A confirmation request uses its own WhatsApp template when there is one, else the plain reminder's.
      const askText = ask ? await textChannelFor(patient, d.org, now, "reminderAsk") : null;
      const kind: TextKind = askText === "whatsapp" ? "reminderAsk" : "reminder";
      const text = askText === "whatsapp" ? askText : await textChannelFor(patient, d.org, now, "reminder");
      const channel = resolveChannel(r.channel, patient, r.fallbackToEmail, text);
      if (!channel) return { status: "skipped", reason: `can't reach patient by ${r.channel}` };
      return send(channel, { email: templates.reminderEmail(data, ask), text: templates.reminderSms(data, ask), kind });
    }

    case "review_request": {
      if (a.status !== "completed") return { status: "skipped", reason: `appointment ${a.status}` };
      // An invitation to review is optional processing: only with a current feedback_request consent.
      if (!(await isAllowed(patient.id, "feedback_request"))) return { status: "skipped", reason: "no feedback_request consent" };
      // For a marketplace booking the invitation is Sorriso's own message, under its Art. 9(2)(a)
      // consent: none once the patient withdrew it (Sorriso's notice, "If you withdraw your consent").
      if (a.processingContext === "marketplace" && !(await isAllowed(patient.id, "platform_booking_art9"))) {
        return { status: "skipped", reason: "Sorriso's booking consent withdrawn" };
      }
      const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.appointmentId, a.id));
      if (existing) return { status: "skipped", reason: "already reviewed" };
      if (!canReachByEmail(patient, now)) return { status: "skipped", reason: "review requests are email-only" };
      return send("email", { email: templates.reviewRequest(data, links.reviewUrl), text: "", kind: null });
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
      logError("reminders", err, { step: "send", reminderId: r.id });
      outcome = { status: "retry", reason: err instanceof Error ? err.message : String(err) };
    }
  }

  if (outcome.status === "retry") {
    const final = r.attempts + 1 >= MAX_ATTEMPTS;
    const error = storedError(outcome.reason);
    await db
      .update(reminders)
      .set(final ? { status: "failed", error } : { error })
      .where(eq(reminders.id, r.id));
    return final ? { status: "failed", reason: error ?? undefined } : { ...outcome, reason: error ?? undefined };
  }

  await db
    .update(reminders)
    .set({
      status: outcome.status,
      sentAt: outcome.status === "sent" ? now : null,
      messageId: outcome.messageId ?? null,
      error: outcome.status === "skipped" ? storedError(outcome.reason) : null,
    })
    .where(eq(reminders.id, r.id));
  return outcome;
}

/**
 * reminders.error is a plain column the dashboard shows: never an exception's raw text. A failed
 * query's message ends with its bound values ("params: …": the recipient's number or email, names,
 * the message text), and provider errors quote the recipient. redact() drops the former and masks
 * the latter, as for the logs; the length is capped.
 */
function storedError(reason: string | undefined): string | null {
  return reason ? redact(reason).slice(0, 300) : null;
}

/**
 * Send everything that's due. Called by the cron endpoint and the background worker (every
 * practice), by "Send due reminders now" in the dashboard (`orgId`: only that practice's) and
 * right after a booking (`appointmentId`).
 */
export async function processDueReminders(opts: { now?: Date; limit?: number; appointmentId?: string; orgId?: string } = {}) {
  const now = opts.now ?? new Date();
  const conditions: SQL[] = [eq(reminders.status, "pending"), lte(reminders.sendAt, now)];
  if (opts.appointmentId) conditions.push(eq(reminders.appointmentId, opts.appointmentId));
  if (opts.orgId) conditions.push(eq(appointments.orgId, opts.orgId));
  const due = await db
    .select({ r: reminders })
    .from(reminders)
    .innerJoin(appointments, eq(appointments.id, reminders.appointmentId))
    .where(and(...conditions))
    .orderBy(asc(reminders.sendAt))
    .limit(opts.limit ?? 100);

  const summary = { due: due.length, sent: 0, skipped: 0, failed: 0, retry: 0 };
  for (const { r } of due) {
    const outcome = await processReminder(r, now);
    summary[outcome.status]++;
  }
  return summary;
}

// ---------------------------------------------------------------- provider copies

/** After a copy's first failed deletion it is left alone this long; the wait doubles with each failure… */
const FAILED_DELETE_BACKOFF_MS = 6 * 3_600_000;
/** …up to a week (6h, 12h, 24h, 48h, 96h, then 7 days). */
const FAILED_DELETE_BACKOFF_DOUBLINGS = 5;
const FAILED_DELETE_BACKOFF_MAX_MS = 7 * 86_400_000;
/** Consecutive failures after which a provider is left for the next run (bad credentials, outage). */
const PROVIDER_FAILURE_LIMIT = 5;

/**
 * A copy is due again once its back-off has passed since its last failed deletion
 * (messages.provider_delete_attempts / provider_delete_failed_at, so the back-off holds across
 * restarts and serverless runs). Never-failed copies are always due.
 */
function retryDue(now: Date): SQL {
  return or(
    isNull(messages.providerDeleteFailedAt),
    lte(
      sql`${messages.providerDeleteFailedAt} + min(${FAILED_DELETE_BACKOFF_MS} << max(min(${messages.providerDeleteAttempts} - 1, ${FAILED_DELETE_BACKOFF_DOUBLINGS}), 0), ${FAILED_DELETE_BACKOFF_MAX_MS})`,
      now.getTime(),
    ),
  )!;
}

/**
 * Ask Twilio to delete its copies of texts (outbound and inbound) older than each practice's
 * privacy.retention.providerMessageDays, and mark them providerDeletedAt. Platform messages (no
 * practice: privacy-center codes) use the default. Run by the reminders cron, the in-process
 * worker and scripts/run-reminders.ts.
 *
 * Oldest first. Copies that can't be deleted don't block the others:
 * - a provider whose credentials are not set here (e.g. after leaving IE1) is not tried at all;
 *   its copies wait, unmarked, until the credentials are back;
 * - a provider that fails PROVIDER_FAILURE_LIMIT times in a row is left for the next run;
 * - a copy that failed is counted on its row (providerDeleteAttempts, providerDeleteFailedAt) and
 *   skipped until its back-off has passed (retryDue): 6 hours after the first failure, doubling
 *   up to a week.
 * One error line per provider and run, not one per message.
 */
export async function purgeProviderCopies(now = new Date(), opts: { batch?: number } = {}) {
  const batch = opts.batch ?? 200;
  const orgs = await db.select({ id: organizations.id, settings: organizations.settings }).from(organizations);
  const scopes: { orgId: string | null; days: number }[] = [
    ...orgs.map((o) => ({ orgId: o.id, days: getPrivacy(o).retention.providerMessageDays })),
    { orgId: null, days: DEFAULT_PRIVACY.retention.providerMessageDays },
  ];
  const summary = { deleted: 0, failed: 0 };
  const streak = new Map<string, number>();
  const reported = new Set<string>();
  const stopped = new Set<string>();
  for (const scope of scopes) {
    const cutoff = new Date(now.getTime() - scope.days * 86_400_000);
    const due = and(
      scope.orgId ? eq(messages.orgId, scope.orgId) : isNull(messages.orgId),
      or(eq(messages.provider, "twilio"), like(messages.provider, "twilio:%")),
      isNotNull(messages.providerId),
      isNull(messages.providerDeletedAt),
      lt(messages.createdAt, cutoff),
      retryDue(now),
    );
    const providers = (await db.selectDistinct({ provider: messages.provider }).from(messages).where(due)).map((p) => p.provider);
    for (const provider of providers.filter((p) => !canDeleteProviderCopies(p) && !reported.has(p))) {
      reported.add(provider);
      logInfo("messaging", "provider copies wait: no credentials for their region", { provider });
    }
    const usable = providers.filter((p) => canDeleteProviderCopies(p) && !stopped.has(p));
    if (!usable.length) continue;
    const rows = await db
      .select({ id: messages.id, provider: messages.provider, providerId: messages.providerId })
      .from(messages)
      .where(and(due, inArray(messages.provider, usable)))
      .orderBy(asc(messages.createdAt))
      .limit(batch);
    for (const m of rows) {
      if (stopped.has(m.provider)) continue;
      try {
        await deleteProviderMessage(m.provider, m.providerId!);
        await db.update(messages).set({ providerDeletedAt: now }).where(eq(messages.id, m.id));
        streak.set(m.provider, 0);
        summary.deleted++;
      } catch (err) {
        summary.failed++;
        await db
          .update(messages)
          .set({ providerDeleteAttempts: sql`${messages.providerDeleteAttempts} + 1`, providerDeleteFailedAt: now })
          .where(eq(messages.id, m.id));
        const n = (streak.get(m.provider) ?? 0) + 1;
        streak.set(m.provider, n);
        if (n >= PROVIDER_FAILURE_LIMIT) stopped.add(m.provider);
        if (!reported.has(m.provider)) {
          reported.add(m.provider);
          logError("messaging", err, { step: "provider-delete", provider: m.provider, messageId: m.id });
        }
      }
    }
  }
  if (summary.deleted || summary.failed) logInfo("messaging", "provider copies purged", summary);
  return summary;
}
