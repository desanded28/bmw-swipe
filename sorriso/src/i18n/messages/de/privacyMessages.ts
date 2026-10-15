/**
 * German privacy-center messages. Discreet: no treatment, practitioner or health detail. SMS:
 * straight quotes only, no ellipsis character.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  requestReceipt: {
    subject: "Wir haben Ihre Datenschutzanfrage erhalten",
    body: "{controller} hat Ihre Anfrage ({type}) am {date} erhalten. Sie erhalten spätestens am {due} eine Antwort. Falls bei einer komplexen Anfrage mehr Zeit nötig ist, werden Sie vor diesem Datum über die Gründe informiert.",
    sms: "{controller} hat Ihre Datenschutzanfrage erhalten ({type}). Antwort bis {due}.",
  },
  contactChangedPhone: {
    sms: "Die bei {practice} hinterlegte Handynummer wurde über das Sorriso-Datenschutz-Center geändert. Nicht Sie? Wenden Sie sich an die Praxis.",
  },
  contactChangedEmail: {
    subject: "Ihre Kontaktdaten wurden geändert",
    body: "Die bei {practice} hinterlegte E-Mail-Adresse wurde am {date} über das Sorriso-Datenschutz-Center geändert. Wenn Sie das nicht waren, wenden Sie sich bitte umgehend an die Praxis.",
  },
  bookedForYou: {
    subject: "Für Sie wurde ein Termin bei {practice} gebucht",
    body: "{booker} hat für Sie einen Termin bei {practice} am {when} gebucht. Die Praxis verwendet Ihre Daten, um den Termin zu verwalten. Hier erfahren Sie, wie Ihre Daten verarbeitet werden und welche Rechte Sie haben, unter anderem, wie Sie sie einsehen, berichtigen oder löschen lassen können.",
    cta: "Datenschutzhinweise lesen",
    sms: "{booker} hat für Sie einen Termin bei {practice} am {when} gebucht. Datenschutzhinweise: {url}",
  },
  confirmBooking: {
    subject: "Bitte bestätigen Sie den für Sie gebuchten Termin",
    body: "{booker} hat über Sorriso für Sie einen Termin bei {practice} am {when} gebucht. Nur Sie selbst können ihn bestätigen und der Verarbeitung der Buchung durch Sorriso zustimmen. Wenn Sie ihn nicht innerhalb von {hours} Stunden bestätigen, wird er storniert.",
    cta: "Bestätigen oder ablehnen",
    sms: "{booker} hat über Sorriso einen Termin bei {practice} für Sie gebucht. Bitte innerhalb von {hours} Std. bestätigen: {url}",
  },
  adultNotConfirmed: {
    subject: "Der von Ihnen gebuchte Termin wurde storniert",
    body: "Der Termin, den Sie für {name} bei {practice} am {when} gebucht haben, wurde storniert, weil {name} ihn nicht rechtzeitig bestätigt hat. Nur die Patientin oder der Patient selbst kann eine für sie oder ihn über Sorriso vorgenommene Buchung bestätigen und kann selbst erneut buchen.",
    sms: "Der Termin, den Sie für {name} bei {practice} am {when} gebucht haben, wurde storniert: {name} hat ihn nicht rechtzeitig bestätigt.",
  },
  requestTypes: {
    access: "Auskunft über Ihre Daten",
    rectification: "Berichtigung Ihrer Daten",
    erasure: "Löschung Ihrer Daten",
    restriction: "Einschränkung der Verarbeitung",
    portability: "Kopie Ihrer Daten zur Übertragung",
    objection: "Widerspruch gegen die Verarbeitung",
    consent_withdrawal: "Widerruf der Einwilligung",
  },
  footer: {
    privacyCenter: "Sie erhalten diese Nachricht aufgrund einer Anfrage im Sorriso-Datenschutz-Center.",
  },
} satisfies DeepPartial<Messages["privacyMessages"]>;
