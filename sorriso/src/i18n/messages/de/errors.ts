import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  network: "Der Server ist nicht erreichbar. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.",
  checkFields: p({
    one: "Bitte korrigieren Sie das markierte Feld.",
    other: "Bitte korrigieren Sie die {count} markierten Felder.",
  }),
  slotTaken:
    "Leider hat gerade jemand diesen Termin gebucht. Bitte wählen Sie einen anderen: Ihre Eingaben bleiben erhalten.",
  slotsLoadFailed: "Die verfügbaren Termine konnten nicht geladen werden.",
  reload: "Seite neu laden",
  fields: {
    required: "Pflichtfeld",
    contactRequired: "Geben Sie eine Handynummer oder eine E-Mail-Adresse an",
    phoneForText: "Erforderlich für Erinnerungen per SMS oder WhatsApp",
    emailForEmail: "Erforderlich für Erinnerungen per E-Mail",
    invalidEmail: "Geben Sie eine gültige E-Mail-Adresse ein, z. B. name@example.com",
    invalidPhone: "Geben Sie eine gültige Handynummer ein",
    invalidDate: "Geben Sie ein gültiges Datum ein",
    invalidCountryCode: "Wählen Sie eine Ländervorwahl",
    consentRequired: "Bitte erteilen Sie Ihre Einwilligung, um fortzufahren",
    whatsappRequired: "Bitte bestätigen Sie, um fortzufahren",
    dateOrder: "Das Enddatum darf nicht vor dem Startdatum liegen",
    tooLong: "Diese Eingabe ist zu lang",
    invalid: "Bitte prüfen Sie dieses Feld",
  },
  api: {
    practitioner_busy: "Dieser Termin wurde gerade vergeben. Bitte wählen Sie einen anderen.",
    no_room: "Dieser Termin wurde gerade vergeben. Bitte wählen Sie einen anderen.",
    time_off: "Dieser Termin ist nicht mehr verfügbar. Bitte wählen Sie einen anderen.",
    outside_hours: "Dieser Termin ist nicht mehr verfügbar. Bitte wählen Sie einen anderen.",
    too_soon: "Dieser Termin liegt zu kurzfristig für eine Online-Buchung. Bitte wählen Sie einen späteren oder rufen Sie die Praxis an.",
    too_far: "Dieser Termin liegt zu weit in der Zukunft für eine Online-Buchung. Bitte wählen Sie einen früheren.",
    in_past: "Dieser Termin liegt bereits in der Vergangenheit. Bitte wählen Sie einen anderen.",
    not_offered: "Diese Behandlung wird bei diesem Behandler nicht angeboten.",
    not_found: "Wir konnten diese Praxis oder diesen Termin nicht finden. Der Link ist möglicherweise veraltet.",
    not_allowed: "Dieser Termin kann nicht mehr online geändert werden. Bitte wenden Sie sich an die Praxis.",
    not_accepting: "Diese Praxis nimmt derzeit keine Online-Buchungen an. Bitte wenden Sie sich direkt an die Praxis.",
    privacy_required: "Bitte lesen Sie die Datenschutzinformationen und treffen Sie Ihre Auswahl, um fortzufahren.",
    validation_error: "Einige Angaben sind ungültig. Bitte prüfen Sie die markierten Felder.",
    rate_limited: "Zu viele Versuche. Bitte warten Sie einige Minuten und versuchen Sie es dann erneut.",
    internal_error: "Bei uns ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.",
    forbidden: "Das ist nicht erlaubt.",
    unauthorized: "Das ist nicht erlaubt.",
    invalid: "Diese Buchung kann so nicht angenommen werden. Bitte prüfen Sie Ihre Angaben.",
    platform_consent_required: "Um über Sorriso zu buchen, willigen Sie bitte in die Verarbeitung Ihrer Buchungsdaten ein.",
    whatsapp_consent_required: "Bitte bestätigen Sie, dass Sie Nachrichten über WhatsApp erhalten möchten.",
    whatsapp_unavailable: "Diese Praxis versendet keine WhatsApp-Nachrichten. Bitte wählen Sie SMS oder E-Mail.",
    guardian_required: "Patienten unter 14 Jahren müssen von einem Elternteil oder einem gesetzlichen Vertreter angemeldet werden.",
    birthdate_required: "Bitte geben Sie das Geburtsdatum des Patienten ein.",
    invalid_birthdate: "Bitte prüfen Sie das Geburtsdatum.",
    not_a_minor: "Der Patient ist am Tag des Termins 18 Jahre oder älter.",
    guardian_name_required: "Bitte geben Sie den Namen des Elternteils oder gesetzlichen Vertreters ein.",
    guardian_relation_required: "Bitte geben Sie an, ob Sie Elternteil oder gesetzlicher Vertreter sind.",
    guardian_contact_required:
      "Bitte geben Sie eine Telefonnummer oder eine E-Mail-Adresse des Elternteils oder gesetzlichen Vertreters ein.",
    other_adult_must_book_themselves:
      "Erwachsene buchen ihre Termine hier selbst. Sie können auch direkt bei der Praxis buchen.",
    other_adult_contact_required:
      "Bitte geben Sie die eigene Handynummer oder E-Mail-Adresse des Patienten ein, nicht Ihre: Darüber bestätigt er die Buchung.",
    notice_outdated:
      "Die Datenschutzinformationen wurden aktualisiert, seit Sie diese Seite geöffnet haben. Bitte laden Sie die Seite neu, um die neue Fassung zu lesen, und senden Sie das Formular dann erneut.",
  },
} satisfies DeepPartial<Messages["errors"]>;
