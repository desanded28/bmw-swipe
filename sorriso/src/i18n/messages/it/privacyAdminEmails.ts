/**
 * Comunicazioni agli interessati (artt. 12 e 18, par. 3, GDPR) e ai titolari degli studi.
 * SMS: solo apostrofi dritti, niente puntini di sospensione (GSM-7). Testi giuridici: revisione
 * legale in sospeso (docs/i18n/glossary-it.md).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  types: {
    access: "accesso ai tuoi dati",
    rectification: "rettifica dei tuoi dati",
    erasure: "cancellazione dei tuoi dati",
    restriction: "limitazione del trattamento dei tuoi dati",
    portability: "copia dei tuoi dati da trasferire altrove",
    objection: "opposizione al trattamento dei tuoi dati",
    consent_withdrawal: "revoca del tuo consenso",
  },

  requestExtended: {
    subject: "La tua richiesta privacy: ci serve più tempo",
    body: "Abbiamo ricevuto il {received} la tua richiesta di {type}. Per risponderti in modo completo ci serve più tempo, per il seguente motivo: {reason}. Riceverai la nostra risposta entro il {until}. Il GDPR (art. 12, par. 3) consente questa proroga fino a ulteriori due mesi.",
    sms: "{practice}: ci serve più tempo per la tua richiesta privacy del {received}. Motivo: {reason}. Risposta entro il {until}.",
  },
  requestGranted: {
    subject: "La tua richiesta privacy è stata evasa",
    body: "Abbiamo dato seguito alla tua richiesta di {type}, ricevuta il {received}. La nostra risposta: {reason}",
    sms: "{practice}: la tua richiesta privacy del {received} è stata evasa. {reason}",
  },
  requestPartiallyGranted: {
    subject: "La nostra risposta alla tua richiesta privacy",
    body: "Abbiamo accolto in parte la tua richiesta di {type}, ricevuta il {received}. La nostra risposta e le motivazioni: {reason}. Se non sei d'accordo, puoi proporre reclamo all'autorità italiana per la protezione dei dati (Garante per la protezione dei dati personali, www.garanteprivacy.it) o rivolgerti all'autorità giudiziaria.",
    sms: "{practice}: la tua richiesta privacy del {received} è stata accolta in parte. Motivi: {reason}. Puoi fare reclamo al Garante (garanteprivacy.it) o rivolgerti al giudice.",
  },
  requestRefused: {
    subject: "La nostra risposta alla tua richiesta privacy",
    body: "Non possiamo accogliere la tua richiesta di {type}, ricevuta il {received}, per i seguenti motivi: {reason}. Se non sei d'accordo, puoi proporre reclamo all'autorità italiana per la protezione dei dati (Garante per la protezione dei dati personali, www.garanteprivacy.it) o rivolgerti all'autorità giudiziaria.",
    sms: "{practice}: non possiamo accogliere la tua richiesta privacy del {received}. Motivi: {reason}. Puoi fare reclamo al Garante (garanteprivacy.it) o rivolgerti al giudice.",
  },
  restrictionLifted: {
    subject: "La limitazione del trattamento dei tuoi dati viene revocata",
    body: "Il {since} il trattamento dei tuoi dati presso {practice} è stato limitato. Questa limitazione viene ora revocata, quindi lo studio potrà di nuovo utilizzare i tuoi dati, ad esempio per inviarti i promemoria degli appuntamenti. Se hai domande o ritieni che la limitazione debba proseguire, contatta lo studio.",
    sms: "{practice}: la limitazione del trattamento dei tuoi dati, in vigore dal {since}, viene revocata. Contattaci per qualsiasi domanda.",
  },

  ownerDeadline7: {
    subject: "Richiesta privacy in scadenza tra 7 giorni",
    body: "Una richiesta di {type} ricevuta da {practice} il {received} deve ricevere risposta entro il {due}. Aprila nel pannello per evaderla, oppure per prorogare la scadenza indicandone il motivo, se ti serve davvero più tempo.",
    cta: "Apri la richiesta",
  },
  ownerDeadline2: {
    subject: "Richiesta privacy in scadenza tra 2 giorni",
    body: "Una richiesta di {type} ricevuta da {practice} il {received} deve ricevere risposta entro il {due}. Rispondere in ritardo viola l'art. 12, par. 3, GDPR: evadila subito.",
    cta: "Apri la richiesta",
  },

  subprocessorsChanged: {
    subject: "L'elenco dei sub-responsabili di Sorriso è cambiato",
    body: "Sorriso ha aggiornato l'elenco dei sub-responsabili che trattano i dati di {practice} (versione {version}, in vigore dal {effective}). Prendine visione e accettalo nel pannello. Se ti opponi a una modifica, scrivi a {email} entro 30 giorni: cercheremo una soluzione con te e, se non ve ne sono, potrai recedere dal contratto senza penali.",
    cta: "Esamina l'elenco",
  },

  closureRequested: {
    subject: "Il tuo account Sorriso è in fase di chiusura",
    body: "Il {date} abbiamo ricevuto la richiesta di chiusura dell'account di {practice}. La prenotazione online è stata interrotta e lo studio non compare più nella ricerca. Puoi scaricare tutti i tuoi dati fino al {purge}; in quella data saranno cancellati definitivamente. Fino ad allora puoi annullare la chiusura dal pannello.",
    cta: "Scarica i tuoi dati",
  },
  closureCancelled: {
    subject: "Chiusura dell'account annullata",
    body: "La chiusura dell'account di {practice} è stata annullata e nessun dato sarà cancellato. La prenotazione online tramite la tua pagina di prenotazione, il widget e i tuoi link funziona di nuovo. Lo studio resta nascosto dalla ricerca di Sorriso finché non lo pubblichi di nuovo in Impostazioni.",
  },
  closureCertificate: {
    subject: "Certificato di cancellazione: {practice}",
    body: "Il {date} abbiamo cancellato definitivamente i dati di {practice} dai sistemi di Sorriso, come previsto dall'accordo sul trattamento dei dati. Le copie di backup cifrate che ancora li contengono scadono il {backups} e vengono poi sovrascritte. Il certificato elenca cosa è stato cancellato.",
    cta: "Visualizza il certificato",
  },

  footer: {
    rights: "Ricevi questo messaggio perché hai esercitato i tuoi diritti in materia di protezione dei dati.",
    staff: "Ricevi questo messaggio in qualità di titolare di uno studio che utilizza Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyAdminEmails"]>;
