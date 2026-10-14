/**
 * English source for the careMessages namespace. Owned by WP8 (care). Server-only namespace: never
 * sent to the browser. Sent with sendPatientMessage() (src/lib/messaging/index.ts): each top-level
 * key is a message kind with its email texts (subject, body, cta) and its SMS texts (sms, smsShort).
 *
 * Discreet in every mode (docs/care.md): no treatment, specialty, practitioner, reason or clinical
 * detail, in the SMS or in the email. A recall never says what the check-up is for. SMS texts use
 * straight quotes, no ellipsis and the shortest natural phrasing (GSM-7 segment budget).
 *
 * Placeholders: {clinic} the practice's name, {when} the visit's date and time already formatted
 * in the recipient's language, {url} the link the message is about, {optout} where to stop recall
 * messages (the privacy center).
 */
export default {
  /** A clinician set a recall interval for this patient and it is due (src/lib/recalls.ts). */
  recall: {
    subject: "{clinic}: time for your regular check-up",
    body: "It's time to book the next regular check-up at {clinic}. Choose a time that suits you online, or call the practice. If you'd rather not receive these reminders, you can opt out at {optout}.",
    cta: "Book your check-up",
    sms: "{clinic}: it's time for your regular check-up. Book: {url} To stop these reminders: {optout}",
    smsShort: "{clinic}: time for your check-up. Book: {url} Stop: {optout}",
  },
  /** The practice closed during the visit and offers other times (src/lib/rebooking.ts). */
  practiceMoved: {
    subject: "{clinic} needs to move your appointment",
    body: "We're sorry: {clinic} can't see you on {when} as planned. Choose a new time in one tap, or ask the practice to call you.",
    cta: "Choose a new time",
    sms: "{clinic}: sorry, we need to move your appointment on {when}. Pick a new time: {url}",
    smsShort: "{clinic}: we need to move your visit on {when}. New time: {url}",
  },
  /** Medical history form before a visit (src/lib/forms.ts). */
  anamnesisInvite: {
    subject: "{clinic}: please fill in your medical history before your visit",
    body: "Before your visit on {when}, please fill in a short medical history form. It takes about three minutes and helps the dentist treat you safely. Your answers are encrypted and only the clinical team can read them.",
    cta: "Fill in the form",
    sms: "{clinic}: before your visit on {when}, please fill in the medical history form: {url}",
    smsShort: "{clinic}: please fill in your medical history before {when}: {url}",
  },
} as const;
