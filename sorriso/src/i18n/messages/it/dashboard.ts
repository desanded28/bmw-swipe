import { p } from "../../plural";
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    title: "Pannello",
    template: "{page} · {app}",
  },
  skipToContent: "Vai al contenuto principale",

  nav: {
    label: "Pannello",
    overview: "Panoramica",
    calendar: "Agenda",
    confirmations: "Conferme",
    messages: "Messaggi",
    patients: "Pazienti",
    duplicates: "Possibili duplicati",
    waitlist: "Lista d'attesa",
    recalls: "Richiami",
    reviews: "Recensioni",
    analytics: "Statistiche",
    team: "Team e orari",
    services: "Prestazioni",
    locations: "Sedi e poltrone",
    reminders: "Promemoria",
    settings: "Impostazioni",
    funds: "Fondi sanitari",
    api: "API",
    privacyRequests: "Richieste privacy",
    privacySettings: "Impostazioni privacy",
    audit: "Registro attività",
    security: "La mia sicurezza",
    platform: "Piattaforma",
    platformPrivacy: "Richieste privacy della piattaforma",
    groups: {
      setup: "Configurazione",
      privacy: "Privacy",
      account: "Account",
    },
    count: p({ one: "{count} da gestire", other: "{count} da gestire" }),
  },

  sidebar: {
    home: "Panoramica del pannello",
    publicPage: "Pagina pubblica",
    publicPageNewTab: "La tua pagina pubblica (si apre in una nuova scheda)",
    switchPractice: "Cambia studio",
    logout: "Esci",
    language: "Lingua del pannello",
    languageAuto: "Automatica ({language})",
  },

  language: {
    saved: "Lingua salvata.",
    invalid: "Scegli una delle lingue elencate.",
  },

  toast: {
    region: "Notifiche",
    dismiss: "Chiudi",
  },

  form: {
    saved: "Salvato.",
  },

  notFound: {
    title: "Pagina non trovata",
    body: "Questa pagina del pannello non esiste o è stata spostata.",
    back: "Torna alla panoramica",
  },

  denied: "Non hai l'autorizzazione per aprire quella pagina. Se ti serve, chiedi a un titolare o a un amministratore dello studio.",

  overview: {
    title: "Panoramica",
    greeting: {
      morning: "Buongiorno, {name}",
      afternoon: "Buon pomeriggio, {name}",
      evening: "Buonasera, {name}",
    },
    subtitle: "{date} · {practice}",
    openCalendar: "Apri l'agenda",
    welcome: {
      title: "Benvenuto! Quattro passaggi per essere operativi",
      team: "Aggiungi dentisti e igienisti, con i loro orari in ogni sede",
      services: "Imposta prestazioni, durate e prezzi",
      reminders: "Scegli quando inviare i promemoria (SMS, WhatsApp, email)",
      widget: "Integra il widget di prenotazione nel tuo sito",
    },
    stats: {
      today: "Oggi",
      todayHint: p({ one: "{count} confermato o effettuato", other: "{count} confermati o effettuati" }),
      tomorrow: "Confermati per domani",
      tomorrowHint: "{confirmed} su {total} · {open} da sollecitare",
      noShow: "Tasso di mancate presentazioni (30 giorni)",
      noShowHint: "Mancate presentazioni: {noShows} · visite: {visits}",
      online: "Prenotazioni online (7 giorni)",
      onlineHint: "Recuperati dalla lista d'attesa (30 giorni): {refilled} · in attesa: {waiting}",
      none: "–",
    },
    demo: {
      all: "Modalità demo: email, SMS e messaggi WhatsApp vengono raccolti nella pagina Messaggi invece di essere consegnati.",
      email: "Modalità demo: le email vengono raccolte nella pagina Messaggi invece di essere consegnate.",
      text: "Modalità demo: SMS e messaggi WhatsApp vengono raccolti nella pagina Messaggi invece di essere consegnati.",
      connect: "Collega i fornitori",
    },
    attention: "Richiede la tua attenzione",
    attentionCount: p({ one: "{count} appuntamento", other: "{count} appuntamenti" }),
    agenda: "Appuntamenti di oggi",
    noneToday: "Nessun appuntamento oggi.",
    tomorrowLink: "Conferme di domani",
  },

  confirmations: {
    title: "Conferme",
    tabs: {
      label: "Quali appuntamenti",
      tomorrow: "Domani",
      week: "Prossimi 7 giorni",
      requests: "Richieste online",
      outcome: "Registra l'esito",
      cancelled: "Annullati di recente",
    },
    descriptions: {
      tomorrow: "Chi viene domani. Sollecita chi non ha ancora confermato: i pazienti con mancate presentazioni passate sono segnalati.",
      week: "Tutto ciò che è prenotato per la settimana prossima.",
      requests: "Prenotazioni online in attesa della tua approvazione (quando lo studio verifica le prenotazioni online).",
      outcome: "Visite passate senza esito. Contrassegnale come effettuate (viene inviata la richiesta di recensione) o come mancate presentazioni.",
      cancelled: "Orari futuri liberati da disdette. Sono stati offerti automaticamente ai pazienti compatibili in lista d'attesa.",
    },
    onlyPending: "Solo in attesa di conferma ({count})",
    riskSorted: "Per ogni giorno, le visite non confermate con un rischio più alto di mancata presentazione sono elencate per prime.",
    empty: "Niente da mostrare qui.",
  },

  waitlist: {
    title: "Lista d'attesa",
    description:
      "Quando un appuntamento viene disdetto o spostato, l'orario viene offerto fino a 3 pazienti compatibili via SMS, WhatsApp o email. Lo ottiene il primo che prenota.",
    emptyTitle: "Nessuno in attesa",
    emptyBody: "I pazienti possono iscriversi dalla pagina di prenotazione quando nessun orario va loro bene.",
    waiting: "In attesa",
    anyPractitioner: "Qualsiasi professionista",
    anyOffice: "Qualsiasi sede",
    preference: "{practitioner} · {office}",
    window: "{from} – {to}",
    partOfDay: {
      any: "Qualsiasi orario",
      morning: "Mattina",
      afternoon: "Pomeriggio",
    },
    offers: p({ one: "{count} offerta inviata", other: "{count} offerte inviate" }),
    remove: "Rimuovi",
    removeConfirm: "Rimuovere questo paziente dalla lista d'attesa?",
    note: "Nota del paziente: {note}",
    restricted: "Scheda con accesso limitato: recapiti e nota sono nascosti.",
    openRecord: "Apri la scheda del paziente (serve una motivazione)",
    booked: "Prenotati di recente dalla lista d'attesa",
    bookedBadge: "Prenotato",
  },
} satisfies DeepPartial<Messages["dashboard"]>;
