# Transfer impact assessment (TIA)

> **Draft. To be reviewed by Sorriso's DPO and a privacy lawyer before go-live, and whenever a
> provider, its region or its certification changes.** Follows the EDPB Recommendations 01/2020
> on supplementary measures (version 2.0). Statements marked *(verify)* need a primary source.

The sub-processor list is `src/lib/privacy/subprocessors.ts` (`SUBPROCESSORS`), published at
`/{locale}/legal/subprocessors` and in the DPA's Annex III.

## 1. Why there is a transfer at all

Sorriso hosts and stores data in the EU. Several providers, however, are subsidiaries of US
companies. A US parent can be compelled under US law (FISA s. 702, the CLOUD Act) to produce data
held by its group, and its support staff may access systems from the US. Remote access from a
third country is a transfer (EDPB Guidelines 05/2021). Sorriso therefore treats these providers
as transfers and never describes them as "data stays in the EU".

## 2. Transfer tools

- **EU-US Data Privacy Framework (DPF)**, adequacy decision of 10 July 2023 (Art. 45), for
  certified US parents. The General Court dismissed the annulment action in *Latombe* (T-553/23,
  3 September 2025); an appeal is pending (C-703/25 P) *(verify)*.
- **Standard contractual clauses** (Commission Implementing Decision (EU) 2021/914), modules 2
  (controller → processor) and 3 (processor → processor), incorporated in each provider's DPA,
  as a fallback if the DPF is invalidated or a parent is not certified.

## 3. Assessment per provider

| Provider | Data | Where | Tool | Access risk | Supplementary measures | Conclusion |
| --- | --- | --- | --- | --- | --- | --- |
| Vercel (hosting, fra1) | All requests in transit, logs | EU (Frankfurt) | DPF + SCC | Low: transient processing; logs carry no personal data by design | TLS; logs redacted (`log.ts`); no request bodies logged | Acceptable |
| Turso (database) | All stored data | EU | DPF + SCC | Medium: complete dataset | Field-level AES-256-GCM encryption of free text and health data with keys held in the application environment, not by Turso; HMAC of IPs and contacts | Acceptable |
| Turso backups | All stored data | EU (same region) | DPF + SCC | Medium | As above; limited backup retention (`BACKUP_RETENTION_DAYS`) | Acceptable |
| Twilio (SMS, IE1) | Phone numbers, message text, delivery metadata | EU (Ireland, IE1 data residency) | DPF + SCC | Medium: message content in clear to the carrier network by nature | Discreet content by default; region-pinned credentials; deletion of provider copies after `providerMessageDays` (WP3) | Acceptable |
| WhatsApp (Meta, through Twilio) | Phone numbers, message content | United States | DPF + SCC | Medium-high: Meta learns the patient is in contact with the practice | Off by default; only with the practice's opt-in **and** the patient's explicit consent (consent text names Meta and the US); templates without health details | Acceptable only with consent |
| SMTP provider | Email addresses, message content | Configured per deployment | `SMTP_PROVIDER_TRANSFER` (default DPF + SCC) | Medium | No tracking pixels or link rewriting; discreet subjects; TLS required (`SMTP_REQUIRE_TLS`) | Acceptable once the provider is named |

## 4. Laws and practices of the destination country

- FISA s. 702 and EO 12333 apply to "electronic communication service providers"; all US-parented
  cloud and messaging providers above may qualify.
- EO 14086 (2022) introduced necessity and proportionality limits and the Data Protection Review
  Court, on which the DPF adequacy decision relies.
- No provider has reported to Sorriso a request for Sorriso customer data *(to be confirmed in
  each provider's transparency report and DPA annex)*.

## 5. Re-evaluation triggers

A new provider or region; a change in a parent's DPF status; a court ruling on the DPF; a
transparency report showing requests; new categories of data sent to a provider. Every change of
the list is a new `LEGAL_VERSIONS.subprocessors`, announced to practices 30 days before it applies.
