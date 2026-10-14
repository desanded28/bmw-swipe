# The patient's privacy journey

How a patient meets Sorriso's privacy features, from the first booking to exercising their
rights, and where each piece lives in the code. Owned by WP4 (patient GDPR).

> **Legal review required.** Every notice, consent and message text referred to here is a draft
> written by engineers from the processing register. An Italian privacy lawyer or the DPO must
> review and approve the Italian wording (it is authoritative) before go-live; English and the
> other languages are translations of it. Points flagged for review are listed at the end.

## 1. Booking: the first layer, no bundled consent

`src/components/booking/PrivacySection.tsx` (booking and waitlist variants) and
`src/components/booking/PatientRelationSection.tsx`, rendered by WP1's `DetailsStep` and
`WaitlistOffer`.

| Shown | When | Stored |
| --- | --- | --- |
| A first layer of four or five lines: the practice as controller, why (booking, reminders), the legal basis (Art. 6(1)(b) + 9(2)(h)), the rights and the privacy center, links to the practice's notice, its version for young people and, on the marketplace, Sorriso's notice | always | `appointments.notice_version` and `notice_locale`: the version the **server** displayed for the booking's context (`noticeVersionFor`), not a client claim |
| Sorriso's Art. 9(2)(a) consent, required, unticked (`consents.platform_booking_art9.label`, verbatim) | marketplace bookings only (`processingContextFor`) | a `consents` row, org NULL, text key + version, language, HMAC of the IP |
| The WhatsApp just-in-time notice (Meta, Twilio, US transfer under DPF + SCC) and a required, unticked confirmation | WhatsApp chosen and offered by the practice | `whatsapp_channel` grant; `patients.preferred_channel = 'whatsapp'` |
| Feedback invitation, optional, unticked | booking variant | `feedback_request` grant if ticked |
| News and offers, optional, unticked | booking variant, practice has `marketingEnabled` | `marketing` grant if ticked |

There is **no notice-acknowledgement checkbox** (critique 21): it isn't required, and next to the
consent boxes it reads as bundled consent. The server checks (`validateBookingPrivacy`,
`src/lib/privacy/booking-rules.ts`) and answers 422 with a code the form maps to a text:

- `platform_consent_required`: marketplace booking without the Art. 9 consent;
- `whatsapp_unavailable`: WhatsApp chosen at a practice that doesn't offer it;
- `whatsapp_consent_required`: WhatsApp chosen without the confirmation;
- `notice_outdated`: the form showed an older notice version than the one now in force (the
  patient reloads and sees the current one, so the stored version is always the one shown).

The spec's `notice_required` no longer exists (no acknowledgement); its
`whatsapp_confirmation_required` is `whatsapp_consent_required`, the code the foundation and the
booking form already use. Marketing is ignored, never refused, where the practice doesn't run it
(`effectiveBookingChoices`). `bookingPrivacyFormErrors` is the same rule for the browser.

Consent wording lives only in the lead-owned `consents` namespace (critique 6); the ledger stores
its key and `CONSENT_TEXT_VERSION`, which is what makes the row proof of what was shown.

## 2. Who the appointment is for: minors and other adults

`PatientRelationSection` asks "Who is this appointment for? Me / A minor / Another adult" (IT:
"Per chi è l'appuntamento? Me / Un minore / Un altro adulto"). "Me" is preselected and reported on
mount, so every booking is checked. Server rules: `validateBookingRelation`
(`src/lib/privacy/minors.ts`), called by WP8's `booking.ts`.

- **Me.** Under 14 (Art. 2-quinquies Codice privacy) a patient can't book or consent alone:
  `guardian_required`. From 14 to 17 they can; the form shows a line about the notice for young
  people (`/c/<practice>/privacy/minors`).
- **A minor.** The patient fields are the child's; the birth date is required
  (`birthdate_required`, `not_a_minor` at 18). The parent or legal guardian gives a name, the
  relation and a phone or email; they are stored on the child's record (`guardian_*`), the visit
  gets `minor_flag`, consents are recorded with `actor_relation` parent/legal_guardian, and
  `recipientFor()` sends every message to the guardian until the child turns 14.
- **Another adult.** The patient fields are the adult's own; the booker's name and contact go to
  `appointments.booked_by_*`, never to the patient's contacts. Through the practice's channels the
  practice gives the Art. 14 notice: `sendBookedForYouNotice()` sends it to the adult's own
  contact. On the marketplace only the adult can give Sorriso's Art. 9 consent (critique 2):
  `src/lib/privacy/adult-confirmation.ts` holds the booking (status `requested`), sends the adult a
  link to `/a/<token>/privacy/confirm`, records **their** consent (`actor_relation` self) when they
  confirm, cancels when they decline, and cancels unconfirmed holds after 48 hours. Until WP8
  wires it (see "Hooks requested"), the marketplace path stays refused with
  `other_adult_must_book_themselves`.

