/**
 * English source for the dashboard namespace. Owned by WP2 (dashboard): the staff area's shell
 * (navigation, language, toasts, not-found page), the overview, the confirmations board and the
 * waitlist.
 */
import { p } from "../../plural";

export default {
  meta: {
    title: "Dashboard",
    /** Browser tab title of a dashboard page: {page} is the page title, {app} the product name. */
    template: "{page} · {app}",
  },
  skipToContent: "Skip to main content",

  nav: {
    label: "Dashboard",
    overview: "Overview",
    calendar: "Calendar",
    confirmations: "Confirmations",
    messages: "Messages",
    patients: "Patients",
    waitlist: "Waitlist",
    recalls: "Recalls",
    reviews: "Reviews",
    analytics: "Analytics",
    team: "Team & hours",
    services: "Treatments",
    locations: "Offices & chairs",
    reminders: "Reminders",
    settings: "Settings",
    funds: "Health funds",
    api: "API",
    privacyRequests: "Privacy requests",
    privacySettings: "Privacy settings",
    audit: "Audit log",
    security: "My security",
    platform: "Platform",
    groups: {
      setup: "Setup",
      privacy: "Privacy",
      account: "Account",
    },
    /** Screen-reader text of the counter next to a navigation entry. */
    count: p({ one: "{count} to handle", other: "{count} to handle" }),
  },

  sidebar: {
    home: "Dashboard overview",
    publicPage: "Public page",
    publicPageNewTab: "Your public page (opens in a new tab)",
    switchPractice: "Switch practice",
    logout: "Log out",
    language: "Dashboard language",
    languageAuto: "Automatic ({language})",
  },

  language: {
    saved: "Language saved.",
    invalid: "Choose one of the listed languages.",
  },

  toast: {
    region: "Notifications",
    dismiss: "Dismiss",
  },

  form: {
    saved: "Saved.",
  },

  notFound: {
    title: "Page not found",
    body: "This dashboard page doesn't exist or has moved.",
    back: "Back to the overview",
  },

  denied: "You don't have permission to open that page. Ask an owner or an admin of the practice if you need it.",

  overview: {
    title: "Overview",
    greeting: {
      morning: "Good morning, {name}",
      afternoon: "Good afternoon, {name}",
      evening: "Good evening, {name}",
    },
    subtitle: "{date} · {practice}",
    openCalendar: "Open calendar",
    welcome: {
      title: "Welcome! Four steps to go live",
      team: "Add your dentists and hygienists, with their hours at each office",
      services: "Set treatments, durations and prices",
      reminders: "Choose when reminders go out (SMS, WhatsApp, email)",
      widget: "Embed the booking widget on your website",
    },
    stats: {
      today: "Today",
      todayHint: p({ one: "{count} confirmed or done", other: "{count} confirmed or done" }),
      tomorrow: "Confirmed for tomorrow",
      tomorrowHint: "{confirmed} of {total} · {open} to chase",
      noShow: "No-show rate (30 days)",
      noShowHint: "No-shows: {noShows} · visits: {visits}",
      online: "Online bookings (7 days)",
      onlineHint: "Refilled from the waitlist (30 days): {refilled} · waiting: {waiting}",
      none: "–",
    },
    demo: {
      all: "Demo mode: emails, SMS and WhatsApp messages are captured on the Messages page instead of being delivered.",
      email: "Demo mode: emails are captured on the Messages page instead of being delivered.",
      text: "Demo mode: SMS and WhatsApp messages are captured on the Messages page instead of being delivered.",
      connect: "Connect providers",
    },
    attention: "Needs your attention",
    attentionCount: p({ one: "{count} appointment", other: "{count} appointments" }),
    agenda: "Today's agenda",
    noneToday: "No appointments today.",
    tomorrowLink: "Tomorrow's confirmations",
  },

  confirmations: {
    title: "Confirmations",
    tabs: {
      label: "Which appointments",
      tomorrow: "Tomorrow",
      week: "Next 7 days",
      requests: "Online requests",
      outcome: "Record outcome",
      cancelled: "Recently cancelled",
    },
    descriptions: {
      tomorrow: "Who's coming tomorrow. Chase the ones still awaiting confirmation: patients with past no-shows are flagged.",
      week: "Everything booked for the coming week.",
      requests: "Online bookings waiting for your approval (when the practice reviews online bookings).",
      outcome: "Past visits without an outcome. Mark them completed (this sends the review request) or no-show.",
      cancelled: "Upcoming slots freed by cancellations. Matching waitlist patients were offered them automatically.",
    },
    onlyPending: "Only awaiting confirmation ({count})",
    riskSorted: "Unconfirmed visits with a higher no-show risk are listed first on each day.",
    empty: "Nothing to show here.",
  },

  waitlist: {
    title: "Waitlist",
    description:
      "When an appointment is cancelled or moved, the slot is offered to up to 3 matching patients by SMS, WhatsApp or email. The first one to book gets it.",
    emptyTitle: "Nobody is waiting",
    emptyBody: "Patients can join from the booking page when no time suits them.",
    waiting: "Waiting",
    anyPractitioner: "Any practitioner",
    anyOffice: "Any office",
    preference: "{practitioner} · {office}",
    window: "{from} – {to}",
    partOfDay: {
      any: "Any time",
      morning: "Mornings",
      afternoon: "Afternoons",
    },
    offers: p({ one: "{count} offer sent", other: "{count} offers sent" }),
    remove: "Remove",
    removeConfirm: "Remove this patient from the waitlist?",
    note: "Patient's note: {note}",
    restricted: "Restricted record: contact details and the note are hidden.",
    openRecord: "Open the patient record (a reason is required)",
    booked: "Recently booked from the waitlist",
    bookedBadge: "Booked",
  },
} as const;
