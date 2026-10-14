# Legitimate-interest assessment — adaptive reminders (`adaptive_reminders`)

> **Draft. To be reviewed and signed off by the DPO before the feature is enabled for real
> patients (DPIA go-live blocker).** Method: EDPB Guidelines 1/2024 (Art. 6(1)(f)), paired with
> Art. 9(2)(h). This is **profiling** (Art. 4(4)); it is disclosed in the notice together with the
> right to object (Art. 21(1) and (4)). The summary shown to practices in the privacy settings is
> taken from this document.

## What happens

When a practice switches on `privacy.riskBasedReminders`, each appointment gets a risk level
(low / medium / high) computed from the patient's missed and late-cancelled appointments of the
last 24 months and simple appointment features (e.g. booked long in advance, not yet confirmed).
Reminder rules can be limited to medium or high risk (`ReminderRule.onlyIfRisk`): a higher risk
adds **one more reminder**. Nothing else changes.

## 1. Purpose test

Fewer missed visits mean continuity of care for the patient, shorter waits for others and less
wasted clinical time. Legitimate, real and present.

## 2. Necessity test

- Uses only data the practice already holds (appointment history); no external data, no
  inference about health beyond attendance.
- The output is a coarse level with human-readable reasons, not a score sold or shared.
- Alternative considered: send the extra reminder to everyone. Rejected as more intrusive (more
  messages to all patients, more health-related content on lock screens).

## 3. Balancing test

| Factor | Assessment |
| --- | --- |
| Effect on the patient | One extra reminder; never blocks a booking, never triggers a deposit, never changes priority. No decision with legal or similarly significant effect: Art. 22 is not engaged |
| Transparency | Notice discloses the profiling, its logic in plain words and the right to object; staff see the reasons next to the level |
| Control | Objection at any time (`adaptive_reminders` or `no_show_tracking` = false) restores standard reminders from the next scheduling |
| Accuracy | Levels recomputed regularly; corrections of attendance flow into the next computation |
| Vulnerable subjects | Minors' reminders go to the guardian under 14; no other effect |
| Italian AI law | If the scoring is ever implemented with a machine-learning model, check the obligations of Legge 23 settembre 2025 n. 132 on AI in health care *(verify)*; the current rules are deterministic |

**Conclusion (draft):** acceptable on legitimate interest with the safeguards above, provided
the DPIA is signed off and the feature stays help-only.

## Summary for practices (shown in the privacy settings)

The purpose (fewer missed visits, shorter waits for others) is legitimate; the history used is
limited to missed and cancelled appointments of the last 24 months; the only effect is one more
reminder, never a refusal of care or a deposit; patients are told in the notice and can object at
any time, after which they get standard reminders. A DPIA is required before switching it on.
