# Personal data breach runbook

> **Draft. To be reviewed by Sorriso's DPO, security lead and legal counsel.** References:
> Art. 33-34 GDPR; EDPB Guidelines 9/2022 on personal data breach notification and 01/2021 on
> examples; the DPA (section 9). Procedures marked *(verify)* must be checked before go-live.

## Roles

| Role | Who | Duty |
| --- | --- | --- |
| Incident lead | On-call engineer | Contain, preserve evidence, open the incident record |
| DPO / privacy lead | `PLATFORM_DPO_EMAIL` | Risk assessment, notifications, records |
| Practice contact | The practice owner (and DPO if any) | Controller decision to notify the Garante and patients |

## Timeline

| When | What |
| --- | --- |
| T0 | Sorriso becomes aware: a reasonable degree of certainty that a security incident compromised personal data |
| T0 + 1 h | Incident record opened (time line, systems, data, people involved); containment started |
| **T0 + 24 h** | **Each affected practice notified** (DPA section 9) — even with incomplete information; updates follow |
| T0 + 72 h | The practice (controller) notifies the Garante unless the breach is unlikely to result in a risk (Art. 33(1)). For breaches of Sorriso's own controller processing (marketplace, reviews, privacy center, staff accounts), **Sorriso** notifies the Garante |
| Without undue delay | Communication to patients when the risk is high (Art. 34) |
| T0 + 30 days | Post-incident review and corrective actions |

## 1. Detect and contain

- Sources: alerts (audit failures `getAuditFailureCount()`, chain verification failing in the
  audit viewer, rate-limit anomalies), provider notices, reports from practices or patients.
- Contain: revoke sessions (`sessions`), revoke API keys, disable the affected integration,
  rotate credentials (see section 5), block the abused endpoint.
- Preserve evidence: snapshot the database (encrypted), export the relevant audit chains with
  `/dashboard/audit/export` (hash fields included) and the logged chain heads.

## 2. Assess the risk

Consider: categories (health data is always serious), volume, ease of identification, severity
of consequences (discrimination, embarrassment, fraud), vulnerable subjects (minors), whether the
data was encrypted with keys not compromised (field encryption may make the risk low for
encrypted fields only). Record the assessment and the reasoning even when no notification is made
(Art. 33(5)).

## 3. Notify the practices (processor duty, within 24 hours)

Email to owners and the practice DPO, and a dashboard banner. Template:

> **Subject:** Personal data breach affecting [practice] — Sorriso
>
> On [date/time] Sorriso became aware of [nature of the breach]. Data concerned: [categories]
> of about [number] patients and [number] records. Likely consequences: [..]. Measures taken:
> [..]. Measures proposed to you: [..]. Contact: [DPO]. We will send updates as we learn more.
> As controller, you have 72 hours from your awareness to notify the Garante unless the breach is
> unlikely to result in a risk to patients; we will help you with the notification.

## 4. Notify the Garante

- Through the Garante's online breach notification procedure on its services portal
  (servizi.gpdp.it) *(verify the current URL and form)*; keep the receipt.
- Content (Art. 33(3)): nature, categories and approximate numbers of data subjects and records,
  DPO contact, likely consequences, measures taken or proposed. Phased notification is allowed.

## 5. Communicate to patients (Art. 34) — template

Italian is authoritative; send in the patient's language (`patients.locale`), by email or SMS,
plainly:

> **Oggetto:** Comunicazione di violazione dei dati personali — [studio]
>
> Gentile paziente, il [data] si è verificata una violazione che ha riguardato alcuni dati
> personali che ti riguardano: [categorie]. Le possibili conseguenze sono [..]. Abbiamo già
> [misure adottate]. Ti consigliamo di [misure per l'interessato: es. diffidare di messaggi che
> chiedono codici]. Per informazioni: [contatto del titolare / DPO].
>
> *English:* On [date] a breach affected some of your personal data: [categories]. Possible
> consequences: [..]. We have [measures]. We recommend that you [..]. Contact: [..].

Public communication instead, when individual notice would involve disproportionate effort
(Art. 34(3)(c)).

## 6. Key rotation

- **Data encryption keys** (`DATA_ENCRYPTION_KEYS`): add a new key first in the list (it becomes
  active), keep the old ones for decryption, deploy, run `npm run db:encrypt` to re-encrypt
  (`needsReencrypt`), then remove the compromised key and deploy again.
- **HMAC secret** (`HMAC_SECRET`): rotating it invalidates every audit-chain hash and all stored
  HMACs (contacts, IPs, tokens). Before rotating: verify every chain, record the heads
  (`logAuditHeads`), export the audit log; after rotating, document the cut-over in the incident
  record. Patients' one-time-code sessions and unsubscribe links signed with the old secret stop
  working.
- **Provider credentials** (Twilio IE1/US1, SMTP, database token): rotate at the provider, update
  the environment, redeploy.
- **Staff sessions and API keys:** revoke all sessions of the affected users; revoke and reissue
  API keys.

## 7. Records

Every breach — notified or not — is recorded with facts, effects and remedial action (Art. 33(5)),
in Sorriso's incident register and, for practices, in theirs. Keep for at least 5 years.
