/**
 * German translation of the consent and objection texts. ITALIAN IS AUTHORITATIVE (it/consents.ts);
 * this file was translated from the English version and checked against the Italian one. Draft:
 * a DPO or privacy lawyer must review it before go-live (docs/i18n/glossary-de.md, "Needs lawyer
 * review"). Any change needs a new CONSENT_TEXT_VERSION.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  platform_booking_art9: {
    title: "Buchung über Sorriso",
    label:
      "Ich willige ein, dass Sorriso die Daten zu meiner Buchung, die Rückschlüsse auf meine Gesundheit zulassen können, verarbeitet, um sie an die gewählte Praxis weiterzuleiten und Erinnerungen und Änderungen zu verwalten.",
    description:
      "Nur erforderlich, wenn Sie über die Suchseiten von Sorriso buchen: Für diesen Dienst ist Sorriso eigenständiger Verantwortlicher (Art. 9 Abs. 2 lit. a DSGVO). Sie können Ihre Einwilligung jederzeit im Datenschutz-Center widerrufen. Sorriso beendet dann die eigene Verarbeitung, während die Praxis die Daten behält, die sie für Ihre Behandlung benötigt. Der Widerruf berührt nicht die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung. Wenn Sie nicht einwilligen möchten, können Sie direkt bei der Praxis buchen.",
  },
  whatsapp_channel: {
    title: "WhatsApp-Nachrichten",
    label: "Ich bin einverstanden, Nachrichten zu meinen Terminen über WhatsApp zu erhalten.",
    description:
      "WhatsApp wird von Meta betrieben. Die Nachrichten werden über Twilio versendet und können in den Vereinigten Staaten verarbeitet werden, auf Grundlage des EU-US Data Privacy Framework und von Standardvertragsklauseln. Meta kann erkennen, dass Sie mit dieser Praxis in Kontakt stehen. Sie können jederzeit zu SMS oder E-Mail zurückwechseln.",
  },
  sms_channel: {
    title: "SMS-Nachrichten",
    label: "Senden Sie mir Terminbestätigungen und Erinnerungen per SMS.",
    description:
      "Diese Nachrichten sind Teil des Buchungsdienstes und enthalten nur das Nötigste: Praxis, Datum, Uhrzeit und einen Link. Sie können sie jederzeit abbestellen, indem Sie mit STOP antworten oder Ihre Einstellungen ändern.",
  },
  email_channel: {
    title: "E-Mails",
    label: "Senden Sie mir Terminbestätigungen und Erinnerungen per E-Mail.",
    description:
      "Diese E-Mails sind Teil des Buchungsdienstes. Sie können sie jederzeit über den Abmeldelink in jeder E-Mail oder in Ihren Einstellungen abbestellen.",
  },
  feedback_request: {
    title: "Einladungen zum Feedback",
    label: "Senden Sie mir nach dem Besuch eine kurze Einladung, Feedback zu geben.",
    description:
      "Sie erhalten einige Tage nach dem Termin eine einzige Nachricht. Feedback zu geben ist freiwillig. Sie können diese Einwilligung jederzeit widerrufen.",
  },
  review_publication: {
    title: "Veröffentlichung meiner Bewertung",
    label:
      "Ich willige ein, dass diese Bewertung auf Sorriso und auf der Seite von {practice} veröffentlicht wird. Daraus geht hervor, dass ich einen Termin bei {practitioner} hatte. Ich kann sie jederzeit im Datenschutz-Center löschen.",
    description:
      "Standardmäßig erscheint Ihre Bewertung als 'Verifizierter Patient'. Machen Sie keine Angaben zu Ihrer Gesundheit: Bewertungen, die solche Angaben enthalten, werden vor der Veröffentlichung geprüft. Wenn Sie Ihre Einwilligung widerrufen, wird die Bewertung entfernt.",
  },
  marketing: {
    title: "Neuigkeiten und Angebote",
    label: "Ich möchte Neuigkeiten und Angebote von {practice} erhalten.",
    description:
      "Freiwillig: nicht erforderlich, um zu buchen oder behandelt zu werden. Sie können Ihre Einwilligung jederzeit über jede Nachricht oder im Datenschutz-Center widerrufen. Die Einwilligung erlischt nach 24 Monaten ohne Kontakt.",
  },
  adaptive_reminders: {
    title: "Angepasste Erinnerungen",
    label: "Passen Sie Zeitpunkt und Anzahl meiner Erinnerungen an meine bisherigen Termine an.",
    description:
      "Die Praxis kann Ihnen eine zusätzliche Erinnerung senden, wenn ein Termin anhand Ihrer bisherigen Termine eher versäumt werden könnte. Dies ist ein Profiling auf Grundlage des berechtigten Interesses und schränkt Ihre Möglichkeit zu buchen niemals ein. Sie können jederzeit widersprechen: Sie erhalten dann die Standarderinnerungen.",
  },
  no_show_tracking: {
    title: "Verlauf versäumter Termine",
    label: "Die Praxis darf Termine erfassen, zu denen ich nicht erscheine.",
    description:
      "Versäumte Termine der letzten 24 Monate werden gezählt, um den Terminplan zu organisieren und Ihnen Unterstützung anzubieten, etwa eine zusätzliche Erinnerung. Dadurch werden Sie niemals am Buchen gehindert. Sie können jederzeit widersprechen.",
  },
  recalls: {
    title: "Erinnerungen an Kontrolltermine",
    label: "Erinnern Sie mich, wenn mein Zahnarzt eine Kontrolluntersuchung empfiehlt.",
    description:
      "Erinnerungen werden nur gesendet, wenn Ihr Zahnarzt für Sie ein Kontrollintervall festgelegt hat. Jede Erinnerung enthält eine Möglichkeit, sie abzubestellen. Sie können jederzeit widersprechen.",
  },
} satisfies DeepPartial<Messages["consents"]>;
