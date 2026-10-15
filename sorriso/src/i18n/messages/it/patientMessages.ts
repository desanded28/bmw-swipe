/**
 * Italian patient messages. Owned by WP3 (the only non-English dictionary a package owns): Italian
 * patients are the majority, so these keep the wording they received before the i18n move, made
 * discreet where it named the treatment. Rules: see messages/en/patientMessages.ts.
 * SMS: straight quotes only; "è", "à", "ì", "ò", "ù" and "é" are GSM-7, "È" is not.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  format: {
    slot: "{day}/{month} {time}",
  },

  email: {
    greeting: "Ciao {name},",
    when: "Quando",
    where: "Dove",
    service: "Prestazione",
    with: "Con",
    patient: "Paziente",
    manage: "Gestisci appuntamento",
    confirm: "Confermo la presenza",
    cancel: "Disdici",
    reschedule: "Sposta",
    calendar: "Aggiungi al calendario",
    detailsOnline: "Trovi tutti i dettagli della visita nella pagina del tuo appuntamento.",
  },

  privacyFooter: {
    sender: "{name} · {address}",
    phone: "Tel. {phone}",
    why: "Hai ricevuto questa email perché hai un appuntamento presso {clinic}.",
    whyGuardian: "Hai ricevuto questa email perché sei il contatto per gli appuntamenti di {patient} presso {clinic}.",
    whyWaitlist: "Hai ricevuto questa email perché sei in lista d'attesa presso {clinic}.",
    whyGeneric: "Hai ricevuto questa email perché sei paziente di {clinic}.",
    object:
      "Puoi opporti ai promemoria o revocare un consenso in qualsiasi momento dalle tue scelte sulla privacy, oppure rispondendo STOP ai nostri SMS.",
    notice: "Informativa privacy",
    preferences: "Le tue scelte sulla privacy",
  },

  booked: {
    subject: "Appuntamento prenotato - {clinic} - {date}",
    subjectDetailed: "Appuntamento prenotato: {service}, {date}",
    body: "il tuo appuntamento è prenotato. Ti invieremo un promemoria prima della visita.",
    sms: "{clinic}: appuntamento prenotato per {when}. Gestisci: {url} Informativa privacy: {privacy} STOP per non ricevere SMS",
    smsShort: "{clinic}: prenotato per {slot}. Gestisci: {url}",
    smsDetailed: "{clinic}: appuntamento prenotato, {service} con {practitioner} {when}. Gestisci: {url} STOP per non ricevere SMS",
  },

  requested: {
    subject: "Richiesta ricevuta - {clinic} - {date}",
    subjectDetailed: "Richiesta ricevuta: {service}",
    body: "abbiamo ricevuto la tua richiesta. Lo studio la confermerà a breve e riceverai un'email.",
  },

  approved: {
    subject: "Appuntamento confermato dallo studio - {clinic} - {date}",
    subjectDetailed: "Appuntamento confermato dallo studio: {service}, {date}",
    body: "lo studio ha confermato la tua richiesta. Ecco i dettagli del tuo appuntamento.",
    sms: "{clinic}: lo studio ha confermato il tuo appuntamento per {when}. Gestisci: {url} Informativa privacy: {privacy} STOP per non ricevere SMS",
    smsShort: "{clinic}: confermato per {slot}. Gestisci: {url}",
  },

  reminder: {
    subject: "Promemoria appuntamento - {clinic} - {date}",
    subjectDetailed: "Promemoria appuntamento: {service}, {date}",
    body: "ti ricordiamo il tuo prossimo appuntamento.",
    bodyAsk: "ti ricordiamo il tuo prossimo appuntamento. Puoi confermare la tua presenza con un clic?",
    sms: "{clinic}: promemoria appuntamento {when}, {address}. Dettagli: {url} STOP per non ricevere SMS",
    smsAsk:
      "{clinic}: promemoria appuntamento {when}, {address}. Rispondi SI per confermare, NO per disdire. Dettagli: {url} STOP per non ricevere SMS",
    smsShort: "{clinic}: appuntamento {slot}. Dettagli: {url}",
    smsAskShort: "{clinic}: appuntamento {slot}. SI conferma, NO disdice. {url}",
    smsDetailed: "{clinic}: ciao {name}, promemoria {service} con {practitioner} {when}, {address}. Dettagli: {url}",
    smsAskDetailed:
      "{clinic}: ciao {name}, promemoria {service} con {practitioner} {when}, {address}. Rispondi SI per confermare, NO per disdire. Dettagli: {url}",
  },

  cancelled: {
    subject: "Appuntamento annullato - {clinic} - {date}",
    body: "il tuo appuntamento è stato annullato come richiesto.",
    bodyByPractice: "purtroppo lo studio ha dovuto annullare il tuo appuntamento. Puoi prenotare un nuovo orario quando vuoi.",
    sms: "{clinic}: il tuo appuntamento di {when} è stato annullato. Prenota di nuovo: {url}",
    smsShort: "{clinic}: appuntamento {slot} annullato. {url}",
    rebook: "Prenota di nuovo",
  },

  rescheduled: {
    subject: "Appuntamento spostato - {clinic} - {date}",
    subjectDetailed: "Appuntamento spostato: {service}, {date}",
    body: "il tuo appuntamento è stato spostato. Ecco il nuovo orario.",
    sms: "{clinic}: il tuo appuntamento è stato spostato a {when}, {address}. Dettagli: {url}",
    smsShort: "{clinic}: appuntamento spostato a {slot}. {url}",
  },

  waitlist: {
    subject: "Si è liberato un posto - {clinic} - {date}",
    body: "si è liberato un posto per {when}. È di chi prenota per primo: se ti interessa, prenotalo ora.",
    sms: "{clinic}: si è liberato un posto per {when}. Primo che prenota: {url}",
    smsShort: "{clinic}: posto libero {slot}: {url}",
    cta: "Prenota questo orario",
  },

  review: {
    subject: "Com'è andata da {clinic}?",
    body: "grazie per la visita. La tua recensione verificata aiuta altri pazienti a scegliere. Ci vuole un minuto.",
    bodyDetailed: "grazie per la visita con {practitioner}. La tua recensione verificata aiuta altri pazienti a scegliere. Ci vuole un minuto.",
    cta: "Lascia una recensione",
  },

  replies: {
    confirmed: "{clinic}: grazie! Presenza confermata per {when}. A presto!",
    confirmedShort: "{clinic}: grazie, confermato per {slot}.",
    cancelled: "{clinic}: appuntamento di {when} annullato. Per prenotare un nuovo orario: {url}",
    cancelledShort: "{clinic}: appuntamento {slot} annullato. Prenota di nuovo: {url}",
    reschedule: "{clinic}: scegli un nuovo orario qui: {url}",
    unknown: "{clinic}: non abbiamo capito la risposta. Rispondi SI per confermare o NO per disdire, oppure: {url}",
    none: "{clinic}: non abbiamo trovato appuntamenti futuri associati a questo numero.",
    awaitingApproval: "{clinic}: grazie! La tua richiesta per {when} deve ancora essere accettata dallo studio. Ti scriveremo appena accettata.",
    awaitingApprovalShort: "{clinic}: richiesta {slot} non ancora accettata. Ti scriveremo.",
    confirmThroughLink: "{clinic}: l'appuntamento di {when} non è ancora confermato. Confermalo tu stesso qui: {url}",
    confirmThroughLinkShort: "{clinic}: appuntamento {slot} non ancora confermato. Conferma qui: {url}",
    general: "{clinic}: grazie del messaggio. Per prenotare o modificare un appuntamento usa il link nel nostro messaggio o chiamaci.",
    stop: "{clinic}: non riceverai più SMS. Rispondi START per riattivarli.",
    start: "{clinic}: SMS riattivati. Rispondi STOP per non riceverli più.",
  },

  unsubscribeConfirmation: {
    subject: "Le tue preferenze di contatto - {clinic}",
    body: "non riceverai più messaggi via {channel} sui tuoi appuntamenti presso {clinic}. Puoi cambiare idea in qualsiasi momento dalle tue scelte sulla privacy.",
    cta: "Le tue scelte sulla privacy",
    sms: "{clinic}: non riceverai più SMS. Rispondi START per riattivarli.",
  },

  breachNotice: {
    subject: "Importante: un incidente di sicurezza che riguarda i tuoi dati - {clinic}",
    body: "ti scriviamo per informarti di una violazione dei dati personali che potrebbe riguardarti. La prendiamo sul serio e vogliamo spiegarti cosa è successo e cosa stiamo facendo.",
    what: "Cosa è successo",
    when: "Quando",
    data: "Dati coinvolti",
    consequences: "Possibili conseguenze per te",
    measures: "Cosa abbiamo fatto",
    advice: "Cosa puoi fare",
    contact: "Domande",
    contactValue: "Contatta il nostro responsabile della protezione dei dati: {dpo}",
    sms: "{clinic}: comunicazione importante sui tuoi dati personali. Leggila con attenzione: {url}",
  },

  ics: {
    summary: "Appuntamento – {clinic}",
    phone: "Tel. {phone}",
  },

  preview: {
    sampleFirstName: "Marco",
  },
} satisfies DeepPartial<Messages["patientMessages"]>;
