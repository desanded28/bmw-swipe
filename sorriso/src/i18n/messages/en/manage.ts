/**
 * English source for the manage namespace: the patient's appointment page (/{locale}/a/<token>),
 * reached from the link in every confirmation and reminder, and its error screens. Owned by WP1.
 *
 * The page title and preview texts are generic on purpose: link previews (messaging apps, mail
 * scanners) must not show the practice, the treatment or the patient.
 */
import { p } from "../../plural";

export default {
  meta: {
    title: "Your appointment",
    description: "See, confirm, move or cancel your appointment.",
  },
  greeting: "Hello {name},",
  title: "Your appointment at {clinic}",
  status: {
    cancelled: "Cancelled",
    requested: "Waiting for the practice to confirm",
    completed: "Completed",
    no_show: "Missed",
    confirmed: "Booked and confirmed",
    pending: "Booked: please confirm",
  },
  details: {
    when: "When",
    timeRange: "{start}–{end}",
    treatment: "Treatment",
    where: "Where",
    address: "{address}, {city}",
    phone: "Phone",
  },
  confirm: {
    title: "Will you be there?",
    body: "Confirming helps {clinic} plan the day, and keeps your time.",
    button: "Yes, I'll be there",
    done: "Thank you! Your attendance is confirmed.",
  },
  reschedule: {
    button: "Reschedule",
    title: "Pick a new time with {practitioner}",
    moveTo: "Move your appointment to {when}?",
    confirm: "Confirm the new time",
    done: "Done: your appointment has been moved.",
    closed: p({
      one: "Online rescheduling closes {count} hour before the visit.",
      other: "Online rescheduling closes {count} hours before the visit.",
    }),
    call: "To move it, call <tel>{phone}</tel>.",
  },
  cancel: {
    button: "Cancel appointment",
    title: "Cancel this appointment?",
    late: p({
      one: "Your visit is less than {count} hour away. Cancelling still frees the time for someone on the waitlist: thank you for letting us know.",
      other: "Your visit is less than {count} hours away. Cancelling still frees the time for someone on the waitlist: thank you for letting us know.",
    }),
    body: "Your time will be offered to patients on the waitlist.",
    reason: "Reason",
    reasonHint: "Optional. Visible only to the practice. Don't include health details.",
    confirm: "Yes, cancel it",
    keep: "Keep it",
    done: "Your appointment has been cancelled.",
  },
  calendar: {
    appleOutlook: "Apple / Outlook",
    google: "Google Calendar",
  },
  review: {
    title: "How was your visit?",
    button: "Leave a review",
  },
  rebook: "Book another appointment",
  privateLink: "Keep this link private: anyone who has it can manage this appointment.",
  clinicPage: "Page of {clinic}",
  invalid: {
    title: "This link doesn't work",
    body: "It may be incomplete or mistyped. Check that you opened the whole link from your message, or contact your practice.",
  },
  expired: {
    title: "This link has expired",
    body: "For your privacy, appointment links stop working some time after the visit. To book again or ask about a past visit, contact your practice directly.",
    privacyCenter: "To see the data practices hold about you, use the privacy center.",
  },
  rateLimited: {
    title: "Too many requests",
    body: p({
      one: "This page was opened too many times in a short time. Please try again in {count} minute.",
      other: "This page was opened too many times in a short time. Please try again in {count} minutes.",
    }),
  },
  preview: {
    title: "Your appointment",
    body: "Open this link in your browser to see and manage your appointment.",
  },
  home: "Go to the home page",
} as const;
