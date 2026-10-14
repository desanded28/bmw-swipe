## What changes

<!-- What does this change do, and why? Link the issue or work package. -->

## How it was tested

<!-- Commands run (npm run typecheck, lint, test), screenshots for UI changes. -->

## Privacy and security checklist

- [ ] **DPIA impact reviewed** — does this change what personal data we collect, why, who receives it, where it goes, or how long we keep it? If yes, `docs/privacy/dpia.md` (and `roles.ts` / `subprocessors.ts` / `retention.md`) are updated and the DPO is asked to review.
- [ ] New free text that may contain health data is stored only in `encryptedText` columns and never sent to calendars, WhatsApp variables or logs.
- [ ] Every query on patients, appointments, messages, waitlist, consents, recalls or forms is scoped by `orgId` (or is a documented exception).
- [ ] Dashboard loaders call `requirePermission()`; actions use `guard(fn, { permission, audit })`; reads and writes of patient data are audited.
- [ ] No `console.*`; logs carry ids and counts only (`src/lib/log.ts`).
- [ ] No new third-party scripts, fonts, pixels, cookies or runtime requests (`npm run check:third-party`).
- [ ] A new sub-processor or a change of region is a new `LEGAL_VERSIONS.subprocessors`, announced 30 days ahead.
- [ ] User-visible text is in the package's English namespace; legal and consent texts are marked for review (Italian authoritative).
