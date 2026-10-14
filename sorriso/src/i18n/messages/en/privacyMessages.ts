/**
 * English source for the privacyMessages namespace: emails and SMS sent by the privacy center and
 * the patient-facing privacy flows (request receipts, contact-change alerts, the Art. 14 notice to
 * an adult someone else booked for, the confirmation they are asked for on Sorriso, and the note to
 * the booker when that confirmation never came). Owned by WP4. Server-only: never sent to the browser.
 *
 * Kinds follow sendPatientMessage's layout (src/lib/messaging/index.ts): subject + body for email,
 * sms for SMS (straight quotes, no ellipsis, short: GSM-7 budget), cta for the email button.
 * Discreet: no treatment, practitioner or health detail in any of them.
 */
export default {
  /** Receipt for a request filed in the privacy center (Art. 12(3): the one-month deadline). */
  requestReceipt: {
    subject: "We received your privacy request",
    body: "{controller} received your request ({type}) on {date}. You will get an answer by {due}. If more time is needed for a complex request, you will be told why before that date.",
    sms: "{controller} received your privacy request ({type}). Answer by {due}.",
  },
  /**
   * Sent to the old contact when it is replaced from the privacy center: by SMS to an old mobile
   * number, by email to an old address. Whole sentences per kind of contact, never a noun slotted
   * into one template (the noun's gender changes the article and agreement in most languages).
   */
  contactChangedPhone: {
    sms: "The mobile number on your record at {practice} was changed via the Sorriso privacy center. Not you? Contact the practice.",
  },
  contactChangedEmail: {
    subject: "Your contact details were changed",
    body: "The email address on your record at {practice} was changed from the Sorriso privacy center on {date}. If it wasn't you, contact the practice right away.",
  },
  /** Art. 14 GDPR: someone else booked for this adult; the notice goes to their own contact. */
  bookedForYou: {
    subject: "An appointment was booked for you at {practice}",
    body: "{booker} booked an appointment for you at {practice} for {when}. The practice uses your details to manage it. Here is how your data are processed and what your rights are, including how to see, correct or delete them.",
    cta: "Read the privacy notice",
    sms: "{booker} booked an appointment for you at {practice} for {when}. Privacy notice: {url}",
  },
  /** Marketplace booking for another adult: only they can confirm and consent (critique 2). */
  confirmBooking: {
    subject: "Please confirm the appointment booked for you",
    body: "{booker} booked an appointment for you at {practice} for {when} through Sorriso. Only you can confirm it and agree to how Sorriso handles the booking. If you don't confirm it within {hours} hours, it will be cancelled.",
    cta: "Confirm or decline",
    sms: "{booker} booked an appointment for you at {practice} via Sorriso. Confirm within {hours}h: {url}",
  },
  /**
   * To whoever booked for another adult on Sorriso, when that adult didn't confirm in time and the
   * held booking was cancelled. {name} is the first name the booker typed.
   */
  adultNotConfirmed: {
    subject: "The appointment you booked was cancelled",
    body: "The appointment you booked for {name} at {practice} for {when} was cancelled, because {name} didn't confirm it in time. Only the patient can confirm a booking made for them on Sorriso: they can book again themselves.",
    sms: "The appointment you booked for {name} at {practice} for {when} was cancelled: {name} didn't confirm it in time.",
  },
  requestTypes: {
    access: "access to your data",
    rectification: "correction of your data",
    erasure: "erasure of your data",
    restriction: "restriction of processing",
    portability: "a copy of your data to take elsewhere",
    objection: "objection to processing",
    consent_withdrawal: "withdrawal of consent",
  },
  footer: {
    privacyCenter: "You receive this message because of a request made in the Sorriso privacy center.",
  },
} as const;
