# Patient messaging

Every SMS, WhatsApp message, email and calendar invite that reaches a patient (or, for a child
under 14, their guardian) goes through `src/lib/messaging/`. This page covers what the messages
say, in which language, on which channel, to whom, and what the providers keep.

> Legal wording on this page and in the message texts (privacy footer, breach notice, STOP
> semantics) is a draft **to be reviewed by a lawyer/DPO** before go-live.

| Module | What it does |
| --- | --- |
| `src/lib/messaging/templates.ts` | appointment messages: emails, SMS, WhatsApp variables, replies, calendar texts |
| `src/lib/messaging/layout.ts` | `renderEmailLayout()`, the shared email layout (frozen signature) |
| `src/lib/messaging/index.ts` | `deliver()` (frozen) and `sendPatientMessage()` (frozen signature) for other packages |
| `src/lib/messaging/providers.ts` | SMTP and Twilio: TLS, regions, allowlist, `deleteProviderMessage()` |
| `src/lib/messaging/whatsapp.ts` | per-language WhatsApp templates and `chooseTextChannel()` |
| `src/lib/messaging/sms-encoding.ts` | GSM-7, segments, the ASCII fallback, the segment budget |
| `src/lib/reminders.ts` | the reminder engine, calendar invites, the provider clean-up |
| `src/lib/inbound.ts` | understanding replies in 8 languages and routing them to one practice |
| `src/lib/waitlist.ts` | freed-slot offers |
| `src/i18n/messages/<locale>/patientMessages.ts` | the texts (server-only namespace) |

## Content levels: discreet by default

A text message is read on a lock screen, an email subject in a notification, a calendar entry on
every synced device. In Italy a treatment name ("Implantologia", "Ortodonzia") is health data
(GDPR Art. 9), so by default nothing that leaves the practice names it.

**Discreet** (the default) — SMS bodies, WhatsApp variables, email subjects, email bodies and
calendar entries carry only:

- the practice's name, the date and time and the address;
- how to confirm or cancel (reply YES/NO), the link to the appointment page and the STOP instruction;
- for booking confirmations, the practice's privacy notice (`/{locale}/c/<slug>/privacy`) and how
  to object (email footer; in the SMS when it fits the budget).

Never the treatment, its category, the practitioner or a note. The details sit behind the
appointment link (`/a/<token>`), which is hashed in the database and expires 60 days after the
visit (`src/lib/links.ts`).

**Detailed** is used for one message only when all of these hold (`contentLevelFor()` in
`src/lib/appointments.ts`):

1. the practice chose it (`privacy.messageContentLevel = "detailed"`, privacy settings);
2. the treatment is not marked sensitive (`services.sensitive`);
3. the patient record has a verified contact (`patients.contactVerifiedAt`) **and** the very
   contact this message goes to is one of the verified ones (`patients.verifiedContacts`), so a
   mistyped number or address only ever gets the discreet text.

The level is decided per channel: a verified email and an unverified phone give a detailed email
and a discreet SMS. Calendar invites and waiting-list offers are discreet in every mode. A contact
is verified by a correct one-time code, an explicit action on the appointment page (POST, never a
GET: mail scanners open links) or a reply to our SMS that matched an appointment.

Italian reference texts (`it/patientMessages.ts`):

- SMS reminder: `{clinic}: promemoria appuntamento {when}, {address}. Rispondi SI per confermare, NO per disdire. Dettagli: {url} STOP per non ricevere SMS`
- Email subject: `Promemoria appuntamento - {clinic} - {date}`
- Calendar: `Appuntamento – {clinic}`; description: the address and `Tel. {phone}`; no link.

## Languages

Each message is written in the recipient's language: `patients.locale`, chosen at booking and
editable in the privacy center. Dates come from `src/i18n/datefmt` (`fmtWhen` with the patient's
locale), so a Polish patient reads "środa, 16 września o 10:30" even while the Polish texts fall back
to English.

The `patientMessages` namespace is server-only (it never reaches a browser). English is the key
source; `it/patientMessages.ts` is owned by WP3 so that Italian patients keep the wording they had;
the other six locales are WP9's. Rules for translators:

