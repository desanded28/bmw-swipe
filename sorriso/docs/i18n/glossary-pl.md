# Polish (pl) glossary

Terminology, register and open review items for the Polish dictionaries in
`src/i18n/messages/pl/`. Source language: English (`messages/en`). For legal and consent texts the
Italian version is authoritative (see `docs/i18n.md`); the Polish legal texts are translations
and carry the notice "Tłumaczenie: w razie rozbieżności rozstrzygająca jest wersja włoska".

## Register and style

- **Impersonal forms.** Full sentences addressed to patients or staff avoid personal pronouns and
  avoid "Pan/Pani": passive and impersonal constructions ("Wizyta została zarezerwowana",
  "Wysłano kod", "Można anulować wizytę online", "Należy podać...", "Prosimy o...").
- **Buttons, menu items, field hints and short commands** use the imperative 2nd person
  singular, the standard Polish UI convention ("Zapisz", "Anuluj", "Wybierz godzinę",
  "Wpisz prawidłowy adres e-mail"). No pronoun ("Ty", "Twój") is added.
- **Possessives.** "Your appointment" becomes "Wizyta" or "Twoja wizyta" only where nothing else
  reads naturally; prefer "Wizyta", "Dane pacjenta", "Moja wizyta" (page titles the patient
  reads as their own).
- **First person** is kept where the patient makes a statement (consent labels:
  "Wyrażam zgodę...", "Chcę otrzymywać...").
- **Staff dashboard** texts use a neutral professional register (infinitive or imperative, no
  pronouns).
- **Email greeting:** "Dzień dobry, {name}!" (nominative name, as in transactional email in
  Polish); the body then starts with a capital letter.
- **Typography:** Polish quotes „…" in UI and legal texts are allowed, but straight quotes are used
  in all dictionary texts for consistency with placeholders; never in SMS anything other than
  straight `'` and `"`. Dashes: en dash with spaces for ranges in UI ("{from} – {to}") as in
  English source.
- **Capitalisation:** sentence case for headings and buttons (Polish never uses Title Case).
  Weekday and month names are lower case in Polish.
- **Numbers and dates** never appear in dictionaries (datefmt / number.ts). Plurals use
  `p({ one, few, many, other })`: one = 1; few = 2-4, 22-24...; many = 0, 5-21, 25...;
  other = fractions ("1,5 godziny": genitive singular).

## SMS rules (patientMessages, careMessages, privacyMessages, common.otp)

- Polish letters (ą ć ę ł ń ó ś ź ż) switch an SMS to UCS-2 (70/67 characters per segment): the
  full texts are kept very short so they fit 3 UCS-2 segments with a 40-character practice name
  and address.
- `*Short` variants use **plain ASCII only** (no Polish diacritics), so they stay in GSM-7.
- Straight apostrophes only, no "…", no curly quotes, no en/em dashes.
- Reply keywords: **TAK** (confirm), **NIE** (cancel), **STOP**, **START** (from
  `src/lib/inbound.ts`).
- Discreet: never add the treatment, the practitioner or any health detail that the English text
  does not have.

## Terms

