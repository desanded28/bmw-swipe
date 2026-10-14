# Sorriso's records of processing activities (Art. 30)

> **Draft. To be reviewed by Sorriso's DPO before go-live and kept up to date.** The source of
> truth is `src/lib/privacy/roles.ts` (`PURPOSES`, with `controller: 'sorriso'` for Part A and
> `sorrisoRole: 'processor'` for Part B) and `src/lib/privacy/subprocessors.ts`. Each practice
> keeps its own register, generated in the dashboard (`/dashboard/settings/privacy/register`).

**Controller / processor:** Sorriso — legal name, address and contacts from `PLATFORM_LEGAL_NAME`,
`PLATFORM_ADDRESS`, `PLATFORM_PRIVACY_EMAIL`. **DPO:** `PLATFORM_DPO_EMAIL`.

## Part A — Sorriso as controller (Art. 30(1))

| Activity | Purpose | Legal basis | Data subjects | Data categories | Recipients | Transfers | Erasure time limits |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Bookings started on Sorriso's search pages (`booking_marketplace`) | Forward the booking to the chosen practice and manage it | Art. 6(1)(a) + 9(2)(a) explicit consent (`platform_booking_art9`) | Patients, guardians | Identity, contact, appointment, health-inferred, consent record | The chosen practice; sub-processors | DPF + SCC (Annex III) | Until consent is withdrawn or the booking's purpose ends; consent proof for the limitation period |
| Published reviews (`reviews`) | Publish verified patients' reviews | Art. 6(1)(a) + 9(2)(a) consent (`review_publication`) | Reviewers, practitioners | Review, health-inferred, consent record | Public | — | Until withdrawn or removed after moderation |
| Directory (`directory`) | Publish practices and practitioners who approved their profile | Art. 6(1)(b), 6(1)(f) | Practitioners | Professional data | Public | — | While listed |
| Ranking (`ranking`) | Neutral, explained ordering of results | Art. 6(1)(f) | Practitioners | Aggregated metrics, professional data | — | — | Recomputed; no history kept beyond the metrics window |
| Privacy center (`privacy_center`) | Let patients find their records across practices and exercise rights | Art. 6(1)(c), 6(1)(f); 9(2)(f) | Patients, guardians | Identity, contact, appointment, health-inferred, technical | Practices concerned | DPF + SCC | Sessions expire; codes purged after 2 days; requests per `privacyRequestMonths` |
| Staff accounts (`staff_accounts`) | Provide and secure dashboard access | Art. 6(1)(b), 6(1)(f) | Practice staff, practitioners | Identity, account, technical | Sub-processors | DPF + SCC | Account life; login attempts 90 days; purged with the practice |
| Requests to Sorriso (`privacy_requests`, org_id NULL) | Answer rights requests within the deadline | Art. 6(1)(c); 9(2)(f) | Patients, guardians | Identity, contact, technical | — | — | `privacyRequestMonths` after closure |
| Platform security and audit (platform chain) | Detect misuse, prove accountability | Art. 6(1)(c), 6(1)(f) | Staff, platform admins | Technical, account | — | — | `auditMonths` (default 24) |

Security measures for all rows: the DPA's Annex II (generated from `SECURITY_CONTROLS`).

## Part B — Sorriso as processor (Art. 30(2))

| Item | Content |
| --- | --- |
| Controllers | Each practice that accepted the DPA (`legal_acceptances`, document `dpa`); its identity is in `organizations` (legal name, VAT, registered office, privacy email, DPO) |
| Categories of processing | Booking through practice channels; appointment management; confirmations and reminders; waiting list; clinician-set recalls; feedback invitations (documented instruction); marketing (if the practice enables it); no-show history and adaptive reminders (if enabled); medical-history forms; partner API; access log; privacy requests |
| Transfers | Annex III of the DPA, with tools per provider (`tia.md`) |
| Security | Annex II of the DPA |
| Sub-processors | `SUBPROCESSORS`, version `LEGAL_VERSIONS.subprocessors` |
