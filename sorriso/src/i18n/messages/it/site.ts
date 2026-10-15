import { p } from "../../plural";
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    title: "{app}: prenota il tuo dentista online",
    description:
      "Trova un dentista vicino a te, guarda le disponibilità reali e prenota in pochi secondi. Promemoria via SMS o email: conferma o sposta con un tocco.",
  },
  header: {
    findDentist: "Trova un dentista",
    forPractices: "Per gli studi",
    api: "API",
    login: "Accesso studi",
    bookNow: "Prenota ora",
  },
  footer: {
    tagline: "Prenota il dentista online con disponibilità in tempo reale. Promemoria a cui i pazienti rispondono con una parola.",
    patients: "Pazienti",
    findDentist: "Trova un dentista",
    emergency: "Urgenza dentale",
    cleaning: "Pulizia dei denti",
    privacyCenter: "I tuoi dati (centro privacy)",
    practices: "Studi",
    features: "Funzionalità",
    createPractice: "Registra il tuo studio",
    apiWidget: "API e widget di prenotazione",
    legal: "Note legali",
    privacy: "Informativa privacy",
    cookies: "Cookie",
    terms: "Termini di servizio",
    dpa: "Accordo sul trattamento dei dati",
    subprocessors: "Sub-responsabili",
    accessibility: "Accessibilità",
    reviewPolicy: "Regole sulle recensioni",
    ranking: "Come ordiniamo i risultati",
    copyright: "© {year} {app}",
    demo: "Progetto dimostrativo: gli studi e le persone mostrati sono immaginari.",
  },
  notFound: {
    code: "Errore 404",
  },
  home: {
    badge: "Solo recensioni verificate di visite reali",
    heroTitle: "Il dentista che ti serve, <em>prenotato in 30 secondi.</em>",
    heroBody:
      "Disponibilità in tempo reale degli studi vicino a te. Nessun account, nessuna attesa al telefono. Ricevi un promemoria via SMS o email: rispondi <b>SI</b> per confermare, oppure sposta l'appuntamento con un tocco.",
    quickLabel: "Prestazioni più richieste",
    quick: {
      checkup: "Controllo",
      hygiene: "Pulizia",
      orthodontics: "Allineatori e apparecchi",
      pediatric: "Bambini",
      emergency: "Urgenze",
    },
    soonestTitle: "Disponibili prima",
    soonestBody: "Scegli un orario ed è fatta: questi orari sono aggiornati in tempo reale.",
    seeAll: "Vedi tutti i dentisti",
    how: {
      title: "Come funziona",
      step: "Passaggio {n}",
      findTitle: "Trova disponibilità reali",
      findBody: "Confronta i dentisti per prestazione, prezzo, recensioni verificate e primo orario libero, in ogni sede in cui lavorano.",
      bookTitle: "Prenota senza account",
      bookBody: "Scegli un orario, inserisci nome e numero. Ricevi subito una conferma con l'invito per il calendario.",
      confirmTitle: "Conferma con una risposta",
      confirmBody: "Ti ricordiamo l'appuntamento via SMS o email. Rispondi SI per confermare o NO per disdire, oppure spostalo con un tocco.",
    },
    citiesTitle: "Dentisti per città",
    cityLink: "Dentisti a {city}",
    cityCount: p({ one: "{count} studio", other: "{count} studi" }),
    practices: {
      kicker: "Per gli studi dentistici",
      title: "Meno appuntamenti mancati. Tutte le sedi in un'unica agenda.",
      body: "Agenda multisede con poltrone, conferme via SMS con risposta, una lista d'attesa automatica che riempie gli orari disdetti e un'API di prenotazione aperta.",
      features: "Scopri le funzionalità",
      demo: "Prova il pannello dimostrativo",
      offices: "Più sedi, professionisti e poltrone, senza doppie prenotazioni tra una sede e l'altra",
      rules: "Regole di promemoria per studio: email 48 ore prima, SMS 24 ore prima, WhatsApp se lo attivi",
      replies: "I pazienti rispondono SI o NO e l'agenda si aggiorna da sola",
      waitlist: "Gli orari disdetti vengono offerti alla lista d'attesa in pochi secondi",
    },
  },
  forClinics: {
    metaTitle: "Per gli studi dentistici",
    metaDescription:
      "Prenotazioni online, un'agenda multisede e promemoria a cui i pazienti rispondono, con la privacy integrata. Esporta tutti i tuoi dati in qualsiasi momento.",
    kicker: "Per gli studi dentistici",
    title: "Riempi le tue poltrone. Smetti di rincorrere le conferme.",
    body: "Prenotazioni online, un'agenda multisede e promemoria a cui i pazienti rispondono davvero, in un unico posto.",
    signup: "Registra il tuo studio",
    demo: "Apri il pannello dimostrativo",
    featuresTitle: "Funzionalità",
    features: {
      offices: {
        title: "Tutte le sedi, un'unica agenda",
        body: "I professionisti lavorano in sedi diverse in giorni diversi. La disponibilità è calcolata per sede e nessuno può avere due prenotazioni contemporanee in sedi diverse.",
      },
      chairs: {
        title: "Poltrone, tempi di riordino e chiusure",
        body: "Ogni prenotazione riserva automaticamente una poltrona. Tempi di riordino per prestazione, festività, manutenzioni e assenze personali bloccano la disponibilità.",
      },
      twoWay: {
        title: "Promemoria SMS con risposta",
        body: "I promemoria chiedono ai pazienti di rispondere SI o NO, nella loro lingua. Le risposte confermano o disdicono subito; qualsiasi altra risposta viene segnalata alla segreteria.",
      },
      rules: {
        title: "Regole di promemoria sotto il tuo controllo",
        body: "Ad esempio: email 48 ore prima, SMS 24 ore prima, un SMS breve 2 ore prima. WhatsApp solo se lo attivi e il paziente è d'accordo.",
      },
      waitlist: {
        title: "Le disdette si riempiono da sole",
        body: "Quando un orario si libera viene offerto in pochi secondi ai pazienti in lista d'attesa compatibili. Lo ottiene chi prenota per primo, senza telefonate.",
      },
      board: {
        title: "Tabellone delle conferme",
        body: "Domani a colpo d'occhio: confermati, in attesa e chi va chiamato, con il motivo. Serve solo ad aiutare: a nessuno viene rifiutata una prenotazione.",
      },
      reviews: {
        title: "Solo recensioni verificate",
        body: "Possono recensire solo i pazienti che hanno effettuato una visita, e solo con il loro consenso. Gli studi possono rispondere ma non nascondere le recensioni.",
      },
      api: {
        title: "API e widget di prenotazione aperti",
        body: "Integra la prenotazione nel tuo sito con un solo tag script, sincronizza il gestionale dello studio tramite l'API REST, iscriviti ai feed del calendario.",
      },
      roles: {
        title: "Ruoli per il tuo team",
        body: "Titolari, amministratori, segreteria e professionisti vedono ciascuno ciò che serve loro. Ogni accesso alla scheda di un paziente viene registrato.",
      },
      privacy: {
        title: "Privacy per impostazione predefinita",
        body: "Messaggi e voci di calendario non indicano la prestazione. I pazienti gestiscono i propri dati e consensi in un centro privacy, senza account.",
      },
      languages: {
        title: "Otto lingue",
        body: "I pazienti prenotano e ricevono i promemoria in italiano, inglese, tedesco, francese, spagnolo, portoghese, rumeno o polacco.",
      },
    },
    flow: {
      title: "Come funziona una conferma",
      book: "Il paziente prenota online (o lo prenoti tu in segreteria) e riceve una conferma con l'invito per il calendario.",
      email: "48 ore prima: un'email che gli chiede di confermare con un clic.",
      text: "24 ore prima: un SMS che gli chiede di rispondere SI per confermare o NO per disdire.",
      reply: "SI fa diventare verde l'appuntamento nella tua agenda. NO lo annulla e offre l'orario alla lista d'attesa.",
      other: "Qualsiasi altra risposta (\"posso venire mezz'ora dopo?\") arriva nella tua casella dei messaggi e viene segnalata in agenda.",
    },
    sms: {
      sender: "Studio Bianchi",
      reminder:
        "Studio Bianchi: promemoria appuntamento mer 15 ott alle 10:30, Via Torino 42, Milano. Rispondi SI per confermare, NO per disdire. Dettagli: sorriso.example/a/... STOP per non ricevere SMS",
      reply: "SI",
      thanks: "Studio Bianchi: grazie! Presenza confermata per mer 15 ott alle 10:30. A presto!",
      caption: "Un promemoria come lo riceve il paziente: la prestazione non viene mai indicata.",
    },
    noLockIn: "I tuoi dati restano tuoi: esporta tutto in qualsiasi momento, senza vincoli.",
    apiDocs: "Leggi la documentazione dell'API",
  },
  developers: {
    metaTitle: "API e widget di prenotazione",
    metaDescription:
      "Integra la prenotazione online nel sito del tuo studio, prenota tramite l'API REST e sincronizza il gestionale dello studio.",
    title: "API e widget di prenotazione",
    intro:
      "Tutto ciò che fa il sito {host} passa da questa API, quindi la tua integrazione può fare tutto ciò che può fare un paziente. JSON su HTTPS, CORS abilitato, orari in ISO 8601 (UTC).",
    codeSample: "Esempio di codice",
    attribute: "Attributo",
    field: "Campo",
    description: "Descrizione",
    widget: {
      title: "1. Integra la prenotazione nel tuo sito",
      button: "Un pulsante flottante \"Prenota un appuntamento\" che apre il modulo di prenotazione in una finestra di dialogo:",
      inline: "Oppure in linea, all'interno di un elemento della tua pagina, qui in tedesco e per un solo professionista:",
      attributesCaption: "Attributi del widget",
      attributes: {
        "data-clinic": "Obbligatorio. L'indirizzo del tuo studio su Sorriso (lo slug). Senza questo attributo lo script non mostra nulla.",
        "data-lang":
          "La lingua del modulo e dei messaggi al paziente. Se manca: la lingua della tua pagina (il suo attributo lang), poi quella del browser del visitatore, infine l'italiano.",
        "data-target":
          "Un selettore CSS: mostra il modulo all'interno di quell'elemento invece di un pulsante flottante. Se nessun elemento corrisponde quando lo script viene eseguito, non viene mostrato nulla.",
        "data-practitioner": "Apre il modulo per un solo professionista (il suo id).",
        "data-service": "Preseleziona una prestazione (il suo id).",
        "data-location": "Preseleziona una sede (il suo id).",
        "data-label": "Il testo del pulsante flottante. Se manca, \"Prenota un appuntamento\" nella lingua scelta.",
        "data-color": "Il colore del pulsante flottante, come colore CSS.",
        "data-events": "Attiva l'evento sorriso:booked sulla tua pagina quando una prenotazione viene completata.",
        "data-include-id": "Con data-events: include l'id dell'appuntamento nell'evento.",
      },
      languages: "Valori della lingua (<code>data-lang</code>, <code>patient.locale</code>):",
      eventsTitle: "Eventi di prenotazione",
      events:
        "Con <code>data-events</code>, la tua pagina riceve un evento <code>sorriso:booked</code> quando una prenotazione viene completata. Non contiene dati personali, e l'id dell'appuntamento solo con <code>data-include-id</code>. I messaggi vengono inviati solo all'origine della tua pagina.",
      eventsWarning:
        "Non inoltrare questo evento a strumenti pubblicitari o di analisi (come i tag di Meta o Google): rivela che un visitatore ha prenotato un appuntamento dal dentista, cioè un dato relativo alla salute. In base all'accordo sul trattamento dei dati puoi usarlo solo per mostrare la tua conferma.",
      origins:
        "Per impedire ad altri siti di integrare il tuo modulo di prenotazione, elenca gli indirizzi del tuo sito in Pannello, Impostazioni privacy, Siti autorizzati. Altrove il widget mostrerà solo un link che apre la pagina di prenotazione in una nuova scheda. Il controllo si basa sull'indirizzo che i browser dei visitatori inviano con il frame: il widget lo richiede e, se scrivi un iframe tuo, non assegnargli <code>referrerpolicy=\"no-referrer\"</code>.",
    },
    booking: {
      title: "2. Prenota tramite l'API",
      fieldsCaption: "Campi della prenotazione",
      context:
        "Chi è responsabile dei dati della prenotazione lo decide il server, mai un campo che invii: le prenotazioni effettuate con la tua chiave API, il tuo widget o link firmati per il tuo studio sono tue (Sorriso le tratta per tuo conto); le prenotazioni iniziate sulle pagine di Sorriso richiedono il consenso del paziente a Sorriso.",
      errors:
        "Gli errori hanno un'unica forma: un oggetto <code>error</code> con un <code>code</code> e un <code>message</code>. Un orario già occupato restituisce 409 con <code>practitioner_busy</code>, <code>no_room</code>, <code>time_off</code>, <code>outside_hours</code> o <code>too_soon</code>; i campi non validi restituiscono 422 con un elenco <code>issues</code>, una regola sulla privacy o sull'età non rispettata 422 con il proprio codice e <code>field</code>.",
    },
    fields: {
      locale:
        "La lingua dei messaggi al paziente: <code>it</code>, <code>en</code>, <code>de</code>, <code>fr</code>, <code>es</code>, <code>pt</code>, <code>ro</code> o <code>pl</code>.",
      phoneCountry:
        "Il prefisso internazionale di un numero digitato senza prefisso, ad esempio <code>39</code> o <code>49</code>. I numeri che iniziano con + o 00 mantengono il proprio.",
      preferredChannel:
        "<code>sms</code>, <code>email</code> o <code>whatsapp</code>. WhatsApp solo se lo studio lo ha attivato e con <code>privacy.whatsapp</code> impostato a true.",
      privacy:
        "Obbligatorio senza chiave API. <code>noticeVersion</code> (la versione dell'informativa mostrata), <code>locale</code> e le scelte del paziente: <code>platformConsent</code>, <code>whatsapp</code>, <code>feedback</code>, <code>marketing</code>. Le caselle che il paziente non ha selezionato sono false.",
      relation:
        "Per chi è l'appuntamento: <code>bookedFor</code> è <code>self</code>, <code>minor</code> (con <code>guardian</code>: nome, relazione, telefono o email) oppure <code>other_adult</code>.",
      practiceRef: "Il marcatore dello studio presente in un link pubblicato dal tuo studio (?ref=). Senza di esso la prenotazione è considerata effettuata su Sorriso.",
      fundId: "Facoltativo: il fondo sanitario o l'assicurazione che il paziente utilizzerà. Viene conservato solo se lo studio ha in elenco quel fondo.",
    },
    sync: {
      title: "3. Sincronizza il gestionale dello studio",
      keys: "Crea una chiave API in Pannello, Impostazioni, API, scegli i suoi ambiti e inviala come token bearer. Le chiavi possono scadere ed essere revocate in qualsiasi momento.",
      scopesTitle: "Ambiti",
    },
    scopes: {
      "appointments:read": "Leggere gli appuntamenti e le risorse che utilizzano.",
      "appointments:write": "Creare, spostare e annullare appuntamenti, registrare conferme, mancate presentazioni e visite effettuate.",
      "patients:read": "Leggere nomi e recapiti dei pazienti.",
      "patients:write": "Creare e aggiornare i pazienti.",
      "notes:read": "Leggere le note scritte da pazienti e personale sugli appuntamenti. Concedilo solo a software clinici.",
      "patients:erase": "Chiedere la cancellazione dei dati di un paziente (gestita come richiesta privacy).",
    },
    export: {
      title: "4. Esporta i tuoi dati",
      body: "Uno studio può esportare tutti i propri dati in qualsiasi momento in JSON, CSV e FHIR R4. I formati sono descritti nello <link>schema di esportazione</link>.",
    },
    reference: "Riferimento",
    groups: {
      public: "Prenotazione pubblica (usata dal sito e dal widget)",
      patient: "Self-service del paziente (token dal link del paziente)",
      partner: "API per partner (il gestionale del tuo studio)",
      infra: "Infrastruttura",
    },
    auth: {
      public: "pubblico",
      token: "token del link",
      apiKey: "chiave API",
      secret: "segreto",
    },
    endpoints: {
      clinic: "Profilo dello studio, sedi, professionisti (con prestazioni e sedi) e prestazioni prenotabili.",
      availability:
        "Orari liberi per giorno. Senza practitionerId: \"primo disponibile\", distribuito tra i professionisti. Restituisce nextAvailable quando l'intervallo è vuoto.",
      book: "Prenota un orario. Verificato di nuovo in una transazione di scrittura: due pazienti non possono mai ottenere lo stesso orario.",
      waitlist: "Iscrive alla lista d'attesa per una prestazione, facoltativamente per un professionista o una sede, un intervallo di date e un momento della giornata.",
      appointment: "L'appuntamento e ciò che il paziente può ancora fare (canCancel, canReschedule).",
      confirm: "Conferma la presenza.",
      cancel: "Disdice (l'orario viene offerto alla lista d'attesa). Campo facoltativo nel corpo: reason.",
      reschedule: "Sposta su un altro orario libero. Campi del corpo: start e, facoltativamente, practitionerId e locationId.",
      resources: "Sedi, poltrone, professionisti (con orari) e prestazioni, per mappare gli id.",
      list: "Elenca gli appuntamenti. Usa updatedSince per la sincronizzazione incrementale.",
      create: "Crea un appuntamento con i poteri della segreteria (durata personalizzata, fuori orario, id di un paziente esistente).",
      update: "Sposta, annulla, segna come effettuato o come mancata presentazione, oppure registra una conferma telefonica.",
      twilio: "Risposte SMS e WhatsApp in arrivo (firmate da Twilio). Risponde direttamente con TwiML.",
      twilioStatus: "Ricevute di consegna (consegnato, non riuscito).",
      cron: "Invia i promemoria in scadenza. Da chiamare ogni 1-5 minuti con Authorization: Bearer $CRON_SECRET.",
      ics: "Il feed del calendario di un professionista, a cui ci si può iscrivere (Google, Apple, Outlook).",
    },
  },
} satisfies DeepPartial<Messages["site"]>;
