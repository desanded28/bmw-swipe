import type { Locale as AppLocale } from "@/i18n/config";
import { formatDate, formatTime } from "../time";
import { renderEmailLayout, type EmailButton } from "./layout";

export type Locale = AppLocale;

/** Italian and English tables exist today; other locales fall back to English. */
const tableFor = (l: Locale) => (l === "it" ? "it" : "en");

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
};

export type EmailContent = { subject: string; text: string; html: string };

const T = {
  it: {
    greeting: (n: string) => `Ciao ${n},`,
    when: "Quando",
    with: "Con",
    service: "Prestazione",
    where: "Dove",
    manage: "Gestisci appuntamento",
    confirmBtn: "Confermo la presenza",
    cancelBtn: "Disdici",
    rescheduleBtn: "Sposta",
    calendarBtn: "Aggiungi al calendario",
    footer: (c: string, p: string | null) =>
      `${c}${p ? ` · Tel. ${p}` : ""} — Hai ricevuto questa email perché hai un appuntamento presso questo studio.`,
    booked: {
      subject: (s: string, d: string) => `Appuntamento prenotato: ${s}, ${d}`,
      intro: "il tuo appuntamento è prenotato. Ti invieremo un promemoria prima della visita.",
      sms: (c: string, s: string, p: string, d: string, u: string) =>
        `${c}: appuntamento prenotato, ${s} con ${p} ${d}. Gestisci: ${u}`,
    },
    requested: {
      subject: (s: string) => `Richiesta ricevuta: ${s}`,
      intro: "abbiamo ricevuto la tua richiesta. Lo studio la confermerà a breve e riceverai un'email.",
    },
    approved: {
      subject: (s: string, d: string) => `Appuntamento confermato dallo studio: ${s}, ${d}`,
      intro: "lo studio ha confermato la tua richiesta. Ecco i dettagli del tuo appuntamento.",
    },
    reminder: {
      subject: (d: string) => `Promemoria appuntamento: ${d}`,
      introAsk: "ti ricordiamo il tuo prossimo appuntamento. Puoi confermare la tua presenza con un clic?",
      intro: "ti ricordiamo il tuo prossimo appuntamento.",
      sms: (n: string, s: string, p: string, d: string, c: string, a: string) =>
        `${c}: ciao ${n}, promemoria ${s} con ${p} ${d}, ${a}.`,
      smsAsk: "Rispondi SI per confermare o NO per disdire.",
      smsManage: (u: string) => `Gestisci: ${u}`,
    },
    cancelled: {
      subject: (d: string) => `Appuntamento annullato: ${d}`,
      byStaff: "purtroppo lo studio ha dovuto annullare il tuo appuntamento. Puoi prenotare un nuovo orario quando vuoi.",
      byPatient: "il tuo appuntamento è stato annullato come richiesto.",
      sms: (c: string, d: string, u: string) => `${c}: il tuo appuntamento del ${d} è stato annullato. Prenota di nuovo: ${u}`,
      rebook: "Prenota di nuovo",
    },
    rescheduled: {
      subject: (d: string) => `Appuntamento spostato: ${d}`,
      intro: "il tuo appuntamento è stato spostato. Ecco il nuovo orario.",
      sms: (c: string, d: string, u: string) => `${c}: il tuo appuntamento è stato spostato a ${d}. Dettagli: ${u}`,
    },
    replies: {
      confirmed: (c: string, d: string) => `${c}: grazie! Presenza confermata per ${d}. A presto!`,
      cancelled: (c: string, d: string, u: string) =>
        `${c}: appuntamento del ${d} annullato. Per prenotare un nuovo orario: ${u}`,
      reschedule: (c: string, u: string) => `${c}: scegli un nuovo orario qui: ${u}`,
      unknown: (c: string, u: string) =>
        `${c}: non abbiamo capito la risposta. Rispondi SI per confermare o NO per disdire, oppure: ${u}`,
      none: (c: string) => `${c}: non abbiamo trovato appuntamenti futuri associati a questo numero.`,
      stop: (c: string) => `${c}: non riceverai più SMS. Continuerai a ricevere promemoria via email.`,
    },
    waitlist: {
      subject: (d: string) => `Si è liberato un posto: ${d}`,
      intro: (s: string) =>
        `si è liberato un posto per ${s}. È di chi prenota per primo: se ti interessa, prenotalo ora.`,
      sms: (c: string, s: string, d: string, u: string) =>
        `${c}: si è liberato un posto per ${s} ${d}. Primo che prenota: ${u}`,
      cta: "Prenota questo orario",
    },
    review: {
      subject: (c: string) => `Com'è andata da ${c}?`,
      intro: (p: string) =>
        `grazie per la visita con ${p}. La tua recensione verificata aiuta altri pazienti a scegliere. Ci vuole un minuto.`,
      cta: "Lascia una recensione",
    },
  },
  en: {
    greeting: (n: string) => `Hi ${n},`,
    when: "When",
    with: "With",
    service: "Service",
    where: "Where",
    manage: "Manage appointment",
    confirmBtn: "Confirm I'll be there",
    cancelBtn: "Cancel",
    rescheduleBtn: "Reschedule",
    calendarBtn: "Add to calendar",
    footer: (c: string, p: string | null) =>
      `${c}${p ? ` · Tel. ${p}` : ""} — You're receiving this email because you have an appointment with this practice.`,
    booked: {
      subject: (s: string, d: string) => `Appointment booked: ${s}, ${d}`,
      intro: "your appointment is booked. We'll send you a reminder before your visit.",
      sms: (c: string, s: string, p: string, d: string, u: string) =>
        `${c}: booked, ${s} with ${p} ${d}. Manage: ${u}`,
    },
    requested: {
      subject: (s: string) => `Request received: ${s}`,
      intro: "we've received your request. The practice will confirm it shortly and you'll get an email.",
    },
    approved: {
      subject: (s: string, d: string) => `Appointment confirmed by the practice: ${s}, ${d}`,
      intro: "the practice has accepted your request. Here are your appointment details.",
    },
    reminder: {
      subject: (d: string) => `Appointment reminder: ${d}`,
      introAsk: "this is a reminder of your upcoming appointment. Could you confirm you'll be there with one click?",
      intro: "this is a reminder of your upcoming appointment.",
      sms: (n: string, s: string, p: string, d: string, c: string, a: string) =>
        `${c}: hi ${n}, reminder: ${s} with ${p} ${d}, ${a}.`,
      smsAsk: "Reply YES to confirm or NO to cancel.",
      smsManage: (u: string) => `Manage: ${u}`,
    },
    cancelled: {
      subject: (d: string) => `Appointment cancelled: ${d}`,
      byStaff: "unfortunately the practice had to cancel your appointment. You can book a new time whenever you like.",
      byPatient: "your appointment has been cancelled as requested.",
      sms: (c: string, d: string, u: string) => `${c}: your appointment on ${d} was cancelled. Book again: ${u}`,
      rebook: "Book again",
    },
    rescheduled: {
      subject: (d: string) => `Appointment moved: ${d}`,
      intro: "your appointment has been moved. Here is the new time.",
      sms: (c: string, d: string, u: string) => `${c}: your appointment was moved to ${d}. Details: ${u}`,
    },
    replies: {
      confirmed: (c: string, d: string) => `${c}: thanks! You're confirmed for ${d}. See you soon!`,
      cancelled: (c: string, d: string, u: string) => `${c}: your appointment on ${d} is cancelled. Book a new time: ${u}`,
      reschedule: (c: string, u: string) => `${c}: pick a new time here: ${u}`,
      unknown: (c: string, u: string) =>
        `${c}: sorry, we didn't understand. Reply YES to confirm or NO to cancel, or visit: ${u}`,
      none: (c: string) => `${c}: we couldn't find an upcoming appointment for this number.`,
      stop: (c: string) => `${c}: you won't receive more texts. Reminders will continue by email.`,
    },
    waitlist: {
      subject: (d: string) => `A slot just opened up: ${d}`,
      intro: (s: string) =>
        `a slot just opened up for ${s}. It goes to whoever books first, so grab it now if it works for you.`,
      sms: (c: string, s: string, d: string, u: string) => `${c}: a slot opened for ${s} ${d}. First to book gets it: ${u}`,
      cta: "Book this slot",
    },
    review: {
      subject: (c: string) => `How was your visit to ${c}?`,
      intro: (p: string) =>
        `thanks for visiting ${p}. A verified review helps other patients choose with confidence. It takes a minute.`,
      cta: "Leave a review",
    },
  },
} as const;

