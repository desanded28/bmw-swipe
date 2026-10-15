import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Ihr Termin",
    description: "Termin ansehen, bestätigen, verschieben oder absagen.",
  },
  greeting: "Hallo {name},",
  title: "Ihr Termin bei {clinic}",
  status: {
    cancelled: "Abgesagt",
    requested: "Wartet auf Bestätigung durch die Praxis",
    completed: "Abgeschlossen",
    no_show: "Versäumt",
    confirmed: "Gebucht und bestätigt",
    pending: "Gebucht: bitte bestätigen",
  },
  details: {
    when: "Wann",
    timeRange: "{start}–{end}",
    treatment: "Behandlung",
    where: "Wo",
    address: "{address}, {city}",
    phone: "Telefon",
  },
  confirm: {
    title: "Kommen Sie?",
    body: "Ihre Bestätigung hilft {clinic}, den Tag zu planen, und sichert Ihnen Ihren Termin.",
    button: "Ja, ich komme",
    done: "Vielen Dank! Ihre Teilnahme ist bestätigt.",
  },
  reschedule: {
    button: "Verschieben",
    title: "Neuen Termin bei {practitioner} wählen",
    moveTo: "Ihren Termin auf {when} verschieben?",
    moveToOffice: "Ihren Termin auf {when} am Standort {office} verschieben?",
    confirm: "Neuen Termin bestätigen",
    done: "Erledigt: Ihr Termin wurde verschoben.",
    closed: p({
      one: "Online-Verschieben ist bis {count} Stunde vor dem Besuch möglich.",
      other: "Online-Verschieben ist bis {count} Stunden vor dem Besuch möglich.",
    }),
    call: "Um ihn zu verschieben, rufen Sie <tel>{phone}</tel> an.",
  },
  cancel: {
    button: "Termin absagen",
    title: "Diesen Termin absagen?",
    late: p({
      one: "Ihr Besuch ist in weniger als {count} Stunde. Eine Absage gibt den Termin trotzdem für jemanden auf der Warteliste frei: Danke, dass Sie uns Bescheid geben.",
      other: "Ihr Besuch ist in weniger als {count} Stunden. Eine Absage gibt den Termin trotzdem für jemanden auf der Warteliste frei: Danke, dass Sie uns Bescheid geben.",
    }),
    body: "Ihr Termin wird Patienten auf der Warteliste angeboten.",
    reason: "Grund",
    reasonHint: "Optional. Nur für die Praxis sichtbar. Machen Sie keine Angaben zu Ihrer Gesundheit.",
    confirm: "Ja, absagen",
    keep: "Termin behalten",
    done: "Ihr Termin wurde abgesagt.",
  },
  calendar: {
    appleOutlook: "Apple-Kalender / Outlook",
    google: "Google Kalender",
  },
  review: {
    title: "Wie war Ihr Besuch?",
    button: "Bewertung abgeben",
  },
  rebook: "Weiteren Termin buchen",
  privateLink: "Halten Sie diesen Link privat: Jeder, der ihn hat, kann diesen Termin verwalten.",
  clinicPage: "Seite von {clinic}",
  invalid: {
    title: "Dieser Link funktioniert nicht",
    body: "Er ist möglicherweise unvollständig oder falsch geschrieben. Prüfen Sie, ob Sie den ganzen Link aus Ihrer Nachricht geöffnet haben, oder wenden Sie sich an Ihre Praxis.",
  },
  expired: {
    title: "Dieser Link ist abgelaufen",
    body: "Zum Schutz Ihrer Privatsphäre funktionieren Terminlinks einige Zeit nach dem Besuch nicht mehr. Um erneut zu buchen oder Fragen zu einem früheren Besuch zu stellen, wenden Sie sich direkt an Ihre Praxis.",
    privacyCenter: "Um die Daten einzusehen, die Praxen über Sie gespeichert haben, nutzen Sie das Datenschutz-Center.",
  },
  rateLimited: {
    title: "Zu viele Anfragen",
    body: p({
      one: "Diese Seite wurde in kurzer Zeit zu oft geöffnet. Bitte versuchen Sie es in {count} Minute erneut.",
      other: "Diese Seite wurde in kurzer Zeit zu oft geöffnet. Bitte versuchen Sie es in {count} Minuten erneut.",
    }),
  },
  preview: {
    title: "Ihr Termin",
    body: "Öffnen Sie diesen Link in Ihrem Browser, um Ihren Termin anzusehen und zu verwalten.",
  },
  home: "Zur Startseite",
} satisfies DeepPartial<Messages["manage"]>;
