/**
 * English source for the reminders namespace: the dashboard's Reminders and Messages pages, the
 * rules editor, the message preview and the reply simulator. Owned by WP3 (messaging).
 */
import { p } from "../../plural";

export default {
  page: {
    title: "Reminders & confirmations",
    description: "When and how patients are reminded. Replies to text reminders update the calendar automatically.",
  },

  schedule: {
    title: "Reminder schedule",
    current: "Current reminders",
    none: "No reminders: patients get only the booking confirmation.",
    confirmNote: "Once a patient confirms, later reminders stop asking.",
    asks: "asks to confirm",
    channel: {
      email: "Email",
      text: "Text message",
    },
    offset: {
      days: p({ one: "{count} day before", other: "{count} days before" }),
      hours: p({ one: "{count} hour before", other: "{count} hours before" }),
      minutes: p({ one: "{count} minute before", other: "{count} minutes before" }),
    },
    risk: {
      medium: "only medium or high no-show risk",
      high: "only high no-show risk",
    },
  },

  rules: {
    channelLabel: "Channel",
    channelEmail: "Email",
    channelText: "Text (SMS, or WhatsApp where the patient chose it)",
    amountLabel: "How long before",
    unitLabel: "Unit",
    hoursBefore: "hours before",
    daysBefore: "days before",
    askConfirmation: "Ask to confirm (reply YES/NO)",
    fallbackToEmail: "Email if no mobile",
    riskLabel: "Send for",
    riskAll: "Every appointment",
    riskMedium: "Medium or high no-show risk only",
    riskHigh: "High no-show risk only",
    riskOff: "Risk-based reminders are off in the privacy settings, so rules limited by risk are never sent.",
    riskObjection: "Patients who objected to adaptive reminders count as no risk.",
    remove: "Remove reminder {number}",
    rule: "Reminder {number}",
    add: "Add reminder",
    max: "Up to 6 reminders.",
    flagsTitle: "Other messages",
    sendBookingConfirmation: "Send a booking confirmation with a calendar invite right after booking",
    autoOfferToWaitlist: "Offer freed-up slots to matching waitlist patients automatically",
    requestReviews: "Ask for a verified review 2 hours after a visit is marked completed",
    requestReviewsHint: "Only patients who agreed to be asked for feedback get this email.",
    smsAsciiFallback: "Send Spanish, Portuguese, French, Romanian and Polish texts without accents",
    smsAsciiFallbackHint:
      "Accented letters such as ą or ș make a text cost up to twice as much. Without them, a reminder fits in fewer SMS segments.",
    save: "Save reminder rules",
    runNow: "Send due reminders now",
    readOnly: "Only owners and admins can change the reminder rules.",
  },

  stats: {
    title: "Last 30 days",
    sent: "Sent",
    pending: "Scheduled",
    skipped: "Skipped",
    failed: "Failed",
    hint: "Skipped: the appointment was cancelled or moved, the patient can't be reached on that channel, or a rule didn't apply.",
  },

  inbound: {
    title: "Reply number",
    description:
      "With a number of your own (in Sorriso's Twilio account), your texts go out from it and patients' replies come back to it, so a reply can never be taken for another practice's. Without one, texts use the shared sender and a reply goes to the practice that texted the patient last from it.",
    label: "Your number or Twilio Messaging Service",
    placeholder: "+39 02 1234 5678",
    hint: "International format, e.g. +39 02 1234 5678, or a Messaging Service SID (MG…). Leave empty to use the shared sender.",
    save: "Save reply number",
    ownerOnly: "Only the practice owner can change the reply number.",
  },

  providers: {
    title: "Delivery providers",
    email: "Email",
    sms: "SMS",
    whatsapp: "WhatsApp",
    captured: "Demo: captured",
    live: "Live via {provider}",
    emailEnv: "Any SMTP service with an EU region",
    smtpTls: "STARTTLS required, TLS 1.2 or later",
    smtpNoTls: "TLS is not enforced (SMTP_REQUIRE_TLS=0): only for a local test server",
    smsRegion: "Twilio {region} region via the {edge} edge (EU data residency)",
    smsDefaultRegion: "Twilio's default US1 region: set TWILIO_REGION=ie1 and TWILIO_EDGE=dublin for EU data residency",
    whatsappTemplates: p({
      one: "{count} approved template (kind and language)",
      other: "{count} approved templates (kind and language)",
    }),
    whatsappNoTemplates: "No approved templates: WhatsApp patients get SMS until templates are configured.",
    repliesTitle: "Two-way replies",
    repliesBody: "In Twilio, set “A message comes in” for your number or WhatsApp sender to:",
  },

  preview: {
    title: "Message preview",
    languageLabel: "Patient's language",
    discreet: "Discreet messages: no treatment, practitioner or notes in texts, email subjects or calendar entries.",
    detailed:
      "Detailed messages: texts and emails may name the treatment and the practitioner, but only for treatments not marked sensitive and patients whose contact is verified. Everyone else gets the discreet version.",
    reminderAsk: "Reminder asking to confirm",
    reminder: "Reminder after the patient confirmed",
    patientReply: "Patient's reply",
    automaticAnswer: "Automatic answer",
    segments: p({ one: "{count} SMS segment", other: "{count} SMS segments" }),
    characters: p({ one: "{encoding}, {count} character", other: "{encoding}, {count} characters" }),
    overBudget: "Longer than the budget of 2 GSM-7 or 3 UCS-2 segments",
    asciiOn: "Sent without accents (the fallback is on)",
    emailTitle: "Email",
    subject: "Subject: {subject}",
    emailFrame: "Email preview in {language}",
    sampleNote: "Sample data; links lead nowhere.",
  },

  replies: {
    title: "Replies we understand",
    description:
      "Patients can answer in their own language. A message in another language is understood only when it is a single one of these words; anything else is flagged for the front desk.",
    language: "Language",
    confirm: "Confirm",
    cancel: "Cancel",
    reschedule: "New time",
    stop: "Stop texts",
    start: "Texts back on",
    emoji: "👍 confirms and 👎 cancels in every language.",
  },

  messages: {
    title: "Messages",
    description: "Every reminder, confirmation and patient reply, across email, SMS and WhatsApp.",
    filters: "Filter messages",
    all: "All",
    inbound: "Patient replies",
    attention: "Not understood",
    empty: "No messages yet",
    received: "Received",
    sentLabel: "Sent",
    reply: "Reply: {intent}",
    showEmail: "Show email",
    hideEmail: "Hide email",
    emailFrame: "Email: {subject}",
    unknownSender: "Unknown number",
    redacted: "Content removed by the retention policy",
    /** Stands in for a patient's personal link (manage page, calendar file) in a message shown to staff. */
    linkRedacted: "[patient link]",
    /** Instead of the name and the text of a restricted (GDPR Art. 18) or erased patient's message. */
    restrictedPatient: "Restricted patient",
    restrictedBody: "This patient's data is restricted (GDPR Art. 18). Open their appointment in the calendar and give a reason to see these messages.",
    status: {
      sent: "Sent",
      delivered: "Delivered",
      failed: "Failed",
      received: "Received",
      captured: "Captured (not sent)",
    },
    intent: {
      confirm: "confirmed",
      cancel: "cancelled",
      reschedule: "wants a new time",
      unknown: "not understood",
      stop: "stopped texts",
      start: "texts back on",
    },
  },

  simulator: {
    title: "Try the two-way flow",
    description: "Pretend a patient answered their reminder. The calendar updates exactly as it will with real Twilio replies.",
    demoOnly: "The reply simulator is available in demo mode only.",
    noPatients: "No upcoming appointments with a mobile number.",
    patient: "Patient with an upcoming visit",
    patientOption: "{name}, next visit {when}",
    reply: "Their reply",
    via: "Via",
    examples: "Examples",
    submit: "Simulate reply",
  },

  actions: {
    saved: "Reminder rules saved. They apply to new bookings and anything you reschedule.",
    ran: p({
      one: "Processed {count} due reminder: {sent} sent, {skipped} skipped, {failed} failed.",
      other: "Processed {count} due reminders: {sent} sent, {skipped} skipped, {failed} failed.",
    }),
    inboundSaved: "Reply number saved.",
    inboundCleared: "Reply number removed: replies now come through the shared sender.",
    inboundInvalid: "Enter a phone number in international format (+39…) or a Messaging Service SID (MG…).",
    inboundTaken: "This number is already used by another practice.",
    inboundShared:
      "This is Sorriso's shared sender, which every practice's patients reply to. Enter a number or Messaging Service set aside for your practice.",
    ownerOnly: "Only the practice owner can change the reply number.",
    invalidPhone: "Enter a valid phone number.",
    noPatient: "No patient of this practice has that number.",
    demoOnly: "The reply simulator is available in demo mode only.",
    simulated: "Understood as “{intent}”.",
    simulatedReply: "Understood as “{intent}”. Automatic answer: {reply}",
  },
} as const;