export function whenLabel(d: AppointmentTemplateData, style: "long" | "short" = "long"): string {
  const date = formatDate(d.start, d.timezone, d.locale, style === "long" ? "long" : "weekday");
  const time = formatTime(d.start, d.timezone, d.locale);
  return d.locale === "it" ? `${date} alle ${time}` : `${date} at ${time}`;
}

/** The appointment emails' layout: greeting, appointment details and the practice footer. */
function layout(opts: {
  d: AppointmentTemplateData;
  intro: string;
  showDetails?: boolean;
  buttons?: EmailButton[];
  details?: [string, string][];
}): { html: string; text: string } {
  const { d } = opts;
  const t = T[tableFor(d.locale)];
  const details: [string, string][] =
    opts.details ??
    (opts.showDetails === false
      ? []
      : [
          [t.when, whenLabel(d)],
          [t.service, d.serviceName],
          [t.with, d.practitionerName],
          [t.where, `${d.locationName}, ${d.address}`],
        ]);
  return renderEmailLayout({
    locale: d.locale,
    brandColor: d.brandColor,
    brandName: d.clinicName,
    greeting: t.greeting(d.patientFirstName),
    intro: opts.intro,
    details,
    buttons: opts.buttons ?? [],
    footerLines: [t.footer(d.clinicName, d.clinicPhone)],
  });
}

