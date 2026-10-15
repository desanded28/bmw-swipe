import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  page: {
    title: "Erinnerungen & Bestätigungen",
    description:
      "Wann und wie Patienten erinnert werden. Antworten auf SMS-Erinnerungen aktualisieren den Kalender automatisch.",
  },

  schedule: {
    title: "Erinnerungsplan",
    current: "Aktuelle Erinnerungen",
    none: "Keine Erinnerungen: Patienten erhalten nur die Buchungsbestätigung.",
    confirmNote: "Sobald ein Patient bestätigt hat, fragen spätere Erinnerungen nicht mehr nach.",
    asks: "bittet um Bestätigung",
    channel: {
      email: "E-Mail",
      text: "Textnachricht",
    },
    offset: {
      days: p({ one: "{count} Tag vorher", other: "{count} Tage vorher" }),
      hours: p({ one: "{count} Stunde vorher", other: "{count} Stunden vorher" }),
      minutes: p({ one: "{count} Minute vorher", other: "{count} Minuten vorher" }),
    },
    risk: {
      medium: "nur bei mittlerem oder hohem Ausfallrisiko",
      high: "nur bei hohem Ausfallrisiko",
    },
  },

  rules: {
    channelLabel: "Kanal",
    channelEmail: "E-Mail",
    channelText: "Textnachricht (SMS, oder WhatsApp, wenn der Patient es gewählt hat)",
    amountLabel: "Wie lange vorher",
    unitLabel: "Einheit",
    hoursBefore: "Stunden vorher",
    daysBefore: "Tage vorher",
    askConfirmation: "Um Bestätigung bitten (Antwort JA/NEIN)",
    fallbackToEmail: "E-Mail, wenn keine Handynummer vorhanden",
    riskLabel: "Senden für",
    riskAll: "Jeden Termin",
    riskMedium: "Nur mittleres oder hohes Ausfallrisiko",
    riskHigh: "Nur hohes Ausfallrisiko",
    riskOff:
      "Risikobasierte Erinnerungen sind in den Datenschutzeinstellungen ausgeschaltet, daher werden auf ein Risiko beschränkte Regeln nie versendet.",
    riskObjection: "Patienten, die angepassten Erinnerungen widersprochen haben, gelten als ohne Risiko.",
    remove: "Erinnerung {number} entfernen",
    rule: "Erinnerung {number}",
    add: "Erinnerung hinzufügen",
    max: "Bis zu 6 Erinnerungen.",
    flagsTitle: "Weitere Nachrichten",
    sendBookingConfirmation: "Direkt nach der Buchung eine Buchungsbestätigung mit Kalendereinladung senden",
    autoOfferToWaitlist: "Frei gewordene Termine automatisch passenden Patienten auf der Warteliste anbieten",
    requestReviews: "2 Stunden nachdem ein Besuch als abgeschlossen markiert wurde, um eine verifizierte Bewertung bitten",
    requestReviewsHint: "Nur Patienten, die einer Feedback-Anfrage zugestimmt haben, erhalten diese E-Mail.",
    smsAsciiFallback: "Spanische, portugiesische, französische, rumänische und polnische SMS ohne Akzente senden",
    smsAsciiFallbackHint:
      "Buchstaben mit Akzent wie ą oder ș können eine SMS bis zu doppelt so teuer machen. Ohne sie passt eine Erinnerung in weniger SMS-Segmente.",
    save: "Erinnerungsregeln speichern",
    runNow: "Fällige Erinnerungen jetzt senden",
    readOnly: "Nur Inhaber und Administratoren können die Erinnerungsregeln ändern.",
  },

  stats: {
    title: "Letzte 30 Tage",
    sent: "Gesendet",
    pending: "Geplant",
    skipped: "Übersprungen",
    failed: "Fehlgeschlagen",
    hint: "Übersprungen: Der Termin wurde abgesagt oder verschoben, der Patient ist über diesen Kanal nicht erreichbar, oder eine Regel traf nicht zu.",
  },

  inbound: {
    title: "Antwortnummer",
    description:
      "Mit einer eigenen Nummer (im Twilio-Konto von Sorriso) werden Ihre SMS von ihr aus versendet, und die Antworten der Patienten kommen dort an. So kann eine Antwort nie einer anderen Praxis zugeordnet werden. Ohne eigene Nummer nutzen SMS den gemeinsamen Absender, und eine Antwort geht an die Praxis, die dem Patienten zuletzt von dort geschrieben hat.",
    label: "Ihre Nummer oder Ihr Twilio Messaging Service",
    placeholder: "+39 02 1234 5678",
    hint: "Internationales Format, z. B. +39 02 1234 5678, oder eine Messaging Service SID (MG…). Leer lassen, um den gemeinsamen Absender zu nutzen.",
    save: "Antwortnummer speichern",
    ownerOnly: "Nur der Inhaber der Praxis kann die Antwortnummer ändern.",
  },

  providers: {
    title: "Versanddienste",
    email: "E-Mail",
    sms: "SMS",
    whatsapp: "WhatsApp",
    captured: "Demo: abgefangen",
    live: "Live über {provider}",
    emailEnv: "Jeder SMTP-Dienst mit EU-Region",
    smtpTls: "STARTTLS erforderlich, TLS 1.2 oder höher",
    smtpNoTls: "TLS wird nicht erzwungen (SMTP_REQUIRE_TLS=0): nur für einen lokalen Testserver",
    smsRegion: "Twilio-Region {region} über den Edge-Standort {edge} (Datenhaltung in der EU)",
    smsDefaultRegion:
      "Twilio-Standardregion US1: Setzen Sie TWILIO_REGION=ie1 und TWILIO_EDGE=dublin für die Datenhaltung in der EU",
    whatsappTemplates: p({
      one: "{count} genehmigte Vorlage (Art und Sprache)",
      other: "{count} genehmigte Vorlagen (Art und Sprache)",
    }),
    whatsappNoTemplates:
      "Keine genehmigten Vorlagen: WhatsApp-Patienten erhalten SMS, bis Vorlagen eingerichtet sind.",
    repliesTitle: "Antworten in beide Richtungen",
    repliesBody: "Setzen Sie in Twilio für Ihre Nummer oder Ihren WhatsApp-Absender „A message comes in“ auf:",
  },

  preview: {
    title: "Nachrichtenvorschau",
    languageLabel: "Sprache des Patienten",
    discreet:
      "Diskrete Nachrichten: keine Behandlung, kein Behandler und keine Notizen in SMS, E-Mail-Betreffzeilen oder Kalendereinträgen.",
    detailed:
      "Ausführliche Nachrichten: SMS und E-Mails dürfen die Behandlung und den Behandler nennen, aber nur bei Behandlungen, die nicht als sensibel markiert sind, und bei Patienten mit verifizierten Kontaktdaten. Alle anderen erhalten die diskrete Version.",
    reminderAsk: "Erinnerung mit Bitte um Bestätigung",
    reminder: "Erinnerung nach Bestätigung durch den Patienten",
    patientReply: "Antwort des Patienten",
    automaticAnswer: "Automatische Antwort",
    segments: p({ one: "{count} SMS-Segment", other: "{count} SMS-Segmente" }),
    characters: p({ one: "{encoding}, {count} Zeichen", other: "{encoding}, {count} Zeichen" }),
    overBudget: "Länger als das Budget von 2 GSM-7- oder 3 UCS-2-Segmenten",
    asciiOn: "Ohne Akzente gesendet (die Ersetzung ist aktiv)",
    emailTitle: "E-Mail",
    subject: "Betreff: {subject}",
    emailFrame: "E-Mail-Vorschau auf {language}",
    sampleNote: "Beispieldaten; Links führen nirgendwohin.",
  },

  replies: {
    title: "Antworten, die wir verstehen",
    description:
      "Patienten können in ihrer eigenen Sprache antworten. Eine Nachricht in einer anderen Sprache wird nur verstanden, wenn sie aus genau einem dieser Wörter besteht; alles andere wird für den Empfang markiert.",
    language: "Sprache",
    confirm: "Bestätigen",
    cancel: "Absagen",
    reschedule: "Neuer Termin",
    stop: "SMS stoppen",
    start: "SMS wieder an",
    emoji: "👍 bestätigt und 👎 sagt ab, in jeder Sprache.",
  },

  messages: {
    title: "Nachrichten",
    description: "Alle Erinnerungen, Bestätigungen und Antworten von Patienten, per E-Mail, SMS und WhatsApp.",
    filters: "Nachrichten filtern",
    all: "Alle",
    inbound: "Antworten von Patienten",
    attention: "Nicht verstanden",
    empty: "Noch keine Nachrichten",
    received: "Empfangen",
    sentLabel: "Gesendet",
    reply: "Antwort: {intent}",
    showEmail: "E-Mail anzeigen",
    hideEmail: "E-Mail ausblenden",
    emailFrame: "E-Mail: {subject}",
    unknownSender: "Unbekannte Nummer",
    redacted: "Inhalt gemäß Aufbewahrungsrichtlinie entfernt",
    linkRedacted: "[Patientenlink]",
    restrictedPatient: "Eingeschränkter Patient",
    restrictedBody:
      "Die Daten dieses Patienten sind eingeschränkt (Art. 18 DSGVO). Öffnen Sie seinen Termin im Kalender und geben Sie eine Begründung an, um diese Nachrichten zu sehen.",
    status: {
      sent: "Gesendet",
      delivered: "Zugestellt",
      failed: "Fehlgeschlagen",
      received: "Empfangen",
      captured: "Abgefangen (nicht gesendet)",
    },
    intent: {
      confirm: "bestätigt",
      cancel: "abgesagt",
      reschedule: "möchte einen neuen Termin",
      unknown: "nicht verstanden",
      stop: "SMS gestoppt",
      start: "SMS wieder an",
    },
  },

  simulator: {
    title: "Antwortablauf ausprobieren",
    description:
      "Simulieren Sie, dass ein Patient auf seine Erinnerung geantwortet hat. Der Kalender aktualisiert sich genau so wie bei echten Twilio-Antworten.",
    demoOnly: "Der Antwortsimulator ist nur im Demomodus verfügbar.",
    noPatients: "Keine bevorstehenden Termine mit Handynummer.",
    patient: "Patient mit bevorstehendem Besuch",
    patientOption: "{name}, nächster Besuch {when}",
    reply: "Seine Antwort",
    via: "Über",
    examples: "Beispiele",
    submit: "Antwort simulieren",
  },

  actions: {
    saved: "Erinnerungsregeln gespeichert. Sie gelten für neue Buchungen und alles, was Sie verschieben.",
    ran: p({
      one: "{count} fällige Erinnerung verarbeitet: {sent} gesendet, {skipped} übersprungen, {failed} fehlgeschlagen.",
      other: "{count} fällige Erinnerungen verarbeitet: {sent} gesendet, {skipped} übersprungen, {failed} fehlgeschlagen.",
    }),
    inboundSaved: "Antwortnummer gespeichert.",
    inboundCleared: "Antwortnummer entfernt: Antworten kommen jetzt über den gemeinsamen Absender.",
    inboundInvalid:
      "Geben Sie eine Telefonnummer im internationalen Format (+39…) oder eine Messaging Service SID (MG…) ein.",
    inboundTaken: "Diese Nummer wird bereits von einer anderen Praxis verwendet.",
    inboundShared:
      "Dies ist der gemeinsame Absender von Sorriso, an den die Patienten aller Praxen antworten. Geben Sie eine Nummer oder einen Messaging Service ein, die bzw. der Ihrer Praxis vorbehalten ist.",
    ownerOnly: "Nur der Inhaber der Praxis kann die Antwortnummer ändern.",
    invalidPhone: "Geben Sie eine gültige Telefonnummer ein.",
    noPatient: "Kein Patient dieser Praxis hat diese Nummer.",
    demoOnly: "Der Antwortsimulator ist nur im Demomodus verfügbar.",
    simulated: "Verstanden als „{intent}“.",
    simulatedReply: "Verstanden als „{intent}“. Automatische Antwort: {reply}",
  },
} satisfies DeepPartial<Messages["reminders"]>;
