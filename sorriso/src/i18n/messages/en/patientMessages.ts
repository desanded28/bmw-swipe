/**
 * English source for the patientMessages namespace: appointment emails, SMS and WhatsApp fallbacks,
 * replies to patients' texts and calendar invites. Owned by WP3 (messaging). Server-only namespace:
 * never sent to the browser. Rendered by src/lib/messaging/templates.ts; see docs/messaging.md.
 *
 * Rules for every locale:
 * - Discreet by default. Subjects, `sms*` texts and `ics.*` name only the practice, the date and
 *   time, the address and the link: never the treatment, the practitioner or a note. Only the
 *   `*Detailed` variants may use {service} and {practitioner}; they are used only when the practice
 *   chose detailed messages, the treatment is not sensitive and the patient's contact is verified.
 * - SMS texts use straight quotes and no ellipsis character. `sms` is the full text; `smsShort` is
 *   sent when the full one would go over the segment budget (2 GSM-7 or 3 UCS-2 segments): no
 *   address, the date as {slot}, and only plain ASCII letters so that it stays in GSM-7.
 * - Email bodies follow the greeting ("Hi Emma,"), so they start in lower case where a language
 *   continues a sentence after the greeting's comma.
 * - The confirm and cancel words in SMS must be words src/lib/inbound.ts understands (KEYWORDS).
 */
