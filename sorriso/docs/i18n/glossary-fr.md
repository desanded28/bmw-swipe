# Glossaire français (fr)

Translation glossary for `src/i18n/messages/fr/*.ts`. Source: English (`messages/en`), except the
`consents` namespace, which is translated from the authoritative Italian (`messages/it/consents.ts`)
and cross-checked against the English.

## Register and style

- **Vous** everywhere, for patients and for staff. Patient texts: warm but plain ("Votre
  rendez-vous est confirmé."). Staff dashboard: neutral, professional, infinitive or imperative
  for buttons ("Enregistrer", "Annuler le rendez-vous").
- Buttons and labels: sentence case, no final full stop. Titles: sentence case (French does not
  capitalise every word).
- Typography in UI and emails: French punctuation spacing is **not** forced in dictionaries (no
  no-break spaces before `: ; ? !`), because the same strings feed SMS and plain-text emails and
  the GSM-7 budget. Write `«` `»` only in UI/legal text; quotes inside SMS are straight `'` / `"`.
  The ellipsis character `…` is allowed in UI loading texts only, never in SMS.
- **SMS** (`patientMessages`, `careMessages`, `privacyMessages`, `common.otp.sms`): straight
  apostrophe `'`, no `…`, no curly quotes, no `«»`, no en/em dash. GSM-7 has `é è ù à` but not
  `ê â î ô û ç ë ï` (lower-case `ç` is missing): prefer words without them in the short variants
  where a natural alternative exists. Confirm keyword: **OUI**, cancel keyword: **NON**, opt-out
  **STOP**, opt-back-in **START**. Messages stay discreet: never add treatment details the
  English does not have.
- Gender: masculine generic for roles ("le praticien", "le patient"), as is usual in French
  healthcare UI; no inclusive point (·) in SMS.
- Dates, times, prices and numbers are never written in the dictionaries; they come from
  `datefmt.ts` / `number.ts`.

## Terms

| English | Français | Notes |
| --- | --- | --- |
| appointment | rendez-vous (pl. rendez-vous) | "RDV" only where a key is a short SMS variant and space is tight |
| booking / to book | réservation / prendre rendez-vous, réserver | "Book" button: "Prendre rendez-vous" or "Réserver" |
| practice / studio (studio dentistico) | cabinet (dentaire) | never "pratique", never "studio" |
| practitioner | praticien | covers dentists, hygienists, orthodontists… |
| dentist | dentiste | "chirurgien-dentiste" only in legal texts if needed |
| hygienist | hygiéniste dentaire | |
| orthodontist | orthodontiste | |
| patient | patient | |
| reception (role) | accueil | the front desk staff role |
| owner (role) | titulaire | the practice owner |
| admin (role) | administrateur | |
| slot / time | créneau / horaire | |
| reminder | rappel | appointment reminder: "rappel de rendez-vous" |
| recall (check-up recall) | relance (de contrôle) | kept distinct from "rappel" (reminder) |
| waitlist / waiting list | liste d'attente | |
| no-show | absence (rendez-vous non honoré) | status label "Absent" |
| confirm / confirmed | confirmer / confirmé | |
| cancel / cancelled | annuler / annulé | |
| reschedule | déplacer (le rendez-vous) | "reporter" for postponing |
| check-up | contrôle / bilan | |
| cleaning (hygiene) | détartrage, hygiène | |
| treatment / service | soin / prestation | "service" in the catalogue = "prestation" |
| review | avis | |
| verified patient | patient vérifié | |
| feedback | avis, retour | |
| consent | consentement | "I consent to…" = "Je consens à…" |
| withdraw consent | retirer son consentement | |
| object / objection | s'opposer / opposition | |
| data controller | responsable du traitement | |
| independent controller | responsable de traitement autonome | |
| joint controllers | responsables conjoints du traitement | |
| processor | sous-traitant | GDPR French wording (art. 28 RGPD) |
| sub-processor | sous-traitant ultérieur | |
| data processing agreement (DPA) | accord de traitement des données (DPA) | |
| standard contractual clauses | clauses contractuelles types | |
| data subject | personne concernée | |
| privacy notice | politique de confidentialité / informations sur la confidentialité | "notice" for the practice's Art. 13 notice: "politique de confidentialité du cabinet" |
| privacy center | espace confidentialité | |
| rights request | demande d'exercice des droits | |
| access / rectification / erasure / restriction / portability | accès / rectification / effacement / limitation / portabilité | |
| data breach | violation de données | |
| retention | conservation | |
| legitimate interest | intérêt légitime | |
| GDPR | RGPD | in prose; "GDPR" kept only inside identifiers |
| DPO | DPO (délégué à la protection des données) | |
| Garante (Italian DPA) | Garante (autorité italienne de protection des données) | keep "Garante per la protezione dei dati personali" |
| health fund / fondo sanitario | fonds de santé (fondo sanitario) | Italian supplementary health funds; closest French notion: mutuelle |
| direct / indirect (fund) | en direct / en remboursement | "direct" = tiers payant |
| anamnesis / medical history | anamnèse / antécédents médicaux | questionnaire: "questionnaire médical" |
| guardian / legal guardian | représentant légal / tuteur | "parent ou représentant légal" |
| minor | mineur | |
| two-factor authentication | authentification à deux facteurs | |
| passkey | clé d'accès | |
| one-time code / verification code | code de vérification | |
| sign in / sign out | se connecter / se déconnecter | |
| dashboard | tableau de bord | |
| calendar / schedule | agenda / planning | |
| location (practice site) | site / cabinet | "lieu" in generic contexts |
| chair / room | fauteuil / salle | |
| embed / widget | widget de réservation | |
| audit log | journal d'audit | |
| export | export / exporter | |

Brand and technical terms kept as is: Sorriso, SMS, WhatsApp, Email/e-mail (we write "e-mail" in
prose and "Email" for the channel name), API, FHIR, OK, ICS, PDF, CSV, JSON, ZIP, DPO, FAQ, Twilio,
Meta, AgID, Garante.

## Native-speaker review

- [ ] Native French reviewer sign-off: _pending_ (name, date)

## Needs lawyer review

All legal and consent strings below are drafts translated from English (consents: from the
authoritative Italian). The Italian version prevails; a lawyer or DPO must review the French
before go-live.

(See the list at the end of this file, updated when the namespaces are translated.)
