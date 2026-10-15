/**
 * English source for the errors namespace: what patients read when something fails on the public
 * site. `api.*` is keyed by the `error.code` the booking and appointment APIs return; keep every
 * api text free of placeholders (the forms look codes up with t.has()). Owned by WP1 (public site);
 * loaded on every public page by the [locale] layout.
 */
import { p } from "../../plural";

export default {
  generic: "Something went wrong. Please try again.",
  network: "We couldn't reach the server. Check your connection and try again.",
  checkFields: p({
    one: "Please correct the highlighted field.",
    other: "Please correct the {count} highlighted fields.",
  }),
  /** A 409 between picking a time and confirming: the form goes back to the times, keeping what was typed. */
  slotTaken: "Sorry, someone has just booked that time. Please pick another one: everything you typed is kept.",
  slotsLoadFailed: "We couldn't load the available times.",
  /** The button under api.notice_outdated: reloading is the only way to read (and post) the new notice. */
  reload: "Reload the page",
  fields: {
    required: "Required",
    contactRequired: "Add a mobile number or an email address",
    phoneForText: "Needed for SMS or WhatsApp reminders",
    emailForEmail: "Needed for email reminders",
    invalidEmail: "Enter a valid email address, like name@example.com",
    invalidPhone: "Enter a valid mobile number",
    invalidDate: "Enter a valid date",
    invalidCountryCode: "Choose a country code",
    consentRequired: "Please consent to continue",
    whatsappRequired: "Please confirm to continue",
    dateOrder: "The end date can't be before the start date",
    tooLong: "This is too long",
    invalid: "Please check this field",
  },
  api: {
    practitioner_busy: "That time has just been taken. Please pick another one.",
    no_room: "That time has just been taken. Please pick another one.",
    time_off: "That time is no longer available. Please pick another one.",
    outside_hours: "That time is no longer available. Please pick another one.",
    too_soon: "That time is too close to book online. Please pick a later one or call the practice.",
    too_far: "That time is too far ahead to book online. Please pick an earlier one.",
    in_past: "That time has already passed. Please pick another one.",
    not_offered: "This treatment isn't available with that practitioner.",
    not_found: "We couldn't find this practice or appointment. The link may be out of date.",
    not_allowed: "This appointment can't be changed online any more. Please contact the practice.",
    /** Confirming a visit the practice has to move (it closed and offered new times). */
    rebook_needed: "The practice can't see you at this time, so it can't be confirmed. Please choose a new time instead.",
    not_accepting: "This practice isn't taking online bookings right now. Please contact them directly.",
    not_accepting_new_patients: "This practitioner isn't taking new patients. Please choose another practitioner or contact the practice.",
    privacy_required: "Please read the privacy information and make your choices to continue.",
    validation_error: "Some details aren't valid. Please check the highlighted fields.",
    rate_limited: "Too many attempts. Please wait a few minutes and try again.",
    internal_error: "Something went wrong on our side. Please try again.",
    forbidden: "This isn't allowed.",
    unauthorized: "This isn't allowed.",
    invalid: "This booking can't be accepted as entered. Please check your details.",
    platform_consent_required: "To book through Sorriso, please consent to the processing of your booking data.",
    whatsapp_consent_required: "Please confirm that you want to receive messages on WhatsApp.",
    whatsapp_unavailable: "This practice doesn't send WhatsApp messages. Please choose SMS or email.",
    guardian_required: "Patients under 14 must be booked by a parent or legal guardian.",
    birthdate_required: "Please enter the patient's date of birth.",
    invalid_birthdate: "Please check the date of birth.",
    not_a_minor: "The patient will be 18 or older on the day of the appointment.",
    guardian_name_required: "Please enter the parent's or guardian's name.",
    guardian_relation_required: "Please say whether you are a parent or a legal guardian.",
    guardian_contact_required: "Please enter a phone number or an email address for the parent or guardian.",
    other_adult_must_book_themselves: "Adults book their own appointments here. You can also book directly with the practice.",
    /** A booking held for another adult needs a contact of their own: they confirm it through that. */
    other_adult_contact_required:
      "Please enter the patient's own mobile number or email, not yours: they confirm the booking through it.",
    /** The privacy notice changed while the form was open (e.g. a release); the page still shows the old one. */
    notice_outdated: "The privacy information has been updated since you opened this page. Please reload the page to read the new version, then send the form again.",
  },
} as const;
