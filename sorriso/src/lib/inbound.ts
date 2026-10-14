import { and, asc, desc, eq, gt, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { appointments, messages, organizations, patients, type Channel, type Message, type Patient } from "@/db/schema";
import { appointmentLinks, getAppointmentDetails, templateData } from "./appointments";
import { cancelAppointment, confirmAttendance } from "./booking";
import { recipientFor } from "./contact";
import { newId } from "./ids";
import { deliver } from "./messaging";
import { templates } from "./messaging/templates";
import { normalizePhone } from "./phone";

export type Intent = NonNullable<Message["intent"]>;

const CONFIRM = new Set([
  "si", "s", "sii", "yes", "y", "yep", "yeah", "ok", "okay", "k", "1", "confermo", "conferma", "confermato",
  "confermata", "confirm", "confirmed", "certo", "certamente", "presente", "ci", "sure", "va", "perfetto",
]);
const CANCEL = new Set([
  "no", "n", "2", "annulla", "annullo", "annullare", "disdico", "disdire", "disdetta", "cancel", "cancella",
  "cancello", "cancelled", "nope", "impossibile",
]);
const STOP = new Set(["stop", "unsubscribe", "basta", "stopall", "end", "quit"]);

/** Understand a free-text reply (Italian or English). */
export function parseIntent(raw: string): Intent {
  if (/👍|✅|👌/u.test(raw)) return "confirm";
  if (/👎|❌/u.test(raw)) return "cancel";
  const text = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
  if (!text) return "unknown";
  const words = text.split(/\s+/);
  const first = words[0];
  if (STOP.has(first) && words.length <= 2) return "stop";
  if (/^no (problem|prob|worries)/.test(text)) return "confirm";
  if (/(spost|rinvi|resched|cambi|altro (giorno|orario)|another (day|time)|different (day|time)|move)/.test(text))
    return "reschedule";
  if (CANCEL.has(first) || /\b(non (posso|riesco|vengo|ci saro)|can ?not come|cant come|won ?t (make|be))/.test(text))
    return "cancel";
  if (CONFIRM.has(first) || /\b(ci saro|ci sarò|see you|will be there|confermo)\b/.test(text)) return "confirm";
  return "unknown";
}

/**
 * The number this patient's texts go to: recipientFor() (the guardian's for a child under 14 with
 * guardian contacts), read as if the patient were not restricted, so a restricted patient's STOP or
 * reply about an earlier message still finds them.
 */
function textedNumber(p: Patient, now: Date): string | null {
  return recipientFor({ ...p, restrictedAt: null, erasedAt: null }, now).phone;
}

export type InboundResult = {
  intent: Intent;
  reply: string | null;
  appointmentId: string | null;
  orgId: string | null;
};

/**
 * Handle an inbound SMS / WhatsApp message from a patient.
 *
 * replyMode:
 *   "return"  – return the reply text (e.g. to answer inline via TwiML); it is logged as sent.
 *   "deliver" – send the reply through the normal provider (used by the simulator).
 */
export async function handleInboundMessage(input: {
  channel: Exclude<Channel, "email">;
  from: string;
  to?: string | null;
  body: string;
  providerId?: string | null;
  replyMode: "return" | "deliver";
  /** Only consider this practice's patients (the dashboard simulator). Real webhooks look across practices. */
  orgId?: string;
  now?: Date;
}): Promise<InboundResult> {
  const now = input.now ?? new Date();
  const phone = normalizePhone(input.from);
  const intent = parseIntent(input.body);

  // The records we text at this number: a child under 14's messages go to the guardian
  // (recipientFor), so the guardian's reply is about the child, and the child's own number, which we
  // don't text, is not. With a parent who is also a patient, both records match; the outbound
  // message below decides which visit the reply is about, and STOP covers both.
  const patientRows = phone
    ? (
        await db
          .select()
          .from(patients)
          .where(
            and(
              or(eq(patients.phone, phone), eq(patients.guardianPhone, phone)),
              input.orgId ? eq(patients.orgId, input.orgId) : undefined,
            ),
          )
      ).filter((p) => textedNumber(p, now) === phone)
    : [];
  const patientIds = patientRows.map((p) => p.id);

  // Which visit are they answering? The one we most recently texted them about;
  // otherwise the soonest upcoming one. (One number can have visits at several practices.)
  const candidates = patientIds.length
    ? await db
        .select({ id: appointments.id, startsAt: appointments.startsAt })
        .from(appointments)
        .where(
          and(
            inArray(appointments.patientId, patientIds),
            inArray(appointments.status, ["scheduled", "requested"]),
            gt(appointments.startsAt, new Date(now.getTime() - 30 * 60_000)),
          ),
        )
        .orderBy(asc(appointments.startsAt))
    : [];
  let upcoming = candidates[0];
  if (candidates.length > 1 && phone) {
    const [lastText] = await db
      .select({ appointmentId: messages.appointmentId })
      .from(messages)
      .where(
        and(
          eq(messages.direction, "outbound"),
          eq(messages.to, phone),
          inArray(messages.channel, ["sms", "whatsapp"]),
          inArray(
            messages.appointmentId,
            candidates.map((c) => c.id),
          ),
        ),
      )
      .orderBy(desc(messages.createdAt))
      .limit(1);
    upcoming = candidates.find((c) => c.id === lastText?.appointmentId) ?? upcoming;
  }

  const details = upcoming ? await getAppointmentDetails({ id: upcoming.id }) : null;
  const fallbackPatient = patientRows[0];
  const orgId = details?.org.id ?? fallbackPatient?.orgId ?? null;

  await db.insert(messages).values({
    id: newId(),
    orgId,
    appointmentId: details?.appointment.id ?? null,
    patientId: details?.patient.id ?? fallbackPatient?.id ?? null,
    channel: input.channel,
    direction: "inbound",
    to: input.to ?? "",
    from: phone ?? input.from,
    body: input.body,
    status: "received",
    provider: input.replyMode === "return" ? "twilio" : "simulator",
    providerId: input.providerId ?? null,
    intent,
  });

  let reply: string | null = null;

  if (intent === "stop") {
    if (patientIds.length) await db.update(patients).set({ smsOptIn: false }).where(inArray(patients.id, patientIds));
    const [org] = orgId ? await db.select().from(organizations).where(eq(organizations.id, orgId)) : [];
    reply = templates.reply.stop(fallbackPatient?.locale ?? "it", org?.name ?? "Sorriso");
  } else if (!details) {
    const [org] = orgId ? await db.select().from(organizations).where(eq(organizations.id, orgId)) : [];
    reply = templates.reply.none(fallbackPatient?.locale ?? "it", org?.name ?? "Sorriso");
  } else {
    const data = templateData(details);
    switch (intent) {
      case "confirm":
        if (details.appointment.status === "requested") {
          await db.update(appointments).set({ needsAttention: true }).where(eq(appointments.id, details.appointment.id));
        }
        await confirmAttendance(details.appointment.id, input.channel, now);
        reply = templates.reply.confirmed(data);
        break;
      case "cancel":
        await cancelAppointment(details.appointment.id, {
          by: "patient",
          reason: `Replied "${input.body.slice(0, 80)}" via ${input.channel}`,
          via: input.channel,
          notifyPatient: false,
          now,
        });
        reply = templates.reply.cancelled(data, appointmentLinks(details).rebookUrl);
        break;
      case "reschedule":
        reply = templates.reply.reschedule(data);
        break;
      default:
        await db
          .update(appointments)
          .set({ needsAttention: true, updatedAt: now })
          .where(eq(appointments.id, details.appointment.id));
        reply = templates.reply.unknown(data);
    }
  }

  if (reply && phone) {
    if (input.replyMode === "deliver") {
      await deliver({
        orgId,
        appointmentId: details?.appointment.id,
        patientId: details?.patient.id ?? fallbackPatient?.id,
        channel: input.channel,
        to: phone,
        text: reply,
      });
    } else {
      await db.insert(messages).values({
        id: newId(),
        orgId,
        appointmentId: details?.appointment.id ?? null,
        patientId: details?.patient.id ?? fallbackPatient?.id ?? null,
        channel: input.channel,
        direction: "outbound",
        to: phone,
        from: input.to ?? null,
        body: reply,
        status: "sent",
        provider: "twilio",
      });
    }
  }

  return { intent, reply, appointmentId: details?.appointment.id ?? null, orgId };
}
