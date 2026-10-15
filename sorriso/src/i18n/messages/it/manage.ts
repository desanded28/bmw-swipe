import { p } from "../../plural";
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    title: "Il tuo appuntamento",
    description: "Visualizza, conferma, sposta o disdici il tuo appuntamento.",
  },
  greeting: "Ciao {name},",
  title: "Il tuo appuntamento presso {clinic}",
  status: {
    cancelled: "Annullato",
    requested: "In attesa della conferma dello studio",
    completed: "Effettuato",
    no_show: "Mancato",
    confirmed: "Prenotato e confermato",
    pending: "Prenotato: conferma la tua presenza",
  },
  details: {
    when: "Quando",
    timeRange: "{start}–{end}",
    treatment: "Prestazione",
    where: "Dove",
    address: "{address}, {city}",
    phone: "Telefono",
  },
  confirm: {
    title: "Ci sarai?",
    body: "Confermare aiuta {clinic} a organizzare la giornata e ti garantisce l'orario.",
    button: "Sì, ci sarò",
    done: "Grazie! La tua presenza è confermata.",
  },
  reschedule: {
    button: "Sposta",
    title: "Scegli un nuovo orario con {practitioner}",
    moveTo: "Vuoi spostare il tuo appuntamento a {when}?",
    moveToOffice: "Vuoi spostare il tuo appuntamento a {when} presso {office}?",
    confirm: "Conferma il nuovo orario",
    done: "Fatto: il tuo appuntamento è stato spostato.",
    closed: p({
      one: "Non è più possibile spostare online l'appuntamento a meno di {count} ora dalla visita.",
      other: "Non è più possibile spostare online l'appuntamento a meno di {count} ore dalla visita.",
    }),
    call: "Per spostarlo, chiama il numero <tel>{phone}</tel>.",
  },
  cancel: {
    button: "Disdici appuntamento",
    title: "Vuoi disdire questo appuntamento?",
    late: p({
      one: "Manca meno di {count} ora alla visita. Disdire libera comunque l'orario per chi è in lista d'attesa: grazie di avercelo fatto sapere.",
      other: "Mancano meno di {count} ore alla visita. Disdire libera comunque l'orario per chi è in lista d'attesa: grazie di avercelo fatto sapere.",
    }),
    body: "Il tuo orario sarà offerto ai pazienti in lista d'attesa.",
    reason: "Motivo",
    reasonHint: "Facoltativo. Visibile solo allo studio. Non inserire informazioni sulla tua salute.",
    confirm: "Sì, disdici",
    keep: "No, mantienilo",
    done: "Il tuo appuntamento è stato disdetto.",
  },
  calendar: {
    appleOutlook: "Apple / Outlook",
    google: "Calendario Google",
  },
  review: {
    title: "Com'è andata la visita?",
    button: "Lascia una recensione",
  },
  rebook: "Prenota un altro appuntamento",
  privateLink: "Non condividere questo link: chiunque lo abbia può gestire questo appuntamento.",
  clinicPage: "Pagina di {clinic}",
  invalid: {
    title: "Questo link non funziona",
    body: "Potrebbe essere incompleto o contenere un errore. Verifica di aver aperto il link completo dal tuo messaggio, oppure contatta il tuo studio.",
  },
  expired: {
    title: "Questo link è scaduto",
    body: "Per la tua privacy, i link agli appuntamenti smettono di funzionare qualche tempo dopo la visita. Per prenotare di nuovo o per informazioni su una visita passata, contatta direttamente il tuo studio.",
    privacyCenter: "Per vedere i dati che gli studi conservano su di te, usa il centro privacy.",
  },
  rateLimited: {
    title: "Troppe richieste",
    body: p({
      one: "Questa pagina è stata aperta troppe volte in poco tempo. Riprova tra {count} minuto.",
      other: "Questa pagina è stata aperta troppe volte in poco tempo. Riprova tra {count} minuti.",
    }),
  },
  preview: {
    title: "Il tuo appuntamento",
    body: "Apri questo link nel browser per vedere e gestire il tuo appuntamento.",
  },
  home: "Vai alla pagina iniziale",
} satisfies DeepPartial<Messages["manage"]>;