- Placeholders stay as they are: `{clinic}`, `{when}` (medium date and time), `{date}` (short date
  and time, for subjects), `{slot}` (numeric, built from `format.slot`), `{address}`, `{url}`,
  `{privacy}`, and in `*Detailed` variants only `{service}`, `{practitioner}`, `{name}`.
- SMS texts: straight quotes, no ellipsis character, the shortest natural phrasing.
- `smsShort`, `smsAskShort`, `replies.*Short`: plain ASCII letters only (they must stay GSM-7) and
  no address. They are sent when the full text goes over the budget.
- The confirm and cancel words in `reminder.smsAsk` must be in the `KEYWORDS` table below
  (de JA/NEIN, fr OUI/NON, es SI/NO, pt SIM/NAO, ro DA/NU, pl TAK/NIE).
- `src/lib/messaging/templates.test.ts` enforces all of this for every locale: no treatment in
  discreet texts, no `{` left after interpolation, straight quotes, GSM-7 short forms and the
  segment budget.

Other packages send patient messages with `sendPatientMessage({ orgId, patient, ns, kind, vars, url?, purpose? })`
(recalls, practice-moved notices, privacy receipts, review invitations). A kind is a top-level key of
the namespace with `subject` + `body` (+ `cta`) for email and/or `sms` (+ `smsShort`). The function
routes to the guardian under 14, skips restricted patients and withdrawn purposes, picks the
channel, applies the SMS rules below, adds the privacy footer and the email headers, and logs
through `deliver()`. Keeping those namespaces' texts discreet is their authors' job.

## SMS cost control

