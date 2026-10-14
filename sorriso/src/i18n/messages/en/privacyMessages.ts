/**
 * English source for the privacyMessages namespace: emails and SMS sent by the privacy center and
 * the patient-facing privacy flows (request receipts, contact-change alerts, the Art. 14 notice to
 * an adult someone else booked for). Owned by WP4. Server-only: never sent to the browser.
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
  /** Sent to the old contact when a contact is changed from the privacy center. */
  contactChanged: {
    subject: "Your contact details were changed",
    body: "The {field} on your record at {practice} was changed from the Sorriso privacy center on {date}. If it wasn't you, contact the practice right away.",
    sms: "The {field} on your record at {practice} was changed via the Sorriso privacy center. Not you? Contact the practice.",
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
  fields: {
    phone: "mobile number",
    email: "email address",
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
