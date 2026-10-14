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
- **Deferred erasures are carried out.** An erasure request the practice could not grant at once
  (erasePatient in `restrict` mode: kept on a legal ground until `retainUntil`, marked by
  `patients.erasure_requested_at`; records marked before that column existed carry the
  `restrictionReason` prefix `erasure:…`, still honoured) is pseudonymised the day after `retainUntil`, whatever
  `erasureDefault` says and however recent the last visit, forms included (the ground for keeping
  them has ended).
- **Restricted, erased and merged records keep no derived history**: their no-show count is not
  recomputed (an erasure removed it; a restricted record is only stored, Art. 18(2)).

## Rules per practice

| Data | Rule | Setting (default) |
| --- | --- | --- |
| Message text (body, subject, HTML) | Blanked, `redactedAt` set | `messageBodyMonths` (12) |
| Message rows (metadata) | Deleted | `messageMetaMonths` (24) |
| Reminders | Deleted after the appointment | `reminderDays` (90) |
| Waiting list, active | Deleted after the last useful date | `waitlistDays` (90) |
| Waiting list, booked or removed | Deleted 30 days after closing (`closed_at`) (*) | fixed 30 days |
| Patient's booking note and cancellation reason | Cleared after the visit | `patientNoteDays` (90) |
| Patients never seen (no appointment, no active waiting-list entry) | Pseudonymised | `neverSeenPatientMonths` (12) |
| Patients inactive (last appointment) | Restricted or pseudonymised (`erasureDefault`, default restrict) | `patientInactiveMonths` (120) |
| Erasure deferred to `retainUntil` | Pseudonymised the day after `retainUntil` | set per request |
| Guardian contacts | Cleared once the patient is 18 (critique 10) | fixed |
| Marketing consent | Lapses after 24 months without contact: a withdrawal row, source `retention` | fixed 24 months |
| No-show count | Recomputed over the last 24 months; 0 after an objection; not for erased, restricted or merged records | fixed 24 months |
| Signed medical-history forms copied to the clinical record | Deleted `formSubmissionMonths` after they were copied (`exported_at`); forms not copied yet and unsigned invitation rows are never deleted here (they go with the record) | `formSubmissionMonths` (120) |
| Recalls booked or dismissed | Deleted | fixed 24 months |
| Consent proofs of records no longer on file (`patientId` null) | Deleted `consentMonths` after they were unlinked (`unlinked_at`) (**) | `consentMonths` (120) |
| Closed privacy requests | Deleted | `privacyRequestMonths` (60) |
| Free text of closed requests of erased patients (details, answer, extension reason, the contact kept to answer in `answer_contact`) | Cleared 30 days after closing (cleared at once when the erasure itself answered the request) | fixed 30 days |
| Review reports decided or closed (DSA notices: details, the patient's response, the statement of reasons) | Deleted 24 months after the decision (the 6-month appeal window plus time to defend it) | fixed 24 months |
| Text of removed reviews (the comment and the statement of reasons) | Cleared 183 days after the decision (the DSA Art. 20 appeal window, `APPEAL_DAYS`) when no report or appeal about the review is still open; the rating and dates stay | fixed 183 days |
| Practitioners' daily profile statistics (views, search impressions) | Deleted | fixed 24 months |
| Privacy-notice versions superseded by a newer one (content hashes) | Deleted 10 years after the newer one was published | fixed 10 years |
| Acceptances of superseded legal-document versions | Deleted | fixed 10 years |
| Access log | Oldest rows deleted behind an anchor (`audit_anchors`), chain stays verifiable | `auditMonths` (24) |

(*) Entries closed before `waitlist.closed_at` existed (migration 0003) and not backfilled: the
last offer, or the creation date, stands in for it.

(**) `consents.unlinked_at` is set by the erasure and by the purge of a closed practice. Proofs
unlinked before that column existed (migration 0003) are counted from the consent row's own date.

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
| Platform notice versions (org_id NULL) superseded | Deleted 10 years after the newer one |
| Certificates of deletion (`org.close` rows, stage `purged`, in the platform chain) | Re-recorded at the head of the chain before pruning reaches them, for 10 years after the purge (the link keeps working) |
| Audit chains of practices that no longer exist (older purges) | Default `auditMonths` from their last rows; a purge now deletes the chain at once |

## Other jobs in the same run

- **Privacy-request deadline reminders** to owners 7 and 2 days before the deadline, once each per
  deadline (`reminders_sent`), platform admins for requests to Sorriso.
- **Sub-processor change notices** to owners, once per list version.
- **Purge of closed practices** whose `purgeAfter` has passed (`org-closure.ts`): rows deleted,
  provider copies deleted, staff accounts belonging to no other practice deleted, the practice's
  own access log deleted (only the chain's last hash stays, in `audit_anchors`; the log is part of
  the export offered before closing), certificate of deletion issued.

## Not handled here

- Copies at the messaging provider after `providerMessageDays`: WP3's cleanup
  (`deleteProviderMessage`, `messages.providerDeletedAt`).
- Backups: overwritten by the provider after `BACKUP_RETENTION_DAYS` (default 30).