| English | Polish | Notes |
| --- | --- | --- |
| appointment | wizyta | "umówić wizytę", "zarezerwować wizytę" |
| visit | wizyta | |
| booking | rezerwacja | to book: zarezerwować / umówić (się na) wizytę |
| request (booking) | prośba o wizytę / zgłoszenie | practice must accept it |
| practice / studio | gabinet (gabinet stomatologiczny) | "dla gabinetów" (for practices) |
| office / location | placówka | a practice's site/address |
| room / chair | sala / fotel | "sala zabiegowa" where ambiguous |
| practitioner | specjalista | covers dentists and hygienists; role name "Specjalista" |
| dentist | dentysta / lekarz dentysta | |
| hygienist | higienistka stomatologiczna | |
| patient | pacjent | generic masculine, gender-neutral use |
| staff | personel | |
| reception | recepcja | role |
| owner | właściciel | role |
| admin (role) | administrator | never confuse with "administrator danych" (always qualified) |
| treatment / service | zabieg / usługa | "zabieg" in patient flow, "usługa" in catalog/settings |
| slot / time | termin / godzina | "wolny termin" |
| reschedule | przełożyć / zmienić termin | |
| cancel (appointment) | odwołać wizytę | the generic button "Cancel" = "Anuluj" |
| confirm attendance | potwierdzić obecność | |
| reminder | przypomnienie | |
| recall | przypomnienie o kontroli | "zaproszenie na kontrolę" in patient texts |
| check-up | wizyta kontrolna / przegląd | |
| waitlist / waiting list | lista oczekujących | |
| no-show | nieobecność / niestawienie się | status: "Nieobecność"; "opuszczona wizyta" (missed appointment) |
| review | opinia | "zweryfikowany pacjent" (verified patient) |
| feedback | opinia / ocena | |
| dashboard | panel | |
| calendar | kalendarz | |
| verification code / OTP | kod weryfikacyjny | |
| two-factor authentication | uwierzytelnianie dwuskładnikowe | |
| passkey | klucz dostępu | |
| sign in | zaloguj się / logowanie | |
| privacy center | centrum prywatności | |
| privacy choices / preferences | ustawienia prywatności | |
| privacy notice | informacja o ochronie danych | Art. 13/14 notice ("klauzula informacyjna") |
| consent | zgoda | give: wyrazić zgodę; withdraw: wycofać zgodę |
| object / objection | wnieść sprzeciw / sprzeciw | |
| GDPR | RODO | Polish official name; articles: "art. 9 ust. 2 lit. a RODO" |
| data controller | administrator danych | |
| joint controller | współadministrator | |
| independent controller | samodzielny administrator | |
| processor | podmiot przetwarzający | |
| sub-processor | dalszy podmiot przetwarzający | |
| data processing agreement (DPA) | umowa powierzenia przetwarzania danych | |
| data subject | osoba, której dane dotyczą | |
| rights request | wniosek (o realizację praw) | "wniosek RODO" in staff UI |
| access / rectification / erasure / restriction / portability | dostęp / sprostowanie / usunięcie / ograniczenie przetwarzania / przenoszenie danych | |
| data protection officer (DPO) | inspektor ochrony danych (IOD) | |
| supervisory authority / Garante | organ nadzorczy / Garante per la protezione dei dati personali (włoski organ nadzorczy) | |
| personal data breach | naruszenie ochrony danych osobowych | |
| legitimate interest | prawnie uzasadniony interes | |
| profiling | profilowanie | |
| retention | okres przechowywania | |
| health data | dane dotyczące zdrowia | |
| health fund / fondo sanitario | fundusz zdrowotny (fondo sanitario) | Italian supplementary health fund; not NFZ |
| anamnesis / medical history | wywiad medyczny | |
| clinical record | dokumentacja medyczna | |
| guardian | opiekun prawny | "rodzic lub opiekun prawny" |
| minor | osoba niepełnoletnia / dziecko | under 14: "dziecko poniżej 14 lat" |
| audit log | dziennik zdarzeń | |
| export | eksport | |
| SMS, WhatsApp, API, FHIR, ICS, OK, Sorriso | unchanged | "Email" is localised as "E-mail" |

## Needs lawyer review

All strings below are drafts translated from English. A Polish-speaking privacy lawyer or DPO
must compare them with the authoritative Italian text before go-live.

- `consents.*` (every consent and objection text: title, label, description)
- `legalPatient.*` (patient privacy notice, terms of use, cookie policy and the translation notice)
- `legalPractice.*` (terms for practices, data processing agreement, sub-processors, staff
  instructions and the translation notice)
- `privacy.*` texts that describe rights, legal bases, retention and the Art. 9 platform consent
- `privacyMessages.*` and `privacyAdminEmails.*` (identity verification, request outcomes,
  breach notices)
- `patientMessages.breachNotice.*` (Art. 34 communication of a personal data breach)
- `patientMessages.privacyFooter.object` and `.why*` (Art. 21 objection and Art. 13 transparency)
- `booking.embed.privacyNotice`, `errors.api.platform_consent_required`,
  `errors.api.notice_outdated`
- `reviews.*` strings about publication consent and health details in reviews
- `care.*` strings about clinical data, anamnesis and guardianship of minors

## Review sign-off

| Role | Name | Date | Scope |
| --- | --- | --- | --- |
| Translator | Claude (WP9, pl) | 2026-10-15 | all namespaces |
| Native-speaker review | _pending_ | | all namespaces |
| Lawyer / DPO review | _pending_ | | items in "Needs lawyer review" |
