/**
 * TESTO GIURIDICO, VERSIONE ITALIANA AUTOREVOLE: accordo sul trattamento dei dati (art. 28 GDPR),
 * termini di servizio per gli studi, elenco dei sub-responsabili, istruzioni per il personale
 * autorizzato e lessico del registro delle attività di trattamento (art. 30 GDPR). L'inglese e le
 * altre lingue sono traduzioni di questo testo.
 *
 * Bozza da sottoporre a un DPO o a un avvocato prima della messa in produzione
 * (docs/i18n/glossary-it.md, "Needs lawyer review"). I paragrafi sono separati da una riga vuota.
 */
import { p } from "../../plural";
import type { DeepPartial, Messages } from "../../types";

export default {
  staffInstructions: {
    title: "Istruzioni per il personale autorizzato al trattamento dei dati dei pazienti",
    intro:
      "Sei autorizzato a trattare i dati personali dei pazienti, compresi i dati relativi alla salute, per conto dello studio (artt. 29 e 32, par. 4, GDPR; art. 2-quaterdecies del Codice in materia di protezione dei dati personali). Attieniti a queste istruzioni in ogni fase del tuo lavoro.",
    confidentiality:
      "Mantieni riservato tutto ciò che apprendi sui pazienti, durante e dopo la tua collaborazione con lo studio. Non parlare mai dei pazienti dove altri possono sentire o vedere.",
    needToKnow:
      "Apri solo i pazienti e gli appuntamenti necessari per il tuo compito. Ciò che puoi vedere dipende dal tuo ruolo; non chiedere ai colleghi accessi che non hai.",
    freeText:
      "Non scrivere informazioni sulla salute nei campi condivisi all'esterno dello studio, come i messaggi ai pazienti, le voci di calendario o le note inviate ad altri fornitori. I dettagli clinici vanno nella cartella clinica.",
    breaches:
      "Segnala immediatamente al titolare dello studio la perdita di un dispositivo, un messaggio inviato alla persona sbagliata o qualsiasi altra possibile violazione dei dati: lo studio ha 72 ore per notificarla al Garante.",
    personalDevices:
      "Non copiare, esportare o inoltrare dati dei pazienti su dispositivi personali, account personali di email o di messaggistica, o servizi non approvati dallo studio.",
    calendarSync:
      "Se sincronizzi la tua agenda con un calendario personale, mantieni l'impostazione con il livello minimo di dettaglio: solo gli orari, senza nomi dei pazienti né prestazioni.",
    accessLog:
      "Ogni accesso ai dati dei pazienti è registrato in un registro delle attività che lo studio può esaminare per tutelare i pazienti. Il registro non è utilizzato per valutare la tua prestazione lavorativa.",
    adTools:
      "Non collegare mai il widget di prenotazione o il sito web dello studio a strumenti pubblicitari o di analisi in modo da comunicare loro chi ha prenotato: il fatto che una persona abbia prenotato dal dentista è un'informazione relativa alla salute.",
    restricted:
      "Alcune schede sono soggette a limitazione del trattamento su richiesta del paziente. Aprile solo quando è davvero necessario e indica la motivazione richiesta dal sistema: ogni accesso viene registrato.",
    accept: "Ho letto queste istruzioni e mi impegno a rispettarle",
    version: "Versione {version}",
  },

  common: {
    version: "Versione {version}",
    effective: "In vigore dal {date}",
    italianPrevails: "Versione italiana: in caso di discordanza con le traduzioni prevale il testo italiano.",
    print: "Stampa o salva come PDF",
    contents: "Indice",
    notConfigured: "Non configurato",
    onRequest: "Su richiesta",
    platformParty: "{name}, {address} (contatto privacy: {email})",
    platformPartyShort: "{name} (contatto privacy: {email})",
    backToTop: "Torna all'inizio",
  },

  purposes: {
    booking_practice: {
      activity: "Prenotazione degli appuntamenti (canali dello studio)",
      purpose:
        "Prenotazione, modifica e disdetta degli appuntamenti richiesti tramite il sito web dello studio, il widget di prenotazione, i link propri dello studio, il telefono, la segreteria e le integrazioni scelte dallo studio.",
    },
    booking_marketplace: {
      activity: "Prenotazioni avviate dalle pagine di ricerca di Sorriso",
      purpose:
        "Inoltro della prenotazione allo studio scelto e relativa gestione, con il consenso esplicito del paziente (Sorriso in qualità di titolare autonomo).",
    },
    appointment_management: {
      activity: "Agenda e schede dei pazienti",
      purpose:
        "Gestione dell'agenda dello studio, delle poltrone e dei professionisti, dello storico degli appuntamenti dei pazienti e delle note amministrative dello studio.",
    },
    reminders: {
      activity: "Conferme e promemoria",
      purpose:
        "Invio di conferme di prenotazione, promemoria, modifiche e annullamenti via SMS, email o, se lo studio lo attiva e il paziente lo sceglie, WhatsApp; elaborazione delle risposte.",
    },
    waitlist: {
      activity: "Lista d'attesa",
      purpose: "Offerta degli orari che si liberano ai pazienti che hanno chiesto di essere avvisati di appuntamenti anticipati.",
    },
    recalls: {
      activity: "Richiami per i controlli",
      purpose: "Promemoria ai pazienti per un controllo, quando il dentista ha fissato per loro un intervallo tra i controlli.",
    },
    feedback_requests: {
      activity: "Inviti a lasciare un feedback",
      purpose: "Invito a lasciare un feedback dopo una visita rivolto ai pazienti che vi hanno acconsentito.",
    },
    reviews: {
      activity: "Recensioni pubblicate",
      purpose: "Pubblicazione su Sorriso, con il loro consenso, delle recensioni di pazienti verificati (Sorriso in qualità di titolare autonomo).",
    },
    marketing: {
      activity: "Novità e offerte",
      purpose: "Invio di novità e offerte dello studio ai pazienti che vi hanno acconsentito.",
    },
    no_show_tracking: {
      activity: "Storico degli appuntamenti mancati",
      purpose:
        "Conteggio degli appuntamenti mancati negli ultimi 24 mesi per organizzare l'agenda e offrire un aiuto aggiuntivo; mai per rifiutare le cure.",
    },
    adaptive_reminders: {
      activity: "Promemoria adattivi",
      purpose:
        "Stima, sulla base dello storico degli appuntamenti, dei casi in cui è utile un promemoria aggiuntivo (profilazione priva di effetti sull'accesso alle cure; il paziente può opporsi).",
    },
    anamnesis: {
      activity: "Anamnesi prima della visita",
      purpose: "Raccolta del questionario anamnestico prima della visita, firmato con un codice monouso, a uso del personale sanitario.",
    },
    partner_api: {
      activity: "Integrazioni (API per partner)",
      purpose: "Scambio dei dati di prenotazione con i software collegati dallo studio, come il gestionale o il call center.",
    },
    directory: {
      activity: "Elenco di studi e professionisti",
      purpose: "Pubblicazione dei profili degli studi e dei professionisti che li hanno approvati.",
    },
    ranking: {
      activity: "Posizionamento nei risultati di ricerca",
      purpose: "Ordinamento dei risultati di ricerca secondo criteri neutrali illustrati agli utenti.",
    },
    privacy_center: {
      activity: "Centro privacy per i pazienti",
      purpose: "Consentire ai pazienti di individuare le proprie schede presso i diversi studi, scaricarle ed esercitare i propri diritti.",
    },
    staff_accounts: {
      activity: "Account del personale",
      purpose: "Gestione degli account del personale degli studi e dei relativi diritti di accesso.",
    },
    security_logs: {
      activity: "Registro degli accessi e sicurezza",
      purpose:
        "Registrazione di chi ha avuto accesso ai dati dei pazienti o li ha modificati, per tutelare i pazienti e individuare gli abusi. Il personale ne è informato (art. 4 L. 300/1970); il registro non è utilizzato per valutare la prestazione lavorativa.",
    },
    privacy_requests: {
      activity: "Richieste in materia di protezione dei dati",
      purpose: "Ricezione delle richieste di esercizio dei diritti in materia di protezione dei dati e relativo riscontro entro i termini di legge.",
    },
  },

  legalBases: {
    art6_1_a: "Consenso (art. 6, par. 1, lett. a), GDPR)",
    art6_1_b: "Esecuzione di un contratto o di misure precontrattuali (art. 6, par. 1, lett. b))",
    art6_1_c: "Obbligo legale (art. 6, par. 1, lett. c))",
    art6_1_f: "Legittimo interesse (art. 6, par. 1, lett. f))",
    art9_2_a: "Consenso esplicito al trattamento di dati relativi alla salute (art. 9, par. 2, lett. a))",
    art9_2_f: "Accertamento, esercizio o difesa di un diritto in sede giudiziaria (art. 9, par. 2, lett. f))",
    art9_2_h: "Assistenza sanitaria sotto il vincolo del segreto professionale (art. 9, par. 2, lett. h), e par. 3)",
  },

  dataCategories: {
    identity: "dati identificativi (nome, data di nascita)",
    contact: "dati di contatto (telefono, email)",
    appointment: "dati degli appuntamenti (data, ora, studio, professionista)",
    health_inferred: "dati che possono rivelare lo stato di salute (fruizione di cure odontoiatriche, tipo di prestazione)",
    health: "dati relativi alla salute (note, anamnesi)",
    minor: "dati di minori",
    guardian: "dati di genitori e tutori",
    message_content: "contenuto dei messaggi",
    consent_record: "registrazioni dei consensi",
    review: "recensioni",
    professional: "dati professionali dei professionisti",
    account: "dati dell'account",
    technical: "dati tecnici (indirizzo IP pseudonimizzato, browser)",
    aggregated_metrics: "statistiche aggregate",
  },

  subjects: {
    patients: "pazienti",
    guardians: "genitori e tutori",
    bookers: "persone che prenotano per altri",
    practitioners: "professionisti",
    staff: "personale degli studi",
    reviewers: "autori di recensioni",
  },

  transferTools: {
    eu: "Nessun trasferimento: fornitore UE/SEE",
    dpf: "Data Privacy Framework UE-USA (art. 45 GDPR)",
    scc: "Clausole contrattuali standard (art. 46, par. 2, lett. c), GDPR)",
    dpf_scc: "Data Privacy Framework UE-USA e, in subordine, clausole contrattuali standard",
  },

  units: {
    months: p({ one: "{count} mese", other: "{count} mesi" }),
    days: p({ one: "{count} giorno", other: "{count} giorni" }),
    hours: p({ one: "{count} ora", other: "{count} ore" }),
  },

  retention: {
    patientInactiveMonths:
      "Scheda del paziente: {period} dall'ultima visita, poi limitata o pseudonimizzata a scelta dello studio (più a lungo ove la cartella clinica debba essere conservata).",
    neverSeenPatientMonths: "Schede di persone che non hanno mai avuto un appuntamento: {period}.",
    messageBodyMonths: "Testo dei messaggi: {period}.",
    messageMetaMonths: "Registro dei messaggi (destinatario, data, stato): {period}.",
    reminderDays: "Promemoria programmati: {period} dall'appuntamento.",
    waitlistDays: "Iscrizioni alla lista d'attesa: {period} dall'ultima data utile; quelle chiuse dopo 30 giorni.",
    patientNoteDays: "Nota di prenotazione del paziente e motivo della disdetta: {period} dalla visita.",
    auditMonths: "Registro degli accessi: {period}.",
    providerMessageDays: "Copie conservate dal fornitore dei servizi di messaggistica: {period}.",
    formSubmissionMonths: "Questionari anamnestici, una volta copiati nella cartella clinica: {period}.",
    consentMonths: "Registrazioni dei consensi di pazienti non più presenti in archivio: {period}.",
    privacyRequestMonths: "Richieste chiuse: {period}.",
    marketingLapse: "Il consenso a ricevere novità e offerte decade dopo 24 mesi senza contatti.",
    contract: "Per tutta la durata del servizio, poi per il termine di prescrizione.",
  },

  register: {
    title: "Registro delle attività di trattamento",
    intro:
      "Art. 30, par. 1, GDPR. Generato a partire da quanto Sorriso svolge per lo studio e dalle sue impostazioni attuali; aggiungi le attività che svolgi al di fuori di Sorriso. Mantienilo aggiornato ed esibiscilo al Garante su richiesta.",
    controller: "Titolare del trattamento",
    vat: "Partita IVA",
    address: "Sede legale",
    contact: "Contatto privacy",
    dpo: "Responsabile della protezione dei dati",
    none: "—",
    generated: "Generato il {date}",
    columns: {
      activity: "Attività di trattamento",
      purpose: "Finalità",
      legalBasis: "Base giuridica",
      subjects: "Interessati",
      dataCategories: "Categorie di dati personali",
      recipients: "Destinatari",
      transfers: "Trasferimenti al di fuori dell'UE",
      retention: "Termini di cancellazione",
      security: "Misure di sicurezza",
    },
    recipient: "{name} ({service})",
    processor: "Sorriso, in qualità di responsabile del trattamento ai sensi dell'accordo sul trattamento dei dati",
    transfer: "{name}: {tool}",
    noTransfers: "Nessuno",
    security: {
      platform:
        "Cifratura a livello di campo di note e messaggi; accessi basati sui ruoli; registro degli accessi a prova di manomissione; conservazione automatizzata; backup cifrati nell'UE; personale istruito e vincolato alla riservatezza.",
      mfaRequired: "Accesso con verifica in due passaggi obbligatorio per tutto il personale.",
      mfaOptional: "Accesso con verifica in due passaggi disponibile ma non obbligatorio.",
      sessions: p({ one: "Le sessioni scadono dopo {count} ora.", other: "Le sessioni scadono dopo {count} ore." }),
      discreet: "I messaggi non indicano mai la prestazione.",
      detailed: "I messaggi possono indicare la prestazione (scelta dello studio).",
    },
  },

  controls: {
    encryption: {
      title: "Cifratura dei campi sensibili",
      body: "Note, testi dei messaggi, risposte ai questionari anamnestici e altri testi liberi sono cifrati nel database con AES-256-GCM, con chiavi conservate al di fuori del database.",
    },
    transport: {
      title: "Cifratura in transito",
      body: "Tutte le connessioni utilizzano TLS; i browser sono istruiti a utilizzare solo HTTPS e le pagine applicano una rigorosa politica di sicurezza dei contenuti.",
    },
    access_control: {
      title: "Accessi basati sui ruoli",
      body: "Ogni ruolo del personale vede solo ciò che gli serve: la segreteria non ha accesso alle note cliniche; esportazioni, cancellazioni e impostazioni sono riservate a titolari e amministratori.",
    },
    mfa: {
      title: "Accesso con verifica in due passaggi",
      body: "Il personale accede con una password e un codice generato da un'app di autenticazione; le operazioni sensibili richiedono di nuovo il codice.",
    },
    sessions: {
      title: "Limiti delle sessioni",
      body: "Le sessioni scadono dopo un periodo stabilito dallo studio e in caso di inattività; il personale può revocarle.",
    },
    audit_log: {
      title: "Registro degli accessi a prova di manomissione",
      body: "Ogni accesso ai dati dei pazienti e ogni loro modifica sono registrati in un registro concatenato tramite hash, che lo studio può verificare ed esportare; le teste della catena sono conservate al di fuori del database.",
    },
    pseudonymous_logs: {
      title: "Log privi di dati personali",
      body: "I log applicativi mascherano numeri di telefono e indirizzi email; gli indirizzi IP sono conservati solo come hash con chiave.",
    },
    rate_limiting: {
      title: "Protezione dagli abusi",
      body: "L'accesso, i codici monouso e gli endpoint pubblici di prenotazione sono soggetti a limiti di frequenza.",
    },
    links: {
      title: "Link ai pazienti con scadenza",
      body: "I link nei messaggi contengono token casuali, conservati solo come hash, che scadono dopo la visita.",
    },
    otp: {
      title: "Codici monouso",
      body: "I codici sono conservati solo come hash, scadono dopo 5 minuti e si bloccano dopo ripetuti tentativi errati.",
    },
    discreet_messages: {
      title: "Messaggi discreti",
      body: "Per impostazione predefinita SMS, WhatsApp, oggetti delle email e voci di calendario non indicano mai la prestazione, la specializzazione o le note.",
    },
    retention: {
      title: "Conservazione automatizzata",
      body: "Un processo giornaliero cancella, oscura o pseudonimizza i dati al termine del relativo periodo di conservazione.",
    },
    erasure: {
      title: "Cancellazione e limitazione",
      body: "Gli studi possono esportare, pseudonimizzare o limitare un paziente in un'unica operazione; per ogni accesso alle schede limitate è richiesta una motivazione.",
    },
    backups: {
      title: "Backup",
      body: "I backup cifrati con ripristino a un momento specifico sono conservati nell'UE per un periodo limitato e poi sovrascritti.",
    },
    key_rotation: {
      title: "Gestione delle chiavi",
      body: "Le chiavi di cifratura possono essere ruotate senza interruzione del servizio; le chiavi precedenti servono solo per decifrare.",
    },
    no_trackers: {
      title: "Nessun tracciatore di terze parti",
      body: "Le pagine di Sorriso non caricano script, caratteri, pixel o cookie pubblicitari di terze parti; ciò viene verificato automaticamente.",
    },
    staff_instructions: {
      title: "Personale istruito",
      body: "Ogni membro del personale accetta istruzioni scritte in materia di protezione dei dati prima di trattare i dati dei pazienti; le accettazioni sono registrate.",
    },
    breach_procedure: {
      title: "Procedura in caso di violazione",
      body: "Una procedura documentata per valutare, contenere e notificare le violazioni dei dati personali, con notifica allo studio entro 24 ore.",
    },
  },

  subprocessors: {
    title: "Sub-responsabili del trattamento",
    description: "I fornitori di cui Sorriso si avvale per trattare i dati degli studi, dove li trattano e come sono tutelati i trasferimenti.",
    intro:
      "Quando uno studio utilizza Sorriso, Sorriso tratta i dati dei pazienti per conto dello studio in qualità di responsabile del trattamento (art. 28 GDPR). Sorriso si avvale dei fornitori elencati di seguito, ciascuno vincolato da un accordo sul trattamento dei dati con obblighi almeno equivalenti a quelli previsti dall'accordo sul trattamento dei dati di Sorriso.",
    noticeRule:
      "Sorriso comunica agli studi l'aggiunta o la sostituzione di un sub-responsabile almeno 30 giorni prima della modifica, via email e nel pannello. Lo studio può opporsi entro tale termine; se non si trova una soluzione, può recedere dal contratto senza penali prima che la modifica abbia effetto.",
    transfersNote:
      "Un fornitore la cui società controllante ha sede negli Stati Uniti può essere obbligato a consentire l'accesso ai dati anche quando i suoi server si trovano nell'UE. Tali trasferimenti si basano sul Data Privacy Framework UE-USA e, in subordine, sulle clausole contrattuali standard, e sono oggetto di una valutazione d'impatto sul trasferimento.",
    columns: {
      name: "Fornitore",
      entity: "Soggetto giuridico",
      service: "Servizio",
      data: "Dati",
      region: "Dove",
      transfer: "Garanzia per il trasferimento",
      dpa: "Accordo",
    },
    onlyWhatsapp: "Solo per gli studi che attivano WhatsApp e solo per i pazienti che lo scelgono.",
    parent: "Società controllante: {parent}",
    viewDpa: "Accordo sul trattamento dei dati del fornitore",
    service: {
      hosting: "Hosting dell'applicazione",
      database: "Banca dati",
      sms: "Invio di SMS",
      whatsapp: "Invio di messaggi WhatsApp",
      email: "Invio di email",
      backups: "Backup",
    },
    data: {
      all_platform_data: "tutti i dati conservati in Sorriso",
      contact: "dati di contatto",
      message_content: "contenuto dei messaggi",
      message_metadata: "metadati dei messaggi",
      technical: "dati tecnici",
    },
    changelog: "Registro delle modifiche",
    change: {
      initial: "Prima pubblicazione dell'elenco.",
      added: "Aggiunto {name}.",
      removed: "Rimosso {name}.",
      changed: "Modificati i dati di {name}.",
    },
    announced: "Comunicato il {date}",
  },

  dpa: {
    title: "Accordo sul trattamento dei dati personali",
    description: "L'accordo ai sensi dell'art. 28 GDPR tra ciascuno studio (titolare del trattamento) e Sorriso (responsabile del trattamento).",
    intro:
      "Il presente accordo costituisce parte integrante dei termini di servizio e si applica ogni volta che Sorriso tratta dati personali per conto di uno studio. Lo studio lo accetta nel pannello; l'accettazione è registrata con la versione, la data e la lingua.",
    parties: {
      title: "1. Parti e ruoli",
      body: "Titolare del trattamento: lo studio che utilizza Sorriso. Responsabile del trattamento: {platform}.\n\nIl Titolare determina le finalità e i mezzi del trattamento dei dati dei pazienti per le prenotazioni che riceve tramite i propri canali: il proprio sito web e widget di prenotazione, i propri link, il telefono e la segreteria, nonché le integrazioni che collega. Sorriso tratta tali dati esclusivamente in qualità di Responsabile del trattamento per conto del Titolare.",
    },
    subject: {
      title: "2. Oggetto, durata, natura e finalità",
      body: "Oggetto: il servizio di prenotazione online, promemoria, lista d'attesa, richiami e gestione dei pazienti descritto nei termini di servizio.\n\nDurata: per tutta la durata dell'account dello studio e, successivamente, fino alla cancellazione o alla restituzione dei dati ai sensi della sezione 11.\n\nNatura e finalità, tipi di dati e categorie di interessati: come descritti nell'Allegato I, generato a partire dai trattamenti effettivamente svolti da Sorriso.",
    },
    instructions: {
      title: "3. Istruzioni documentate (art. 28, par. 3, lett. a))",
      body: "Sorriso tratta i dati personali soltanto su istruzione documentata del Titolare: il presente accordo, i termini di servizio, le impostazioni del Titolare nel pannello e le operazioni svolte dal suo personale. Ciò vale anche per i trasferimenti verso paesi terzi, che avvengono esclusivamente come descritto nell'Allegato III.\n\nIl Titolare incarica Sorriso di inviare inviti a lasciare un feedback ai pazienti che vi hanno acconsentito e di applicare i periodi di conservazione impostati nel pannello.\n\nQualora il diritto dell'Unione o il diritto italiano imponga a Sorriso di trattare i dati diversamente, Sorriso ne informa il Titolare prima del trattamento, salvo che la legge lo vieti. Sorriso informa immediatamente il Titolare qualora, a suo parere, un'istruzione violi la normativa in materia di protezione dei dati.",
    },
    confidentiality: {
      title: "4. Riservatezza (art. 28, par. 3, lett. b))",
      body: "Sorriso garantisce che le persone autorizzate al trattamento dei dati si siano impegnate alla riservatezza, ricevano istruzioni in materia di protezione dei dati e accedano ai dati solo nella misura necessaria al proprio compito. Il personale di Sorriso non accede mai alle schede dei pazienti, salvo per fornire l'assistenza richiesta dal Titolare, per garantire la sicurezza del servizio o quando la legge lo impone; tali accessi sono registrati.",
    },
    security: {
      title: "5. Sicurezza (art. 28, par. 3, lett. c), e art. 32)",
      body: "Sorriso adotta le misure tecniche e organizzative indicate nell'Allegato II, tenendo conto dello stato dell'arte, dei costi di attuazione e dei rischi per i pazienti, in particolare perché i dati possono rivelare informazioni sulla salute. Sorriso riesamina periodicamente tali misure e non riduce il livello complessivo di protezione.",
    },
    subprocessors: {
      title: "6. Sub-responsabili del trattamento (art. 28, parr. 2 e 4)",
      body: "Il Titolare concede a Sorriso un'autorizzazione scritta generale a ricorrere ai sub-responsabili elencati nell'Allegato III e nella pagina pubblica dei sub-responsabili. Sorriso informa il Titolare di eventuali modifiche previste riguardanti l'aggiunta o la sostituzione di sub-responsabili con almeno 30 giorni di preavviso, via email e nel pannello. Il Titolare può opporsi entro tale termine per ragionevoli motivi attinenti alla protezione dei dati; se non si trova una soluzione, il Titolare può recedere senza penali dal servizio interessato prima che la modifica abbia effetto.\n\nSorriso impone contrattualmente a ciascun sub-responsabile gli stessi obblighi in materia di protezione dei dati previsti dal presente accordo e rimane pienamente responsabile nei confronti del Titolare dell'adempimento degli obblighi dei sub-responsabili.",
    },
    rights: {
      title: "7. Diritti degli interessati (art. 28, par. 3, lett. e))",
      body: "Sorriso assiste il Titolare nel dare seguito alle richieste di esercizio dei diritti di cui al Capo III del GDPR mediante strumenti disponibili nel pannello: la casella delle richieste con le relative scadenze, l'esportazione in JSON, CSV e FHIR, la rettifica, la limitazione e la cancellazione mediante pseudonimizzazione.\n\nSe una richiesta relativa al trattamento del Titolare perviene a Sorriso, Sorriso la inoltra al Titolare entro 2 giorni lavorativi e non vi risponde per conto del Titolare, salvo per comunicare al richiedente l'avvenuto inoltro.",
    },
    assistance: {
      title: "8. Assistenza negli obblighi del Titolare (art. 28, par. 3, lett. f))",
      body: "Tenendo conto della natura del trattamento e delle informazioni a sua disposizione, Sorriso assiste il Titolare nel garantire il rispetto degli obblighi in materia di sicurezza (art. 32), di notifica e comunicazione delle violazioni (artt. 33-34), di valutazione d'impatto sulla protezione dei dati e di consultazione preventiva (artt. 35-36). Sorriso mette a disposizione la propria valutazione d'impatto della piattaforma e la propria valutazione d'impatto sui trasferimenti.",
    },
    breach: {
      title: "9. Violazioni dei dati personali",
      body: "Sorriso notifica al Titolare, senza ingiustificato ritardo e comunque entro 24 ore dal momento in cui ne è venuta a conoscenza, qualsiasi violazione dei dati personali che riguardi i dati del Titolare. La notifica descrive, per quanto noto, la natura della violazione, le categorie e il numero approssimativo di pazienti e di registrazioni interessati, le probabili conseguenze e le misure adottate o proposte. Sorriso integra le informazioni man mano che si rendono disponibili, così da consentire al Titolare di notificare la violazione al Garante entro 72 ore e, ove necessario, di comunicarla ai pazienti.",
    },
    audits: {
      title: "10. Informazioni e attività di revisione (art. 28, par. 3, lett. h))",
      body: "Sorriso mette a disposizione del Titolare tutte le informazioni necessarie per dimostrare il rispetto degli obblighi di cui all'art. 28: il presente accordo, il registro dei trattamenti, le misure di sicurezza, le certificazioni o i rapporti di audit ove disponibili e il registro degli accessi nel pannello. Sorriso consente e contribuisce alle attività di revisione, comprese le ispezioni, realizzate dal Titolare o da un altro soggetto da questi incaricato e vincolato alla riservatezza, con un preavviso di almeno 30 giorni, in orario lavorativo e senza pregiudicare il servizio; le attività di revisione sono a carico del Titolare, salvo che rivelino una violazione sostanziale.",
    },
    deletion: {
      title: "11. Restituzione e cancellazione al termine (art. 28, par. 3, lett. g))",
      body: "Il Titolare può scaricare tutti i propri dati in qualsiasi momento, in formati documentati (JSON, CSV e FHIR R4), senza alcun costo. Quando il Titolare chiude il proprio account, la prenotazione online si interrompe immediatamente, i dati restano disponibili per il download per 60 giorni (30 giorni di transizione e almeno 30 giorni per recuperarli) e vengono poi cancellati dai sistemi di Sorriso. Sorriso rilascia un certificato di cancellazione che indica cosa è stato cancellato e quando. I backup cifrati sono sovrascritti entro il relativo periodo di conservazione e non vengono ripristinati se non per il recupero a seguito di un incidente. Sorriso conserva i dati più a lungo solo se il diritto dell'Unione o il diritto italiano lo prevede, e in tal caso esclusivamente per tale finalità.",
    },
    transfers: {
      title: "12. Trasferimenti al di fuori dell'UE",
      body: "I dati sono ospitati nell'UE. Alcuni sub-responsabili appartengono a gruppi con sede negli Stati Uniti; le garanzie applicabili ai trasferimenti sono indicate per ciascuno nell'Allegato III e il relativo impatto è stato valutato. Sorriso non trasferisce i dati del Titolare verso alcun altro paese terzo senza averne informato preventivamente il Titolare ai sensi della sezione 6.",
    },
    ownPurposes: {
      title: "13. Trattamenti di cui Sorriso è titolare",
      body: "Per alcune attività Sorriso opera in qualità di titolare autonomo del trattamento, e non di responsabile del Titolare, e ne informa i pazienti con la propria informativa: le prenotazioni avviate dalle pagine di ricerca di Sorriso (con il consenso esplicito del paziente), le recensioni pubblicate, l'elenco e il posizionamento nei risultati di ricerca, il centro privacy per i pazienti e gli account del personale. Sorriso non utilizza i dati trattati per conto del Titolare per alcuna finalità propria e non li vende né li utilizza mai a fini pubblicitari.",
    },
    controller: {
      title: "14. Obblighi del Titolare",
      body: "Il Titolare garantisce di disporre di una base giuridica per il trattamento, fornisce ai pazienti la propria informativa (Sorriso ne genera una a partire dalle impostazioni dello studio), istruisce il proprio personale e mantiene aggiornati le impostazioni, i periodi di conservazione e il registro dei trattamenti. Il Titolare non collega il widget o le pagine di prenotazione di Sorriso a strumenti pubblicitari o di analisi in modo da comunicare loro chi ha prenotato.",
    },
    liability: {
      title: "15. Responsabilità e durata",
      body: "Ciascuna parte risponde secondo quanto previsto dall'art. 82 GDPR e dai termini di servizio. Il presente accordo resta in vigore finché Sorriso tratta dati personali per conto del Titolare. In caso di contrasto con i termini di servizio in materia di protezione dei dati, prevale il presente accordo.",
    },
    law: {
      title: "16. Legge applicabile",
      body: "Il presente accordo è disciplinato dalla legge italiana. Le controversie sono devolute al foro indicato nei termini di servizio.",
    },
    annex1: {
      title: "Allegato I — Descrizione del trattamento",
      intro: "I trattamenti svolti da Sorriso in qualità di responsabile, generati a partire dal registro delle finalità della piattaforma.",
    },
    annex2: {
      title: "Allegato II — Misure tecniche e organizzative",
      intro: "Le misure attualmente in essere. L'elenco è generato a partire dai controlli implementati nella piattaforma.",
    },
    annex3: {
      title: "Allegato III — Sub-responsabili del trattamento",
      intro: "L'elenco attuale (versione {version}). La pagina pubblica conserva il registro delle modifiche.",
    },
  },

  terms: {
    title: "Termini di servizio per gli studi",
    description: "Il contratto tra Sorriso e gli studi dentistici che lo utilizzano.",
    intro:
      "I presenti termini disciplinano l'utilizzo di Sorriso da parte degli studi dentistici (\"lo Studio\") e sono conclusi con {platform}. Lo Studio li accetta nel pannello; l'accettazione è registrata con la versione, la data e la lingua.",
    service: {
      title: "1. Il servizio",
      body: "Sorriso fornisce la prenotazione online per il sito web dello Studio e per le pagine di ricerca di Sorriso, un'agenda per professionisti, poltrone e sedi, conferme e promemoria, una lista d'attesa, richiami, schede dei pazienti per la gestione amministrativa e strumenti per adempiere agli obblighi in materia di protezione dei dati. Sorriso non è un fornitore di prestazioni sanitarie e non fornisce consulenza medica.",
    },
    account: {
      title: "2. Account e personale",
      body: "Lo Studio designa un titolare che gestisce il suo account e invita il personale assegnandogli un ruolo. Lo Studio è responsabile dell'utilizzo del servizio da parte del proprio personale, mantiene riservate le credenziali di accesso e attiva la verifica in due passaggi. Ogni membro del personale deve accettare le istruzioni in materia di protezione dei dati prima di trattare i dati dei pazienti.",
    },
    data: {
      title: "3. Protezione dei dati",
      body: "Per i dati dei pazienti che prenotano tramite i canali propri dello Studio, lo Studio è titolare del trattamento e Sorriso responsabile del trattamento: si applica l'accordo sul trattamento dei dati, che costituisce parte integrante dei presenti termini. Per le prenotazioni avviate dalle pagine di ricerca di Sorriso, le recensioni, l'elenco e il centro privacy, Sorriso è titolare autonomo del trattamento, come illustrato nella propria informativa.",
    },
    obligations: {
      title: "4. Obblighi dello Studio",
      body: "Lo Studio fornisce informazioni corrette sulle proprie prestazioni, sui prezzi, sui professionisti e sulla disponibilità; onora le prenotazioni che accetta; utilizza i dati dei pazienti solo per finalità di cura e amministrative; e non utilizza Sorriso per inviare comunicazioni non richieste.",
    },
    marketplace: {
      title: "5. Ricerca, posizionamento e recensioni",
      body: "Gli studi compaiono nella ricerca di Sorriso solo se pubblicati e con professionisti che hanno approvato il proprio profilo. Il posizionamento si basa su criteri neutrali pubblicati nella pagina dedicata; nessun pagamento influisce sulla posizione. Solo i pazienti con una visita effettuata possono scrivere recensioni, e gli studi non possono rimuoverle: possono rispondere e segnalare una recensione, sulla quale Sorriso decide con una motivazione e con la possibilità di un ricorso.",
    },
    availability: {
      title: "6. Disponibilità e assistenza",
      body: "Sorriso usa la ragionevole diligenza per mantenere il servizio disponibile e sicuro e comunica in anticipo le manutenzioni programmate. L'assistenza è disponibile via email nei giorni lavorativi.",
    },
    fees: {
      title: "7. Corrispettivi",
      body: "Gli eventuali corrispettivi sono quelli del piano scelto dallo Studio, indicati nel pannello. Sorriso comunica le variazioni di prezzo con almeno 30 giorni di preavviso. L'esportazione dei dati e il passaggio a un altro fornitore sono gratuiti.",
    },
    ip: {
      title: "8. Proprietà intellettuale",
      body: "Lo Studio conserva tutti i diritti sui propri contenuti e dati. Sorriso conserva tutti i diritti sul software. Lo Studio concede a Sorriso il diritto di mostrare il proprio profilo pubblico e i propri contenuti ai fini del servizio.",
    },
    suspension: {
      title: "9. Sospensione",
      body: "Sorriso può sospendere un account solo in caso di grave violazione dei presenti termini, di rischio per la sicurezza o di obbligo di legge, comunicandone per iscritto i motivi allo Studio in anticipo ove possibile, e al più tardi nel momento in cui la sospensione ha effetto. Lo Studio può contestare la decisione tramite la procedura di reclamo.",
    },
    exit: {
      title: "10. Recesso, cambio di fornitore e recupero dei dati",
      body: "Lo Studio può chiudere il proprio account in qualsiasi momento dal pannello, senza preavviso. La prenotazione online si interrompe immediatamente; lo Studio mantiene l'accesso per un periodo di transizione di 30 giorni e per almeno ulteriori 30 giorni per recuperare gratuitamente i propri dati in JSON, CSV e FHIR, e Sorriso lo assiste nel passaggio a un altro fornitore. I dati vengono poi cancellati e viene rilasciato un certificato di cancellazione. Sorriso può recedere dal contratto con un preavviso di due mesi, o con effetto immediato in caso di grave inadempimento.",
    },
    liability: {
      title: "11. Responsabilità",
      body: "Nessuna delle parti esclude la propria responsabilità per dolo o colpa grave, né nei casi in cui la legge non lo consente. Per il resto, la responsabilità di ciascuna parte è limitata ai danni diretti prevedibili. Sorriso non risponde delle prestazioni cliniche dello Studio.",
    },
    complaints: {
      title: "12. Reclami e mediazione",
      body: "Lo Studio può inviare reclami a Sorriso tramite il pannello o via email; Sorriso risponde entro 15 giorni lavorativi. Sorriso è disponibile a ricorrere alla mediazione per la risoluzione stragiudiziale delle controversie, come previsto dal Regolamento (UE) 2019/1150.",
    },
    changes: {
      title: "13. Modifiche ai presenti termini",
      body: "Sorriso comunica le modifiche con almeno 30 giorni di preavviso via email e nel pannello, salvo che la legge imponga una modifica più rapida. Se lo Studio non le accetta, può recedere gratuitamente prima che la modifica abbia effetto.",
    },
    law: {
      title: "14. Legge applicabile e foro competente",
      body: "I presenti termini sono disciplinati dalla legge italiana. È competente il foro della sede legale di Sorriso, fatte salve le norme inderogabili.",
    },
  },

  docs: {
    dpa: "Accordo sul trattamento dei dati",
    terms: "Termini di servizio",
    subprocessors: "Sub-responsabili",
    staff_instructions: "Istruzioni per il personale",
  },
} satisfies DeepPartial<Messages["legalPractice"]>;
