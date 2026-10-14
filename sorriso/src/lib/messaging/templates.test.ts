import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LOCALES, type Locale } from "@/i18n/config";
import { lhref } from "@/i18n/href";
import { LOCALE_MESSAGES } from "@/i18n/messages";
import { getMessages } from "@/i18n/t";
import { isPlural } from "@/i18n/plural";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { createPractice } from "@/test/fixtures";
import { newId } from "../ids";
import { absoluteUrl, APP_URL } from "../config";
import { signPracticeRef } from "../privacy/context";
import { bookSlotUrl } from "../waitlist";
import { deliver, patientEmailHeaders } from "./index";
import { smtpTransportOptions } from "./providers";
import { asciiFallback, isGsm7, segments, withinBudget, ASCII_FALLBACK_LOCALES } from "./sms-encoding";
import { templates, type AppointmentTemplateData, type EmailContent } from "./templates";

/**
 * Acceptance (WP3): every message kind in every language, discreet by default; the SMS segment
 * budget; email hygiene (html lang, List-Unsubscribe, no remote images, no foreign links).
 */

const sent = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock("nodemailer", () => ({
  default: {
    createTransport: () => ({
      sendMail: async (m: Record<string, unknown>) => {
        sent.push(m);
        return { messageId: "<test@smtp>" };
      },
    }),
  },
}));

const SERVICE = "Implantologia ZZTEST";
const PRACTITIONER = "Dr. QQTEST";
const NOTE = "NOTEZZ";
/** 40 characters each: the budget is defined for these lengths. */
const CLINIC = "Studio Dentistico Associato Rossi & C. M";
const ADDRESS = "Via Giuseppe Garibaldi 128, 20121 Milano";
const SLUG = "studio-dentistico-associato-ro";
/** A real manage token is 43 characters (32 random bytes, base64url). */
const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE";
const WEBSITE = "https://www.studio-rossi.example";

const IDS = { service: "svc123456789", practitioner: "prc123456789", location: "loc123456789", org: "org123456789" };

function data(locale: Locale, start: Date, over: Partial<AppointmentTemplateData> = {}): AppointmentTemplateData {
  const d: AppointmentTemplateData & { patientNote: string; internalNote: string } = {
    locale,
    patientFirstName: "Giulia",
    clinicName: CLINIC,
    clinicPhone: "+39 02 1234 5678",
    brandColor: "#0d9488",
    practitionerName: PRACTITIONER,
    serviceName: SERVICE,
    start,
    timezone: "Europe/Rome",
    locationName: "Milano Centro",
    address: ADDRESS,
    manageUrl: absoluteUrl(`/a/${TOKEN}`),
    icsUrl: absoluteUrl(`/api/ics/appointment/${TOKEN}`),
    legalName: "Studio Rossi S.r.l.",
    legalAddress: ADDRESS,
    privacyUrl: absoluteUrl(lhref(locale, `/c/${SLUG}/privacy`)),
    preferencesUrl: absoluteUrl(`/a/${TOKEN}/privacy`),
    // Never read by the templates: if one leaked a note, the checks below would see it.
    patientNote: NOTE,
    internalNote: NOTE,
    ...over,
  };
  return d;
}

const rebookUrl = absoluteUrl(`/book/${SLUG}?service=${IDS.service}&practitioner=${IDS.practitioner}&ref=${signPracticeRef(IDS.org)}`);
const reviewUrl = absoluteUrl(`/a/${TOKEN}/review`);
const waitlistUrl = (start: Date) =>
  bookSlotUrl(
    SLUG,
    { orgId: IDS.org, serviceId: IDS.service, practitionerId: IDS.practitioner, locationId: IDS.location, startsAt: start },
    "wl1234567890",
    signPracticeRef(IDS.org),
  );
const breach = {
  what: "An unauthorised access to the booking system",
  when: "3 November 2026",
  data: "Name, phone, appointment times",
  consequences: "Possible unwanted calls",
  measures: "Access blocked, passwords reset",
  advice: "Be wary of calls asking for codes",
  dpoContact: "dpo@studio-rossi.example",
};

