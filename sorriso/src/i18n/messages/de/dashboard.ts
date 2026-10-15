import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Dashboard",
    template: "{page} · {app}",
  },
  skipToContent: "Zum Hauptinhalt springen",

  nav: {
    label: "Dashboard",
    overview: "Übersicht",
    calendar: "Kalender",
    confirmations: "Bestätigungen",
    messages: "Nachrichten",
    patients: "Patienten",
    duplicates: "Mögliche Duplikate",
    waitlist: "Warteliste",
    recalls: "Recalls",
    reviews: "Bewertungen",
    analytics: "Auswertungen",
    team: "Team & Arbeitszeiten",
    services: "Behandlungen",
    locations: "Standorte & Behandlungsstühle",
    reminders: "Erinnerungen",
    settings: "Einstellungen",
    funds: "Gesundheitsfonds",
    api: "API",
    privacyRequests: "Datenschutzanfragen",
    privacySettings: "Datenschutzeinstellungen",
    audit: "Protokoll",
    security: "Meine Sicherheit",
    platform: "Plattform",
    platformPrivacy: "Datenschutz-Posteingang der Plattform",
    groups: {
      setup: "Einrichtung",
      privacy: "Datenschutz",
      account: "Konto",
    },
    count: p({ one: "{count} zu erledigen", other: "{count} zu erledigen" }),
  },

  sidebar: {
    home: "Dashboard-Übersicht",
    publicPage: "Öffentliche Seite",
    publicPageNewTab: "Ihre öffentliche Seite (öffnet in einem neuen Tab)",
    switchPractice: "Praxis wechseln",
    logout: "Abmelden",
    language: "Sprache des Dashboards",
    languageAuto: "Automatisch ({language})",
  },

  language: {
    saved: "Sprache gespeichert.",
    invalid: "Wählen Sie eine der aufgeführten Sprachen.",
  },

  toast: {
    region: "Benachrichtigungen",
    dismiss: "Schließen",
  },

  form: {
    saved: "Gespeichert.",
  },

  notFound: {
    title: "Seite nicht gefunden",
    body: "Diese Dashboard-Seite existiert nicht oder wurde verschoben.",
    back: "Zurück zur Übersicht",
  },

  denied:
    "Sie haben keine Berechtigung, diese Seite zu öffnen. Wenden Sie sich bei Bedarf an einen Inhaber oder einen Administrator der Praxis.",

  overview: {
    title: "Übersicht",
    greeting: {
      morning: "Guten Morgen, {name}",
      afternoon: "Guten Tag, {name}",
      evening: "Guten Abend, {name}",
    },
    subtitle: "{date} · {practice}",
    openCalendar: "Kalender öffnen",
    welcome: {
      title: "Willkommen! In vier Schritten startklar",
      team: "Fügen Sie Ihre Zahnärzte und Dentalhygieniker mit ihren Arbeitszeiten an jedem Standort hinzu",
      services: "Legen Sie Behandlungen, Dauer und Preise fest",
      reminders: "Wählen Sie, wann Erinnerungen versendet werden (SMS, WhatsApp, E-Mail)",
      widget: "Binden Sie das Buchungs-Widget auf Ihrer Website ein",
    },
    stats: {
      today: "Heute",
      todayHint: p({ one: "{count} bestätigt oder erledigt", other: "{count} bestätigt oder erledigt" }),
      tomorrow: "Für morgen bestätigt",
      tomorrowHint: "{confirmed} von {total} · {open} nachzufassen",
      noShow: "Ausfallquote (30 Tage)",
      noShowHint: "Nicht erschienen: {noShows} · Besuche: {visits}",
      online: "Online-Buchungen (7 Tage)",
      onlineHint: "Über die Warteliste neu belegt (30 Tage): {refilled} · wartend: {waiting}",
      none: "–",
    },
    demo: {
      all: "Demomodus: E-Mails, SMS und WhatsApp-Nachrichten werden auf der Seite Nachrichten abgefangen statt zugestellt.",
      email: "Demomodus: E-Mails werden auf der Seite Nachrichten abgefangen statt zugestellt.",
      text: "Demomodus: SMS und WhatsApp-Nachrichten werden auf der Seite Nachrichten abgefangen statt zugestellt.",
      connect: "Anbieter verbinden",
    },
    attention: "Erfordert Ihre Aufmerksamkeit",
    attentionCount: p({ one: "{count} Termin", other: "{count} Termine" }),
    agenda: "Heutige Termine",
    noneToday: "Heute keine Termine.",
    tomorrowLink: "Bestätigungen für morgen",
  },

  confirmations: {
    title: "Bestätigungen",
    tabs: {
      label: "Welche Termine",
      tomorrow: "Morgen",
      week: "Nächste 7 Tage",
      requests: "Online-Anfragen",
      outcome: "Ergebnis erfassen",
      cancelled: "Kürzlich abgesagt",
    },
    descriptions: {
      tomorrow:
        "Wer morgen kommt. Fassen Sie bei denen nach, deren Bestätigung noch aussteht: Patienten mit früheren Ausfällen sind markiert.",
      week: "Alles, was für die kommende Woche gebucht ist.",
      requests: "Online-Buchungen, die auf Ihre Freigabe warten (wenn die Praxis Online-Buchungen prüft).",
      outcome:
        "Vergangene Besuche ohne Ergebnis. Markieren Sie sie als abgeschlossen (dadurch wird die Bitte um eine Bewertung versendet) oder als nicht erschienen.",
      cancelled:
        "Kommende Termine, die durch Absagen frei wurden. Sie wurden passenden Patienten auf der Warteliste automatisch angeboten.",
    },
    onlyPending: "Nur ausstehende Bestätigungen ({count})",
    riskSorted: "Unbestätigte Besuche mit höherem Ausfallrisiko stehen an jedem Tag oben.",
    empty: "Hier gibt es nichts anzuzeigen.",
  },

  waitlist: {
    title: "Warteliste",
    description:
      "Wird ein Termin abgesagt oder verschoben, wird der freie Termin bis zu 3 passenden Patienten per SMS, WhatsApp oder E-Mail angeboten. Wer zuerst bucht, bekommt ihn.",
    emptyTitle: "Niemand wartet",
    emptyBody: "Patienten können sich auf der Buchungsseite eintragen, wenn kein Termin passt.",
    waiting: "Wartend",
    anyPractitioner: "Beliebiger Behandler",
    anyOffice: "Beliebiger Standort",
    preference: "{practitioner} · {office}",
    window: "{from} – {to}",
    partOfDay: {
      any: "Beliebig",
      morning: "Vormittags",
      afternoon: "Nachmittags",
    },
    offers: p({ one: "{count} Angebot gesendet", other: "{count} Angebote gesendet" }),
    remove: "Entfernen",
    removeConfirm: "Diesen Patienten von der Warteliste entfernen?",
    note: "Notiz des Patienten: {note}",
    restricted: "Eingeschränkter Datensatz: Kontaktdaten und Notiz sind ausgeblendet.",
    openRecord: "Patientenakte öffnen (Begründung erforderlich)",
    booked: "Kürzlich über die Warteliste gebucht",
    bookedBadge: "Gebucht",
  },
} satisfies DeepPartial<Messages["dashboard"]>;
