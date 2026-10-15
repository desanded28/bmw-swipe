import { templates } from "@/lib/messaging/templates";
import { segments } from "@/lib/messaging/sms-encoding";
const start = new Date(Date.UTC(2026, 8, 16, 8, 30));
const d: any = {
  locale: "pl", patientFirstName: "Giulia", clinicName: "Studio Dentistico Associato Rossi & C. M", clinicPhone: "+39 02 1234 5678",
  brandColor: "#0d9488", practitionerName: "Dr. QQTEST", serviceName: "Implantologia ZZTEST", start, timezone: "Europe/Rome",
  locationName: "Milano", address: "Via Giuseppe Garibaldi 128, 20121 Milano", manageUrl: "http://localhost:3010/a/AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE",
  icsUrl: "x", privacyUrl: "http://localhost:3010/pl/c/studio-dentistico-associato-ro/privacy", preferencesUrl: "y",
};
const rebook = "http://localhost:3010/book/studio-dentistico-associato-ro?service=svc123456789&practitioner=prc123456789&ref=abcdefabcdef";
for (const det of [false, true]) {
  const x = { ...d, contentLevel: det ? { text: "detailed" } : undefined };
  const all: Record<string, string> = {
    booked: templates.bookingConfirmationSms(x), approved: templates.bookingApprovedSms(x),
    reminderAsk: templates.reminderSms(x, true), reminder: templates.reminderSms(x, false),
    cancelled: templates.cancelledSms(x, rebook), rescheduled: templates.rescheduledSms(x),
    waitlist: templates.waitlistOfferSms(x, rebook + "&slot=1"),
    replyConfirmed: templates.reply.confirmed(x), replyCancelled: templates.reply.cancelled(x, rebook),
    replyReschedule: templates.reply.reschedule(x), replyUnknown: templates.reply.unknown(x),
    replyStop: templates.reply.stop("pl", x.clinicName), replyStart: templates.reply.start("pl", x.clinicName),
    replyNone: templates.reply.none("pl", x.clinicName), unsub: templates.unsubscribeConfirmationSms(x), breach: templates.breachNoticeSms(x, x.manageUrl),
  };
  for (const [k, v] of Object.entries(all)) { const s = segments(v); console.log(`${det ? "D " : "  "}${k.padEnd(16)} ${s.encoding} ${s.units}u ${s.segments}seg | ${v}`); }
}
