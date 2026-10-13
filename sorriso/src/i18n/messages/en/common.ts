/**
 * Shared words used across every surface. Owned by the lead (frozen): packages read these keys
 * but add their own texts to their own namespaces.
 *
 * SMS texts (otp.sms) use straight quotes only and no ellipsis character, to stay in GSM-7.
 */
import type {
  AppointmentStatus,
  Channel,
  ConfirmationStatus,
  MembershipRole,
  ServiceCategory,
  SpokenLanguage,
} from "@/db/enums";
import { p } from "../../plural";

/** Keys that must cover an enum exactly (other groups are free-form). */
type Contract = Record<string, unknown> & {
  appointmentStatus: Record<AppointmentStatus, string>;
  confirmationStatus: Record<ConfirmationStatus, string>;
  channels: Record<Channel, string>;
  categories: Record<ServiceCategory, string>;
  roles: Record<MembershipRole, string>;
  languages: Record<SpokenLanguage, string>;
};

export default {
  actions: {
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    back: "Back",
    next: "Next",
    continue: "Continue",
    close: "Close",
    confirm: "Confirm",
    edit: "Edit",
    delete: "Delete",
    remove: "Remove",
    add: "Add",
    search: "Search",
    retry: "Try again",
    copy: "Copy",
    copied: "Copied",
    submit: "Submit",
    send: "Send",
    apply: "Apply",
    clear: "Clear",
    download: "Download",
    showMore: "Show more",
    showLess: "Show less",
    open: "Open",
    select: "Select",
  },
  words: {
    loading: "Loading…",
    yes: "Yes",
    no: "No",
    optional: "Optional",
    required: "Required",
    or: "or",
    none: "None",
    all: "All",
    on: "On",
    off: "Off",
  },
  units: {
    minutesShort: "{count} min",
    minutes: p({ one: "{count} minute", other: "{count} minutes" }),
    hours: p({ one: "{count} hour", other: "{count} hours" }),
    days: p({ one: "{count} day", other: "{count} days" }),
    weeks: p({ one: "{count} week", other: "{count} weeks" }),
    months: p({ one: "{count} month", other: "{count} months" }),
  },
  appointmentStatus: {
    requested: "Requested",
    scheduled: "Scheduled",
    completed: "Completed",
    no_show: "No-show",
    cancelled: "Cancelled",
  },
  confirmationStatus: {
    pending: "Awaiting confirmation",
    confirmed: "Confirmed",
    declined: "Declined",
  },
  channels: {
    sms: "SMS",
    whatsapp: "WhatsApp",
    email: "Email",
  },
  categories: {
    checkup: "Check-up & first visit",
    hygiene: "Cleaning & hygiene",
    orthodontics: "Orthodontics & aligners",
    implants: "Implants",
    aesthetic: "Whitening & aesthetic",
    endodontics: "Root canal",
    pediatric: "Children's dentistry",
    surgery: "Oral surgery",
    emergency: "Dental emergency",
    prosthetics: "Crowns & prosthetics",
  },
  roles: {
    owner: "Owner",
    admin: "Admin",
    reception: "Reception",
    practitioner: "Practitioner",
  },
  /** Names of spoken languages (ISO 639-1), in the reader's language. */
  languages: {
    it: "Italian",
    en: "English",
    de: "German",
    fr: "French",
    es: "Spanish",
    pt: "Portuguese",
    ro: "Romanian",
    pl: "Polish",
    sq: "Albanian",
    uk: "Ukrainian",
    ru: "Russian",
    ar: "Arabic",
    zh: "Chinese",
    hi: "Hindi",
    bn: "Bengali",
    ur: "Urdu",
    tl: "Filipino",
    nl: "Dutch",
    el: "Greek",
    hr: "Croatian",
    sr: "Serbian",
    sl: "Slovenian",
    hu: "Hungarian",
    cs: "Czech",
    sk: "Slovak",
    bg: "Bulgarian",
    tr: "Turkish",
    fa: "Persian",
    he: "Hebrew",
    ja: "Japanese",
  },
  price: {
    onRequest: "Price on request",
    free: "Free",
    from: "from {price}",
  },
  /** One-time codes (sendOtp). No personal data: the code is the only variable. */
  otp: {
    sms: "{code} is your Sorriso verification code. It expires in 5 minutes. Never share it.",
    emailSubject: "Your Sorriso verification code",
    emailIntro: "Your verification code is:",
    emailBody: "It expires in 5 minutes. Never share it with anyone: Sorriso and your practice will never ask you for it.",
    emailIgnore: "If you didn't request this code, you can ignore this email.",
  },
  errors: {
    network: "We couldn't reach the server. Check your connection and try again.",
    notFound: "We couldn't find what you were looking for.",
    forbidden: "You don't have permission to do this.",
    rateLimited: "Too many attempts. Please wait a few minutes and try again.",
    unexpected: "Something went wrong. Please try again.",
  },
} as const satisfies Contract;
