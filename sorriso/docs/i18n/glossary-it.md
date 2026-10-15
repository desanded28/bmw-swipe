# Glossario italiano (it)

Riferimento terminologico per tutti i dizionari `src/i18n/messages/it/*.ts`. L'italiano è la lingua
predefinita di Sorriso e la **versione autorevole dei testi legali e di consenso** (vedi
`docs/i18n.md`, sezione "Legal and consent texts"): per quei testi l'inglese è una traduzione
dell'italiano, non il contrario.

## Registro

| Superficie | Registro | Esempio |
| --- | --- | --- |
| Pazienti (sito pubblico, prenotazione, centro privacy, SMS, email) | **"tu"** informale ma cortese, come i messaggi ai pazienti già esistenti | "Scegli un orario", "Il tuo appuntamento" |
| Staff (dashboard, agenda, analisi, amministrazione privacy) | neutro professionale: infinito o imperativo impersonale nei pulsanti, "tu" solo dove inevitabile, mai "Lei" | "Salva", "Aggiungi professionista", "Nessun appuntamento in questo giorno" |
| Testi legali (informative, termini, DPA, istruzioni al personale) | linguaggio giuridico preciso, terza persona ("l'Utente", "lo Studio", "il Titolare"); nelle informative ai pazienti è ammesso il "tu" nelle parti esplicative | "Il Titolare tratta i dati...", "Hai il diritto di..." |
| SMS | "tu", frase più breve possibile, GSM-7 (vedi sotto) | "{clinic}: promemoria appuntamento {when}" |

- Maiuscole: solo l'iniziale della frase (anche nei titoli e nei pulsanti): "Gestisci appuntamento", non "Gestisci Appuntamento".
- Nomi di lingua nelle liste e nei selettori: iniziale maiuscola ("Italiano", "Inglese").
- Virgolette nei testi UI: apici semplici '...' (come nei testi di consenso del lead); niente virgolette curve negli SMS.
- Numeri, date e importi non sono nei dizionari: arrivano già formattati (`datefmt.ts`, `number.ts`).

## SMS e messaggi brevi (GSM-7)

Vale per `patientMessages` (WP3), `careMessages`, `privacyMessages`, `common.otp.sms` e ogni chiave documentata come SMS.

- Solo apostrofo dritto `'`, niente `…` (scrivere `...` o meglio riformulare), niente virgolette curve, niente trattino lungo `–`/`—`.
- `è à ì ò ù é` sono GSM-7; **`È` maiuscola non lo è**: a inizio frase scrivere "E'" o riformulare.
- Parola chiave di conferma: **SI** (senza accento), disdetta **NO**, **STOP** / **START** invariati.
- Discrezione: mai aggiungere prestazione, categoria, professionista o dettagli clinici che il testo inglese non contiene.

## Termini chiave