The client-side checks (`ageBand`, `noticeKindFor`, `relationFormIssue`) are the same functions in
the browser; the server's answer arrives in `errors` and wins.

## 3. Notices

Generated by `buildNotice(kind, { org, locale })` (`src/lib/privacy/notices.ts`), pure and
synchronous, from `roles.ts` PURPOSES (purposes, legal bases, profiling, objection), the
sub-processor list (recipients, transfers and their tools), the practice's legal fields and
settings (active purposes, retention). Texts: the `legalPatient` namespace.

| Page | Kind | Notes |
| --- | --- | --- |
| `/[locale]/c/[org]/privacy` | `practice_patient` | first layer ("In short") then anchored sections: controller and DPO (or "no DPO"), data and source (Art. 14), purposes with legal bases, the marketplace and the effect of withdrawing the Art. 9 consent, recipients by category with each sub-processor, transfers and safeguards, retention periods from the practice's settings, rights (Art. 15-22, withdrawal, Art. 19), the Garante, whether data are mandatory, no solely automated decisions (profiling disclosed when adaptive reminders are on), minors, cookies, changes |
| `/[locale]/c/[org]/privacy/minors` | `minor` | simple words, for children and teenagers (Recital 58) |
| `/[locale]/legal/privacy` | `platform_patient` | Sorriso as marketplace controller and as processor, its DPO, retention, transfers; `?for=staff` and `?for=practitioners` show the `staff` notice (access log, Art. 4 L. 300/1970) and the `practitioner` notice (profiles, Albo checks, reviews, ranking) |
| `/[locale]/legal/cookies` | `cookies` | the staff session, `NEXT_LOCALE`, the privacy-center cookie, browser storage (`BROWSER_STORAGE`, none today), no third parties, the click-to-load map |

Every page shows its version and the date the exact wording has been in force since, and in
every language but Italian a banner saying the Italian version prevails (with a link to it).
`publishNotice` records a `notice_versions` row the first time each content hash is published
(per practice, kind and language); `recordPracticeNotices(org)` does it for every language at
once. An appointment's `notice_version` + `notice_locale` and the `notice_versions` rows together
prove the wording a patient was shown.

## 4. The appointment link

`ManagePrivacyCard` (on `/a/<token>`) links to `/[locale]/a/<token>/privacy`, where, **without a
code**, the patient (or the guardian the link went to) can change the language and channel of
messages (WhatsApp with its notice and confirmation), withdraw optional consents, object, and
stop SMS or email. Turning things on happens where their notice is shown (booking, the privacy
center). Seeing everything, exporting or filing a request first sends a one-time code to the
contact on file (step-up); the code opens a privacy-center session and records that contact as
verified for the record. Audited with actor type `patient_link`. Opening any of these pages
changes nothing (mail scanners open links on their own).

## 5. The privacy center (no account)

`/[locale]/privacy` explains the rights, how to exercise them and how to complain to the Garante,
and signs in with a one-time code (`src/lib/privacy/privacy-center.ts`,
`src/lib/privacy/patient-session.ts`).

1. **Sign-in.** A phone number or an email address. If a practice holds a record for it, a code
   goes there (`sendOtp`, purpose `privacy_center`). If none does, nothing is sent but a decoy
   challenge is stored with the same limits and attempt counting, and the response is padded to
   the same duration: "If we hold data for this contact you'll receive a code" either way, and an
   outsider can't tell from the answer, its timing or later guesses whether someone is a patient.
   Limits: 3 codes per 15 minutes and 10 per day per contact, 10 per hour per network, 5 attempts
   per code, codes valid 5 minutes, a contact locked for a day after 10 wrong codes.
2. **Session.** `__Host-sorriso_pc` on https (`sorriso_pc` on http), HttpOnly, SameSite=Lax,
   30 minutes, never extended. The database keeps only the sha256 of the token and an HMAC of
   the contact; the contact itself rides in the cookie, encrypted and bound to the session.
3. **What it shows.** Every practice with a patient row whose phone or email is the verified
   contact, plus children whose guardian contact it is, until they turn 18 (critique 10). Shared
   family phones and mistyped emails (critique 11): a row whose matching contact was never proven,
   or a contact shared by several adults, shows only "a record exists at practice X" until the
   visitor gives that row's surname and birth date (5 tries per day); then the contact is recorded
   as verified for it. Bookers for another adult never match (their contact is on the appointment).