/** Every SMS a patient can receive, by kind. */
function allSms(d: AppointmentTemplateData): Record<string, string> {
  return {
    booked: templates.bookingConfirmationSms(d),
    approved: templates.bookingApprovedSms(d),
    reminderAsk: templates.reminderSms(d, true),
    reminder: templates.reminderSms(d, false),
    cancelled: templates.cancelledSms(d, rebookUrl),
    rescheduled: templates.rescheduledSms(d),
    waitlist: templates.waitlistOfferSms(d, waitlistUrl(d.start)),
    replyConfirmed: templates.reply.confirmed(d),
    replyCancelled: templates.reply.cancelled(d, rebookUrl),
    replyReschedule: templates.reply.reschedule(d),
    replyUnknown: templates.reply.unknown(d),
    replyStop: templates.reply.stop(d.locale, d.clinicName, { asciiFallback: d.smsAsciiFallback }),
    replyStart: templates.reply.start(d.locale, d.clinicName, { asciiFallback: d.smsAsciiFallback }),
    replyNone: templates.reply.none(d.locale, d.clinicName, { asciiFallback: d.smsAsciiFallback }),
    unsubscribe: templates.unsubscribeConfirmationSms(d),
    breach: templates.breachNoticeSms(d, d.manageUrl),
  };
}

function allEmails(d: AppointmentTemplateData): Record<string, EmailContent> {
  return {
    booked: templates.bookingConfirmation(d),
    requested: templates.bookingRequested(d),
    approved: templates.bookingApproved(d),
    reminderAsk: templates.reminderEmail(d, true),
    reminder: templates.reminderEmail(d, false),
    cancelledByPractice: templates.cancelledEmail(d, "staff", rebookUrl),
    cancelledByPatient: templates.cancelledEmail(d, "patient", rebookUrl),
    rescheduled: templates.rescheduledEmail(d),
    waitlist: templates.waitlistOfferEmail(d, waitlistUrl(d.start)),
    review: templates.reviewRequest(d, reviewUrl),
    unsubscribe: templates.unsubscribeConfirmationEmail(d, "Email"),
    breach: templates.breachNoticeEmail(d, breach),
  };
}

/** A week of dates (every weekday name) in a month with long names in most languages. */
const WEEK = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 8, 14 + i, 8, 30)));
const START = WEEK[2];

const categoryLabels = (l: Locale) => Object.values(getMessages(l, ["common"]).common.categories);

let patientId: string;
beforeAll(async () => {
  const { orgId } = await createPractice();
  patientId = newId();
  await db.insert(patients).values({ id: patientId, orgId, firstName: "Giulia", lastName: "Rossi", email: "giulia@example.com", locale: "de" });
});
afterEach(() => vi.unstubAllEnvs());

