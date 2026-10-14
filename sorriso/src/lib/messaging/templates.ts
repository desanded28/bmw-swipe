import type { Locale as AppLocale } from "@/i18n/config";
import { fmtWhen, zonedDate, zonedTime } from "@/i18n/datefmt";
import { getT } from "@/i18n/t";
import type { MessageKey } from "@/i18n/types";
import { renderEmailLayout, type EmailButton, type EmailLink } from "./layout";
import { fitSmsBudget, prepareSms } from "./sms-encoding";
import { whatsappVariables } from "./whatsapp";

/**
 * Appointment messages to patients: emails, SMS, WhatsApp template variables, replies to texts
 * and calendar-invite texts, in the patient's language (the patientMessages namespace).
 *
 * Discreet by default (docs/messaging.md). Unless `contentLevel` says "detailed" for the channel,
 * SMS texts, WhatsApp variables, email subjects and bodies and calendar entries carry only the
 * practice, the date and time, the address, how to confirm or cancel, the link and how to opt
 * out: never the treatment, its category, the practitioner or a note. templateData() in
 * src/lib/appointments.ts decides the level.
 */

export type Locale = AppLocale;
export type ContentLevel = "discreet" | "detailed";

export type AppointmentTemplateData = {
  locale: Locale;
  patientFirstName: string;
  clinicName: string;
  clinicPhone: string | null;
  brandColor: string;
  practitionerName: string;
  serviceName: string;
  start: Date;
  timezone: string;
  locationName: string;
  address: string;
  manageUrl: string;
  icsUrl: string;
  /** The guardian's name when messages go to the guardian of a child under 14 (recipientFor). */
  recipientName?: string | null;
  viaGuardian?: boolean;
  /** Per channel; anything missing is discreet. Detailed only per contentLevelFor() (appointments.ts). */
  contentLevel?: { email?: ContentLevel; text?: ContentLevel };
  /** settings.reminders.smsAsciiFallback: transliterate es, pt, fr, ro and pl SMS to GSM-7. */
  smsAsciiFallback?: boolean;
  /** Controller identity for the footer: the practice's legal name and registered address. */
  legalName?: string | null;
  legalAddress?: string | null;
  /** The practice's privacy notice (/{locale}/c/<slug>/privacy). */
  privacyUrl?: string | null;
  /** The patient's privacy choices (/a/<token>/privacy, or the privacy center). */
  preferencesUrl?: string | null;
  /** Why the patient gets the email: an appointment (default), a waiting-list entry, or being a patient. */
  reason?: "appointment" | "waitlist" | "patient";
};

export type EmailContent = { subject: string; text: string; html: string };

type PM = "patientMessages";
type Key = MessageKey<PM>;

/** A translator taking any vars object: the keys below are typed, their vars are checked by the tests. */
function tr(locale: Locale) {
  const t = getT(locale, "patientMessages");
  return (key: Key, vars?: Record<string, string | number>) =>
    (t as unknown as (k: string, v?: Record<string, string | number>) => string)(key, vars);
}

const detailed = (d: AppointmentTemplateData, channel: "email" | "text") => d.contentLevel?.[channel] === "detailed";

/** "martedì 3 novembre alle 09:30" (style medium) or, short, "mar 3 nov alle 09:30". */
export function whenLabel(d: Pick<AppointmentTemplateData, "start" | "timezone" | "locale">, style: "long" | "short" = "long"): string {
  return fmtWhen(d.start, d.timezone, d.locale, style === "long" ? "long" : "weekday");
}

/** Every placeholder an appointment text may use, already formatted for the patient's language. */
function vars(d: AppointmentTemplateData, url: string = d.manageUrl): Record<string, string> {
  const t = tr(d.locale);
  const [, month, day] = zonedDate(d.start, d.timezone).split("-");
  return {
    clinic: d.clinicName,
    when: fmtWhen(d.start, d.timezone, d.locale, "medium"),
    date: fmtWhen(d.start, d.timezone, d.locale, "weekday"),
    slot: t("format.slot", { day, month, time: zonedTime(d.start, d.timezone) }),
    address: d.address,
    url,
    privacy: d.privacyUrl ?? "",
    name: d.patientFirstName,
    service: d.serviceName,
    practitioner: d.practitionerName,
  };
}

/**
 * The SMS for `keys` (fullest first): GSM-7 typography, the ASCII fallback when the practice turned
 * it on, then the first text within the segment budget (sms-encoding.ts).
 */