4. **Per practice:** details; appointments with service names; messages, including the patient's
   replies; waiting-list entries; choices (withdraw or give optional consents, object, switch
   channels: `recordConsent`/`withdrawConsent`, source `privacy_center`); reviews, deletable
   (`withdrawReview`, WP7); the access log (date, staff role, action; never names); requests.
5. **Actions:** download (`/api/privacy/export`, `buildPatientExport` ZIP, `no-store`,
   attachment, audited `privacy_center.export`); correct a phone or email with a code to the new
   contact (purpose `contact_change`; the old contact is told; other practices holding the same
   contact can be updated at once; the session moves to the new contact); language and channel;
   access, rectification, erasure, restriction, objection and portability requests
   (`createPrivacyRequest`, due one calendar month later, in the practice's inbox, or Sorriso's
   platform inbox for marketplace data), with a receipt to the contact (`privacyMessages`).
6. **Audit.** Every view (`privacy_center.view`, one row per record shown), export and change is
   audited with actor type `patient_session` and the session id as actor id.

## 6. Unsubscribe links

Every patient email carries `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
(WP3's `patientEmailHeaders`) pointing to `/api/privacy/unsubscribe?t=…&c=email`. The token is
`unsubscribeToken(patientId, channel)` (links.ts): HMAC-signed, no expiry, so old emails keep
working. GET shows a confirmation page and changes nothing; POST (the mail client's one-click
request, or the page's button) records an `email_channel` (or `sms_channel`) withdrawal (method
`email_link`, source `manage_link`), which turns the opt-in off, so the next reminder on that
channel is skipped. Answers in the patient's language; idempotent.

## 7. Cookies and storage

Only three cookies exist on public pages, all technical (Art. 122 Codice privacy; Garante
guidelines of 10 June 2021), so there is no banner: the staff session, `NEXT_LOCALE` (set only on
an explicit language choice) and the privacy-center session. Nothing is kept in localStorage
today; a package that adds a key adds it to `BROWSER_STORAGE` in `notices.ts` so the cookie notice
lists it.

## 8. Hooks requested from other packages

- **WP8 / lead (`src/lib/booking.ts`, TODO(WP4))**: let marketplace `other_adult` bookings through
  as held bookings (status `requested`, no consent recorded), then call
  `requestAdultConfirmation(appointmentId)`; call `sendBookedForYouNotice(appointmentId)` after a
  practice-context `other_adult` booking; call `expireAdultConfirmations()` from the reminders cron
  (WP3). Beware the import cycle: adult-confirmation.ts imports `cancelAppointment` from booking.ts,
  so booking.ts should import it lazily (`await import(...)`).
- **WP5**: call `recordPracticeNotices(org)` after saving the practice's legal fields or privacy
  settings, so a changed notice is on record before anyone opens it. WP5's notice preview uses
  `buildNotice` (it records nothing).
- **WP6**: the third-party/cookie check lists the privacy-center cookie as `__Host-sorriso_privacy`
  / `sorriso_privacy`; the real names are `__Host-sorriso_pc` / `sorriso_pc`
  (`PATIENT_SESSION_COOKIE_NAMES` in `patient-session.ts`).
- **WP1**: add `errors.api.notice_outdated`; offer the birth date on the waitlist form (a minor
  can't join the waiting list without it); optionally adopt `bookingPrivacyFormErrors` and
  `relationFormIssue` for the submit-time checks.
- **WP7**: the practitioner page's `<ClientMessages>` around `BookingFlow` must include `privacy`
  (it has only `consents`).

## 9. Points for the lawyer / DPO

- All of `legalPatient` (notices), `privacy` (first layer, privacy center texts) and
  `privacyMessages`; the Italian version must be written first.
- Clinical documentation retention ("as long as the law requires") and the 10-year limitation
  period used for legal acceptances.
- The staff notice's paragraph on the access log and Art. 4(3) L. 300/1970 (use of the log for
  employment purposes) and whether a union agreement or labour-inspectorate authorisation is
  needed for any practice.
- The legal basis of the cross-practice privacy-center lookup (roles.ts: 6(1)(c)/(f) + 9(2)(f)).
- The 48-hour hold for marketplace bookings made for another adult.
- That OpenStreetMap is described accurately in the cookie notice (it receives the IP only after
  the visitor clicks to show the map).
