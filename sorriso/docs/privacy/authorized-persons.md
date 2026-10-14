# Authorised persons (Art. 29 GDPR, Art. 2-quaterdecies Codice privacy)

> **Draft. To be reviewed by the DPO and an employment lawyer (staff monitoring: art. 4
> L. 300/1970 and art. 114 Codice privacy).** The practice designates its staff as persons
> authorised to process patient data under its authority; Sorriso provides the tools to instruct
> them, limit what they see and record what they do.

## Designation and instructions

- Every member accepts the **staff instructions** (`legalPractice.staffInstructions`, version
  `LEGAL_VERSIONS.staff_instructions`) before working with patient data: at invitation (WP6's
  invite flow) and again whenever the version changes (the dashboard gate sends them to
  `/dashboard/legal?doc=staff_instructions`). Acceptance is recorded in `legal_acceptances` with
  version, language and HMACs of IP and browser, and on the membership row.
- The instructions cover confidentiality, need-to-know access, free text, breaches, personal
  devices, calendar sync, advertising tools on the website, restricted records and the access log.

## Roles and what they can do (`src/lib/permissions.ts`)

| Permission | Owner | Admin | Practitioner | Reception |
| --- | --- | --- | --- | --- |
| Calendar, appointments and their notes | ✓ | ✓ | ✓ | ✓ |
| Patient identity and contacts | ✓ | ✓ | ✓ | ✓ |
| Patient notes and clinical record (medical history) | ✓ | ✓ | ✓ | — |
| Correct patient details | ✓ | ✓ | ✓ | ✓ |
| Record consents and withdrawals | ✓ | ✓ | — | ✓ |
| Open restricted records (with a reason each time) | ✓ | ✓ | — | — |
| Export, erase, restrict a patient | ✓ | ✓ | — | — |
| Privacy requests inbox, privacy settings, register | ✓ | ✓ | — | — |
| Access log | ✓ | ✓ | — | — |
| Accept the DPA and terms | ✓ | ✓ | — | — |
| Export all practice data | ✓ | ✓ | — | — |
| Close the account | ✓ | — | — | — |

Sensitive operations (exports, erasure, privacy settings, closure) also need a recent second
factor (`requireStepUp`).

## Monitoring and the access log

- Every read and change of patient data is recorded (`audit_log`), hash-chained and verifiable
  in `/dashboard/audit`. Staff are told so in the instructions; the log protects patients and is
  not used to assess performance (art. 4 L. 300/1970: tools used to perform work, with
  information to employees *(verify the need for a union agreement or authorisation for the
  practice's case)*).
- Patients see who (by role, not by name) accessed their record in their export.

## Leaving the practice

Removing a member (WP6) deletes their sessions; their audit rows remain (with the name shown as
"Former member" once the account is gone). Owners review the team list and the access log at
least every 6 months.