| Inglese | Italiano | Note |
| --- | --- | --- |
| appointment | appuntamento | "visita" quando si parla dell'atto clinico ("dopo la visita") |
| booking / to book | prenotazione / prenotare | |
| practice, clinic | studio (studio dentistico) | mai "clinica" salvo nome proprio; "lo studio" nei testi ai pazienti |
| practice (legal party) | lo Studio | maiuscolo solo nei testi contrattuali (DPA, termini per gli studi) |
| practitioner | professionista | genere neutro; al plurale "professionisti" |
| dentist | dentista (UI) / odontoiatra (testi legali e clinici) | |
| hygienist | igienista dentale | |
| patient | paziente | |
| staff, team | personale, team | "il team dello studio" |
| owner (role) | titolare | ruolo nello studio; nei testi privacy specificare "titolare dello studio" per non confonderlo con il titolare del trattamento |
| admin (role) | amministratore | |
| reception (role) | segreteria | |
| treatment, service | prestazione | evitare "trattamento" (ambiguo con il trattamento dei dati) salvo in "piano di cura" |
| treatment plan, care plan | piano di cura | |
| estimate, quote | preventivo | |
| recall | richiamo | richiamo per il controllo periodico |
| check-up | controllo | |
| waitlist | lista d'attesa | "iscriversi alla lista d'attesa" |
| reminder | promemoria | invariabile |
| confirmation | conferma | |
| no-show | mancata presentazione; stato: "Non presentato"; "appuntamento mancato" | |
| cancel (by patient) | disdire / disdetta | lo studio "annulla" |
| reschedule | spostare | |
| slot, time | orario | "fascia oraria" solo per intervalli |
| opening hours | orari di apertura | |
| time off | assenza | ferie, permessi |
| chair, room | poltrona / sala | "riunito" solo nei testi tecnici |
| calendar (practice) | agenda | "calendario" per il calendario personale del paziente (ICS) |
| dashboard | pannello | "pannello dello studio" |
| health fund | fondo sanitario (integrativo) | |
| insurance | assicurazione | |
| medical history, anamnesis | anamnesi | "questionario anamnestico" per il modulo |
| guardian | tutore legale | "genitore o tutore legale"; nei testi legali "esercente la responsabilità genitoriale" |
| minor | minore | |
| review | recensione | "Paziente verificato" |
| deposit | acconto | |
| sign in / sign out | accedi / esci | |
| two-factor authentication | verifica in due passaggi | |
| passkey | passkey | |
| step-up (confirm it's you) | conferma della tua identità | |
| audit log | registro delle attività | |
| export | esportazione / esporta | |

## Privacy e GDPR

| Inglese | Italiano |
| --- | --- |
| GDPR | GDPR / Regolamento (UE) 2016/679 (prima citazione nei testi legali) |
| Italian Privacy Code | Codice in materia di protezione dei dati personali (D.Lgs. 196/2003, "Codice Privacy") |
| supervisory authority (Garante) | Garante per la protezione dei dati personali |
| personal data | dati personali |
| health data, special categories | dati relativi alla salute, categorie particolari di dati (art. 9 GDPR) |
| processing | trattamento |
| data controller | titolare del trattamento |
| joint controller | contitolare del trattamento |
| independent controller | titolare autonomo del trattamento |
| processor | responsabile del trattamento (art. 28 GDPR) |
| sub-processor | sub-responsabile del trattamento |
| data processing agreement (DPA) | accordo sul trattamento dei dati (art. 28 GDPR), "DPA" |
| DPO | responsabile della protezione dei dati (RPD/DPO) |
| privacy notice | informativa sul trattamento dei dati personali; in UI "informativa privacy" |
| privacy center | centro privacy |
| privacy choices / preferences | scelte sulla privacy (come in `patientMessages`) |
| consent / withdraw consent | consenso / revocare il consenso |
| legal basis | base giuridica |
| legitimate interest | legittimo interesse |
| object / objection | opporsi / opposizione |
| rights request | richiesta di esercizio dei diritti |
| access, rectification, erasure, restriction, portability | accesso, rettifica, cancellazione, limitazione, portabilità |
| retention period | periodo di conservazione |
| data breach | violazione dei dati personali (data breach) |
| transfer outside the EU | trasferimento verso paesi terzi |
| Data Privacy Framework, SCC | Data Privacy Framework UE-USA, clausole contrattuali standard |
| identity verification | verifica dell'identità |
| pseudonymised / anonymised | pseudonimizzato / anonimizzato |
| record of processing activities | registro delle attività di trattamento |
| DPIA | valutazione d'impatto sulla protezione dei dati (DPIA) |
| professional secrecy | segreto professionale |
| clinical record | cartella clinica |

## Formule di riferimento (dalla specifica, da usare alla lettera)

- Consenso art. 9 piattaforma: «Acconsento al trattamento da parte di Sorriso dei dati relativi alla mia prenotazione, che possono rivelare informazioni sulla mia salute, per inoltrarla allo studio scelto e gestire promemoria e modifiche.» (in `consents`, del lead)
- Feedback: «Dopo la visita, inviatemi un breve invito a lasciare un feedback» (in `consents`, del lead)
- Nota alla prenotazione: «Visibile solo allo studio. Non inserire informazioni che non vuoi condividere.»
- SMS promemoria: «{clinic}: promemoria appuntamento {when}, {address}. Rispondi SI per confermare, NO per disdire. Dettagli: {url} STOP per non ricevere SMS» (in `patientMessages`, WP3)
- Oggetto email promemoria: «Promemoria appuntamento - {clinic} - {date}» (in `patientMessages`, WP3)

## Revisione

- Revisione madrelingua: traduzione redatta da traduttore madrelingua italiano (WP9). **Firma della revisione madrelingua indipendente: da completare** (nome, data).
- Revisione legale: vedi elenco sotto. Nessun testo legale o di consenso è definitivo finché un DPO o un avvocato non lo ha approvato.

## Da sottoporre a revisione legale (Needs lawyer review)

Testi italiani che fanno fede e che devono essere approvati da un DPO o da un avvocato prima della messa in produzione:

- `consents.*` (tutto il namespace; testo del lead, solo verificato qui)
- `legalPatient.*` (tutto il namespace: informative degli studi e di Sorriso, informativa per i minori, cookie, termini per i pazienti)
- `legalPractice.*` (tutto il namespace: termini per gli studi, accordo sul trattamento dei dati art. 28, elenco dei sub-responsabili, istruzioni al personale)
- `privacy.*`: primo livello dell'informativa nel modulo di prenotazione, avviso WhatsApp (trasferimento USA), testi sull'esercizio dei diritti, revoca dei consensi, minori
- `privacyAdmin.*`: testi che lo studio pubblica o invia ai pazienti (informativa, risposte alle richieste di esercizio dei diritti, notifica di violazione)
- `privacyAdminEmails.*`, `privacyMessages.*`: comunicazioni ai pazienti su richieste di esercizio dei diritti e violazioni dei dati
- `reviews.*`: consenso alla pubblicazione e testi di moderazione
- `care.*`: testi sul consenso informato e sull'anamnesi
- `patientMessages.breachNotice.*` (WP3)