describe("discreet by default, in every language", () => {
  it.each(LOCALES)("%s: no treatment, category, practitioner or note in SMS, WhatsApp, subjects, bodies or calendars", (locale) => {
    const d = data(locale, START);
    const forbidden = [SERVICE, PRACTITIONER, NOTE, ...categoryLabels(locale), ...categoryLabels("en")];
    const check = (where: string, text: string) => {
      for (const f of forbidden) expect(text, `${where} mentions "${f}"`).not.toContain(f);
      expect(text, `${where} has a placeholder left`).not.toMatch(/\{\w*\}?/);
    };
    for (const [kind, sms] of Object.entries(allSms(d))) {
      expect(sms.length, kind).toBeGreaterThan(10);
      check(`sms ${kind}`, sms);
    }
    for (const [kind, email] of Object.entries(allEmails(d))) {
      check(`subject ${kind}`, email.subject);
      // Discreet mode keeps the treatment out of the body too: details sit behind the link.
      check(`html ${kind}`, email.html);
      check(`text ${kind}`, email.text);
    }
    const wa = templates.whatsappVariables(d);
    expect(Object.keys(wa).sort()).toEqual(["1", "2", "3", "4"]);
    for (const [k, v] of Object.entries(wa)) check(`whatsapp {{${k}}}`, v);
    const ics = templates.ics(d);
    check("ics summary", ics.summary);
    check("ics description", ics.description);
    expect(ics.description).not.toMatch(/https?:/);
    expect(ics.summary).toContain(CLINIC);
  });

  it("uses the Italian reference wording", () => {
    const d = data("it", START, { clinicName: "Studio Rossi", address: "Via Roma 1, Milano" });
    expect(templates.reminderSms(d, true)).toBe(
      `Studio Rossi: promemoria appuntamento mercoledì 16 settembre alle 10:30, Via Roma 1, Milano. Rispondi SI per confermare, NO per disdire. Dettagli: ${d.manageUrl} STOP per non ricevere SMS`,
    );
    expect(templates.reminderEmail(d, false).subject).toBe("Promemoria appuntamento - Studio Rossi - mer 16 set alle 10:30");
    expect(templates.ics(d).summary).toBe("Appuntamento – Studio Rossi");
    expect(templates.reply.confirmed(d)).toContain("Presenza confermata");
  });

  it("names the treatment only in detailed mode, per channel", () => {
    const short = { clinicName: "Studio Rossi", address: "Via Roma 1, Milano" };
    const both = data("en", START, { ...short, contentLevel: { email: "detailed", text: "detailed" } });
    expect(templates.reminderSms(both, true)).toContain(SERVICE);
    expect(templates.reminderEmail(both, true).subject).toContain(SERVICE);
    expect(templates.reminderEmail(both, true).html).toContain(PRACTITIONER);
    const emailOnly = data("en", START, { ...short, contentLevel: { email: "detailed" } });
    expect(templates.reminderSms(emailOnly, true)).not.toContain(SERVICE);
    expect(templates.reminderEmail(emailOnly, true).subject).toContain(SERVICE);
    // The calendar entry and the waiting-list offer stay discreet whatever the level.
    expect(templates.ics(both).summary).not.toContain(SERVICE);
    expect(templates.waitlistOfferSms(both, waitlistUrl(START))).not.toContain(SERVICE);
    expect(templates.waitlistOfferEmail(both, waitlistUrl(START)).html).not.toContain(SERVICE);
  });

  it("writes to the guardian about the child, by name only in the email body", () => {
    const d = data("it", START, { viaGuardian: true, recipientName: "Maria Neri" });
    const email = templates.reminderEmail(d, true);
    expect(email.text.startsWith("Ciao Maria,")).toBe(true);
    expect(email.text).toContain("Paziente: Giulia");
    expect(email.html).toContain("sei il contatto per gli appuntamenti di Giulia");
  });

  it("links the practice's privacy notice and how to object in booking confirmations", () => {
    for (const locale of ["it", "en"] as const) {
      const d = data(locale, START);
      const email = templates.bookingConfirmation(d);
      expect(email.html).toContain(`href="${d.privacyUrl}"`);
      expect(email.html).toContain(`href="${d.preferencesUrl}"`);
      expect(email.text).toContain("STOP");
      expect(templates.bookingConfirmationSms({ ...d, clinicName: "Studio Rossi" })).toContain(d.privacyUrl!);
    }
  });
});

