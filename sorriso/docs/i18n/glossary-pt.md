# Glossary: European Portuguese (pt-PT)

Locale `pt`, files `src/i18n/messages/pt/*.ts`. Source: English (`messages/en`), except the
`consents` namespace, which is translated from the authoritative Italian (`messages/it/consents.ts`).
Legal texts: Italian prevails (see [Needs lawyer review](#needs-lawyer-review)).

## Register and style

- **European Portuguese only**, Acordo Ortográfico de 1990 spelling: *ação, receção, ativo, atual,
  proteção, direção, objetivo, exceção, efetuar*; but pt-PT *contacto*, *facto*, *receção*.
- pt-PT vocabulary, never Brazilian: *telemóvel* (not celular), *ecrã* (tela), *utilizador*
  (usuário), *ficheiro* (arquivo), *equipa* (equipe), *registo* (registro), *palavra-passe*
  (senha), *partilhar* (compartilhar), *guardar* (salvar), *aceder* (acessar), *gerir*
  (gerenciar), *definições* (configurações), *morada* (postal address), *transferir* (download).
- **Patients:** neutral phrasing or *você* left implicit (third-person verb: *Pode cancelar…*,
  *Receberá…*), possessive *o seu / a sua*. Never *tu*.
- **Staff dashboard:** neutral professional register, same implicit *você*.
- **Buttons and menu items:** infinitive (*Guardar*, *Cancelar*, *Marcar consulta*).
- **Headings:** sentence case (only the first word capitalised), like English source.
- Weekday and month names are lower case (*segunda-feira*, *outubro*); they come from
  `calendar-names.ts`, not from the dictionaries.
- Quotation marks in UI text: « » in prose is acceptable, but this dictionary uses straight
  ASCII `'` / `"` where English does, to keep diffs readable and SMS-safe.
- Numbers, dates and money are never in the dictionaries (`datefmt.ts`, `number.ts`).
- Plurals: `one` / `other` (pt-PT: 0 is `other`). `many` (millions only) is not provided.

## SMS rules

- Namespaces: `patientMessages`, `careMessages`, `privacyMessages`, `common.otp.sms`.
- Straight apostrophes and quotes only, no `…`, no en/em dash, shortest natural phrasing.
- Portuguese needs ã, õ, ç, á, é, í, ó, ú, â, ê, ô, which are **not** GSM-7 (except é): a pt SMS is
  usually UCS-2 (67 characters per segment, budget 3 segments). The `*Short` texts are written in
  plain ASCII (no accents) so that they stay in GSM-7.
- Reply keywords: **SIM** to confirm, **NAO** to cancel (ASCII, as `src/lib/inbound.ts` expects),
  **STOP** to opt out, **START** to opt back in.
- Discreet: never add the treatment, practitioner or any health detail that English does not have.

## Terms

| English | pt-PT | Notes |
| --- | --- | --- |
| appointment | consulta | patient-facing; *marcação* when the act of booking is meant |
| book (verb) | marcar (uma consulta) | *Marcar consulta* (button) |
| booking | marcação | |
| booking request | pedido de marcação | |
| reschedule / move | remarcar / alterar | *Remarcar* (button) |
| cancel (appointment) | cancelar | patients also say *desmarcar* (keyword) |
| practice / studio | clínica | *clínica dentária* where the kind matters; never *estúdio* |
| office / location | unidade | one practice's address; multi-location practices |
| room / chair | gabinete / cadeira | |
| practitioner | profissional | |
| dentist | médico dentista / dentista | *médico dentista* in formal texts, *dentista* in patient UI |
| hygienist | higienista oral | |
| orthodontist | ortodontista | |
| treatment / service | tratamento | the catalogue item; *serviço* only for Sorriso's own service |
| check-up | consulta de controlo | |
| first visit | primeira consulta | |
| recall | chamada de controlo | message reminding the patient to book a check-up |
| reminder | lembrete | |
| waitlist / waiting list | lista de espera | |
| slot / time | horário / vaga | *vaga* for a freed slot offered to the waitlist |
| no-show / missed appointment | falta / falta à consulta | status: *Falta* |
| attendance | comparência | *Comparência confirmada* |
| patient | paciente | |
| new patient | novo paciente | |
| guardian / legal guardian | tutor legal | *pai, mãe ou tutor legal* |
| minor | menor | |
| medical history / anamnesis | historial clínico / anamnese | *anamnese* for the questionnaire |
| health fund / fondo sanitario | fundo de saúde (*fondo sanitario integrativo*) | Italian name kept in brackets where useful |
| insurance | seguro de saúde | |
| invoice / receipt | fatura / recibo | |
| review | avaliação | |
| rating | classificação | stars |
| verified patient | paciente verificado | |
| feedback | opinião | *feedback* kept in technical staff texts |
| dashboard | painel | |
| staff / team | equipa | |
| owner / admin / reception | proprietário / administrador / receção | roles |
| sign in / sign out | iniciar sessão / terminar sessão | |
| password | palavra-passe | |
| two-factor authentication | autenticação de dois fatores | |
| passkey | chave de acesso | |
| verification code | código de verificação | |
| mobile number | número de telemóvel | |
| email | email | *endereço de email* |
| address (postal) | morada | |
| settings | definições | |
| download | transferir | |
| upload | carregar | |
| export | exportar / exportação | |
| privacy center | centro de privacidade | |
| privacy choices | escolhas de privacidade | |
| privacy notice | aviso de privacidade | GDPR Art. 13/14 information |
| GDPR | RGPD | Regulamento Geral sobre a Proteção de Dados |
| personal data | dados pessoais | |
| health data | dados de saúde | |
| special categories of data | categorias especiais de dados | Art. 9 |
| data subject | titular dos dados | |
| data controller | responsável pelo tratamento | |
| joint controllers | responsáveis conjuntos pelo tratamento | |
| independent controller | responsável autónomo pelo tratamento | |
| processor | subcontratante | official pt-PT RGPD term |
| sub-processor | subcontratante ulterior | |
| DPA (data processing agreement) | acordo de subcontratação (DPA) | |
| DPO | encarregado da proteção de dados (EPD) | |
| supervisory authority | autoridade de controlo | Italy: *Garante per la protezione dei dati personali* (name kept) |
| consent / give consent | consentimento / dar o consentimento | |
| withdraw consent | retirar o consentimento | |
| object / objection | opor-se / oposição | |
| legitimate interest | interesse legítimo | |
| profiling | definição de perfis | RGPD pt-PT term |
| rights request | pedido de exercício de direitos | |
| access / rectification / erasure | acesso / retificação / apagamento | |
| restriction of processing | limitação do tratamento | |
| data portability | portabilidade dos dados | |
| retention | conservação | *prazo de conservação* |
| data breach | violação de dados pessoais | |
| record of processing activities | registo das atividades de tratamento | |
| audit log / access log | registo de auditoria / registo de acessos | |
| standard contractual clauses | cláusulas contratuais-tipo | |
| EU-US Data Privacy Framework | Quadro de Privacidade de Dados UE-EUA | |
| Art. 9(2)(a) GDPR | art. 9.º, n.º 2, alínea a), do RGPD | |
| terms of service | termos de utilização | |

Kept as is: Sorriso, SMS, WhatsApp, Email (as *email*), API, FHIR, OK, ICS, STOP, START, CSV, JSON,
PDF, Google Calendar, Apple / Outlook, AgID, Garante.

## Translation notice for legal pages

`legalPatient`, `legalPractice` and `accessibility` carry:
*Tradução: em caso de divergência, prevalece a versão italiana.* (see the keys listed below).

## Needs lawyer review

Every legal and consent text in pt is a draft translation until a Portuguese-speaking lawyer or DPO
compares it with the authoritative Italian. Strings to review:

- `consents.*` (all purposes: `title`, `label`, `description`), translated from `it/consents.ts`.
- `legalPatient.*` (patient privacy notice, terms, cookie information): translated from English.
- `legalPractice.*` (practice terms, data processing agreement, staff instructions): translated
  from English.
- `accessibility.*` (accessibility statement, legal basis and enforcement procedure).
- `privacy.*` texts that state legal bases, retention periods, rights or deadlines.
- `privacyMessages.*` and `privacyAdminEmails.*` (statutory communications to data subjects).
- `patientMessages.breachNotice.*` (GDPR Art. 34 communication).
- `patientMessages.privacyFooter.object`, `booking` consent hints, `errors.api.platform_consent_required`.

## Review sign-off

| Reviewer | Role | Date | Scope |
| --- | --- | --- | --- |
| _pending_ | native pt-PT speaker | | all namespaces |
| _pending_ | lawyer / DPO | | list above |
