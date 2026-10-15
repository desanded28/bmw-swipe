/**
 * German accessibility statement. The Italian version is authoritative; this text was translated
 * from the English one. Draft: to be reviewed by a lawyer before go-live (docs/i18n/glossary-de.md).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    title: "Erklärung zur Barrierefreiheit",
    description:
      "Wie barrierefrei die Website und der Buchungsdienst von {app} sind, ihre bekannten Einschränkungen und wie Sie eine Barriere melden können.",
  },
  title: "Erklärung zur Barrierefreiheit",
  translationNotice: "Dies ist eine Übersetzung. Im Fall von Abweichungen ist die <link>italienische Fassung</link> maßgeblich.",
  intro:
    "{provider} möchte, dass seine Website und sein Buchungsdienst für alle nutzbar sind, auch für Menschen, die einen Screenreader, nur die Tastatur, eine Bildschirmvergrößerung oder eine Sprachsteuerung verwenden.",
  legalBasis:
    "Diese Erklärung wird auf Grundlage des European Accessibility Act (Richtlinie (EU) 2019/882), in Italien umgesetzt durch das Gesetzesvertretende Dekret (D.Lgs.) 82/2022, sowie des Gesetzes Nr. 4/2004 veröffentlicht.",
  scope: {
    title: "Geltungsbereich dieser Erklärung",
    body: "Die öffentliche Website {host}: Suche, Praxis- und Behandlerseiten, die Buchungs- und Wartelistenformulare, die über Bestätigungen und Erinnerungen erreichbare Terminseite, das Datenschutz-Center, die rechtlichen Seiten und das Buchungs-Widget, das Praxen auf ihren eigenen Websites einbinden.",
  },
  status: {
    title: "Stand der Vereinbarkeit",
    body: "Wir gestalten und prüfen nach den Web Content Accessibility Guidelines (WCAG) 2.2, Konformitätsstufe AA. Die harmonisierte europäische Norm, auf die das Gesetz verweist, EN 301 549 v3.2.1, übernimmt WCAG 2.1 Stufe AA. Der Dienst ist teilweise mit WCAG 2.1 Stufe AA vereinbar: Die unter den bekannten Einschränkungen aufgeführten Teile erfüllen die Anforderungen noch nicht vollständig.",
  },
  features: {
    title: "Was wir tun",
    keyboard:
      "Die Website ist so gebaut, dass sie allein mit der Tastatur bedient werden kann, mit sichtbarem Fokus und einem Link, der direkt zum Hauptinhalt springt.",
    screenReader:
      "Die Seiten sind mit Überschriften und Landmarks gegliedert. Formularfelder haben Beschriftungen, und Fehler- und Statusmeldungen werden von Screenreadern angesagt.",
    steps:
      "Das Buchungsformular setzt den Fokus auf jeden neuen Schritt, behält Ihre Eingaben, wenn Sie zurückgehen, und erklärt jeden Fehler direkt neben dem betreffenden Feld.",
    contrast:
      "Texte und Bedienelemente erfüllen die Kontrastverhältnisse nach WCAG AA, und keine Information wird allein durch Farbe vermittelt.",
    motion: "Animationen werden ausgeschaltet, wenn Ihr Gerät reduzierte Bewegung anfordert.",
    zoom: "Die Seiten funktionieren bei 200 % Vergrößerung und auf kleinen Bildschirmen ohne seitliches Scrollen.",
    languages:
      "Die Website ist in acht Sprachen verfügbar, und jede Seite gibt ihre Sprache an, damit Screenreader sie richtig aussprechen.",
    help: "Die Kontaktdaten der Praxis stehen im Buchungsformular und auf Ihrer Terminseite an derselben Stelle.",
  },
  limitations: {
    title: "Bekannte Einschränkungen",
    practiceContent:
      "Von Praxen verfasste Texte (Behandlungsbeschreibungen, Lebensläufe von Behandlern) werden in der Sprache angezeigt, in der die Praxis sie geschrieben hat; diese kann von der Sprache der Seite abweichen.",
    dates:
      "Datumsfelder verwenden die eigene Datumsauswahl Ihres Browsers, deren Barrierefreiheit je nach Browser und Screenreader unterschiedlich ist. Sie können das Datum jederzeit auch eintippen.",
    maps: "Karten auf Praxisseiten sind nur eine visuelle Hilfe: Die Adresse wird immer auch als Text angegeben.",
    widget:
      "Wenn das Buchungs-Widget auf der Website einer Praxis eingebunden ist, liegt die Barrierefreiheit der umgebenden Seite in der Verantwortung der Praxis.",
    messages:
      "Erinnerungen per SMS sind reiner Text ohne Formatierung; ihre Links öffnen Seiten, die unter diese Erklärung fallen.",
    exports:
      "Datendownloads aus dem Datenschutz-Center (JSON, CSV) sind maschinenlesbare Dateien, keine zum Lesen gedachten Dokumente.",
    workaround:
      "Falls Sie eine dieser Einschränkungen am Buchen hindert, rufen Sie die Praxis an: Ihre Telefonnummer steht auf ihrer Seite und im Buchungsformular.",
  },
  preparation: {
    title: "Erstellung dieser Erklärung",
    body: "Diese Erklärung wurde am {date} im Wege einer Selbstbewertung erstellt, auf Grundlage automatisierter Prüfungen des Website-Codes, die bei jeder Änderung laufen (Beschriftungen, Fehlermeldungen, Fokusführung, Kontrastverhältnisse). Eine manuelle Prüfung allein mit der Tastatur und mit Screenreadern (NVDA mit Firefox unter Windows, VoiceOver mit Safari unter iOS) ist noch nicht abgeschlossen; wir aktualisieren diese Erklärung, sobald sie erfolgt ist. Zuletzt überprüft am {reviewed}.",
  },
  feedback: {
    title: "Feedback und Kontakt",
    body: "Wenn Sie auf eine Barriere stoßen oder Informationen dieser Website in einem anderen Format benötigen, schreiben Sie an <mail>{email}</mail>. Nennen Sie uns die Adresse der Seite und was passiert ist. Wir antworten innerhalb von 30 Tagen.",
    noEmail:
      "Wenn Sie auf eine Barriere stoßen oder Informationen dieser Website in einem anderen Format benötigen, kontaktieren Sie uns über die Angaben in den <link>Datenschutzhinweisen</link>. Nennen Sie uns die Adresse der Seite und was passiert ist. Wir antworten innerhalb von 30 Tagen.",
  },
  enforcement: {
    title: "Durchsetzungsverfahren",
    body: "Wenn Sie mit unserer Antwort nicht zufrieden sind oder innerhalb von 30 Tagen keine erhalten, können Sie dies der AgID (Agenzia per l'Italia Digitale) melden, der Behörde, die die digitale Barrierefreiheit in Italien überwacht, über das Formular unter <link>form.agid.gov.it</link>.",
  },
} satisfies DeepPartial<Messages["accessibility"]>;