export default {
  format: {
    /** Numeric date and time used by the shortest SMS texts. */
    slot: "{day}/{month} {time}",
  },

  /** Shared parts of the appointment emails. */
  email: {
    greeting: "Hi {name},",
    when: "When",
    where: "Where",
    service: "Service",
    with: "With",
    patient: "Patient",
    manage: "Manage appointment",
    confirm: "Confirm I'll be there",
    cancel: "Cancel",
    reschedule: "Reschedule",
    calendar: "Add to calendar",
    detailsOnline: "You'll find all the details of your visit on your appointment page.",
  },

  /** The footer of every patient email: who sent it, why, and where to manage privacy choices. */
  privacyFooter: {
    sender: "{name} · {address}",
    phone: "Tel. {phone}",
    why: "You're receiving this email because you have an appointment at {clinic}.",
    whyGuardian: "You're receiving this email because you're the contact for {patient}'s appointments at {clinic}.",
    whyWaitlist: "You're receiving this email because you joined the waiting list at {clinic}.",
    whyGeneric: "You're receiving this email because you're a patient of {clinic}.",
    object:
      "You can object to reminders or withdraw any consent at any time from your privacy choices, or by replying STOP to our text messages.",
    notice: "Privacy notice",
    preferences: "Your privacy choices",
  },

  booked: {
    subject: "Appointment booked - {clinic} - {date}",
    subjectDetailed: "Appointment booked: {service}, {date}",
    body: "your appointment is booked. We'll send you a reminder before your visit.",
    sms: "{clinic}: appointment booked for {when}. Manage: {url} Privacy notice: {privacy} Reply STOP to opt out",
    smsShort: "{clinic}: booked for {slot}. Manage: {url}",
    smsDetailed: "{clinic}: booked, {service} with {practitioner} {when}. Manage: {url} Reply STOP to opt out",
  },

  requested: {
    subject: "Request received - {clinic} - {date}",
    subjectDetailed: "Request received: {service}",
    body: "we've received your request. The practice will confirm it shortly and you'll get an email.",
  },

  approved: {
    subject: "Appointment confirmed - {clinic} - {date}",
    subjectDetailed: "Appointment confirmed by the practice: {service}, {date}",
    body: "the practice has accepted your request. Here are your appointment details.",
    sms: "{clinic}: your appointment on {when} is confirmed. Manage: {url} Privacy notice: {privacy} Reply STOP to opt out",
    smsShort: "{clinic}: confirmed for {slot}. Manage: {url}",
  },

  reminder: {
    subject: "Appointment reminder - {clinic} - {date}",
    subjectDetailed: "Appointment reminder: {service}, {date}",
    body: "this is a reminder of your upcoming appointment.",
    bodyAsk: "this is a reminder of your upcoming appointment. Could you confirm you'll be there with one click?",
    sms: "{clinic}: appointment reminder {when}, {address}. Details: {url} Reply STOP to opt out",
    smsAsk:
      "{clinic}: appointment reminder {when}, {address}. Reply YES to confirm, NO to cancel. Details: {url} Reply STOP to opt out",
    smsShort: "{clinic}: appointment {slot}. Details: {url}",
    smsAskShort: "{clinic}: appointment {slot}. YES to confirm, NO to cancel. {url}",
    smsDetailed: "{clinic}: hi {name}, reminder: {service} with {practitioner} {when}, {address}. Details: {url}",
    smsAskDetailed:
      "{clinic}: hi {name}, reminder: {service} with {practitioner} {when}, {address}. Reply YES to confirm, NO to cancel. Details: {url}",
  },

  cancelled: {
    subject: "Appointment cancelled - {clinic} - {date}",
    body: "your appointment has been cancelled as requested.",
    bodyByPractice: "unfortunately the practice had to cancel your appointment. You can book a new time whenever you like.",
    sms: "{clinic}: your appointment on {when} was cancelled. Book again: {url}",
    smsShort: "{clinic}: appointment {slot} cancelled. {url}",
    rebook: "Book again",
  },

  rescheduled: {
    subject: "Appointment moved - {clinic} - {date}",
    subjectDetailed: "Appointment moved: {service}, {date}",
    body: "your appointment has been moved. Here is the new time.",
    sms: "{clinic}: your appointment was moved to {when}, {address}. Details: {url}",
    smsShort: "{clinic}: appointment moved to {slot}. {url}",
  },

  /** A freed slot offered to the waiting list. Always discreet: no treatment, whatever the content level. */
  waitlist: {
    subject: "A slot just opened up - {clinic} - {date}",
    body: "a slot just opened up on {when}. It goes to whoever books first, so grab it now if it works for you.",
    sms: "{clinic}: a slot opened on {when}. First to book gets it: {url}",
    smsShort: "{clinic}: free slot {slot}: {url}",
    cta: "Book this slot",
  },

  review: {
    subject: "How was your visit to {clinic}?",
    body: "thanks for your visit. A verified review helps other patients choose with confidence. It takes a minute.",
    bodyDetailed: "thanks for visiting {practitioner}. A verified review helps other patients choose with confidence. It takes a minute.",
    cta: "Leave a review",
  },

  /** Automatic answers to a patient's SMS or WhatsApp reply (`*Short`: as for `smsShort`). */
  replies: {
    confirmed: "{clinic}: thanks! You're confirmed for {when}. See you soon!",
    confirmedShort: "{clinic}: thanks, confirmed for {slot}.",
    cancelled: "{clinic}: your appointment on {when} is cancelled. Book a new time: {url}",
    cancelledShort: "{clinic}: appointment {slot} cancelled. Book again: {url}",
    reschedule: "{clinic}: pick a new time here: {url}",
    unknown: "{clinic}: sorry, we didn't understand. Reply YES to confirm or NO to cancel, or visit: {url}",
    none: "{clinic}: we couldn't find an upcoming appointment for this number.",
    stop: "{clinic}: you won't receive more texts from us. Reply START to turn them back on.",
    start: "{clinic}: text messages are back on. Reply STOP to turn them off.",
  },

  /** After the patient turned a channel off (RFC 8058 one-click unsubscribe, privacy center, STOP). */
  unsubscribeConfirmation: {
    subject: "Your message preferences - {clinic}",
    body: "you won't receive {channel} messages about your appointments from {clinic} any more. You can change this at any time from your privacy choices.",
    cta: "Your privacy choices",
    sms: "{clinic}: you won't receive more texts from us. Reply START to turn them back on.",
  },

  /**
   * Communication of a personal data breach to the data subject (GDPR Art. 34): in clear and plain
   * language, the nature of the breach, the contact point (DPO), the likely consequences and the
   * measures taken or proposed. Draft: to be reviewed by the DPO before use (docs/messaging.md).
   */
  breachNotice: {
    subject: "Important: a security incident involving your data - {clinic}",
    body: "we're writing to tell you about a personal data breach that may affect you. We take it seriously, and we want you to know what happened and what we are doing about it.",
    what: "What happened",
    when: "When",
    data: "Data involved",
    consequences: "What it may mean for you",
    measures: "What we have done",
    advice: "What you can do",
    contact: "Questions",
    contactValue: "Contact our data protection officer: {dpo}",
    sms: "{clinic}: important notice about your personal data. Please read it carefully: {url}",
  },

  /** Calendar invites (.ics): discreet in every mode. */
  ics: {
    summary: "Appointment – {clinic}",
    phone: "Tel. {phone}",
  },

  /** Sample data for the dashboard's message preview. */
  preview: {
    sampleFirstName: "Emma",
  },
} as const;
