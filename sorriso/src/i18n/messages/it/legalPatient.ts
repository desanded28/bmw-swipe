/**
 * TESTO GIURIDICO, VERSIONE ITALIANA AUTOREVOLE. Le informative (art. 13 e 14 GDPR) per i pazienti
 * (studio e Sorriso), per i minori, per il personale degli studi e per i professionisti, e
 * l'informativa sui cookie. L'inglese e le altre lingue sono traduzioni di questo testo.
 *
 * Bozza da sottoporre a un DPO o a un avvocato esperto di protezione dei dati prima della messa in
 * produzione (docs/i18n/glossary-it.md, "Needs lawyer review"). Una chiave per frase o voce di
 * elenco; testo semplice, senza markup.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    practiceTitle: "Informativa sul trattamento dei dati personali: {practice}",
    practiceDescription: "Come {practice} tratta i dati personali dei propri pazienti e quali sono i tuoi diritti.",
    minorTitle: "La privacy spiegata ai ragazzi: {practice}",
    minorDescription: "Cosa fa {practice} con le informazioni che ti riguardano, spiegato in parole semplici.",
    platformTitle: "Informativa privacy di Sorriso",
    platformDescription:
      "Come Sorriso tratta i dati personali quando cerchi un dentista, prenoti o scrivi una recensione, e quali sono i tuoi diritti.",
    staffTitle: "Informativa privacy per il personale degli studi",
    staffDescription: "Come vengono trattati i tuoi dati quando utilizzi il pannello di Sorriso e come funziona il registro degli accessi.",
    practitionerTitle: "Informativa privacy per i professionisti",
    practitionerDescription: "Come Sorriso tratta i dati dei professionisti presenti nel proprio elenco.",
    cookiesTitle: "Informativa sui cookie",
    cookiesDescription: "I pochi cookie tecnici utilizzati da Sorriso e perché non è presente un banner dei cookie.",
  },
  page: {
    version: "Versione {version}",
    updated: "In vigore dal {date}",
    italianPrevails: "Questa è la versione italiana, che prevale in caso di discordanza con le traduzioni.",
    italianLink: "Versione italiana",
    contents: "Indice",
    practiceLink: "Informativa completa dello studio",
    minorsLink: "Versione per ragazzi",
    platformLink: "Informativa privacy di Sorriso",
    cookiesLink: "Informativa sui cookie",
    privacyCenterLink: "Vai al centro privacy",
    otherNotices: "Altre informative",
    staffLink: "Per il personale degli studi",
    practitionerLink: "Per i professionisti",
    patientLink: "Per i pazienti",
    backToTop: "Torna all'inizio",
  },
  sections: {
    summary: "In breve",
    controller: "Chi è responsabile dei tuoi dati",
    roles: "I due ruoli di Sorriso",
    data: "Quali dati trattiamo",
    purposes: "Perché li trattiamo e su quale base giuridica",
    marketplace: "Se hai prenotato su Sorriso",
    withdrawal: "Se revochi il consenso",
    recipients: "Chi riceve i tuoi dati",
    transfers: "Trasferimenti al di fuori dello Spazio economico europeo",
    retention: "Per quanto tempo conserviamo i tuoi dati",
    rights: "I tuoi diritti",
    complaint: "Reclami",
    mandatory: "Sei obbligato a fornirci i tuoi dati?",
    automated: "Decisioni automatizzate e profilazione",
    minors: "Bambini e ragazzi",
    monitoring: "Il registro degli accessi",
    profile: "Il tuo profilo pubblico",
    cookies: "Cookie",
    changes: "Modifiche alla presente informativa",
    who: "Chi si occupa delle tue informazioni",
    what: "Quali informazioni usiamo",
    why: "Perché le usiamo",
    parents: "I tuoi genitori o il tuo tutore",
    keep: "Per quanto tempo le conserviamo",
    youCan: "Cosa puoi fare",
    help: "Se qualcosa non va",
    full: "L'informativa completa",
    cookieList: "Cookie che utilizziamo",
    storage: "Memorizzazione nel browser",
    thirdParties: "Terze parti",
    legalBasis: "Base giuridica",
    control: "Come gestire i cookie",
    widget: "Il widget di prenotazione sui siti degli studi",
  },
  controller: {
    name: "Titolare del trattamento: {name}",
    vat: "Partita IVA: {vat}",
    address: "Indirizzo: {address}",
    contact: "Contatto per la privacy: {email}",
    phone: "Telefono: {phone}",
    dpo: "Responsabile della protezione dei dati (RPD/DPO): {name}, {email}",
    dpoEmail: "Responsabile della protezione dei dati (RPD/DPO): {email}",
    noDpo: "Lo studio non ha designato un responsabile della protezione dei dati: per qualsiasi questione relativa alla privacy scrivi al contatto indicato sopra.",
    processor:
      "Sorriso fornisce il software di prenotazione in qualità di responsabile del trattamento dello studio (art. 28 GDPR): agisce esclusivamente su istruzioni documentate dello studio e sulla base di un accordo sul trattamento dei dati.",
    platformDpo: "Il responsabile della protezione dei dati (RPD/DPO) di Sorriso è contattabile all'indirizzo {email}.",
  },
  bases: {
    art6_1_a: "il tuo consenso (art. 6, par. 1, lett. a), GDPR)",
    art6_1_b: "l'esecuzione del servizio da te richiesto o di misure precontrattuali adottate su tua richiesta (art. 6, par. 1, lett. b), GDPR)",
    art6_1_c: "l'adempimento di un obbligo legale al quale è soggetto il titolare (art. 6, par. 1, lett. c), GDPR)",
    art6_1_f: "il legittimo interesse del titolare, al quale puoi opporti (art. 6, par. 1, lett. f), GDPR)",
    art9_2_a: "il tuo consenso esplicito per i dati che possono riguardare la tua salute (art. 9, par. 2, lett. a), GDPR)",
    art9_2_f: "l'accertamento, l'esercizio o la difesa di un diritto in sede giudiziaria (art. 9, par. 2, lett. f), GDPR)",
    art9_2_h:
      "finalità di assistenza sanitaria da parte di professionisti soggetti al segreto professionale (art. 9, par. 2, lett. h), e par. 3, GDPR; art. 2-septies del Codice in materia di protezione dei dati personali, D.Lgs. 196/2003)",
  },
  purposes: {
    item: "{title}. {body} Base giuridica: {bases}.",
    booking_practice: {
      title: "Prenotazione",
      body: "Ricevere e registrare la tua prenotazione, verificare la disponibilità e confermarti l'appuntamento.",
    },
    booking_marketplace: {
      title: "Prenotazioni effettuate su Sorriso",
      body: "Quando prenoti dalle pagine di ricerca di Sorriso: inoltrare la prenotazione allo studio da te scelto e gestire promemoria e modifiche. Poiché i dati della prenotazione possono rivelare informazioni sulla tua salute, Sorriso ti chiede il consenso esplicito.",
    },
    appointment_management: {
      title: "Gestione degli appuntamenti",
      body: "Tenere i tuoi appuntamenti e la tua scheda presso lo studio, organizzare l'agenda e consentirti di confermare, spostare o disdire online.",
    },
    reminders: {
      title: "Conferme e promemoria",
      body: "Inviare conferme di prenotazione e promemoria via SMS, email o, se lo scegli, WhatsApp. I messaggi sono discreti: non indicano prestazioni né note, salvo che lo studio abbia scelto i messaggi dettagliati e il tuo recapito sia stato verificato. Puoi disattivare qualsiasi canale in qualsiasi momento.",
    },
    waitlist: {
      title: "Lista d'attesa",
      body: "Se ti iscrivi alla lista d'attesa: avvisarti quando si libera un orario prima.",
    },
    recalls: {
      title: "Richiami per i controlli",
      body: "Ricordarti il controllo successivo quando il tuo dentista ha fissato un intervallo tra i controlli. Ogni richiamo ti consente di interromperli e puoi opporti in qualsiasi momento.",
    },
    feedback_requests: {
      title: "Inviti a lasciare un feedback",
      body: "Solo con il tuo consenso: un unico invito a lasciare un feedback dopo la visita. Puoi revocare il consenso in qualsiasi momento.",
    },
    reviews: {
      title: "Recensioni",
      body: "Se scrivi una recensione e acconsenti alla sua pubblicazione: pubblicarla, mostrare che si riferisce a una visita reale e moderarla. Puoi eliminarla in qualsiasi momento dal centro privacy.",
    },
    marketing: {
      title: "Novità e offerte",
      body: "Solo con il tuo consenso: novità e offerte dello studio. Non è mai necessario per prenotare o per ricevere cure, e il consenso decade dopo 24 mesi senza contatti.",
    },
    no_show_tracking: {
      title: "Storico degli appuntamenti mancati",
      body: "Registrare gli appuntamenti mancati negli ultimi 24 mesi, organizzare l'agenda e offrirti un aiuto, ad esempio un promemoria in più. Non ti impedisce mai di prenotare. Puoi opporti in qualsiasi momento.",
    },
    adaptive_reminders: {
      title: "Promemoria adattivi",
      body: "Inviare un promemoria in più quando, in base allo storico dei tuoi appuntamenti, è più probabile che un appuntamento venga mancato. Si tratta di profilazione (art. 4, punto 4, GDPR): aggiunge soltanto un aiuto e non limita mai la possibilità di prenotare. Puoi opporti in qualsiasi momento e ricevere i promemoria standard.",
    },
    anamnesis: {
      title: "Questionario anamnestico",
      body: "Se lo studio ti chiede di compilarlo prima della visita: preparare le cure in sicurezza. Le tue risposte sono cifrate e visibili solo al personale sanitario.",
    },
    partner_api: {
      title: "Software gestionale collegato",
      body: "Se lo studio collega all'agenda il proprio software gestionale: mantenere allineati i due sistemi. Tale software è un destinatario scelto dallo studio.",
    },
    directory: {
      title: "Elenco",
      body: "Mostrare studi e professionisti nei risultati di ricerca di Sorriso e nelle relative pagine pubbliche.",
    },
    ranking: {
      title: "Ordine dei risultati di ricerca",
      body: "Ordinare i risultati di ricerca secondo criteri pubblicati: primo orario libero, valutazioni, affidabilità, completezza del profilo e distanza. Nessuno può pagare per ottenere una posizione migliore. Puoi opporti in qualsiasi momento.",
    },
    privacy_center: {
      title: "Centro privacy",
      body: "Individuare le schede che gli studi presenti su Sorriso conservano per un numero di telefono o un indirizzo email che hai verificato con un codice monouso, così da consentirti di esercitare i tuoi diritti in un unico luogo.",
    },
    staff_accounts: {
      title: "Account del personale",
      body: "Fornire al personale degli studi un accesso personale e sicuro al pannello: autenticazione, verifica in due passaggi, sessioni e accettazione delle istruzioni per il personale.",
    },
    security_logs: {
      title: "Sicurezza e registro degli accessi",
      body: "Registrare chi apre e modifica le schede dei pazienti, proteggerle da usi impropri e mostrare ai pazienti chi ha avuto accesso ai loro dati.",
    },
    privacy_requests: {
      title: "Richieste privacy",
      body: "Gestire le richieste degli interessati relative ai propri dati, rispondere entro i termini di legge e conservarne la prova.",
    },
  },
  services: {
    hosting: "hosting dell'applicazione",
    database: "banca dati",
    sms: "invio di SMS",
    whatsapp: "invio di messaggi WhatsApp, solo per gli studi che li attivano e per i pazienti che li scelgono",
    email: "invio di email",
    backups: "copie di backup",
  },
  transferTools: {
    eu: "nessun trasferimento (UE/SEE)",
    dpf: "Data Privacy Framework UE-USA (decisione di adeguatezza della Commissione europea del 10 luglio 2023)",
    scc: "clausole contrattuali standard approvate dalla Commissione europea (art. 46 GDPR)",
    dpf_scc: "Data Privacy Framework UE-USA e, in subordine, clausole contrattuali standard della Commissione europea",
  },
  data: {
    intro: "Trattiamo:",
    identity:
      "dati identificativi e di contatto: nome, cognome, numero di cellulare, indirizzo email, data di nascita, nonché la lingua e il canale che preferisci;",
    appointments:
      "dati degli appuntamenti: data, ora, prestazione, professionista, sede, stato e appuntamenti mancati. Possono rivelare informazioni sulla tua salute;",
    yourWords:
      "quanto scegli di comunicarci: le note aggiunte a una prenotazione, le risposte ai nostri messaggi e, se lo studio lo utilizza, il questionario anamnestico;",
    guardian: "per i minori: i dati del genitore o del tutore legale che prenota e riceve i messaggi;",
    records: "la registrazione dei tuoi consensi e delle tue scelte, e delle richieste privacy che presenti;",
    technical: "dati tecnici necessari per la sicurezza: hash con chiave (HMAC) del tuo indirizzo IP, mai l'indirizzo in chiaro.",
    source:
      "Riceviamo questi dati da te o dalla persona che ha prenotato per te: un genitore o un tutore, oppure un altro adulto che ha prenotato per tuo conto. In tal caso inviamo la presente informativa anche al tuo recapito, se ne disponiamo (art. 14 GDPR).",
  },
  platformData: {
    intro: "Sorriso tratta, per i propri servizi:",
    booking:
      "quando prenoti dalle sue pagine di ricerca: il tuo nome, i recapiti, la data di nascita se indicata, lo studio, la prestazione, la data e l'ora scelte, e la registrazione del tuo consenso;",
    reviews: "quando scrivi una recensione: la valutazione, il testo, il nome visualizzato e la visita a cui si riferisce;",
    privacyCenter:
      "quando utilizzi il centro privacy: un hash con chiave del numero di telefono o dell'indirizzo email che verifichi, i codici monouso inviati (conservati solo come hash) e un cookie di sessione valido per 30 minuti;",
    technical: "per la sicurezza: hash con chiave (HMAC) degli indirizzi IP e dei browser, mai gli indirizzi in chiaro.",
  },
  recipients: {
    intro: "I tuoi dati sono accessibili solo a chi ne ha bisogno:",
    staff: "il personale autorizzato dello studio (segreteria e personale sanitario), ciascuno con l'accesso necessario per il proprio ruolo;",
    sorriso: "Sorriso, che gestisce il software di prenotazione in qualità di responsabile del trattamento dello studio;",
    practices: "lo studio presso cui prenoti, che riceve la prenotazione e diventa titolare del trattamento della propria copia;",
    providers: "i fornitori tecnici indicati di seguito (sub-responsabili del trattamento), vincolati da accordi sul trattamento dei dati;",
    authorities: "le autorità pubbliche, solo nei casi previsti dalla legge.",
    notSold: "I tuoi dati non vengono mai venduti né utilizzati a fini pubblicitari.",
    provider: "{name} ({entity}): {service}, {region}.",
    providerNoRegion: "{name} ({entity}): {service}.",
    fullList: "L'elenco completo e aggiornato dei sub-responsabili è disponibile all'indirizzo {url}.",
  },
  transfers: {
    intro:
      "Alcuni fornitori appartengono a gruppi con sede negli Stati Uniti. Anche quando i loro server si trovano nell'UE, ciò può configurare un trasferimento al di fuori dello Spazio economico europeo. Tali trasferimenti si basano su:",
    item: "{name}: {tool}.",
    assessment:
      "Sorriso ha effettuato una valutazione di impatto di tali trasferimenti (transfer impact assessment). Puoi richiedere copia delle garanzie adottate scrivendo a {email}.",
    none: "I tuoi dati non sono trasferiti al di fuori dello Spazio economico europeo.",
  },
  retention: {
    intro: "Conserviamo i dati solo per il tempo necessario:",
    patientInactiveMonths:
      "la tua scheda presso lo studio: {period} dall'ultima visita, o più a lungo solo se lo studio è tenuto per legge a conservare la documentazione clinica;",
    neverSeenPatientMonths: "le schede di persone che non si sono mai presentate a una visita: {period};",
    patientNoteDays: "le note che aggiungi a una prenotazione: {period} dall'appuntamento;",
    messageBodyMonths: "il testo dei messaggi: {period}, dopodiché restano solo data, canale e stato di consegna;",
    messageMetaMonths: "i dati dei messaggi (data, canale, stato di consegna): {period};",
    reminderDays: "le programmazioni dei promemoria: {period} dall'invio;",
    providerMessageDays: "le copie conservate dal fornitore di SMS e WhatsApp: cancellate dopo {period};",
    waitlistDays: "le iscrizioni alla lista d'attesa: {period} dalla chiusura;",
    auditMonths: "il registro degli accessi: {period};",
    formSubmissionMonths: "i questionari anamnestici: {period}, e solo dopo il loro inserimento nella cartella clinica dello studio;",
    consentMonths: "la registrazione dei tuoi consensi e delle tue scelte: fino a {period}, per poterne fornire la prova;",
    privacyRequestMonths: "le richieste privacy e le relative risposte: {period} dalla chiusura;",
    marketingLapse: "il consenso a ricevere novità e offerte decade dopo 24 mesi senza contatti.",
    after:
      "Al termine di questi periodi i dati vengono cancellati o pseudonimizzati automaticamente. Le registrazioni pseudonimizzate degli appuntamenti non riportano più il tuo nome né i tuoi recapiti e sono conservate solo a fini statistici e per la documentazione dello studio.",
    platformBookings:
      "i dati delle prenotazioni effettuate sul marketplace: per il tempo in cui la prenotazione è gestita, e comunque non oltre il periodo in cui lo studio conserva la propria copia;",
    platformReviews: "le recensioni pubblicate: finché non le elimini o non vengono rimosse;",
    platformCodes: "i codici monouso: cancellati {period} dopo la scadenza; le sessioni del centro privacy terminano dopo 30 minuti;",
  },
  rights: {
    intro: "Hai il diritto di:",
    access: "accedere ai tuoi dati e riceverne copia (art. 15 GDPR);",
    rectification: "ottenere la rettifica dei dati inesatti e l'integrazione di quelli incompleti (art. 16);",
    erasure:
      "ottenere la cancellazione dei tuoi dati quando non sono più necessari o revochi il consenso, salvo quanto la legge ci impone di conservare (art. 17);",
    restriction: "ottenere la limitazione del trattamento, ad esempio durante la verifica di una rettifica (art. 18);",
    portability:
      "ricevere i dati che ci hai fornito in un formato strutturato, di uso comune e leggibile da dispositivo automatico, o ottenerne la trasmissione a un altro titolare (art. 20);",
    objection: "opporti al trattamento basato sul legittimo interesse, compresa la profilazione (art. 21);",
    withdraw: "revocare il consenso in qualsiasi momento, senza pregiudicare la liceità del trattamento basata sul consenso prestato prima della revoca (art. 7, par. 3);",
    automated: "non essere sottoposto a decisioni basate unicamente sul trattamento automatizzato (art. 22).",
    how: "Come: online nel centro privacy all'indirizzo {url}, a cui accedi con un codice monouso inviato al tuo telefono o alla tua email; dal link presente nei messaggi sui tuoi appuntamenti; oppure scrivendo a {email}.",
    howNoContact:
      "Come: online nel centro privacy all'indirizzo {url}, a cui accedi con un codice monouso inviato al tuo telefono o alla tua email, oppure dal link presente nei messaggi sui tuoi appuntamenti.",
    deadline:
      "Rispondiamo entro un mese. Per richieste complesse il termine può essere prorogato di ulteriori due mesi, e in tal caso ti informiamo dei motivi entro il primo mese (art. 12, par. 3, GDPR). L'esercizio dei diritti è gratuito.",
    recipientsInformed:
      "Quando rettifichiamo o cancelliamo i tuoi dati, o ne limitiamo il trattamento, lo comunichiamo anche ai destinatari a cui li abbiamo trasmessi (art. 19 GDPR).",
  },
  complaint: {
    body: "Se ritieni che i tuoi dati siano trattati in modo illecito, puoi proporre reclamo all'autorità italiana per la protezione dei dati, il Garante per la protezione dei dati personali (Piazza Venezia 11, 00187 Roma, www.garanteprivacy.it), oppure all'autorità del Paese dell'UE in cui risiedi o lavori (art. 77 GDPR). Puoi inoltre proporre ricorso all'autorità giudiziaria (art. 79 GDPR).",
  },
  mandatory: {
    practice:
      "Per prenotare devi indicare il tuo nome e un numero di cellulare o un indirizzo email: in mancanza, lo studio non può registrare la prenotazione né ricordarti l'appuntamento. La data di nascita è facoltativa, ma obbligatoria se prenoti per un minore. Ogni consenso è facoltativo: il rifiuto non ti impedisce mai di prenotare o di ricevere cure.",
    platform:
      "Il consenso alla prenotazione tramite Sorriso è necessario solo per prenotare dalle pagine di ricerca di Sorriso. Se preferisci non prestarlo, puoi prenotare direttamente presso lo studio, sul suo sito web o per telefono.",
  },
  automated: {
    none: "Nessuna decisione che ti riguarda è basata unicamente su un trattamento automatizzato (art. 22 GDPR).",
    profiling:
      "Questo studio utilizza i promemoria adattivi: lo storico dei tuoi appuntamenti viene utilizzato per decidere se inviarti un promemoria in più. Si tratta di profilazione, che aggiunge soltanto un aiuto e non limita mai la possibilità di prenotare. Puoi opporti in qualsiasi momento.",
    platform:
      "I risultati di ricerca sono ordinati secondo criteri pubblicati, e le recensioni sono verificate automaticamente prima della pubblicazione per individuare informazioni sulla salute; la decisione di rimuovere una recensione è sempre presa da una persona. Nessuna decisione che produca effetti giuridici o che incida in modo analogo significativamente sulla persona è basata unicamente su un trattamento automatizzato.",
  },
  minors: {
    body: "I minori di 14 anni sono prenotati da un genitore o dal tutore legale, che riceve i messaggi e presta gli eventuali consensi (art. 2-quinquies del Codice in materia di protezione dei dati personali). Dai 14 anni i ragazzi possono prenotare e fare queste scelte autonomamente. L'accesso del genitore o del tutore tramite il centro privacy cessa al compimento dei 18 anni del minore.",
    link: "Una versione della presente informativa scritta per i ragazzi è disponibile all'indirizzo {url}.",
  },
  marketplace: {
    body: "Se hai prenotato dalle pagine di ricerca di Sorriso, Sorriso è anche titolare autonomo del trattamento per quella prenotazione: la inoltra allo studio e gestisce promemoria e modifiche, con il tuo consenso esplicito (art. 9, par. 2, lett. a), GDPR). L'informativa di Sorriso spiega come: {url}.",
    withdraw:
      "Se revochi tale consenso, Sorriso interrompe il proprio trattamento, mentre lo studio conserva i dati necessari per curarti (art. 9, par. 2, lett. h), GDPR).",
  },
  withdrawal: {
    platform:
      "Se revochi il consenso alla prenotazione tramite Sorriso, Sorriso interrompe il proprio trattamento di quella prenotazione: non la conserva più nel tuo storico del marketplace e non invia più propri messaggi e inviti che la riguardano. Lo studio conserva, in qualità di titolare del trattamento, i dati necessari per curarti, ai sensi dell'art. 9, par. 2, lett. h), GDPR, con Sorriso come responsabile del trattamento. La revoca non pregiudica la liceità del trattamento svolto prima.",
  },
  roles: {
    intro: "Sorriso ricopre due ruoli:",
    controller:
      "titolare autonomo del trattamento per i propri servizi: le prenotazioni avviate dalle pagine di ricerca di Sorriso, l'elenco degli studi e dei professionisti, le recensioni pubblicate, l'ordine dei risultati di ricerca e il centro privacy. La presente informativa riguarda tali servizi;",
    processor:
      "responsabile del trattamento per gli studi (art. 28 GDPR) per tutto ciò che passa dai canali propri di uno studio: il suo sito web, il suo widget o i suoi link di prenotazione, il suo personale e il suo software. Per questi trattamenti il titolare è lo studio e si applica la sua informativa, che trovi nella pagina dello studio.",
  },
  changes: {
    body: "Aggiorniamo la presente informativa quando i nostri trattamenti cambiano e conserviamo tutte le versioni precedenti: puoi richiedere quella in vigore al momento della tua prenotazione. Questa è la versione {version}.",
  },
  cookiesLink: {
    body: "Sorriso utilizza solo cookie tecnici e nessun cookie di terze parti: consulta l'informativa sui cookie all'indirizzo {url}.",
  },
  summary: {
    practice:
      "{practice} utilizza i tuoi dati per prenotare e gestire i tuoi appuntamenti odontoiatrici, inviarti conferme e promemoria e tenere la tua scheda presso lo studio. Il trattamento è necessario per fornirti le cure che richiedi (art. 6, par. 1, lett. b), e art. 9, par. 2, lett. h), GDPR). Tutto ciò che è facoltativo, come gli inviti a lasciare un feedback o le novità, richiede un tuo consenso specifico, che puoi revocare in qualsiasi momento.",
    platform:
      "Sorriso ti aiuta a trovare uno studio dentistico e a prenotare presso di esso. Quando prenoti dalle pagine di ricerca di Sorriso, Sorriso inoltra la tua prenotazione allo studio con il tuo consenso. Quando prenoti tramite il sito web, il widget di prenotazione o il personale di uno studio, lo studio è responsabile dei tuoi dati e Sorriso gestisce soltanto il software per suo conto.",
    rights:
      "In qualsiasi momento puoi vedere, rettificare, scaricare o cancellare i tuoi dati, limitarne il trattamento o opporti, e revocare il consenso: online nel centro privacy con un codice monouso, oppure scrivendo a {email}. Puoi inoltre proporre reclamo al Garante per la protezione dei dati personali.",
    rightsNoContact:
      "In qualsiasi momento puoi vedere, rettificare, scaricare o cancellare i tuoi dati, limitarne il trattamento o opporti, e revocare il consenso, online nel centro privacy con un codice monouso. Puoi inoltre proporre reclamo al Garante per la protezione dei dati personali.",
  },
  minor: {
    summary: "Questa pagina spiega, in parole semplici, cosa fa {practice} con le informazioni che ti riguardano quando hai un appuntamento dal dentista.",
    who: "{controller} è responsabile delle tue informazioni. Se hai domande, tu o i tuoi genitori potete scrivere a {email}.",
    whoNoContact: "{controller} è responsabile delle tue informazioni. Se hai domande, tu o i tuoi genitori potete chiedere allo studio.",
    whatIntro: "Usiamo:",
    whatName: "il tuo nome e la tua data di nascita;",
    whatAppointments: "i tuoi appuntamenti: quando sono e a cosa servono;",
    whatContact: "il numero di telefono o l'email a cui mandiamo i promemoria: i tuoi, oppure quelli di un tuo genitore o del tuo tutore;",
    whatMessages: "i messaggi che mandiamo e le risposte che riceviamo.",
    why: "Per prenotare le tue visite, ricordartele e prenderci cura dei tuoi denti in sicurezza. Non le usiamo mai per la pubblicità e non le vendiamo mai.",
    parents:
      "Se hai meno di 14 anni, un tuo genitore o il tuo tutore prenota per te, riceve i promemoria e decide su tutto ciò che è facoltativo. Dai 14 anni puoi prenotare e decidere da solo. Quando compi 18 anni, i tuoi genitori non possono più vedere i tuoi dati tramite il centro privacy.",
    keep: "Solo per il tempo necessario per curarti e per il tempo in cui la legge obbliga lo studio a conservarle. Dopo vengono cancellate.",
    youCan:
      "Puoi chiedere di vedere le tue informazioni, di correggerle se qualcosa è sbagliato o di cancellarle quando non servono più. Puoi farlo nel centro privacy all'indirizzo {url}, oppure chiedere aiuto a un tuo genitore o al tuo tutore.",
    help: "Se pensi che le tue informazioni non siano trattate correttamente, tu o i tuoi genitori potete fare un reclamo all'autorità italiana per la protezione dei dati (Garante per la protezione dei dati personali, www.garanteprivacy.it).",
    full: "Questa è una versione semplificata. L'informativa completa è disponibile all'indirizzo {url}.",
  },
  staff: {
    summary:
      "La presente informativa è rivolta alle persone che utilizzano il pannello di Sorriso in uno studio dentistico: titolari, amministratori, segreteria e professionisti. Spiega quali dati che ti riguardano vengono trattati e come funziona il registro degli accessi.",
    controllers:
      "Sorriso è titolare del trattamento del tuo account utente (autenticazione, verifica in due passaggi, sessioni). Lo studio per cui lavori è titolare del trattamento del registro degli accessi e di tutto ciò che fai nella sua agenda; Sorriso ne è responsabile del trattamento.",
    dataIntro: "Trattiamo:",
    dataAccount: "il tuo nome, l'indirizzo email, il ruolo e la lingua preferita;",
    dataSecurity:
      "la tua password (conservata solo come hash), il segreto per la verifica in due passaggi (cifrato) e i codici di recupero (conservati come hash);",
    dataSessions: "le tue sessioni e i tentativi di accesso, con hash con chiave dell'indirizzo IP e del browser;",
    dataLog: "il registro degli accessi: quali schede dei pazienti apri o modifichi, quando e con quale operazione;",
    dataLegal: "la tua accettazione delle istruzioni per il personale e di altri documenti legali.",
    monitoring:
      "Il registro degli accessi è una misura di sicurezza richiesta per i dati relativi alla salute (art. 32 GDPR). Registra data e ora, il tuo utente, la scheda e l'operazione, mai il contenuto consultato. Lo studio può esaminarlo per verificare che le schede siano aperte solo per finalità di cura e amministrative e per accertare eventuali abusi. Poiché ne sei informato con la presente informativa e con le istruzioni per il personale, le informazioni del registro possono essere utilizzate a tutti i fini connessi al rapporto di lavoro, nei limiti dell'art. 4, comma 3, della Legge 20 maggio 1970, n. 300 (Statuto dei lavoratori) e della normativa in materia di protezione dei dati.",
    retentionSessions: "le sessioni: fino alla loro scadenza; i tentativi di accesso: {period};",
    retentionLog: "il registro degli accessi: per il periodo stabilito dallo studio, non inferiore a {period};",
    retentionLegal: "le accettazioni dei documenti legali: 10 anni, pari al termine di prescrizione, per poterne fornire la prova;",
    retentionAccount: "il tuo account: fino alla sua chiusura o alla cessazione del tuo rapporto con lo studio.",
    rights:
      "Hai i diritti di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione (artt. 15-21 GDPR). Per il tuo account scrivi a Sorriso all'indirizzo {email}; per il registro degli accessi, allo studio per cui lavori.",
    rightsNoContact:
      "Hai i diritti di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione (artt. 15-21 GDPR). Per il tuo account scrivi a Sorriso; per il registro degli accessi, allo studio per cui lavori.",
  },
  practitioner: {
    summary:
      "La presente informativa è rivolta ai dentisti e agli altri professionisti presenti nell'elenco di Sorriso. Spiega come Sorriso tratta i tuoi dati professionali, le verifiche sulla tua iscrizione all'albo e le recensioni che i pazienti scrivono su di te.",
    controllers:
      "Sorriso è titolare del trattamento dell'elenco, del tuo profilo pubblico, delle recensioni e dell'ordine dei risultati di ricerca. Lo studio con cui collabori è titolare del trattamento della tua agenda e dei dati dei suoi pazienti; per tali dati Sorriso ne è responsabile del trattamento.",
    dataIntro: "Trattiamo:",
    dataProfile:
      "il tuo nome, il titolo, la specializzazione, la biografia, le lingue parlate, lo studio e le sedi in cui lavori e la tua disponibilità;",
    dataAlbo:
      "la tua iscrizione all'albo professionale (Albo degli Odontoiatri o dei Medici Chirurghi), la provincia e il numero, nonché le specializzazioni riconosciute ivi indicate;",
    dataReviews: "le valutazioni e le recensioni che i pazienti scrivono sulle visite con te, le tue risposte ed eventuali segnalazioni;",
    dataMetrics:
      "le metriche utilizzate per ordinare i risultati di ricerca: annullamenti da parte dello studio, completezza del profilo e visualizzazioni del tuo profilo.",
    profile:
      "Il tuo profilo diventa pubblico solo dopo che tu o lo studio lo avete approvato, e puoi rimuoverti dal marketplace in qualsiasi momento. Le specializzazioni legalmente riconosciute sono mostrate solo dopo che Sorriso le ha verificate sull'albo pubblico.",
    reviews:
      "Solo i pazienti con una visita verificata possono recensirti. Puoi rispondere e segnalare una recensione; ogni decisione su una segnalazione è motivata e può essere impugnata una volta.",
    retentionProfile: "il tuo profilo: finché tu o lo studio non lo rimuovete dall'elenco;",
    retentionReviews: "le recensioni: finché l'autore non le elimina o non vengono rimosse;",
    retentionMetrics: "le metriche di posizionamento: calcolate sugli ultimi 180 giorni.",
    rights:
      "Hai i diritti di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione (artt. 15-21 GDPR), compreso il diritto di opporti al posizionamento. Scrivi a Sorriso all'indirizzo {email}.",
    rightsNoContact:
      "Hai i diritti di accesso, rettifica, cancellazione, limitazione, portabilità e opposizione (artt. 15-21 GDPR), compreso il diritto di opporti al posizionamento. Scrivi a Sorriso.",
  },
  cookies: {
    summary:
      "Sorriso non utilizza cookie pubblicitari o di tracciamento, e durante la navigazione le pagine non caricano nulla dai server di altre società. Utilizziamo solo i pochi cookie tecnici necessari al funzionamento del sito. Per questi non è richiesto il tuo consenso, e per questo motivo non è presente un banner dei cookie.",
    item: "{name}: {purpose} Durata: {duration}.",
    staffSession: {
      name: "Sessione del personale ({names})",
      purpose: "mantiene il personale dello studio autenticato nel pannello. Viene impostato solo all'accesso del personale.",
      duration: "fino alla disconnessione, al massimo 24 ore, e 30 minuti di inattività",
    },
    locale: {
      name: "Lingua ({names})",
      purpose: "ricorda la lingua che hai scelto con il selettore della lingua. Viene impostato solo quando scegli una lingua.",
      duration: "1 anno",
    },
    privacyCenter: {
      name: "Centro privacy ({names})",
      purpose: "mantiene attivo il tuo accesso al centro privacy dopo l'inserimento di un codice monouso.",
      duration: "30 minuti",
    },
    storageIntro:
      "Oltre a questi cookie, Sorriso memorizza nel tuo browser solo quanto segue. Non lascia mai il tuo dispositivo e viene impostato solo quando utilizzi la relativa funzione:",
    storageItem: "{key}: {purpose}",
    storageItems: {
      dashboardPrivacyScreen:
        "ricorda, su quel dispositivo, se il personale dello studio ha attivato lo schermo privacy del pannello, che sfoca i nomi dei pazienti nell'agenda affinché chi si trova in segreteria non possa leggerli. Conservato finché non viene disattivato.",
    },
    thirdPartiesIntro:
      "Le pagine non caricano script, caratteri, immagini o frame di altre società. Le uniche due eccezioni si verificano solo su tua richiesta:",
    map: "la mappa nella pagina di uno studio compare solo dopo che hai fatto clic per visualizzarla. Il tuo browser la carica allora da OpenStreetMap (OpenStreetMap Foundation), che riceve il tuo indirizzo IP secondo la propria informativa privacy: https://osmfoundation.org/wiki/Privacy_Policy;",
    links: "i link, ad esempio quelli per le indicazioni stradali, aprono altri siti web in una nuova scheda, ad esempio Google Maps: tali siti applicano le proprie informative.",
    legalBasis:
      "I cookie tecnici sono ammessi senza consenso ai sensi dell'art. 122 del Codice in materia di protezione dei dati personali e delle Linee guida del Garante sui cookie e altri strumenti di tracciamento del 10 giugno 2021. La presente informativa ti informa del loro utilizzo.",
    control:
      "Puoi cancellare i cookie in qualsiasi momento dalle impostazioni del tuo browser. Senza i cookie tecnici, l'accesso e la memorizzazione della lingua non funzioneranno.",
    widget:
      "Il widget di prenotazione mostrato sul sito web di uno studio non imposta cookie propri. Il sito web dello studio può utilizzare altri cookie: consulta la sua informativa sui cookie.",
  },
} satisfies DeepPartial<Messages["legalPatient"]>;
