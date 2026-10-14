# Data protection impact assessment (DPIA) — Sorriso

> **Draft. To be reviewed and signed off by Sorriso's DPO and a privacy lawyer before go-live.**
> Sorriso writes this assessment for the processing it designs. Each practice, as controller of
> its patients' data, remains responsible for its own DPIA (Art. 35 GDPR); it may adopt this one
> and add what it does outside Sorriso. Article references are to the GDPR unless stated
> otherwise. Statements marked *(verify)* must be checked against primary sources before they
> are relied on.

| | |
| --- | --- |
| Version | 2026-10 (draft) |
| Owner | Sorriso product and engineering (WP5) |
| Reviewers | DPO, legal counsel, security lead |
| Next review | Every material change (see the PR template's "DPIA impact reviewed" box) and at least yearly |

## 1. Why a DPIA is required

- **Health data on a large scale (Art. 35(3)(b)).** A booking reveals that a person receives
  dental care and often which treatment; notes, the medical-history form and missed-appointment
  history are health data (Art. 9). Sorriso processes them for many practices.
- **Profiling (Art. 35(3)(a) does not apply — no decision with legal or similarly significant
  effect — but profiling is on the Garante's list).** Adaptive reminders estimate the likelihood
  of a missed visit from past appointments.
- **The Garante's list of processing that always requires a DPIA** (provvedimento n. 467 of
  11 October 2018 *(verify)*) includes systematic processing of health data with new
  technologies and profiling of vulnerable data subjects (patients, minors). Two criteria from the
  EDPB/WP29 guidelines (WP248 rev.01) are met at least: sensitive data, data concerning
  vulnerable subjects (patients, children), large scale, innovative use (online booking
  marketplace with risk scoring).

**Go-live blocker:** adaptive reminders (`privacy.riskBasedReminders`) and no-show tracking may
not be switched on for real patients until this DPIA, `lia-no-show.md` and
`lia-adaptive-reminders.md` are signed off.

## 2. Description of the processing

The authoritative list of purposes, legal bases, data categories, recipients and retention keys is
`src/lib/privacy/roles.ts` (`PURPOSES`); the register views are generated from it
(`/dashboard/settings/privacy/register` for each practice, `ropa-sorriso.md` for Sorriso).

| Area | What happens | Roles |
| --- | --- | --- |
| Booking through practice channels | Website widget, the practice's own links, front desk, partner API | Practice controller; Sorriso processor (DPA) |
| Booking from Sorriso's search pages | Explicit consent (Art. 9(2)(a)) to Sorriso, then forwarded to the practice | Sorriso controller for the intermediation; practice controller of its copy (Art. 9(2)(h)) |
| Reminders and confirmations | SMS (Twilio, EU residency), email (SMTP provider), WhatsApp only on consent | Practice controller; Sorriso processor |
| Waiting list, recalls | Offers of freed slots; recalls only when a clinician set an interval | Practice |
| Medical-history form | Encrypted answers, signed with a one-time code; red flags visible only to clinicians | Practice |
| No-show history, adaptive reminders | Count of missed visits over 24 months; an extra reminder when the risk is higher | Practice (legitimate interest + 9(2)(h)); objectable |
| Reviews | Only after a completed visit, with consent, pseudonymous by default | Sorriso controller |
| Privacy center | Account-less access with a one-time code to the records matching a verified contact | Sorriso controller |
| Access log | Every read/write of patient data, hash-chained | Practice (and Sorriso for its own chain) |

Data subjects: patients (including minors), parents and guardians, people who book for others,
practitioners, practice staff, reviewers.

## 3. Necessity and proportionality

- **Minimisation.** Discreet messages by default (no treatment, practitioner or notes in SMS,
  WhatsApp, email subjects or calendar feeds); WhatsApp off by default; marketing off by default;
  calendar feeds show times only by default. Free text that may contain health data is encrypted
  at field level (`encryptedText`).
- **Storage limitation.** Automated retention (`retention.md`), with practice-tunable periods
  bounded by `RETENTION_LIMITS`.
- **Accuracy.** Contacts are verified per contact (one-time codes, replies); staff can correct
  records; patients can correct contacts in the privacy center.
- **Transparency.** Notices generated from the same register (`buildNotice`), including
  profiling and the right to object; the export's `summary.html` carries the Art. 15(1)(a)-(h)
  information.
- **Rights.** Requests inbox with statutory deadlines and reminders; one-step export (JSON, CSV,
  FHIR), restriction and pseudonymisation; objection recorded in the consent ledger.
- **No lock-in.** Full practice export at any time; account closure with retrieval period and a
  certificate of deletion.

## 4. Risks to data subjects

Likelihood (L) and severity (S) on a 1-4 scale before measures; residual after.

| # | Risk | L | S | Main measures | Residual |
| --- | --- | --- | --- | --- | --- |
| R1 | A message on a lock screen or shared phone reveals dental treatment to family, employer | 3 | 3 | Discreet content by default; warning before "detailed"; guardian routing under 14 | Low |
| R2 | A family member sharing a phone or a mistyped email sees another adult's history in the privacy center | 3 | 3 | Per-contact verification; birth date + surname challenge for shared or unverified matches; guardian match ends at 18 | Low |
| R3 | Staff browse records without need (curiosity, ex-partner) | 2 | 4 | Role-based access; access log visible to the practice *and* to the patient in the export; restricted records need a reason each time | Medium-low |
| R4 | Breach at Sorriso or a sub-processor (database, backups, SMS logs) | 2 | 4 | Field encryption with keys outside the database; HMAC of IPs; MFA; least-privilege production access; breach runbook (24 h to practices) | Medium-low |
| R5 | Transfer to US authorities through US-parented providers | 1 | 3 | EU hosting regions; DPF + SCC; TIA; encryption of free text; WhatsApp only on explicit consent | Low |
| R6 | Profiling leads to unfair treatment (refused booking, deposit) | 1 | 3 | Risk only adds help (an extra reminder); never blocks booking; objection honoured; no automated decision (Art. 22 not engaged) | Low |
| R7 | Marketplace consent bundled with booking | 2 | 2 | Separate unticked checkboxes; practice booking possible without platform consent; consent ledger with text version | Low |
| R8 | Data kept longer than needed | 3 | 2 | Daily retention job, idempotent and audited; erasure and restriction tools | Low |
| R9 | Minor's consent given by the child | 2 | 3 | `recordConsent` refuses consent-based grants under 14 without a guardian | Low |
| R10 | Tampering with the access log to hide misuse | 1 | 3 | HMAC hash chain, unique sequence, daily head logging outside the database, verification in the viewer | Low |
| R11 | Erasure wipes a family member's data (shared phone) | 2 | 2 | Erasure scoped to the patient's own rows by id (critique 18) | Low |
| R12 | Practice cannot meet the one-month deadline | 2 | 2 | Countdown badges, 7- and 2-day reminders to owners, extension workflow with reasons | Low |

## 5. Measures

Technical and organisational measures are listed in the DPA's Annex II, generated from
`SECURITY_CONTROLS` in `src/lib/privacy/register.ts` — only controls that exist in the code.
Organisational measures: staff instructions (`authorized-persons.md`), breach runbook
(`breach-runbook.md`), transfer assessment (`tia.md`), retention policy (`retention.md`).

## 6. Consultation

- Data subjects: usability tests of the booking flow and privacy center with patients (planned).
- DPO opinion: *pending*.
- Prior consultation with the Garante (Art. 36): not expected to be needed if the residual risks
  above are accepted; to be reassessed by the DPO.

## 7. Open items before go-live

1. DPO sign-off of this DPIA and both legitimate-interest assessments.
2. Lawyer review of the Italian texts (notices, consents, DPA, terms, staff instructions).
3. Confirm each US parent's DPF certification on dataprivacyframework.gov (otherwise `scc`).
4. Confirm the clinical-record retention period practices must apply (commonly 10 years,
   linked to the limitation period; Legge 24/2017 *(verify)*) and document it in the notice.
5. Penetration test of the dashboard, privacy center and public booking API.
