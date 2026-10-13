/**
 * Every consent and objection text shown to patients, one entry per CONSENT_PURPOSES value.
 * Frozen and owned by the lead: packages render these keys exactly (the consent ledger stores
 * the key and CONSENT_TEXT_VERSION as proof of what was shown), and never write their own.
 *
 * ITALIAN IS AUTHORITATIVE. it/consents.ts is the reference text; this English file and every
 * other locale are translations of it. Drafts: a DPO or privacy lawyer must review all of them
 * before go-live, and any change to a text needs a new CONSENT_TEXT_VERSION.
 *
 *   title        a few words, for toggles, ledgers and the privacy center
 *   label        the statement next to the (unticked) checkbox or toggle
 *   description  what it means, who processes the data, and how to withdraw or object
 */
import type { ConsentPurpose } from "@/db/enums";

type Text = { title: string; label: string; description: string };

export default {
  platform_booking_art9: {
    title: "Booking through Sorriso",
    label:
      "I consent to Sorriso processing the data about my booking, which may reveal information about my health, to forward it to the chosen practice and to manage reminders and changes.",
    description:
      "Needed only when you book from Sorriso's search pages: for this service Sorriso is an independent controller (Art. 9(2)(a) GDPR). You can withdraw at any time from the privacy center. Sorriso then stops its own processing, while the practice keeps the data it needs to treat you. Withdrawal does not affect processing carried out before it. If you prefer not to consent, you can book directly with the practice.",
  },
  whatsapp_channel: {
    title: "WhatsApp messages",
    label: "I agree to receive messages about my appointments on WhatsApp.",
    description:
      "WhatsApp is run by Meta. Messages are sent through Twilio and may be processed in the United States, under the EU-US Data Privacy Framework and standard contractual clauses. Meta can see that you are in contact with this practice. You can go back to SMS or email at any time.",
  },
  sms_channel: {
    title: "SMS messages",
    label: "Send me appointment confirmations and reminders by SMS.",
    description:
      "These messages are part of the booking service and contain only what is needed: practice, date, time and a link. You can stop them at any time by replying STOP or from your preferences.",
  },
  email_channel: {
    title: "Emails",
    label: "Send me appointment confirmations and reminders by email.",
    description:
      "These emails are part of the booking service. You can stop them at any time with the unsubscribe link in every email or from your preferences.",
  },
  feedback_request: {
    title: "Feedback invitations",
    label: "After the visit, send me a short invitation to leave feedback.",
    description:
      "You will receive a single message a few days after the appointment. Leaving feedback is optional. You can withdraw this consent at any time.",
  },
  review_publication: {
    title: "Publishing my review",
    label:
      "I consent to this review being published on Sorriso and on {practice}'s page. It shows I had a visit with {practitioner}. I can delete it at any time from the privacy center.",
    description:
      "By default your review appears as 'Verified patient'. Don't include details about your health: reviews that contain them are checked before publication. If you withdraw your consent, the review is removed.",
  },
  marketing: {
    title: "News and offers",
    label: "I would like to receive news and offers from {practice}.",
    description:
      "Optional: not needed to book or to receive care. You can withdraw at any time from any message or from the privacy center. Consent lapses after 24 months without contact.",
  },
  adaptive_reminders: {
    title: "Adaptive reminders",
    label: "Adjust the timing and number of my reminders based on my past appointments.",
    description:
      "The practice may send you an extra reminder when an appointment is more likely to be missed, based on your appointment history. This is profiling based on legitimate interest and never limits your ability to book. You can object at any time: you will then receive the standard reminders.",
  },
  no_show_tracking: {
    title: "Missed-appointment history",
    label: "The practice may record appointments I miss.",
    description:
      "Missed appointments from the last 24 months are counted to organise the schedule and to offer you help, such as an extra reminder. They never stop you from booking. You can object at any time.",
  },
  recalls: {
    title: "Check-up recalls",
    label: "Remind me when my dentist recommends a check-up.",
    description:
      "Recalls are sent only when your dentist has set a check-up interval for you. Every recall includes a way to stop them. You can object at any time.",
  },
} as const satisfies Record<ConsentPurpose, Text>;
