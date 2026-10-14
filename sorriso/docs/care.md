# Continuity of care (WP8)

Recalls, no-show risk, the rebooking assistant, the digital medical history (anamnesis) and
duplicate patients. This package also owns the booking engine (`src/lib/booking.ts`,
`src/lib/availability.ts`).

> Legal texts and the legal reasoning below are drafts **to be reviewed by a lawyer/DPO** before
> go-live (see [Open legal points](#open-legal-points)).

| Area | Code | Pages and components |
| --- | --- | --- |
| No-show risk | `src/lib/risk.ts` | badges and panel in the appointment drawer, call list |
| Recalls | `src/lib/recalls.ts` | `/dashboard/recalls`, recall picker in the drawer, patient page |
| Rebooking assistant | `src/lib/rebooking.ts`, `proposeAlternatives` in `booking.ts` | `TimeOff.tsx` + drawer, `/{locale}/a/<token>/rebook` |
| Medical history | `src/lib/forms.ts` | `/{locale}/a/<token>/forms/anamnesis`, manage-page card, clinical sheet |
| Duplicates | `upsertPatient`, `mergePatients` in `booking.ts` | `/dashboard/patients/duplicates`, patient page |
| Jobs | `runCareJobs()` in `recalls.ts` | every 15 minutes (instrumentation, reminders cron, `npm run reminders`) |
| Texts | `src/i18n/messages/en/care.ts`, `careMessages.ts` (server-only) | |

Dashboard actions live in `src/app/dashboard/actions/care.ts` and `timeoff.ts`; the patient pages'
actions next to their pages. Lists of patients are audited as `patient.search` (recalls page,
duplicates queue, the "Rebook N patients" drawer), changes as `patient.update` (recalls, forms,
duplicate dismissals) or `appointment.update`/`.cancel`, merges as `patient.merge`, clinical reads
as `patient.clinical.view` **on the patient** (so they show in the patient's access log, the
privacy center and the Art. 15 export).

Restricted (Art. 18) and erased patients: every care read and write of one patient checks
`mayReadPatient` on the server (`patient.restricted.read` plus a reason the same person gave in
the last 15 minutes, `hasRestrictedAccess`), whatever the UI hides: the drawer's care panel, the
medical history, the recall picker, the patient page's care panel and "mark as added to the
clinical record". Lists mask restricted patients (placeholder name, no contacts or birth date)
for viewers without `patient.restricted.read`: the duplicates queue, the call list (never a phone
for a restricted patient) and the rebooking drawer.

## No-show risk

### The no-gating rule

Risk **only adds help**. It never blocks a booking, never hides, reorders or removes a slot,
and never triggers a deposit or prepayment. Nothing in `availability.ts` or the booking path reads
it (`risk.test.ts` checks that `evaluateSlot` and `getAvailability` return the same slots whatever
the patients' risk). What it does:

- reminder rules with `onlyIfRisk: "medium" | "high"` (WP3's rules editor) send an extra
  reminder to riskier visits;
- the front desk's call list on `/dashboard/recalls` shows unconfirmed high-risk visits in the
  next 48 hours;
- the calendar shows a dot (with screen-reader text) and can sort by it.

This keeps the score a support tool under human control (GDPR Art. 22: no decision with legal or
similarly significant effects is taken on it; L. 132/2025 on AI: transparency and human oversight).

### When it is computed

Only when the practice turned on `privacy.riskBasedReminders`. Never for a patient who objected
to `adaptive_reminders` (their `riskLevel` stays null and risk-gated reminders skip them). A patient
who objected to `no_show_tracking` is scored without their attendance history — and without
deriving "first visit" from it: only the booking's own `isNewPatient` counts, so a withheld history
never makes a long-standing patient look new. It is computed on booking and on reschedule
(`refreshAppointmentRisk`), and refreshed by `runCareJobs` for visits in the next 7 days whose
score is older than 6 hours or predates the visit's 24-hour mark, and for any later visit whose
stored risk is older than a day. Practices that turn the setting off get the stored value of every
future visit cleared.

An objection applies at once, before any refresh: everything that reads a stored risk (the
calendar's `loadCareFlags`, the call list) checks the objection live (`riskAllowedFor`), and the
objection flow can clear all of the patient's future values with `clearRiskFor`.

### Factors and weights (deterministic, published)

| Reason key (`care.risk.reasons.*`) | Points |
| --- | --- |
| `no_show_history`: no-shows at this practice in the last 24 months | 25 for one, +15 each further, counted up to 3 (max 55) |
| `unconfirmed`: not confirmed and less than 24 hours to go | 20 |
| `late_cancel_history`: two or more cancellations by the patient inside `cancelUntilHours` | 15 |
| `long_lead_time`: booked 30+ days ahead / 14+ days ahead | 15 / 8 |
| `new_patient`: first visit at the practice | 10 |
| `edge_of_day`: starts before 09:00 or from 18:00 | 5 |
| reliable history: 3+ completed visits and no no-show (not shown as a reason) | −10 |

The score is clamped to 0–100: **high ≥ 45, medium ≥ 25, low below**. Reasons are listed by
weight (ties in the table's order) and stored as keys on the appointment (`riskReasons`), which the
UI translates. Unknown keys are dropped.

## Recalls

### Who decides

A recall follows a **completed** visit and needs an interval set by a clinician for that patient:
this is care under Art. 9(2)(h), not "fidelizzazione" (Garante, health-sector guidance 2019). The
service's `recallMonths` only **suggests** the interval: completing the visit creates the recall
with `setByUserId = NULL`, which is shown on the dashboard ("waiting for a clinician") and in the
drawer's recall picker, and **never sent**. A clinician (`patient.clinical.read` + `recalls.manage`)
sets or confirms it (3–24 months). The confirmed interval carries over to the patient's next visit
for the same treatment until a clinician changes it.

### Lifecycle

```
due ──(message 1)──▶ sent ──(14 days, message 2…)──▶ sent ──(max reached, 14 days)──▶ call
 │                     │                                                        │
 └──── booked (the patient books the same treatment: same service or category) ◀┘
dismissed: by staff · by the patient's objection to "recalls" · 180 days after the due date
```

- At most `care.recallMaxAttempts` messages (default 2, 0–3), 14 days apart; then the front desk
  calls ("Called" puts it back on the list after 14 days, without messages).
- A booking marks open recalls of the same kind `booked`; cancelling that booking, or the visit
  ending as a no-show (also when corrected from completed), reopens them.
- The drawer's picker offers 3, 4, 6, 9, 12, 18 or 24 months, plus the interval in force when it is
  another one (a service may suggest any 1–60 months; recalls keep 3–24, clamped).
- Restricted (Art. 18), erased and merged patients are skipped; under 14, messages go to the
  guardian (`recipientFor`); `care.recallsEnabled = false` stops everything.
- `processDueRecalls` leases each recall (like reminders), so parallel runners never double-send.

### Wording limits

Recall messages (`careMessages.recall`) are discreet in every mode:

- no treatment, specialty, practitioner, reason or clinical detail — in the SMS, the email subject
  and the body (`reasonCode` is internal and never reaches a message);
- no marketing: no offers, prices or other services;
- always an opt-out: the privacy center, where the patient objects to recalls (Art. 21); emails
  also carry the privacy footer and one-click List-Unsubscribe;
- the link opens the practice's booking page in the practice's context (signed `?ref=`) with
  `?service=&practitioner=&via=recall`.

Italian reference for translators (WP9): `{clinic}: è il momento del tuo controllo periodico.
Prenota: {url}`, followed by the opt-out (`Per non ricevere più promemoria: {optout}`).

## Rebooking assistant

1. Staff add time off (`TimeOffForm`): `addTimeOff` returns the upcoming visits the block covers
   (same scopes as availability: practitioner, office, chair, whole practice).
2. "Rebook N patients" opens a drawer listing them (a native modal `<dialog>`). **Send offers**
   (`sendRebookOffers`): each visit is flagged `needsAttention`, its pending reminders are
   cancelled (they would announce a visit that can't happen), the offer is recorded for the
   visit's current start (an `appointment.update` audit row, `rebook: "offer"`), and the patient —
   or the guardian under 14 — gets `careMessages.practiceMoved` in their language with
   `/a/<token>/rebook`. Discreet: date and practice only. Restricted patients get no message
   (the practice calls them).
3. The patient sees three alternatives (`proposeAlternatives`), and up to nine with "Show more
   times" (`?more=1`, still this assistant: every choice moves this visit, nothing is booked next
   to it): the same practitioner first (same office first), then another practitioner at the same
   office; days closest to the original, one per day first, time of day closest to the original;
   never busy or closed; at least two hours ahead. One tap reschedules (`rescheduleAppointment`
   with `practiceMoved`): the practice caused the move, so the patient policies
   (`cancelUntilHours`, minimum notice, maximum advance) don't apply — which is why only a time the
   assistant offers right now is accepted (`acceptAlternative` recomputes the alternatives and
   refuses any other key as "taken"), and the slot is checked again. The original slot is freed and
   offered to the waitlist when bookable (e.g. a chair closure with another chair free).
4. **Call me instead** records the request for the visit's start (`rebook: "call_requested"`),
   keeps `needsAttention`, and puts the visit at the top of the call list. The visit's
   confirmation is left as it was: the patient declined nothing.
5. Or staff **cancel instead**: `cancelledBy = "staff"`, `cancelReason = "practice_unavailable"`
   (WP7's reliability metric counts these); the patient gets the usual cancellation message.

Staff see every visit a closure covers (`coveredByClosure`, checked live, never stored). The
patient is told the visit must move — manage-page card, `/a/<token>/rebook`, choosing a time,
asking for a call — only once the practice offered it (`patientRebook`): an offer recorded for
the visit's current start, `needsAttention` still set, and a closure still covering it. So a visit
staff force-booked into a blocked time, or one they will phone about, shows the patient nothing;
"mark handled" (clearing `needsAttention`) withdraws an offer; a visit moved since the offer needs
a new one. Removing the closure ends it and brings the reminders back (`afterClosureRemoved`);
`needsAttention` stays for staff to clear, since the patient may have been told the visit moves.

## Digital medical history (anamnesis)

### Data flow

```
form_templates (DEFAULT_ANAMNESIS_V1, org_id NULL, created on first use)
      │ schema: sections → fields (labels = care.anamnesis.* keys, answers = codes or free text)
      ▼
/{locale}/a/<token>/forms/anamnesis   (appointment link only; preview bots see nothing;
      │                                rate limited; opening audited as appointment.view)
      │ answers stay in the browser
      ▼ "Sign and send"
sendOtp(form_signature) ──▶ the contact on file (phone, else email; the guardian's under 14)
      │ code + signer's name
      ▼
submitAnamnesis: answers checked → code verified (purpose + target = contact on file)
      ▼
form_submissions: answers  = encryptedText("v1:…", AES-256-GCM, AAD form_submissions.answers)
                  red_flags = field ids (plain, for the calendar)
                  signer_name, signed_at, signed_via (otp_sms|otp_email), otp_challenge_id,
                  locale, version, template_id   ── audit: patient.update (form_submission)
      ▼
calendar:     status complete/missing → everyone with calendar.read
              red-flag boolean        → patient.clinical.read only (not audited: one boolean)
drawer:       which red flags         → patient.clinical.read only; each showing audited as
                                        patient.clinical.view (view: red_flags) on the patient
patient page: how many alerts per form → patient.clinical.read only (never which ones)
sheet:        the answers             → patient.clinical.read only; each opening audited as
                                        patient.clinical.view (view: answers) on the patient
restricted patient: all of the above only after a restricted-access reason (mayReadPatient)
      ▼
print sheet (clinical record) → "Mark as added to the clinical record" sets exported_at
```

The sheet is a native `<dialog>` opened with `showModal()`: opened from the appointment drawer
(itself a modal dialog) it stacks above it in the top layer, the drawer goes inert behind it, and
Escape closes the sheet only. For printing it is re-opened as a plain dialog so a long history
runs over several pages.

- **Questions** (`DEFAULT_ANAMNESIS_V1`): anticoagulants/antiplatelets, bisphosphonates or
  denosumab, other medication, allergies (and to what), heart devices / valve replacement /
  endocarditis, diabetes, pregnancy, smoking, dental anxiety, notes. **Red flags**: a "yes" to
  anticoagulants, bisphosphonates, allergies, cardiac, diabetes, pregnancy.
- **Signature**: a simple electronic signature (eIDAS Art. 3(10)): the signer's name plus a
  one-time code proving control of the contact on file. A code sent anywhere else, or for another
  purpose, is refused. The code is never stored or logged in clear (`src/lib/otp.ts`).
- **Invitations** (`careMessages.anamnesisInvite`): when `care.anamnesisEnabled`, for scheduled
  visits 2 hours to 7 days ahead whose patient has no form signed within
  `care.anamnesisRefreshMonths`. Each visit is invited once: an unsigned row (no answers, no
  flags) records the invitation and is filled in when the patient signs.
- **Status** (`anamnesisStatuses`): `complete` = a form for that visit or signed within the
  refresh window before it; `missing` = collected online, upcoming, none; `none` = past visit
  without one; `null` = not collected online.
- **Reception** sees only complete/missing: `loadCareFlags` sets `redFlag = null` without
  `patient.clinical.read`, and `clinicalAnamnesis` refuses (nothing read, nothing logged).
- **Retention**: `form_submissions` is part of the clinical documentation. WP5's retention may
  delete a form only after `exported_at` (`formSubmissionMonths`); erasure requests restrict
  rather than delete forms not yet in the clinical record (Art. 17(3)(b)/(c)).
- Free text is never logged and never sent to calendars or WhatsApp.

## Minors

- `appointments.minorFlag` (under 18 on the day of the visit) shows the badge **"Parental consent
  required"** (it: "Consenso genitori richiesto") on the calendar and in the drawer: treatment of
  a minor needs the parents' informed consent.
- Under 14, messages go to the guardian (`recipientFor`); a child may have no contacts of their own:
  the guardian's then identify the record.

## Duplicate patients

`upsertPatient` never merges silently:

- **staff**: same first name and a shared contact, but both birth dates present and different
  → a new record with `possibleDuplicateOfId`;
- **public**: an existing record is reused only on an exact match (all identifiers, birth date
  included, not restricted); any other record sharing the first name and a contact → a new
  record, flagged.

`/dashboard/patients/duplicates` lists the flagged pairs (`patient.read`; contacts only with
`patient.contact.read`; a restricted record masked without `patient.restricted.read`, and then
no decision on that pair). **Merge** (`patient.write`, audited `patient.merge`) moves appointments
(with reminders and reviews), messages, recalls, forms, waitlist entries and privacy requests to the
kept record, fills its missing contacts and birth date, adds up no-shows, and leaves the other
record as a tombstone (`mergedIntoId`). The consent ledger is append-only and is **not** moved:
consent lookups and the privacy center follow the tombstone. Restricted records can't be merged.
**Different people** clears the flag (audited). Bookings by a merged id land on the kept record.

Restricted patients (critique 16): a staff booking for a restricted record needs a reason
(`restrictedAccessReason`), audited as `patient.restricted_access`; without it the booking fails
with `BookingError("restricted")` (API: 409 `restricted`).

## Jobs

`runCareJobs(now)` returns `{ recallsSent, risksRefreshed, formInvites }`; each step logs and
continues on failure.

## Seed

`scripts/seed/care.ts`: recall suggestions on services (hygiene 6, check-up 12, orthodontic
checks 3 months); the flagship practice uses risk and the online medical history; recalls in every
dashboard state; risk for the next two weeks (one high-risk unconfirmed visit for the call list);
a child under 14 booked by a parent; one signed medical history with red flags; one possible
duplicate.

## Open legal points

To be reviewed by a lawyer/DPO:

1. Risk scoring is profiling on health-derived data (attendance): legitimate interest paired with
   Art. 9(2)(h), disclosed in the notices with the right to object; a DPIA (Art. 35, Garante list)
   is a go-live blocker.
2. Recalls as care under Art. 9(2)(h) when a clinician sets the interval; the opt-out wording.
3. The simple electronic signature's evidential value for the anamnesis (eIDAS, CAD art. 20) and
   whether practices need an advanced signature for specific consents (it is not used for
   informed consent to treatment).
4. Retention of anamnesis forms as clinical documentation (10 years by analogy with the clinical
   record) versus `formSubmissionMonths`.
5. "Parental consent required" covers informed consent to treatment for under-18s; the age of
   digital consent (14) only governs message routing and online consents.
