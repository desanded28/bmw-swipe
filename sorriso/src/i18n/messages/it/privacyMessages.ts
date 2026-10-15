/**
 * SMS: solo apostrofi dritti, niente puntini di sospensione, frasi brevi (GSM-7). Discreti: nessuna
 * prestazione, professionista o informazione sulla salute.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  requestReceipt: {
    subject: "Abbiamo ricevuto la tua richiesta privacy",
    body: "{controller} ha ricevuto la tua richiesta ({type}) il {date}. Riceverai una risposta entro il {due}. Se per una richiesta complessa servirà più tempo, te ne verrà comunicato il motivo prima di quella data.",
    sms: "{controller} ha ricevuto la tua richiesta privacy ({type}). Risposta entro il {due}.",
  },
  contactChangedPhone: {
    sms: "Il numero di cellulare della tua scheda presso {practice} è stato modificato dal centro privacy Sorriso. Non sei stato tu? Contatta lo studio.",
  },
  contactChangedEmail: {
    subject: "I tuoi recapiti sono stati modificati",
    body: "L'indirizzo email della tua scheda presso {practice} è stato modificato dal centro privacy di Sorriso il {date}. Se non sei stato tu, contatta subito lo studio.",
  },
  bookedForYou: {
    subject: "È stato prenotato un appuntamento per te presso {practice}",
    body: "{booker} ha prenotato per te un appuntamento presso {practice} per {when}. Lo studio utilizza i tuoi dati per gestirlo. Qui trovi come vengono trattati i tuoi dati e quali sono i tuoi diritti, compreso come visualizzarli, rettificarli o cancellarli.",
    cta: "Leggi l'informativa privacy",
    sms: "{booker} ha prenotato per te un appuntamento presso {practice} per {when}. Informativa privacy: {url}",
  },
  confirmBooking: {
    subject: "Conferma l'appuntamento prenotato per te",
    body: "{booker} ha prenotato per te un appuntamento presso {practice} per {when} tramite Sorriso. Solo tu puoi confermarlo e acconsentire al modo in cui Sorriso tratta la prenotazione. Se non lo confermi entro {hours} ore, verrà annullato.",
    cta: "Conferma o rifiuta",
    sms: "{booker} ha prenotato per te un appuntamento presso {practice} tramite Sorriso. Conferma entro {hours} ore: {url}",
  },
  adultNotConfirmed: {
    subject: "L'appuntamento che hai prenotato è stato annullato",
    body: "L'appuntamento che hai prenotato per {name} presso {practice} per {when} è stato annullato perché {name} non l'ha confermato in tempo. Solo il paziente può confermare una prenotazione fatta per lui su Sorriso: può prenotare di nuovo personalmente.",
    sms: "L'appuntamento che hai prenotato per {name} presso {practice} per {when} è stato annullato: {name} non l'ha confermato in tempo.",
  },
  requestTypes: {
    access: "accesso ai tuoi dati",
    rectification: "rettifica dei tuoi dati",
    erasure: "cancellazione dei tuoi dati",
    restriction: "limitazione del trattamento",
    portability: "copia dei tuoi dati da trasferire altrove",
    objection: "opposizione al trattamento",
    consent_withdrawal: "revoca del consenso",
  },
  footer: {
    privacyCenter: "Ricevi questo messaggio a seguito di una richiesta effettuata nel centro privacy di Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyMessages"]>;
