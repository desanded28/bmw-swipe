import { db, type Tx } from "@/db";
import { messages, type Channel, type Message } from "@/db/schema";
import { newId } from "../ids";
import { sendEmail, sendSms, sendWhatsApp, type Attachment, type SendResult } from "./providers";

export type OutboundMessage = {
  orgId: string | null;
  appointmentId?: string | null;
  patientId?: string | null;
  channel: Channel;
  to: string;
  subject?: string;
  text: string;
  html?: string;
  fromName?: string;
  replyTo?: string | null;
  attachments?: Attachment[];
  whatsappVariables?: Record<string, string>;
};

/**
 * Send a message through the right provider and record it in the message log.
 * Never throws: failures are logged with status "failed" and returned.
 */
export async function deliver(msg: OutboundMessage, tx: Tx = db): Promise<Message> {
  let result: SendResult | null = null;
  let error: string | null = null;
  try {
    if (msg.channel === "email") {
      result = await sendEmail({
        to: msg.to,
        subject: msg.subject ?? "",
        text: msg.text,
        html: msg.html,
        fromName: msg.fromName,
        replyTo: msg.replyTo,
        attachments: msg.attachments,
      });
    } else if (msg.channel === "sms") {
      result = await sendSms({ to: msg.to, text: msg.text });
    } else {
      result = await sendWhatsApp({ to: msg.to, text: msg.text, variables: msg.whatsappVariables });
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const row = {
    id: newId(),
    orgId: msg.orgId,
    appointmentId: msg.appointmentId ?? null,
    patientId: msg.patientId ?? null,
    channel: msg.channel,
    direction: "outbound" as const,
    to: msg.to,
    from: result?.from ?? null,
    subject: msg.subject ?? null,
    body: msg.text,
    html: msg.html ?? null,
    status: result ? result.status : ("failed" as const),
    provider: result?.provider ?? (msg.channel === "email" ? "smtp" : "twilio"),
    providerId: result?.providerId ?? null,
    error,
  };
  const [saved] = await tx.insert(messages).values(row).returning();
  if (error) console.error(`[messaging] ${msg.channel} to ${msg.to} failed: ${error}`);
  else if (result?.status === "captured")
    console.info(`[messaging] captured ${msg.channel} to ${msg.to}${msg.subject ? ` — ${msg.subject}` : ""}`);
  return saved;
}

export { providerStatus } from "./providers";