function smsText(d: AppointmentTemplateData, keys: Key[], v: Record<string, string>): string {
  const t = tr(d.locale);
  return fitSmsBudget(keys.map((k) => prepareSms(t(k, v), d.locale, { asciiFallback: d.smsAsciiFallback })));
}

/** Footer lines and links for a patient email (GDPR Art. 13/14 transparency, ePrivacy). */
export function privacyFooter(
  d: Pick<
    AppointmentTemplateData,
    | "locale"
    | "clinicName"
    | "clinicPhone"
    | "address"
    | "legalName"
    | "legalAddress"
    | "privacyUrl"
    | "preferencesUrl"
    | "viaGuardian"
    | "patientFirstName"
    | "reason"
  >,
  opts: { object?: boolean } = {},
): { footerLines: string[]; footerLinks: EmailLink[] } {
  const t = tr(d.locale);
  const name = d.legalName || d.clinicName;
  const address = d.legalAddress || d.address;
  const sender = address ? t("privacyFooter.sender", { name, address }) : name;
  const why = d.viaGuardian
    ? t("privacyFooter.whyGuardian", { patient: d.patientFirstName, clinic: d.clinicName })
    : d.reason === "waitlist"
      ? t("privacyFooter.whyWaitlist", { clinic: d.clinicName })
      : d.reason === "patient"
        ? t("privacyFooter.whyGeneric", { clinic: d.clinicName })
        : t("privacyFooter.why", { clinic: d.clinicName });
  const lines = [sender, ...(d.clinicPhone ? [t("privacyFooter.phone", { phone: d.clinicPhone })] : []), why];
  if (opts.object) lines.push(t("privacyFooter.object"));
  const links: EmailLink[] = [];
  if (d.privacyUrl) links.push({ label: t("privacyFooter.notice"), url: d.privacyUrl });
  if (d.preferencesUrl) links.push({ label: t("privacyFooter.preferences"), url: d.preferencesUrl });
  return { footerLines: lines, footerLinks: links };
}

/** The appointment emails' layout: greeting, appointment details, note, buttons and the privacy footer. */
function layout(opts: {
  d: AppointmentTemplateData;
  intro: string;
  showDetails?: boolean;
  buttons?: EmailButton[];
  object?: boolean;
}): { html: string; text: string } {
  const { d } = opts;
  const t = tr(d.locale);
  const full = detailed(d, "email");
  const details: [string, string][] = [];
  if (opts.showDetails !== false) {
    if (d.viaGuardian) details.push([t("email.patient"), d.patientFirstName]);
    details.push([t("email.when"), whenLabel(d)]);
    if (full) {
      details.push([t("email.service"), d.serviceName], [t("email.with"), d.practitionerName]);
      details.push([t("email.where"), `${d.locationName}, ${d.address}`]);
    } else {
      details.push([t("email.where"), d.address]);
    }
  }
  const greetingName = (d.viaGuardian && d.recipientName?.trim().split(/\s+/)[0]) || d.patientFirstName;
  return renderEmailLayout({
    locale: d.locale,
    brandColor: d.brandColor,
    brandName: d.clinicName,
    greeting: t("email.greeting", { name: greetingName }),
    intro: opts.intro,
    details,
    note: opts.showDetails !== false && !full ? t("email.detailsOnline") : undefined,
    buttons: opts.buttons ?? [],
    ...privacyFooter(d, { object: opts.object }),
  });
}

function manageButtons(d: AppointmentTemplateData, opts: { confirm?: boolean } = {}): EmailButton[] {
  const t = tr(d.locale);
  const cancel: EmailButton = { label: t("email.cancel"), url: `${d.manageUrl}?do=cancel`, variant: "danger" };
  if (opts.confirm) {
    return [
      { label: t("email.confirm"), url: `${d.manageUrl}?do=confirm` },
      { label: t("email.reschedule"), url: `${d.manageUrl}?do=reschedule`, variant: "secondary" },
      cancel,
    ];
  }
  return [
    { label: t("email.manage"), url: d.manageUrl },
    { label: t("email.calendar"), url: d.icsUrl, variant: "secondary" },
    cancel,
  ];
}

/** The subject: discreet, or the detailed variant when the email may name the treatment. */
function subject(d: AppointmentTemplateData, discreet: Key, full: Key | null, v = vars(d)): string {
  const t = tr(d.locale);
  return t(full && detailed(d, "email") ? full : discreet, v);
}