describe("SMS segment budget", () => {
  const sms = (d: AppointmentTemplateData) => [...Object.entries(allSms(d)), ...Object.entries(allSms({ ...d, contentLevel: { text: "detailed" } }))];

  it.each(LOCALES)("%s: every SMS fits 2 GSM-7 or 3 UCS-2 segments with 40-character practice and address", (locale) => {
    for (const start of WEEK) {
      for (const [kind, text] of sms(data(locale, start))) {
        const s = segments(text);
        expect(withinBudget(text), `${kind} on ${start.toISOString().slice(0, 10)}: ${s.encoding} ${s.units} units, ${s.segments} segments`).toBe(true);
      }
    }
  });

  it.each(ASCII_FALLBACK_LOCALES)("%s with the ASCII fallback: every SMS is GSM-7 in at most 2 segments", (locale) => {
    for (const start of WEEK) {
      for (const [kind, text] of sms(data(locale, start, { smsAsciiFallback: true }))) {
        const s = segments(text);
        expect(s.encoding, kind).toBe("GSM-7");
        expect(s.segments, `${kind}: ${s.units} septets`).toBeLessThanOrEqual(2);
      }
    }
  });

  it("strips accents only where the fallback applies", () => {
    const pl = templates.reminderSms(data("pl", WEEK[2], { smsAsciiFallback: true, clinicName: "Gabinet Łódź" }), true);
    expect(pl).toContain("Gabinet Lodz");
    const it = templates.reminderSms(data("it", WEEK[2], { smsAsciiFallback: true, clinicName: "Studio Città" }), true);
    expect(it).toContain("Studio Città");
  });

  type Tree = { [k: string]: unknown };
  const smsLeaves = (tree: unknown, prefix = ""): [string, string][] =>
    Object.entries((tree ?? {}) as Tree).flatMap(([k, v]): [string, string][] => {
      const key = prefix ? `${prefix}.${k}` : k;
      if (typeof v === "string") return /^sms|^replies\./.test(k) || prefix === "replies" ? [[key, v]] : [];
      if (v && typeof v === "object" && !isPlural(v)) return smsLeaves(v, key);
      return [];
    });

  it.each(LOCALES)("%s: SMS texts use straight quotes, no ellipsis, and the short forms are GSM-7", (locale) => {
    for (const [key, text] of smsLeaves(LOCALE_MESSAGES[locale].patientMessages)) {
      expect(text, key).not.toMatch(/[‘’“”«»…–—]/);
      if (/Short$/.test(key)) expect(isGsm7(text.replace(/\{\w+\}/g, "")), key).toBe(true);
    }
    expect(LOCALE_MESSAGES[locale].patientMessages.format?.slot ?? "{day}").toMatch(/\{day\}/);
  });

  it("keeps the confirm word the texts ask for (it SI, en YES)", () => {
    expect(LOCALE_MESSAGES.it.patientMessages.reminder?.smsAsk).toContain("SI");
    expect(LOCALE_MESSAGES.en.patientMessages.reminder?.smsAsk).toContain("YES");
    expect(asciiFallback("SI")).toBe("SI");
  });
});

