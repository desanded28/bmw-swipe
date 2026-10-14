# Legitimate-interest assessment — missed-appointment history (`no_show_tracking`)

> **Draft. To be reviewed and signed off by the DPO before go-live.** Method: EDPB Guidelines
> 1/2024 on processing based on Art. 6(1)(f) (three-step test), read with Art. 9(2)(h) for the
> health dimension. The practice is controller; Sorriso provides the feature as its processor.

## What is processed

For each patient, the number of appointments marked "no-show" in the last **24 months**
(`patients.noShowCount`, recomputed daily by the retention job), shown to staff next to the
patient's name and used as an input to adaptive reminders (`lia-adaptive-reminders.md`).

No-show history reveals that a person was expected for dental care: it is health-related data.
The legal basis is therefore paired: Art. 6(1)(f) for the purpose, Art. 9(2)(h) (management of
health-care services, under professional secrecy, Art. 9(3)) for the special category.

## 1. Purpose test — is the interest legitimate?

- Organise the schedule: a practice with chairs and staff booked per slot needs to know which
  appointments are at risk, to call ahead or double-check confirmations.
- Offer help to patients who miss visits (an extra reminder, a call).
- Reduce waiting times for other patients (freed slots go to the waiting list).
These are lawful, real and present interests of the practice and of other patients.

## 2. Necessity test — is the processing necessary?

- A count is the minimum: no reasons, no free text, no dates shown beyond the history the record
  already holds.
- A 24-month window: older history does not predict current behaviour well and is dropped from
  the count.
- Less intrusive alternatives considered: no tracking at all (loses the organisational benefit);
  asking patients to confirm every visit (already done; does not replace history for front-desk
  planning).

## 3. Balancing test

| Factor | Assessment |
| --- | --- |
| Reasonable expectations | Patients expect a practice to know whether they attended; the notice discloses the count and its use |
| Impact | Low: never used to refuse a booking, impose a deposit or deprioritise care (enforced by design: the count only adds help) |
| Vulnerable subjects | Minors: the count is the guardian's information channel; no consequence beyond reminders |
| Safeguards | Right to object at any time (consent ledger purpose `no_show_tracking`; after an objection the count is 0); visible in the patient's export; access logged |

**Conclusion (draft):** the legitimate interest is not overridden by the patients' interests,
given the safeguards. Re-assess if the count is ever used for anything but organising and helping.

## Objection

Recorded as a `granted: false` row for `no_show_tracking` (privacy center, staff, or reply). From
the next retention run the count is 0 and the patient is excluded from adaptive reminders
(`WITHDRAWAL_EFFECTS.no_show_tracking`).