export const templates = {
  bookingConfirmation(d: AppointmentTemplateData): EmailContent {
    const t = tr(d.locale);
    const { html, text } = layout({ d, intro: t("booked.body"), buttons: manageButtons(d), object: true });
    return { subject: subject(d, "booked.subject", "booked.subjectDetailed"), html, text };
  },

  /** With the practice's privacy notice link when it fits (it is always in the email). */
  bookingConfirmationSms(d: AppointmentTemplateData): string {
    const keys: Key[] = d.privacyUrl ? ["booked.sms", "booked.smsShort"] : ["booked.smsShort"];
    if (detailed(d, "text")) keys.unshift("booked.smsDetailed");
    return smsText(d, keys, vars(d));
  },

  bookingRequested(d: AppointmentTemplateData): EmailContent {
    const t = tr(d.locale);
    const buttons = [{ label: t("email.manage"), url: d.manageUrl }];
    const { html, text } = layout({ d, intro: t("requested.body"), buttons, object: true });
    return { subject: subject(d, "requested.subject", "requested.subjectDetailed"), html, text };
  },

  bookingApproved(d: AppointmentTemplateData): EmailContent {
    const t = tr(d.locale);
    const { html, text } = layout({ d, intro: t("approved.body"), buttons: manageButtons(d), object: true });
    return { subject: subject(d, "approved.subject", "approved.subjectDetailed"), html, text };
  },

  bookingApprovedSms(d: AppointmentTemplateData): string {
    return smsText(d, d.privacyUrl ? ["approved.sms", "approved.smsShort"] : ["approved.smsShort"], vars(d));
  },

  reminderEmail(d: AppointmentTemplateData, askConfirmation: boolean): EmailContent {
    const t = tr(d.locale);
    const { html, text } = layout({
      d,
      intro: t(askConfirmation ? "reminder.bodyAsk" : "reminder.body"),
      buttons: manageButtons(d, { confirm: askConfirmation }),
    });
    return { subject: subject(d, "reminder.subject", "reminder.subjectDetailed"), html, text };
  },

  reminderSms(d: AppointmentTemplateData, askConfirmation: boolean): string {
    const keys: Key[] = askConfirmation ? ["reminder.smsAsk", "reminder.smsAskShort"] : ["reminder.sms", "reminder.smsShort"];
    if (detailed(d, "text")) keys.unshift(askConfirmation ? "reminder.smsAskDetailed" : "reminder.smsDetailed");
    return smsText(d, keys, vars(d));
  },

  cancelledEmail(d: AppointmentTemplateData, by: "staff" | "patient", rebookUrl: string): EmailContent {
    const t = tr(d.locale);
    const { html, text } = layout({
      d,
      intro: t(by === "staff" ? "cancelled.bodyByPractice" : "cancelled.body"),
      buttons: [{ label: t("cancelled.rebook"), url: rebookUrl }],
    });
    return { subject: subject(d, "cancelled.subject", null), html, text };
  },

  cancelledSms(d: AppointmentTemplateData, rebookUrl: string): string {
    return smsText(d, ["cancelled.sms", "cancelled.smsShort"], vars(d, rebookUrl));
  },

  rescheduledEmail(d: AppointmentTemplateData): EmailContent {
    const t = tr(d.locale);
    const { html, text } = layout({ d, intro: t("rescheduled.body"), buttons: manageButtons(d) });
    return { subject: subject(d, "rescheduled.subject", "rescheduled.subjectDetailed"), html, text };
  },

  rescheduledSms(d: AppointmentTemplateData): string {
    return smsText(d, ["rescheduled.sms", "rescheduled.smsShort"], vars(d));
  },

  /** Always discreet: a waiting-list offer never names the treatment ("a slot opened on {date}"). */
  waitlistOfferEmail(d: AppointmentTemplateData, bookUrl: string): EmailContent {
    const t = tr(d.locale);
    const discreet: AppointmentTemplateData = { ...d, contentLevel: undefined, reason: d.reason ?? "waitlist" };
    const v = vars(discreet, bookUrl);
    const { html, text } = layout({
      d: discreet,
      intro: t("waitlist.body", v),
      showDetails: false,
      buttons: [{ label: t("waitlist.cta"), url: bookUrl }],
    });
    return { subject: t("waitlist.subject", v), html, text };
  },

  waitlistOfferSms(d: AppointmentTemplateData, bookUrl: string): string {
    return smsText({ ...d, contentLevel: undefined }, ["waitlist.sms", "waitlist.smsShort"], vars(d, bookUrl));
  },

  /** Email only. Names the practitioner only in detailed mode. */
  reviewRequest(d: AppointmentTemplateData, reviewUrl: string): EmailContent {
    const t = tr(d.locale);
    const v = vars(d);
    const { html, text } = layout({
      d,
      intro: detailed(d, "email") ? t("review.bodyDetailed", v) : t("review.body"),
      showDetails: false,
      buttons: [{ label: t("review.cta"), url: reviewUrl }],
    });
    return { subject: t("review.subject", v), html, text };
  },

  /** Confirmation that a channel was turned off (one-click unsubscribe, privacy center, STOP). */
  unsubscribeConfirmationEmail(d: AppointmentTemplateData, channelName: string): EmailContent {
    const t = tr(d.locale);
    const v = { ...vars(d), channel: channelName };
    const { html, text } = layout({
      d,
      intro: t("unsubscribeConfirmation.body", v),
      showDetails: false,
      buttons: d.preferencesUrl ? [{ label: t("unsubscribeConfirmation.cta"), url: d.preferencesUrl }] : [],
    });
    return { subject: t("unsubscribeConfirmation.subject", v), html, text };
  },

  unsubscribeConfirmationSms(d: Pick<AppointmentTemplateData, "locale" | "clinicName" | "smsAsciiFallback">): string {
    return prepareSms(tr(d.locale)("unsubscribeConfirmation.sms", { clinic: d.clinicName }), d.locale, {
      asciiFallback: d.smsAsciiFallback,
    });
  },

  /**
   * Art. 34 communication of a personal data breach. Every field is plain language written for the
   * patient by the practice (as controller) with its DPO; `url` is a page with the full notice.
   */
  breachNoticeEmail(
    d: AppointmentTemplateData,
    info: { what: string; when: string; data: string; consequences: string; measures: string; advice: string; dpoContact: string },
  ): EmailContent {
    const t = tr(d.locale);
    const v = vars(d);
    const { html, text } = renderEmailLayout({
      locale: d.locale,
      brandColor: d.brandColor,
      brandName: d.clinicName,
      greeting: t("email.greeting", { name: (d.viaGuardian && d.recipientName?.trim().split(/\s+/)[0]) || d.patientFirstName }),
      intro: t("breachNotice.body"),
      details: [
        [t("breachNotice.what"), info.what],
        [t("breachNotice.when"), info.when],
        [t("breachNotice.data"), info.data],
        [t("breachNotice.consequences"), info.consequences],
        [t("breachNotice.measures"), info.measures],
        [t("breachNotice.advice"), info.advice],
        [t("breachNotice.contact"), t("breachNotice.contactValue", { dpo: info.dpoContact })],
      ],
      ...privacyFooter(d),
    });
    return { subject: t("breachNotice.subject", v), html, text };
  },

  breachNoticeSms(d: AppointmentTemplateData, url: string): string {
    return smsText(d, ["breachNotice.sms"], vars(d, url));
  },

  /** WhatsApp template variables: name, date, practice and link only (whatsapp.ts). */
  whatsappVariables(d: AppointmentTemplateData, link: string = d.manageUrl): Record<string, string> {
    return whatsappVariables({ name: d.patientFirstName, date: whenLabel(d, "short"), clinic: d.clinicName, link });
  },

  /** Calendar invite texts: "Appointment – {clinic}", the address and the practice's phone; no link. */
  ics(d: AppointmentTemplateData): { summary: string; description: string; location: string } {
    const t = tr(d.locale);
    return {
      summary: t("ics.summary", { clinic: d.clinicName }),
      description: [d.address, ...(d.clinicPhone ? [t("ics.phone", { phone: d.clinicPhone })] : [])].join("\n"),
      location: d.address,
    };
  },

  reply: {
    confirmed: (d: AppointmentTemplateData) => smsText(d, ["replies.confirmed", "replies.confirmedShort"], vars(d)),
    cancelled: (d: AppointmentTemplateData, rebookUrl: string) =>
      smsText(d, ["replies.cancelled", "replies.cancelledShort"], vars(d, rebookUrl)),
    reschedule: (d: AppointmentTemplateData) => smsText(d, ["replies.reschedule"], vars(d, `${d.manageUrl}?do=reschedule`)),
    unknown: (d: AppointmentTemplateData) => smsText(d, ["replies.unknown"], vars(d)),
    stop: (locale: Locale, clinicName: string, opts: { asciiFallback?: boolean } = {}) =>
      prepareSms(tr(locale)("replies.stop", { clinic: clinicName }), locale, opts),
    start: (locale: Locale, clinicName: string, opts: { asciiFallback?: boolean } = {}) =>
      prepareSms(tr(locale)("replies.start", { clinic: clinicName }), locale, opts),
    none: (locale: Locale, clinicName: string, opts: { asciiFallback?: boolean } = {}) =>
      prepareSms(tr(locale)("replies.none", { clinic: clinicName }), locale, opts),
  },
};
