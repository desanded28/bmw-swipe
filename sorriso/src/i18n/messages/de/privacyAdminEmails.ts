/**
 * German privacy emails from the practice (request answers) and to practice owners. SMS texts:
 * straight quotes only, no ellipsis character (GSM-7).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  types: {
    access: "Auskunft über Ihre Daten",
    rectification: "Berichtigung Ihrer Daten",
    erasure: "Löschung Ihrer Daten",
    restriction: "Einschränkung der Verarbeitung Ihrer Daten",
    portability: "Kopie Ihrer Daten zur Übertragung",
    objection: "Widerspruch gegen die Verarbeitung Ihrer Daten",
    consent_withdrawal: "Widerruf Ihrer Einwilligung",
  },

  requestExtended: {
    subject: "Ihre Datenschutzanfrage: Wir benötigen mehr Zeit",
    body: "Wir haben Ihren Antrag auf {type} am {received} erhalten. Um sie vollständig zu beantworten, benötigen wir aus folgendem Grund mehr Zeit: {reason}. Sie erhalten unsere Antwort spätestens am {until}. Die DSGVO (Art. 12 Abs. 3) erlaubt diese Verlängerung um bis zu zwei weitere Monate.",
    sms: "{practice}: Wir brauchen mehr Zeit für Ihre Datenschutzanfrage vom {received}. Grund: {reason}. Antwort bis {until}.",
  },
  requestGranted: {
    subject: "Ihre Datenschutzanfrage wurde erledigt",
    body: "Wir haben Ihren am {received} eingegangenen Antrag auf {type} erledigt. Unsere Antwort: {reason}",
    sms: "{practice}: Ihre Datenschutzanfrage vom {received} wurde erledigt. {reason}",
  },
  requestPartiallyGranted: {
    subject: "Unsere Antwort auf Ihre Datenschutzanfrage",
    body: "Wir haben Ihrem am {received} eingegangenen Antrag auf {type} teilweise entsprochen. Unsere Antwort und die Gründe: {reason}. Wenn Sie nicht einverstanden sind, können Sie Beschwerde bei der italienischen Datenschutzbehörde (Garante per la protezione dei dati personali, www.garanteprivacy.it) einlegen oder den Rechtsweg beschreiten.",
    sms: "{practice}: Ihrer Datenschutzanfrage vom {received} wurde teilweise entsprochen. Gründe: {reason}. Beschwerde beim Garante (garanteprivacy.it) oder Klage möglich.",
  },
  requestRefused: {
    subject: "Unsere Antwort auf Ihre Datenschutzanfrage",
    body: "Wir können Ihrem am {received} eingegangenen Antrag auf {type} aus folgenden Gründen nicht entsprechen: {reason}. Wenn Sie nicht einverstanden sind, können Sie Beschwerde bei der italienischen Datenschutzbehörde (Garante per la protezione dei dati personali, www.garanteprivacy.it) einlegen oder den Rechtsweg beschreiten.",
    sms: "{practice}: Wir können Ihrer Datenschutzanfrage vom {received} nicht entsprechen. Gründe: {reason}. Beschwerde beim Garante (garanteprivacy.it) oder Klage möglich.",
  },
  restrictionLifted: {
    subject: "Die Einschränkung Ihrer Daten wird aufgehoben",
    body: "Am {since} wurde die Verarbeitung Ihrer Daten bei {practice} eingeschränkt. Diese Einschränkung wird nun aufgehoben, sodass die Praxis Ihre Daten wieder verwenden darf, zum Beispiel um Ihnen Terminerinnerungen zu senden. Wenn Sie Fragen haben oder meinen, dass sie fortbestehen sollte, wenden Sie sich bitte an die Praxis.",
    sms: "{practice}: Die seit {since} bestehende Einschränkung Ihrer Daten wird aufgehoben. Bei Fragen wenden Sie sich an uns.",
  },

  ownerDeadline7: {
    subject: "Datenschutzanfrage in 7 Tagen fällig",
    body: "Ein Antrag auf {type}, den {practice} am {received} erhalten hat, muss spätestens am {due} beantwortet werden. Öffnen Sie sie im Dashboard, um sie zu erledigen oder, falls Sie wirklich mehr Zeit benötigen, die Frist mit Begründung zu verlängern.",
    cta: "Anfrage öffnen",
  },
  ownerDeadline2: {
    subject: "Datenschutzanfrage in 2 Tagen fällig",
    body: "Ein Antrag auf {type}, den {practice} am {received} erhalten hat, muss spätestens am {due} beantwortet werden. Eine verspätete Antwort verstößt gegen Art. 12 Abs. 3 DSGVO: Bitte erledigen Sie sie jetzt.",
    cta: "Anfrage öffnen",
  },

  subprocessorsChanged: {
    subject: "Die Liste der Unterauftragsverarbeiter von Sorriso hat sich geändert",
    body: "Sorriso hat die Liste der Unterauftragsverarbeiter aktualisiert, die Daten von {practice} verarbeiten (Version {version}, gültig ab {effective}). Bitte prüfen Sie sie und akzeptieren Sie sie im Dashboard. Wenn Sie einer Änderung widersprechen, schreiben Sie innerhalb von 30 Tagen an {email}: Wir suchen gemeinsam mit Ihnen nach einer Lösung, und falls es keine gibt, können Sie den Vertrag ohne Vertragsstrafe beenden.",
    cta: "Liste prüfen",
  },

  closureRequested: {
    subject: "Ihr Sorriso-Konto wird geschlossen",
    body: "Wir haben am {date} den Antrag erhalten, das Konto von {practice} zu schließen. Die Online-Buchung wurde beendet, und die Praxis erscheint nicht mehr in der Suche. Sie können alle Ihre Daten bis {purge} herunterladen; an diesem Tag werden sie endgültig gelöscht. Bis dahin können Sie die Schließung im Dashboard rückgängig machen.",
    cta: "Ihre Daten herunterladen",
  },
  closureCancelled: {
    subject: "Kontoschließung abgebrochen",
    body: "Die Schließung des Kontos von {practice} wurde abgebrochen, und es werden keine Daten gelöscht. Die Online-Buchung über Ihre eigene Buchungsseite, Ihr Widget und Ihre Links funktioniert wieder. Die Praxis bleibt in der Sorriso-Suche verborgen, bis Sie sie in den Einstellungen wieder freischalten.",
  },
  closureCertificate: {
    subject: "Löschbestätigung: {practice}",
    body: "Am {date} haben wir die Daten von {practice} wie im Auftragsverarbeitungsvertrag vereinbart endgültig aus den Systemen von Sorriso gelöscht. Verschlüsselte Sicherungskopien, die sie noch enthalten, laufen am {backups} ab und werden dann überschrieben. Die Bestätigung führt auf, was gelöscht wurde.",
    cta: "Bestätigung ansehen",
  },

  footer: {
    rights: "Sie erhalten diese Nachricht, weil Sie Ihre Datenschutzrechte ausgeübt haben.",
    staff: "Sie erhalten diese Nachricht als Inhaber einer Praxis, die Sorriso nutzt.",
  },
} satisfies DeepPartial<Messages["privacyAdminEmails"]>;
