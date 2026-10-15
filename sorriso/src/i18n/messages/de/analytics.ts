import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  title: "Auswertungen",
  description:
    "Beim Öffnen dieser Seite auf unseren Servern aus den eigenen Daten Ihrer Praxis berechnet. Keine Cookies, kein Tracking.",
  range: {
    label: "Zeitraum",
    months: p({ one: "Letzter {count} Monat", other: "Letzte {count} Monate" }),
    window: "{from} – {to}",
  },
  export: "CSV herunterladen",
  exportHint: "Dieselben Zahlen wie auf dieser Seite, für eine Tabellenkalkulation.",
  dimension: {
    label: "Aufschlüsseln nach",
    service: "Behandlung",
    practitioner: "Behandler",
    weekday: "Wochentag",
    partOfDay: "Tageszeit",
  },
  showTable: "Als Tabelle anzeigen",
  noData: "In diesem Zeitraum gibt es noch nicht genug Daten.",
  none: "–",

  kpi: {
    noShow: "Ausfallquote",
    noShowHint: "{noShows}-mal nicht erschienen bei {visits} Besuchen",
    lateCancel: "Kurzfristige Absagen",
    lateCancelHint: "Vom Patienten weniger als {hours} Stunden vorher abgesagt",
    confirmation: "Nach einer Erinnerung bestätigt",
    confirmationHint: "{confirmed} von {sent} Erinnerungen mit Bitte um Bestätigung",
    waitlist: "Belegungsquote der Warteliste",
    waitlistHint: "{booked} gebucht von {closed} abgeschlossenen Einträgen",
    recalls: "Recall-Konversion",
    recallsHint: "{booked} gebucht von {contacted} per Recall kontaktierten Patienten",
    leadTime: "Mittlere Buchungsvorlaufzeit (Median)",
    leadTimeValue: p({ one: "{count} Tag", other: "{count} Tage" }),
    leadTimeHint: p({ one: "Über {count} Buchung", other: "Über {count} Buchungen" }),
  },

  sections: {
    outcomesTotal: "Anwesenheit",
    attendance: "Anwesenheit",
    attendanceHint:
      "Ausfallquote: nicht wahrgenommene Termine im Verhältnis zu allen stattgefundenen oder versäumten Besuchen. Kurzfristige Absagen: vom Patienten innerhalb der Absagefrist der Praxis abgesagt, im Verhältnis zu denselben Besuchen zuzüglich dieser Absagen.",
    byService: "Nach Behandlung",
    byPractitioner: "Nach Behandler",
    byWeekday: "Nach Wochentag",
    byPartOfDay: "Nach Tageszeit",
    noShowChart: "Ausfallquote",
    lateCancelChart: "Quote kurzfristiger Absagen",
    confirmation: "Bestätigungen",
    confirmationHint:
      "Jede Bestätigung zählt für die letzte davor gesendete Erinnerung. Bestätigungen am Empfang oder bei der Buchung werden nicht gezählt.",
    confirmationByChannel: "Bestätigungsquote nach Kanal",
    confirmationByOffset: "Bestätigungsquote nach Zeitpunkt der Erinnerung",
    waitlist: "Warteliste",
    waitlistDetail:
      "{entries} Einträge · {booked} gebucht · {removed} entfernt · {expired} abgelaufen · {waiting} noch wartend",
    recalls: "Recalls",
    recallsDetail: "{due} Recalls fällig · {contacted} Patienten kontaktiert · {booked} gebucht",
    bookings: "Buchungen",
    leadTime: "Wie weit im Voraus Patienten buchen",
    newBySource: "Neupatienten nach Buchungskanal",
    newByContext: "Neupatienten: Praxiskanäle oder Sorriso",
    reviews: "Veröffentlichte Bewertungen",
    reviewsHint: "Nur Bewertungen, die auf Ihrem Profil veröffentlicht sind, werden gezählt.",
    reviewsSummary: p({
      one: "{count} Bewertung, Durchschnitt {average}",
      other: "{count} Bewertungen, Durchschnitt {average}",
    }),
    funnel: "Marktplatz-Trichter",
    funnelHint:
      "Erscheinen in den Suchergebnissen von Sorriso und Aufrufe der Profile Ihrer Behandler, im Vergleich zu auf Sorriso begonnenen Buchungen.",
    ranking: "Ihre Ranking-Faktoren",
    rankingHint:
      "Was das Ranking des Sorriso-Marktplatzes heute über jeden Behandler weiß, und die Punktzahl ohne suchspezifische Faktoren (Entfernung, Stadt, Sprache, Gesundheitsfonds). Eine bessere Position kann niemand kaufen.",
    rankingLink: "So funktioniert das Ranking",
  },

  measures: {
    noShowRate: "Ausfallquote (%)",
    lateCancelRate: "Quote kurzfristiger Absagen (%)",
    confirmationRate: "Bestätigungsquote (%)",
    fillRate: "Belegungsquote (%)",
    entries: "Einträge",
    recallConversion: "Recall-Konversion (%)",
    recallsDue: "Fällige Recalls",
    medianDays: "Median der Vorlaufzeit (Tage)",
    bookings: "Buchungen",
    newPatients: "Neupatienten",
    reviews: "Bewertungen",
    averageRating: "Durchschnittliche Bewertung",
    impressions: "Erscheinen in der Suche",
    profileViews: "Profilaufrufe",
    marketplaceBookings: "Buchungen auf Sorriso",
    bookingRate: "Buchungen pro Profilaufruf (%)",
    score: "Ranking-Punktzahl (0-100)",
    staffCancelRate: "Von der Praxis abgesagt, 180 Tage (%)",
    completeness: "Vollständigkeit des Profils (%)",
  },

  table: {
    item: "Eintrag",
    visits: "Besuche",
    noShows: "Nicht erschienen",
    lateCancels: "Kurzfristige Absagen",
    noShowRate: "Ausfallquote",
    lateCancelRate: "Quote kurzfristiger Absagen",
    sent: "Gesendete Erinnerungen",
    confirmed: "Bestätigt",
    rate: "Quote",
    count: "Anzahl",
    month: "Monat",
    average: "Durchschnittliche Bewertung",
  },

  partsOfDay: {
    morning: "Vormittag (vor 13:00)",
    afternoon: "Nachmittag (13:00–18:00)",
    evening: "Abend (ab 18:00)",
  },

  offsets: {
    h3: "Bis zu 3 Stunden vorher",
    h12: "3 bis 12 Stunden vorher",
    d1: "Etwa einen Tag vorher",
    d2: "Etwa zwei Tage vorher",
    d3: "Drei Tage oder mehr vorher",
  },

  leadBuckets: {
    sameDay: "Innerhalb von 24 Stunden",
    d2: "1–2 Tage",
    d7: "3–7 Tage",
    d14: "8–14 Tage",
    d30: "15–30 Tage",
    more: "Mehr als 30 Tage",
  },

  sources: {
    online: "Online-Buchungsseite",
    widget: "Website-Widget",
    api: "Partnersoftware",
    staff: "Empfang",
    waitlist: "Warteliste",
  },

  contexts: {
    practice: "Praxiskanäle",
    marketplace: "Sorriso-Marktplatz",
  },

  funnel: {
    impressions: "Erscheinen in der Suche",
    views: "Profilaufrufe",
    bookings: "Buchungen auf Sorriso",
    viewRate: "{value} der Einblendungen führten zu einem Profilaufruf",
    bookingRate: "{value} der Profilaufrufe führten zu einer Buchung",
  },

  ranking: {
    practitioner: "Behandler",
    score: "Punktzahl",
    soonest: "Nächster freier Termin",
    noSlot: "Keiner in den nächsten 14 Tagen",
    rating: "Bewertungen",
    ratingValue: p({ one: "{average} ({count} Bewertung)", other: "{average} ({count} Bewertungen)" }),
    noReviews: "Noch keine Bewertungen",
    cancellations: "Von der Praxis abgesagt",
    cancellationsValue: "{value} (180 Tage)",
    completeness: "Profil",
    reasons: "Positiv beeinflusst durch",
    noReasons: "Noch nichts Auffälliges",
    reasonLabels: {
      soonest: "Bald freie Termine",
      rating: "Verifizierte Bewertungen",
      reliability: "Sagt selten ab",
      completeness: "Vollständiges Profil",
      distance: "Nah am Suchort",
      language: "Gesprochene Sprache",
      fund: "Gesundheitsfonds",
    },
    globalMean: "Durchschnittliche Bewertung der Plattform, die für die Gewichtung verwendet wird: {value}",
    empty: "Noch keine aktiven Behandler.",
  },

  chart: {
    bar: "{label}: {value}",
    column: "{label}: {value}",
  },

  csv: {
    filename: "auswertungen",
    section: "Abschnitt",
    item: "Eintrag",
    measure: "Kennzahl",
    value: "Wert",
    numerator: "Zähler",
    denominator: "Nenner",
    all: "Alle",
  },

  forbidden: "Sie haben keine Berechtigung, die Auswertungen der Praxis zu sehen.",
} satisfies DeepPartial<Messages["analytics"]>;