An SMS is billed per segment: 160 GSM-7 characters (153 per segment once split), but 70 UCS-2
characters (67) as soon as one character is outside the GSM 03.38 alphabet: a Polish "ą", a
Romanian "ș", a curly apostrophe, an emoji. GSM-7 extension characters (`€ [ ] { } ~ ^ | \`)
count twice. `segments(text)` counts exactly what carriers bill.

- **Budget:** every SMS kind, in every language, with a 40-character practice name and a
  40-character address, fits in **2 GSM-7 or 3 UCS-2 segments**. Each kind has a full text and a
  short one (`smsShort`); `fitSmsBudget()` sends the full one when it fits.
- **Typography:** in every language, typographic quotes, dashes, ellipses and non-breaking spaces
  in practice names and addresses become their GSM-7 twins.
- **ASCII fallback** (Reminders page, `settings.reminders.smsAsciiFallback`, off by default): for
  `es`, `pt`, `fr`, `ro` and `pl`, letters that GSM-7 lacks lose their diacritics (NFD minus
  combining marks, `ł` → `l`); letters GSM-7 has (`ñ`, `é`, `è`, `à`, `ü`) stay. With it on, those
  messages fit in 2 GSM-7 segments. Italian, German and English texts are GSM-7 already.
- The Reminders page shows each preview's encoding, length and segment count.

## Email hygiene

- **Transport:** nodemailer with `requireTLS` (STARTTLS) and `tls.minVersion: "TLSv1.2"`.
  `SMTP_REQUIRE_TLS=0` turns the STARTTLS requirement off, only for a local test server.
- **Headers** (`deliver()` → `patientEmailHeaders()`): `Content-Language` with the patient's locale
  (the `<html lang>` of the layout), and for any email about a patient record
  `List-Unsubscribe: <APP_URL/api/privacy/unsubscribe?t=<token>&c=email>` with
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` (RFC 8058). The token is
  `unsubscribeToken(patientId, "email")` from `src/lib/links.ts`: HMAC-signed and without expiry,
  so old emails keep working. WP4 owns the route (GET: confirmation page, POST: one click).
- **Footer** (`privacyFooter()`): the practice's legal name and registered address, its phone, why
  the patient got the email (an appointment, the waiting list, being a patient, or as a child's guardian), a link
  to the practice's privacy notice and one to the patient's privacy choices (`/a/<token>/privacy`,
  or the privacy center). Booking confirmations add how to object.
- **No tracking:** no images at all (so no remote ones), no pixels, no redirect or tracked links;
  links go only to `APP_URL` (and, if ever added, the practice's own website). Turn link and open
  tracking off at the SMTP provider. The brief cites Garante guidance on tracking pixels in email
  applying from the end of October 2026: the date and scope are to be verified against the primary
  source; these emails comply either way.

## WhatsApp

WhatsApp (Meta, US) is used only when **all** of these hold (`chooseTextChannel()`):

1. the practice enabled it (privacy settings, `whatsappEnabled`);
2. the patient chose it (`preferredChannel = "whatsapp"`) **and** the consent ledger holds a
   current `whatsapp_channel` grant (a preference set without consent gets SMS);
3. an approved template exists for the message kind **in the patient's language**.

Otherwise the message goes by SMS (if the patient accepts texts) or email: never in the wrong
language, never as free text outside WhatsApp's 24-hour window. Replies to a patient's own
WhatsApp message are free-form (inside the window).

**Setting up templates, per language:**

1. In Twilio's Content Template Builder, create one template per kind and language, with only
   these variables: `{{1}}` the patient's first name, `{{2}}` the date and time, `{{3}}` the
   practice, `{{4}}` the link. No treatment, practitioner or note: there is no variable for them.
   Write the text so it also reads well when the message goes to a parent ("Appointment reminder
   for {{1}}…").
2. Submit each for WhatsApp approval (category *Utility*).
3. Put the approved Content SIDs in `TWILIO_WHATSAPP_CONTENT_SIDS`:

   ```
   TWILIO_WHATSAPP_CONTENT_SIDS={"reminder":{"it":"HX…","en":"HX…"},"reminderAsk":{"it":"HX…"},"booked":{"it":"HX…"}}
   ```

Kinds: `booked`, `approved`, `reminder`, `reminderAsk` (a reminder asking YES/NO; falls back to
`reminder`), `cancelled`, `rescheduled`, `waitlist`, and `<namespace>.<kind>` for messages other
packages send through `sendPatientMessage` (e.g. `careMessages.recall`). Staff notices sent by
`src/lib/booking.ts` (cancelled/moved by the practice) pass no kind today, so they go by SMS.

Development: outside the live deployment (`isLiveMessaging()` false: a dev machine, demo mode, a
preview), without `TWILIO_WHATSAPP_CONTENT_SIDS` and without WhatsApp credentials, every kind
counts as templated so the WhatsApp path shows up (captured) in the message log. As soon as either
is set, only the listed templates are used. **The live deployment never takes that shortcut:**
WhatsApp is chosen only when `TWILIO_WHATSAPP_FROM` (with its credentials) is set and the kind has
an approved template in the patient's language; otherwise the patient gets SMS or email. A WhatsApp
message that still reaches `sendWhatsApp()` there without a sender is recorded as failed
(`not_configured`), never as captured or sent.

## Replies in 8 languages

`parseIntent(text, locale)` (`src/lib/inbound.ts`) normalises the text (lower case, punctuation as
spaces; accents stripped for Latin script only, so `Sì` = `si` and `odwołuję` = `odwoluje`), then:

1. 👍 ✅ 👌 confirm, 👎 ❌ cancel, in every language;
2. **the patient's language**, fully: STOP/START words (a message of at most two words), "no
   problem" phrases (`NOT_A_REFUSAL`: Italian "non c'è problema" confirms), reschedule stems and
   phrases, cancel words (first word) and phrases, confirm words (first word) and phrases;
3. **every other language**, but only when the whole message is a single keyword that means the
   same everywhere it exists ("TAK", "oui", "da"). Free text in another language stays `unknown`
   and is flagged for the front desk: Romanian "da" is also an Italian preposition.

| Locale | Confirm | Cancel | Reschedule (`*` = stem) | Stop | Start |
| --- | --- | --- | --- | --- | --- |
| it | sì, si, s, ok, 1, confermo, conferma, certo, presente, perfetto, va bene, ci sarò, ci sono, d'accordo | no, n, 2, annulla, annullo, disdico, disdire, disdetta, cancella, impossibile, non posso, non riesco, non vengo, non ci sarò, non potrò | spost\*, rinvi\*, rimand\*, posticip\*, anticip\*, cambi\*, altro giorno, altro orario | stop, stopall, basta, disiscrivi, cancellami | start, iscrivi, riattiva |
| en | yes, y, yep, yeah, ok, 1, confirm, confirmed, sure, fine, will be there, see you | no, n, nope, 2, cancel, cancelled, can't come, can't make it, won't make it, not coming | reschedul\*, postpone\*, rebook\*, move, change, another day/time | stop, stopall, unsubscribe, end, quit | start, unstop, subscribe, resume |
| de | ja, jo, ok, 1, bestätige, bestätigt, klar, passt, gerne, einverstanden, ich komme | nein, nee, 2, absagen, abgesagt, storniere, stornieren, kann nicht, komme nicht | verschieb\*, verleg\*, umbuch\*, anderen Termin | stopp, stop, abmelden | start, anmelden |
| fr | oui, ouais, ok, 1, d'accord, je confirme, parfait, entendu, je viendrai | non, 2, annuler, annule, j'annule, je ne peux pas, pas disponible | report\*, déplac\*, décal\*, changer, autre jour/date/horaire | arrêt, stop, désabonner | start, reprendre |
| es | sí, si, vale, ok, 1, confirmo, claro, perfecto, de acuerdo, nos vemos | no, 2, cancelar, cancelo, anular, no puedo, no podré, no voy | cambi\*, aplaz\*, reprogram\*, mover, posponer, otro día/otra hora | baja, stop, parar | start, alta |
| pt | sim, ok, 1, confirmo, claro, combinado, certo, estarei | não, nao, 2, cancelar, cancelo, desmarcar, não posso, não vou | remarc\*, reagend\*, adiar, mudar, alterar, outro dia | parar, stop, sair | start, ativar |
| ro | da, ok, 1, confirm, confirmat, sigur, bine, vin, ne vedem | nu, 2, anulez, anulare, anulat, nu pot, nu vin | reprogram\*, amân\*, muta, schimb\*, altă zi/oră | stop, dezabonare | start, abonare |
| pl | tak, ok, okej, 1, potwierdzam, dobrze, będę, jasne, zgoda | nie, 2, odwołuję, odwołać, anuluję, anuluj, rezygnuję, nie mogę, nie przyjdę | przełoż\*, przesu\*, zmian\*, inny termin | stop, wypisz | start, zapisz |

The authoritative lists are `KEYWORDS` and `NOT_A_REFUSAL` in `src/lib/inbound.ts`; the Reminders
page shows them, and `src/lib/inbound.test.ts` pins them per language.

### Which practice a reply is for

Replies never cross practice boundaries (`replyScope()`):

1. If the number (or Messaging Service) that received the text is a practice's
   `organizations.inboundNumber`, only that practice's patients are considered. Owners set it on
   the Reminders page; the number must belong to Sorriso's Twilio account (and region) and be set
   aside for that practice. The practice's SMS are then sent from it (`deliver()` passes it to
   `sendSms`), so replies come back to it.
   - **The platform's shared senders are no practice's:** `TWILIO_FROM`,
     `TWILIO_MESSAGING_SERVICE_SID`, `TWILIO_WHATSAPP_FROM` and `TWILIO_SHARED_SENDERS` (the
     numbers of the shared Messaging Service's pool, and former shared senders) are refused by
     `saveInboundNumber` and ignored by the routing, even if an older row stores one. Otherwise the
     practice claiming one would receive every practice's replies.
   - When Twilio names the Messaging Service of the receiving number (`MessagingServiceSid`), the
     service decides: the shared service means the shared sender, whichever pool number got the
     text; a practice's service means that practice, whatever another practice claims about the
     number.
2. Otherwise the text reached the **shared platform sender**: the practice that most recently
   texted this number **from the shared sender, on the same channel** is the one being answered.
   `messages.from` records the number or Messaging Service each SMS left from; a practice that
   texts from its own number is answered there, so its SMS don't count here (those it sent from the
   shared sender before it had a number of its own still do). WhatsApp has one platform-wide
   sender, so a WhatsApp reply follows the last WhatsApp message.
3. If no practice texted it from the shared sender, the only practice with a patient texted at
   that number, if it uses the shared sender; with several, or one that has its own number,
   nobody, and nothing changes.

Within the practice, the reply is about the visit that practice last texted the number about,
else the soonest upcoming one. A child's messages go to the guardian, so the guardian's reply is
about the child, and the child's own number (which we never text) matches nothing. The answer goes
out in that practice's name, in the patient's language.

- **Confirm / cancel / new time / not understood:** as before; not understood flags the
  appointment for the front desk. A cancellation stores only the label
  `Cancelled by SMS reply` (or WhatsApp), never the patient's words.
- **A matched reply verifies the number** (`markContactVerified`).
- **STOP** records a `sms_channel` withdrawal (`granted: false`, source and method `sms_reply`) in
  the consent ledger, which turns `smsOptIn` off; on WhatsApp it withdraws `whatsapp_channel`. On a
  practice's own number it applies to that practice's patients only. **On the shared platform
  sender it applies to every practice's patients texted at that number**: carriers and Twilio block
  the whole sender for that number after a STOP, so no practice using it can text the number
  anyway, and the ledger says so.
- **START** (and ISCRIVI) records a grant **only for the practice the reply was matched to**, on
  the shared sender too. Each practice is a separate controller: a START sent in answer to one
  practice is no specific, informed choice about another, where the patient may have withdrawn on
  purpose (privacy center, staff). The carrier lifts its block on the shared sender, but the other
  practices keep the withdrawal in their ledgers and don't text until the patient opts in there.
- **The automatic answer** is sent through the Messages API (`deliver()`), from the number or
  Messaging Service the patient wrote to, never as an inline TwiML `<Message>` (the webhook
  answers with an empty `<Response></Response>`). Twilio's copy of an inline answer has a SID we never
  learn, so it could not be deleted; sent through the API, its SID is stored like any other
  message's and the copy is deleted after `providerMessageDays`. Outside the live deployment the
  answer, like any message, goes only to `MESSAGING_ALLOWLIST`.
- Twilio's own opt-out handling: configure Advanced Opt-Out on the Messaging Service so that
  `CANCEL`/`ANNULLA` are **not** opt-out keywords there (they cancel an appointment here).

## The reminder engine

`processDueReminders({ orgId?, appointmentId?, now?, limit? })` sends what is due. The cron and
the in-process worker run it for every practice; "Send due reminders now" (permission
`reminders.run`) only for the signed-in practice, and the run is on the practice's access log with
its counts (`appointment.update` on the practice, `metadata.job = "reminders.run"`, until the audit
list has a reminders action).

- Recipients come from `recipientFor()`: under 14 with guardian contacts, the guardian.
  Restricted (Art. 18) and erased patients get nothing (the reminder is skipped).
- Channels: an email rule needs an email the patient accepts; a text rule means "a text" and
  `chooseTextChannel()` decides SMS or WhatsApp; `fallbackToEmail` falls back to email.
- **Review requests** go only with a current `feedback_request` consent.
- **`onlyIfRisk`** (`medium` or `high`, per rule in the Reminders page): the rule is skipped unless
  the appointment's no-show risk is at least that level. A practice without risk-based reminders
  (privacy settings) and a patient who objected to `adaptive_reminders` count as no risk. The gate
  is fixed when the reminders are scheduled; the frozen schema has no column for it, so it travels
  as a suffix of the reminder id (`<id>.risk-high`, `reminderRiskGate()`).
- **Waiting-list offers** are discreet ("a slot opened on {date}"), in the patient's language,
  and skip restricted patients.

## Calendar invites

The booking confirmation's attachment and `/api/ics/appointment/<token>` say `Appointment –
{clinic}` in the patient's language; the description is the address and the practice's phone; no
treatment, practitioner, note or link. The route checks the token through `src/lib/links.ts`
(hash lookup, expiry), is rate-limited per network, and answers with `Cache-Control: private,
no-store`, `Referrer-Policy: no-referrer`.

## Providers and their copies

### Twilio in the EU (IE1)

Twilio's Ireland region keeps message bodies and logs in the EU. Twilio is a US company, so it is
still a transfer (DPF + SCC, see `src/lib/privacy/subprocessors.ts` and the TIA).

1. In the Twilio Console, create an API key **in the IE1 region** and note the IE1 auth token.
   Region credentials work only in their region.
2. Route the sending number or Messaging Service to IE1 (Regional Messaging; check Twilio's current
   documentation for availability with Italian numbers).
3. Set `TWILIO_ACCOUNT_SID`, `TWILIO_REGION=ie1`, `TWILIO_EDGE=dublin`,
   `TWILIO_IE1_API_KEY_SID`, `TWILIO_IE1_API_KEY_SECRET`, `TWILIO_IE1_AUTH_TOKEN`, and
   `TWILIO_FROM` or `TWILIO_MESSAGING_SERVICE_SID`. SMS requests then go to
   `https://api.dublin.ie1.twilio.com`. List the numbers of the shared Messaging Service's pool
   (and any former shared sender) in `TWILIO_SHARED_SENDERS`, comma-separated, so no practice can
   claim one as its own reply number.
4. WhatsApp is not available in IE1 and stays on the default US1 region: set
   `TWILIO_US1_AUTH_TOKEN` (or `TWILIO_AUTH_TOKEN`) and `TWILIO_WHATSAPP_FROM`.
5. Point "A message comes in" of the number and of the WhatsApp sender to
   `POST {APP_URL}/api/webhooks/twilio`. Delivery receipts come to `/api/webhooks/twilio/status`
   (set per message by the app).

Webhooks are verified with the auth token of the region that sends them (IE1 for SMS when
`TWILIO_REGION` is set, US1 for WhatsApp). Without a token they are refused (403), except in demo
mode on localhost.

Use a neutral sender: a number or a generic alphanumeric ID, never the practice's name.

### What the providers keep

- The status webhook records `messages.finalStatusAt` once a message is delivered, undelivered,
  failed, read or cancelled.
- The reminders cron (`purgeProviderCopies()`) asks Twilio to delete its copies (outbound and
  inbound, SMS and WhatsApp, the automatic answers to replies included) older than the practice's
  `privacy.retention.providerMessageDays`, oldest first, in the region each went through, and sets
  `messages.providerDeletedAt`. Copies that can't be deleted don't hold up the others: a region
  whose credentials aren't set here (e.g. after leaving IE1) is not tried, and its copies wait
  until the credentials are back; a provider that fails five times in a row is left for the next
  run; a copy that failed is skipped for six hours (remembered by the process: the schema has no
  column for attempts yet). One error line per provider and run. Erasure (WP5) calls
  `deleteProviderMessage()` directly.
- Email can't be recalled from an SMTP relay; choose an EU provider with short log retention.

### Fences and logs

- Outside the live deployment (`isLiveMessaging()`), and always in demo mode, messages go only to
  `MESSAGING_ALLOWLIST`; everyone else is recorded as `captured` and never handed to a provider.
- Provider errors are stored in `messages.error` through `redact()` (they often quote the number),
  and so is `reminders.error`: a failed query's bound values (`params: …`) are dropped, numbers and
  emails masked.
- Logs carry ids and counts only: never a phone number, an email, a message text or SQL parameters.

## Breach notice (Art. 34)

`templates.breachNoticeEmail(d, { what, when, data, consequences, measures, advice, dpoContact })`
and `templates.breachNoticeSms(d, url)` give the practice (as controller) a communication in the
patient's language with what Art. 34(2) requires: the nature of the breach in plain language, the
DPO or contact point, the likely consequences and the measures taken or proposed, plus what the
patient can do. The facts are written per incident with the DPO; tooling to send it in bulk is out
of scope (see `docs/privacy/breach-runbook.md`). Draft wording: to be reviewed by a lawyer/DPO.

## Dashboard

- **Reminders** (every staff role can view; `reminders.manage` edits, `reminders.run` runs):
  rules with the `onlyIfRisk` option, the ASCII fallback toggle, previews of the SMS and email in
  all 8 languages at the practice's content level with the segment count, the table of understood
  replies, the reply number (owners), and the providers' status (SMS region, TLS, WhatsApp templates).
- **Messages** (`messages.read`): the log with decrypted bodies and the understood intent of each
  reply, in the staff member's language. Viewing it is audited. The reply simulator is shown, and
  `simulateReply` works, only in demo mode with `messages.simulate`.
