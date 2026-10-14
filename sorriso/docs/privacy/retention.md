# Retention

> **Draft. Periods and their legal grounds to be confirmed by the DPO.** Implementation:
> `src/lib/privacy/retention.ts` (`runRetention`), run daily by `/api/cron/retention`
> (vercel.json `15 2 * * *`), in-process on long-running servers (`src/instrumentation.ts`), or by
> hand with `npm run retention`. Tests: `src/lib/privacy/retention.test.ts`.

## Principles

- **Strict boundaries.** A row exactly at its cutoff is kept; one millisecond older is processed.
  "N months" are calendar months, clamped to the month's end.
- **Idempotent.** A second run in a row changes nothing and writes no audit row.
- **Accountable.** Each practice with changes gets one `retention.run` audit row with counts only
  (no ids, no personal data); Sorriso's own rows get one in the platform chain. Every run logs a
  summary, and the cron route logs every audit chain's head (`logAuditHeads`).
- **Practice settings within legal limits.** `privacy.retention` is clamped to `RETENTION_LIMITS`
  (`src/lib/privacy/settings.ts`), editable in the privacy settings.
- **Clinical record first.** A record with a future `retainUntil` (a legal ground to keep it) is
  never pseudonymised or restricted by retention. Medical-history forms not yet copied to the
  clinical record are never deleted: the record is restricted instead.

## Rules per practice

| Data | Rule | Setting (default) |
| --- | --- | --- |
| Message text (body, subject, HTML) | Blanked, `redactedAt` set | `messageBodyMonths` (12) |
| Message rows (metadata) | Deleted | `messageMetaMonths` (24) |
| Reminders | Deleted after the appointment | `reminderDays` (90) |
| Waiting list, active | Deleted after the last useful date | `waitlistDays` (90) |
| Waiting list, booked or removed | Deleted 30 days after closing (*) | fixed 30 days |
| Patient's booking note and cancellation reason | Cleared after the visit | `patientNoteDays` (90) |
| Patients never seen (no appointment, no active waiting-list entry) | Pseudonymised | `neverSeenPatientMonths` (12) |
| Patients inactive (last appointment) | Restricted or pseudonymised (`erasureDefault`, default restrict) | `patientInactiveMonths` (120) |
| Guardian contacts | Cleared once the patient is 18 (critique 10) | fixed |
| Marketing consent | Lapses after 24 months without contact: a withdrawal row, source `retention` | fixed 24 months |
| No-show count | Recomputed over the last 24 months; 0 after an objection | fixed 24 months |
| Medical-history forms copied to the clinical record | Deleted | `formSubmissionMonths` (120) |
| Recalls booked or dismissed | Deleted | fixed 24 months |
| Consent proofs of records no longer on file (`patientId` null) | Deleted (**) | `consentMonths` (120) |
| Closed privacy requests | Deleted | `privacyRequestMonths` (60) |
| Acceptances of superseded legal-document versions | Deleted | fixed 10 years |
| Access log | Oldest rows deleted behind an anchor (`audit_anchors`), chain stays verifiable | `auditMonths` (24) |

(*) The schema stores no closing date for waiting-list entries: the last offer, or the creation
date, stands in for it. This can delete a closed entry earlier than 30 days after it closed, never
later. Requested: `waitlist.closed_at`.

(**) Counted from the consent row's date, because the unlinking date is not stored: a proof
older than the period is deleted at the next run after the erasure. Requested from the lead: a
`consents.unlinked_at` column (or count from the erasure audit row).

## Rules for Sorriso's own rows and technical data

| Data | Rule |
| --- | --- |
| Staff sessions, patient (privacy-center) sessions | Deleted once expired |
| Rate-limit buckets | Deleted once their window ended |
| One-time codes | Deleted 2 days after creation once expired (send limits count over a day) |
| Login attempts | Deleted after 90 days |
| Password-reset, verification and invite tokens | Deleted 1 day after expiry or use |
| Platform messages (org_id NULL: OTPs, staff emails of purged practices) | Default message periods |
| Platform consents (org_id NULL) unlinked, platform requests closed, platform audit chain | Default periods (`DEFAULT_RETENTION`) |
| Audit chains of purged practices | Default `auditMonths` from their last rows |

## Other jobs in the same run

- **Privacy-request deadline reminders** to owners 7 and 2 days before the deadline, once each per
  deadline (`reminders_sent`), platform admins for requests to Sorriso.
- **Sub-processor change notices** to owners, once per list version.
- **Purge of closed practices** whose `purgeAfter` has passed (`org-closure.ts`): rows deleted,
  provider copies deleted, staff accounts belonging to no other practice deleted, certificate of
  deletion issued.

## Not handled here

- Copies at the messaging provider after `providerMessageDays`: WP3's cleanup
  (`deleteProviderMessage`, `messages.providerDeletedAt`).
- Review reports and notice versions: no personal data in `notice_versions`; review reports follow
  the DSA moderation record-keeping (WP7).
- Backups: overwritten by the provider after `BACKUP_RETENTION_DAYS` (default 30).
