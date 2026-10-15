/**
 * German patient messages. Rules: see messages/en/patientMessages.ts.
 * SMS: straight quotes only, no ellipsis character; ä, ö, ü, Ä, Ö, Ü and ß are GSM-7.
 * Confirm keyword JA, cancel keyword NEIN, opt-out STOP, opt-in START (src/lib/inbound.ts).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  format: {
    slot: "{day}.{month}. {time}",
  },

  email: {
    greeting: "Hallo {name},",
    when: "Wann",
    where: "Wo",
    service: "Behandlung",
    with: "Bei",
    patient: "Patient",
    manage: "Termin verwalten",
    confirm: "Teilnahme bestätigen",
    cancel: "Absagen",
    reschedule: "Verschieben",
    calendar: "Zum Kalender hinzufügen",
    detailsOnline: "Alle Details zu Ihrem Besuch finden Sie auf Ihrer Terminseite.",
  },

  privacyFooter: {
    sender: "{name} · {address}",
    phone: "Tel. {phone}",
    why: "Sie erhalten diese E-Mail, weil Sie einen Termin bei {clinic} haben.",
    whyGuardian: "Sie erhalten diese E-Mail, weil Sie die Kontaktperson für die Termine von {patient} bei {clinic} sind.",
    whyWaitlist: "Sie erhalten diese E-Mail, weil Sie sich bei {clinic} auf die Warteliste gesetzt haben.",
    whyGeneric: "Sie erhalten diese E-Mail, weil Sie bei {clinic} in Behandlung sind.",
    object:
      "Sie können Erinnerungen jederzeit widersprechen oder eine Einwilligung widerrufen: in Ihren Datenschutzeinstellungen oder indem Sie auf unsere SMS mit STOP antworten.",
    notice: "Datenschutzhinweise",
    preferences: "Ihre Datenschutzeinstellungen",
  },

  booked: {
    subject: "Termin gebucht - {clinic} - {date}",
    subjectDetailed: "Termin gebucht: {service}, {date}",
    body: "Ihr Termin ist gebucht. Wir senden Ihnen vor Ihrem Besuch eine Erinnerung.",
    sms: "{clinic}: Termin am {when} gebucht. Verwalten: {url} Datenschutzhinweise: {privacy} Abmelden: STOP",
    smsShort: "{clinic}: Termin {slot} gebucht. Verwalten: {url}",
    smsDetailed: "{clinic}: gebucht: {service} bei {practitioner} am {when}. Verwalten: {url} Abmelden: STOP",
  },

  requested: {
    subject: "Anfrage erhalten - {clinic} - {date}",
    subjectDetailed: "Anfrage erhalten: {service}",
    body: "wir haben Ihre Anfrage erhalten. Die Praxis wird sie in Kürze bestätigen, und Sie erhalten dann eine E-Mail.",
  },

  approved: {
    subject: "Termin bestätigt - {clinic} - {date}",
    subjectDetailed: "Termin von der Praxis bestätigt: {service}, {date}",
    body: "die Praxis hat Ihre Anfrage angenommen. Hier sind Ihre Termindetails.",
    sms: "{clinic}: Ihr Termin am {when} ist bestätigt. Verwalten: {url} Datenschutzhinweise: {privacy} Abmelden: STOP",
    smsShort: "{clinic}: Termin {slot} bestätigt. Verwalten: {url}",
  },

  reminder: {
    subject: "Terminerinnerung - {clinic} - {date}",
    subjectDetailed: "Terminerinnerung: {service}, {date}",
    body: "wir erinnern Sie an Ihren bevorstehenden Termin.",
    bodyAsk: "wir erinnern Sie an Ihren bevorstehenden Termin. Können Sie Ihr Kommen mit einem Klick bestätigen?",
    sms: "{clinic}: Erinnerung an Ihren Termin am {when}, {address}. Details: {url} Abmelden: STOP",
    smsAsk:
      "{clinic}: Erinnerung an Ihren Termin am {when}, {address}. Antworten Sie JA zum Bestätigen, NEIN zum Absagen. Details: {url} Abmelden: STOP",
    smsShort: "{clinic}: Termin {slot}. Details: {url}",
    smsAskShort: "{clinic}: Termin {slot}. JA = bestätigen, NEIN = absagen. {url}",
    smsDetailed: "{clinic}: Hallo {name}, Erinnerung: {service} bei {practitioner} am {when}, {address}. Details: {url}",
    smsAskDetailed:
      "{clinic}: Hallo {name}, Erinnerung: {service} bei {practitioner} am {when}, {address}. Antworten Sie JA zum Bestätigen, NEIN zum Absagen. Details: {url}",
  },

  cancelled: {
    subject: "Termin abgesagt - {clinic} - {date}",
    body: "Ihr Termin wurde wie gewünscht abgesagt.",
    bodyByPractice: "leider musste die Praxis Ihren Termin absagen. Sie können jederzeit einen neuen Termin buchen.",
    sms: "{clinic}: Ihr Termin am {when} wurde abgesagt. Neu buchen: {url}",
    smsShort: "{clinic}: Termin {slot} abgesagt. {url}",
    rebook: "Neu buchen",
  },

  rescheduled: {
    subject: "Termin verschoben - {clinic} - {date}",
    subjectDetailed: "Termin verschoben: {service}, {date}",
    body: "Ihr Termin wurde verschoben. Hier ist der neue Zeitpunkt.",
    sms: "{clinic}: Ihr Termin wurde verschoben. Neu: {when}, {address}. Details: {url}",
    smsShort: "{clinic}: Termin verschoben auf {slot}. {url}",
  },

  waitlist: {
    subject: "Ein Termin ist frei geworden - {clinic} - {date}",
    body: "am {when} ist ein Termin frei geworden. Wer zuerst bucht, bekommt ihn. Buchen Sie also gleich, wenn er Ihnen passt.",
    sms: "{clinic}: Termin frei am {when}. Wer zuerst bucht, bekommt ihn: {url}",
    smsShort: "{clinic}: freier Termin {slot}: {url}",
    cta: "Diesen Termin buchen",
  },

  review: {
    subject: "Wie war Ihr Besuch bei {clinic}?",
    body: "vielen Dank für Ihren Besuch. Eine verifizierte Bewertung hilft anderen Patienten, mit Vertrauen zu wählen. Es dauert nur eine Minute.",
    bodyDetailed:
      "vielen Dank für Ihren Besuch bei {practitioner}. Eine verifizierte Bewertung hilft anderen Patienten, mit Vertrauen zu wählen. Es dauert nur eine Minute.",
    cta: "Bewertung abgeben",
  },

  replies: {
    confirmed: "{clinic}: Danke! Ihr Termin am {when} ist bestätigt. Bis bald!",
    confirmedShort: "{clinic}: Danke, bestätigt für {slot}.",
    cancelled: "{clinic}: Ihr Termin am {when} ist abgesagt. Neuen Termin buchen: {url}",
    cancelledShort: "{clinic}: Termin {slot} abgesagt. Neu buchen: {url}",
    reschedule: "{clinic}: Wählen Sie hier einen neuen Termin: {url}",
    unknown: "{clinic}: Leider haben wir Sie nicht verstanden. Antworten Sie JA zum Bestätigen oder NEIN zum Absagen, oder öffnen Sie: {url}",
    none: "{clinic}: Für diese Nummer haben wir keinen bevorstehenden Termin gefunden.",
    stop: "{clinic}: Sie erhalten keine SMS mehr von uns. Antworten Sie START, um sie wieder zu erhalten.",
    start: "{clinic}: SMS sind wieder aktiviert. Antworten Sie STOP, um sie abzubestellen.",
  },

  unsubscribeConfirmation: {
    subject: "Ihre Nachrichteneinstellungen - {clinic}",
    body: "Sie erhalten von {clinic} keine {channel}-Nachrichten mehr zu Ihren Terminen. Sie können dies jederzeit in Ihren Datenschutzeinstellungen ändern.",
    cta: "Ihre Datenschutzeinstellungen",
    sms: "{clinic}: Sie erhalten keine SMS mehr von uns. Antworten Sie START, um sie wieder zu erhalten.",
  },

  breachNotice: {
    subject: "Wichtig: ein Sicherheitsvorfall, der Ihre Daten betrifft - {clinic}",
    body: "wir möchten Sie über eine Verletzung des Schutzes personenbezogener Daten informieren, die Sie betreffen könnte. Wir nehmen sie ernst und möchten Ihnen erklären, was passiert ist und was wir dagegen unternehmen.",
    what: "Was ist passiert",
    when: "Wann",
    data: "Betroffene Daten",
    consequences: "Mögliche Folgen für Sie",
    measures: "Was wir unternommen haben",
    advice: "Was Sie tun können",
    contact: "Fragen",
    contactValue: "Wenden Sie sich an unseren Datenschutzbeauftragten: {dpo}",
    sms: "{clinic}: Wichtige Mitteilung zu Ihren personenbezogenen Daten. Bitte lesen Sie sie aufmerksam: {url}",
  },

  ics: {
    summary: "Termin – {clinic}",
    phone: "Tel. {phone}",
  },

  preview: {
    sampleFirstName: "Anna",
  },
} satisfies DeepPartial<Messages["patientMessages"]>;