describe("email hygiene", () => {
  const appHost = new URL(APP_URL).host;
  const websiteHost = new URL(WEBSITE).host;

  it.each(LOCALES)("%s: html lang, no remote images, links only to the app and the practice website", (locale) => {
    for (const [kind, email] of Object.entries(allEmails(data(locale, START)))) {
      expect(email.html, kind).toMatch(new RegExp(`^<!doctype html><html lang="${locale}">`));
      expect(email.html, kind).not.toMatch(/<img\b[^>]*\bsrc=["']?https?:/i);
      expect(email.html, kind).not.toMatch(/url\(\s*["']?https?:/i);
      for (const [, href] of email.html.matchAll(/href="([^"]+)"/g)) {
        const host = new URL(href.replace(/&amp;/g, "&")).host;
        expect([appHost, websiteHost], `${kind} links to ${host}`).toContain(host);
      }
    }
  });

  it("sends Content-Language and one-click List-Unsubscribe headers through SMTP with TLS required", async () => {
    vi.stubEnv("SMTP_URL", "smtp://user:pass@smtp.example.eu:587");
    vi.stubEnv("MESSAGING_ALLOWLIST", "giulia@example.com");
    expect(smtpTransportOptions()).toMatchObject({ requireTLS: true, tls: { minVersion: "TLSv1.2" } });
    vi.stubEnv("SMTP_REQUIRE_TLS", "0");
    expect(smtpTransportOptions()).toMatchObject({ requireTLS: false, tls: { minVersion: "TLSv1.2" } });
    vi.stubEnv("SMTP_REQUIRE_TLS", "1");

    const email = templates.reminderEmail(data("de", START), true);
    const msg = await deliver({
      orgId: null,
      patientId,
      channel: "email",
      to: "giulia@example.com",
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    expect(msg.status).toBe("sent");
    const mail = sent.at(-1)!;
    const headers = mail.headers as Record<string, string>;
    expect(headers["Content-Language"]).toBe("de");
    expect(headers["List-Unsubscribe"]).toMatch(new RegExp(`^<${APP_URL}/api/privacy/unsubscribe\\?t=${patientId}\\.email\\.[0-9a-f]{32}&c=email>$`));
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");

    // Not on the allowlist outside the live deployment: captured, never handed to SMTP.
    const before = sent.length;
    const held = await deliver({ orgId: null, channel: "email", to: "stranger@example.com", subject: "x", text: "x" });
    expect(held.status).toBe("captured");
    expect(sent.length).toBe(before);
  });

  it("adds no unsubscribe header to mail that isn't about a patient record", () => {
    expect(patientEmailHeaders({ locale: "it" })).toEqual({ "Content-Language": "it" });
  });
});

// ---------------------------------------------------------------- templates as reviewed

// The email layout itself is tested in layout.test.ts.

/** Fixed data with characters that need escaping, for the snapshot below. */
const reviewed: AppointmentTemplateData = {
  locale: "it",
  patientFirstName: "Giulia <b>",
  clinicName: 'Studio "Rossi" & Figli',
  clinicPhone: "+39 02 1234 5678",
  brandColor: "#1d4ed8",
  practitionerName: "Dr. Marco Rossi",
  serviceName: "Igiene <professionale>",
  start: new Date("2026-11-03T08:30:00Z"),
  timezone: "Europe/Rome",
  locationName: "Milano Centro",
  address: "Via Roma 1, Milano",
  manageUrl: "https://sorriso.test/a/tok123",
  icsUrl: "https://sorriso.test/api/ics/appointment/tok123",
};

/**
 * Every appointment template rendered with fixed data. The snapshot pins the output, so a change
 * to a patient text or to the layout shows up in review.
 */
function renderReviewed(d: AppointmentTemplateData) {
  return {
    bookingConfirmation: templates.bookingConfirmation(d),
    bookingConfirmationSms: templates.bookingConfirmationSms(d),
    bookingRequested: templates.bookingRequested(d),
    bookingApproved: templates.bookingApproved(d),
    reminderEmailAsk: templates.reminderEmail(d, true),
    reminderEmail: templates.reminderEmail(d, false),
    reminderSmsAsk: templates.reminderSms(d, true),
    reminderSms: templates.reminderSms(d, false),
    cancelledEmailStaff: templates.cancelledEmail(d, "staff", "https://sorriso.test/book/x"),
    cancelledEmailPatient: templates.cancelledEmail(d, "patient", "https://sorriso.test/book/x"),
    cancelledSms: templates.cancelledSms(d, "https://sorriso.test/book/x"),
    rescheduledEmail: templates.rescheduledEmail(d),
    rescheduledSms: templates.rescheduledSms(d),
    waitlistOfferEmail: templates.waitlistOfferEmail(d, "https://sorriso.test/book/x?slot=1"),
    waitlistOfferSms: templates.waitlistOfferSms(d, "https://sorriso.test/book/x?slot=1"),
    reviewRequest: templates.reviewRequest(d, "https://sorriso.test/a/tok123/review"),
    replyConfirmed: templates.reply.confirmed(d),
    replyCancelled: templates.reply.cancelled(d, "https://sorriso.test/book/x"),
    replyReschedule: templates.reply.reschedule(d),
    replyUnknown: templates.reply.unknown(d),
    replyStop: templates.reply.stop(d.locale, d.clinicName),
    replyNone: templates.reply.none(d.locale, d.clinicName),
  };
}

describe("appointment templates as reviewed", () => {
  it.each(["it", "en", "de"] as const)("%s", (locale) => {
    expect(renderReviewed({ ...reviewed, locale })).toMatchSnapshot();
  });
});