function manageButtons(d: AppointmentTemplateData, opts: { confirm?: boolean } = {}): EmailButton[] {
  const t = T[tableFor(d.locale)];
  const cancel: EmailButton = { label: t.cancelBtn, url: `${d.manageUrl}?do=cancel`, variant: "danger" };
  if (opts.confirm) {
    return [
      { label: t.confirmBtn, url: `${d.manageUrl}?do=confirm` },
      { label: t.rescheduleBtn, url: `${d.manageUrl}?do=reschedule`, variant: "secondary" },
      cancel,
    ];
  }
  return [
    { label: t.manage, url: d.manageUrl },
    { label: t.calendarBtn, url: d.icsUrl, variant: "secondary" },
    cancel,
  ];
}

export const templates = {
  bookingConfirmation(d: AppointmentTemplateData): EmailContent {
    const t = T[tableFor(d.locale)];
    const { html, text } = layout({ d, intro: t.booked.intro, buttons: manageButtons(d) });
    return { subject: t.booked.subject(d.serviceName, whenLabel(d, "short")), html, text };
  },

  bookingConfirmationSms(d: AppointmentTemplateData): string {
    return T[tableFor(d.locale)].booked.sms(d.clinicName, d.serviceName, d.practitionerName, whenLabel(d, "short"), d.manageUrl);
  },

  bookingRequested(d: AppointmentTemplateData): EmailContent {
    const t = T[tableFor(d.locale)];
    const { html, text } = layout({ d, intro: t.requested.intro, buttons: [{ label: t.manage, url: d.manageUrl }] });
    return { subject: t.requested.subject(d.serviceName), html, text };
  },

  bookingApproved(d: AppointmentTemplateData): EmailContent {
    const t = T[tableFor(d.locale)];
    const { html, text } = layout({ d, intro: t.approved.intro, buttons: manageButtons(d) });
    return { subject: t.approved.subject(d.serviceName, whenLabel(d, "short")), html, text };
  },

  reminderEmail(d: AppointmentTemplateData, askConfirmation: boolean): EmailContent {
    const t = T[tableFor(d.locale)];
    const { html, text } = layout({
      d,
      intro: askConfirmation ? t.reminder.introAsk : t.reminder.intro,
      buttons: manageButtons(d, { confirm: askConfirmation }),
    });
    return { subject: t.reminder.subject(whenLabel(d, "short")), html, text };
  },

  reminderSms(d: AppointmentTemplateData, askConfirmation: boolean): string {
    const t = T[tableFor(d.locale)];
    const base = t.reminder.sms(
      d.patientFirstName,
      d.serviceName,
      d.practitionerName,
      whenLabel(d, "short"),
      d.clinicName,
      d.address,
    );
    return [base, askConfirmation ? t.reminder.smsAsk : null, t.reminder.smsManage(d.manageUrl)]
      .filter(Boolean)
      .join(" ");
  },

  cancelledEmail(d: AppointmentTemplateData, by: "staff" | "patient", rebookUrl: string): EmailContent {
    const t = T[tableFor(d.locale)];
    const { html, text } = layout({
      d,
      intro: by === "staff" ? t.cancelled.byStaff : t.cancelled.byPatient,
      buttons: [{ label: t.cancelled.rebook, url: rebookUrl }],
    });
    return { subject: t.cancelled.subject(whenLabel(d, "short")), html, text };
  },

  cancelledSms(d: AppointmentTemplateData, rebookUrl: string): string {
    return T[tableFor(d.locale)].cancelled.sms(d.clinicName, whenLabel(d, "short"), rebookUrl);
  },

  rescheduledEmail(d: AppointmentTemplateData): EmailContent {
    const t = T[tableFor(d.locale)];
    const { html, text } = layout({ d, intro: t.rescheduled.intro, buttons: manageButtons(d) });
    return { subject: t.rescheduled.subject(whenLabel(d, "short")), html, text };
  },

  rescheduledSms(d: AppointmentTemplateData): string {
    return T[tableFor(d.locale)].rescheduled.sms(d.clinicName, whenLabel(d, "short"), d.manageUrl);
  },

  waitlistOfferEmail(d: AppointmentTemplateData, bookUrl: string): EmailContent {
    const t = T[tableFor(d.locale)];
    const { html, text } = layout({
      d,
      intro: t.waitlist.intro(d.serviceName),
      buttons: [{ label: t.waitlist.cta, url: bookUrl }],
    });
    return { subject: t.waitlist.subject(whenLabel(d, "short")), html, text };
  },

  waitlistOfferSms(d: AppointmentTemplateData, bookUrl: string): string {
    return T[tableFor(d.locale)].waitlist.sms(d.clinicName, d.serviceName, whenLabel(d, "short"), bookUrl);
  },

  reviewRequest(d: AppointmentTemplateData, reviewUrl: string): EmailContent {
    const t = T[tableFor(d.locale)];
    const { html, text } = layout({
      d,
      intro: t.review.intro(d.practitionerName),
      showDetails: false,
      buttons: [{ label: t.review.cta, url: reviewUrl }],
    });
    return { subject: t.review.subject(d.clinicName), html, text };
  },

  reply: {
    confirmed: (d: AppointmentTemplateData) => T[tableFor(d.locale)].replies.confirmed(d.clinicName, whenLabel(d, "short")),
    cancelled: (d: AppointmentTemplateData, rebookUrl: string) =>
      T[tableFor(d.locale)].replies.cancelled(d.clinicName, whenLabel(d, "short"), rebookUrl),
    reschedule: (d: AppointmentTemplateData) => T[tableFor(d.locale)].replies.reschedule(d.clinicName, `${d.manageUrl}?do=reschedule`),
    unknown: (d: AppointmentTemplateData) => T[tableFor(d.locale)].replies.unknown(d.clinicName, d.manageUrl),
    stop: (locale: Locale, clinicName: string) => T[tableFor(locale)].replies.stop(clinicName),
    none: (locale: Locale, clinicName: string) => T[tableFor(locale)].replies.none(clinicName),
  },
};
