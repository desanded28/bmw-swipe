# Romanian glossary (ro)

Terminology, register and review status for the Romanian dictionaries in
`src/i18n/messages/ro/`. Source language: English (`messages/en`), except the consent texts
(`consents`), which are translated from the authoritative Italian (`messages/it/consents.ts`) and
checked against the English.

## Register and typography

- **Register:** formal *dumneavoastră* everywhere, for patients and for staff. Imperatives use the
  2nd person plural ("Alegeți", "Salvați", "Introduceți"); possessives use *dumneavoastră*
  ("programarea dumneavoastră"). Buttons keep the same imperative ("Salvați", "Anulați").
- **Diacritics:** ă â î ș ț, always with **comma below** (ș U+0219, ț U+021B, Ș U+0218, Ț U+021A),
  never the cedilla forms ş ţ. â inside words, î at the start and end of words ("în", "mâine",
  "sunteți", "înapoi").
- **Quotes:** Romanian „…” in screens and emails; straight '…' in SMS texts.
- **SMS** (`patientMessages`, `careMessages`, `privacyMessages`, `common.otp.sms`): straight
  apostrophes only, no `…`, no curly quotes, no dashes other than `-`, shortest natural phrasing.
  Any Romanian diacritic switches an SMS to UCS-2 (70 characters per segment), so full SMS texts
  stay short; the `*Short` variants use plain ASCII letters only (no diacritics) so they stay in
  GSM-7. The confirm/cancel reply words are **DA** / **NU** (`src/lib/inbound.ts`).
- **Discretion:** messages never add treatment details that the English does not have.
- **Dates:** never in dictionaries; they arrive formatted ("marți, 13 octombrie la 10:30").
  Weekdays and months are lower case in Romanian.
- **Plurals:** `one` / `few` / `other`. `few` covers 0, 2-19 and numbers ending in 01-19
  ("2 zile", "19 zile", "101 zile"); `other` covers 20+ and needs the particle *de*
  ("20 de zile", "1.500 de zile").
- **Brands and technical words stay:** Sorriso, SMS, WhatsApp, email, API, FHIR, OK, ICS, PDF, CSV,
  JSON, ZIP, GDPR, DPO. "Email" is written *email* (pl. *emailuri*), as current Romanian usage.

## Terms

| English | Romanian | Notes |
| --- | --- | --- |
| appointment | programare (pl. programări) | "your appointment" = programarea dumneavoastră |
| book / booking | a face o programare, a programa / programare | "Book" = Programați-vă; "online booking" = programare online |
| practice, studio (studio dentistico) | cabinet (stomatologic) | the business; "clinic" = clinică only where English says clinic |
| practitioner | medic | staff who treat patients; covers hygienists in UI lists |
| dentist | medic dentist, dentist | |
| hygienist | igienist dentar | |
| treatment | tratament | |
| service (catalogue item) | serviciu | |
| visit | vizită, consultație | "first visit" = prima consultație |
| check-up | control | "check-up interval" = interval între controale |
| recall | rechemare (la control) | feature name: Rechemări |
| waiting list, waitlist | listă de așteptare | |
| reminder | reamintire (pl. reamintiri) | "appointment reminder" = reamintire programare |
| no-show | neprezentare; status: Neprezentat | "missed appointment" = programare ratată |
| slot, time | interval (orar), oră | "free slot" = interval liber |
| schedule, calendar | program, calendar | |
| room / chair | sală / fotoliu (unit) | never "cabinet", reserved for the practice |
| location | locație | |
| reception | recepție | |
| owner / admin | proprietar / administrator | |
| dashboard | panou de control | |
| patient | pacient (pl. pacienți) | |
| guardian, legal guardian | tutore, tutore legal; parent = părinte | "parent or legal guardian" = părinte sau tutore legal |
| minor | minor | |
| medical history, anamnesis | istoric medical, anamneză | form: chestionar de anamneză |
| health fund (fondo sanitario) | fond de sănătate (fondo sanitario) | Italian supplementary health fund; keep the Italian term where it first appears |
| health insurance | asigurare de sănătate | |
| consent | consimțământ | "withdraw consent" = retragerea consimțământului |
| object / objection | a se opune / opoziție | GDPR Art. 21 |
| data controller | operator (de date) | official Romanian GDPR term; "independent controller" = operator independent |
| joint controller | operatori asociați | |
| processor | persoană împuternicită de operator (împuternicit) | official GDPR term |
| sub-processor | subîmputernicit (persoană subîmputernicită) | |
| data processing agreement (DPA) | acord de prelucrare a datelor (DPA) | |
| data subject | persoană vizată | |
| personal data | date cu caracter personal, date personale | |
| processing | prelucrare | |
| special categories / health data | categorii speciale de date / date privind sănătatea | |
| privacy notice | nota de informare privind confidențialitatea (informare privind confidențialitatea) | short label: Informare privind confidențialitatea |
| privacy center | centrul de confidențialitate | |
| privacy choices / preferences | opțiunile de confidențialitate / preferințe | |
| rights request | cerere privind drepturile (GDPR) | "request" alone = cerere |
| right of access / rectification / erasure / restriction / portability / objection | dreptul de acces / la rectificare / la ștergere / la restricționarea prelucrării / la portabilitatea datelor / la opoziție | |
| data breach | încălcare a securității datelor (cu caracter personal) | |
| DPO | responsabil cu protecția datelor (DPO) | |
| supervisory authority | autoritatea de supraveghere | Italy: Garante per la protezione dei dati personali |
| legitimate interest | interes legitim | |
| retention | păstrare (perioadă de păstrare) | |
| audit log | jurnal de audit | |
| export | export, a exporta | |
| verification code (OTP) | cod de verificare | |
| sign in / sign out | conectare / deconectare | "Conectați-vă" |
| two-step verification | verificare în doi pași | |
| passkey | cheie de acces (passkey) | |
| review | recenzie | "verified review" = recenzie verificată |
| feedback | feedback, părere | |
| marketplace / directory | platformă, catalog de cabinete | |
| opt out / unsubscribe | dezabonare, a renunța | SMS: "STOP pentru dezabonare" |

## Native-speaker review

- Draft by the WP9 Romanian translator (machine-assisted), 2026-10-15.
- **Native-speaker review sign-off: pending.** Reviewer: ____________ Date: ________

## Needs lawyer review

Every legal and consent string below is a draft translation. Italian is authoritative; these must
be reviewed by a lawyer or the DPO before go-live (docs/i18n.md, "Legal and consent texts").

- `consents.*` (all purposes: title, label, description), translated from `it/consents.ts`.
- `legalPatient.*` (privacy notice for patients, platform notice, terms of use, cookie notice):
  translated from the English draft, not yet checked against the Italian.
- `legalPractice.*` (terms of service for practices, data processing agreement, sub-processors,
  staff instructions): translated from the English draft.
- `legalPatient.italianPrevails`, `legalPractice.*.italianPrevails`,
  `accessibility.translationNotice`, `marketplace.*.translationNotice`,
  `reviews.*.translationNotice`: the "Italian version prevails" lines.
- Consent wording repeated outside `consents` (booking steps, privacy center, minors and guardian
  declarations): see the list of keys under "Strings to check" below.
- `patientMessages.breachNotice.*` and `privacyMessages.*` (GDPR Art. 34 breach communication and
  rights-request messages).
- `privacyAdmin.*` texts that describe legal obligations (deadlines, Art. 12-22 rights, breach
  notification to the Garante within 72 hours).

## Strings to check

Keys where the translator was unsure, kept here for the reviewer:

- (filled in as namespaces are translated)
