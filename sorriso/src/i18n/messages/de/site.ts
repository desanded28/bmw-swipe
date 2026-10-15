import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "{app}: Zahnarzttermine online buchen",
    description:
      "Finden Sie einen Zahnarzt in Ihrer Nähe, sehen Sie freie Termine in Echtzeit und buchen Sie in Sekunden. Erinnerungen per SMS oder E-Mail: mit einem Tippen bestätigen oder verschieben.",
  },
  header: {
    findDentist: "Zahnarzt finden",
    forPractices: "Für Praxen",
    api: "API",
    login: "Praxis-Login",
    bookNow: "Jetzt buchen",
  },
  footer: {
    tagline: "Zahnarzttermine online buchen, mit Verfügbarkeit in Echtzeit. Erinnerungen, die Patienten mit einem Wort beantworten.",
    patients: "Patienten",
    findDentist: "Zahnarzt finden",
    emergency: "Zahnärztlicher Notfall",
    cleaning: "Professionelle Zahnreinigung",
    privacyCenter: "Ihre Daten (Datenschutz-Center)",
    practices: "Praxen",
    features: "Funktionen",
    createPractice: "Praxis anlegen",
    apiWidget: "Buchungs-API und Widget",
    legal: "Rechtliches",
    privacy: "Datenschutzhinweise",
    cookies: "Cookies",
    terms: "Nutzungsbedingungen",
    dpa: "Auftragsverarbeitungsvertrag",
    subprocessors: "Unterauftragsverarbeiter",
    accessibility: "Barrierefreiheit",
    reviewPolicy: "Bewertungsrichtlinie",
    ranking: "So werden Ergebnisse sortiert",
    copyright: "© {year} {app}",
    demo: "Demoprojekt: Die gezeigten Praxen und Personen sind frei erfunden.",
  },
  notFound: {
    code: "Fehler 404",
  },
  home: {
    badge: "Nur verifizierte Bewertungen echter Besuche",
    heroTitle: "Der Zahnarzt, den Sie brauchen, <em>gebucht in 30 Sekunden.</em>",
    heroBody:
      "Freie Termine in Echtzeit von Praxen in Ihrer Nähe. Ohne Konto, ohne Warteschleife. Sie erhalten eine Erinnerung per SMS oder E-Mail: Antworten Sie <b>JA</b> zum Bestätigen oder verschieben Sie den Termin mit einem Tippen.",
    quickLabel: "Beliebte Behandlungen",
    quick: {
      checkup: "Kontrolle",
      hygiene: "Zahnreinigung",
      orthodontics: "Aligner und Zahnspangen",
      pediatric: "Kinder",
      emergency: "Notfall",
    },
    soonestTitle: "Am schnellsten verfügbar",
    soonestBody: "Termin wählen und fertig: Diese Zeiten sind tagesaktuell.",
    seeAll: "Alle Zahnärzte ansehen",
    how: {
      title: "So funktioniert es",
      step: "Schritt {n}",
      findTitle: "Echte freie Termine finden",
      findBody:
        "Vergleichen Sie Zahnärzte nach Behandlung, Preis, verifizierten Bewertungen und nächstem freien Termin, an jedem Standort, an dem sie arbeiten.",
      bookTitle: "Ohne Konto buchen",
      bookBody:
        "Wählen Sie einen Termin und geben Sie Ihren Namen und Ihre Nummer an. Sie erhalten sofort eine Bestätigung mit Kalendereinladung.",
      confirmTitle: "Per Antwort bestätigen",
      confirmBody:
        "Wir erinnern Sie per SMS oder E-Mail. Antworten Sie JA zum Bestätigen oder NEIN zum Absagen, oder verschieben Sie den Termin mit einem Tippen.",
    },
    citiesTitle: "Zahnärzte nach Stadt",
    cityLink: "Zahnärzte in {city}",
    cityCount: p({ one: "{count} Praxis", other: "{count} Praxen" }),
    practices: {
      kicker: "Für Zahnarztpraxen",
      title: "Weniger Terminausfälle. Alle Standorte in einem Kalender.",
      body: "Terminplanung über mehrere Standorte mit Behandlungsstühlen, Bestätigungen per SMS mit Antwortfunktion, eine automatische Warteliste, die Absagen wieder auffüllt, und eine offene Buchungs-API.",
      features: "Funktionen ansehen",
      demo: "Demo-Dashboard ausprobieren",
      offices: "Mehrere Standorte, Behandler und Behandlungsstühle, ohne Doppelbuchungen zwischen Standorten",
      rules: "Erinnerungsregeln pro Praxis: E-Mail 48 Stunden vorher, SMS 24 Stunden vorher, WhatsApp, wenn Sie es aktivieren",
      replies: "Patienten antworten mit JA oder NEIN, und der Kalender aktualisiert sich selbst",
      waitlist: "Abgesagte Termine werden innerhalb von Sekunden der Warteliste angeboten",
    },
  },
  forClinics: {
    metaTitle: "Für Zahnarztpraxen",
    metaDescription:
      "Online-Buchung, ein Kalender für mehrere Standorte und Erinnerungen, auf die Patienten antworten, mit eingebautem Datenschutz. Exportieren Sie jederzeit alle Daten.",
    kicker: "Für Zahnarztpraxen",
    title: "Volle Behandlungsstühle. Kein Hinterhertelefonieren mehr.",
    body: "Online-Buchung, ein Kalender für mehrere Standorte und Erinnerungen, auf die Patienten wirklich antworten, an einem Ort.",
    signup: "Praxis anlegen",
    demo: "Demo-Dashboard öffnen",
    featuresTitle: "Funktionen",
    features: {
      offices: {
        title: "Alle Standorte, ein Kalender",
        body: "Behandler arbeiten an verschiedenen Tagen an verschiedenen Standorten. Die Verfügbarkeit wird pro Standort berechnet, und niemand kann standortübergreifend doppelt gebucht werden.",
      },
      chairs: {
        title: "Behandlungsstühle, Pufferzeiten und Schließtage",
        body: "Buchungen reservieren automatisch einen Behandlungsstuhl. Nachbereitungszeit pro Behandlung, Feiertage, Wartung und persönliche Abwesenheiten blockieren die Verfügbarkeit.",
      },
      twoWay: {
        title: "SMS-Erinnerungen mit Antwortfunktion",
        body: "Erinnerungen bitten Patienten, in ihrer eigenen Sprache mit JA oder NEIN zu antworten. Antworten bestätigen oder sagen sofort ab; alles andere wird für den Empfang markiert.",
      },
      rules: {
        title: "Erinnerungsregeln in Ihrer Hand",
        body: "Zum Beispiel: E-Mail 48 Stunden vorher, SMS 24 Stunden vorher, eine kurze SMS 2 Stunden vorher. WhatsApp nur, wenn Sie es aktivieren und der Patient zustimmt.",
      },
      waitlist: {
        title: "Absagen füllen sich von selbst",
        body: "Wird ein Termin frei, wird er innerhalb von Sekunden passenden Patienten auf der Warteliste angeboten. Wer zuerst bucht, bekommt ihn, ganz ohne Telefonate.",
      },
      board: {
        title: "Bestätigungsübersicht",
        body: "Morgen auf einen Blick: bestätigt, ausstehend und wer einen Anruf braucht, mit Angabe des Grundes. Sie bietet nur Unterstützung: Niemandem wird eine Buchung verweigert.",
      },
      reviews: {
        title: "Nur verifizierte Bewertungen",
        body: "Nur Patienten mit einem abgeschlossenen Besuch können bewerten, und nur mit ihrer Einwilligung. Praxen können antworten, aber keine Bewertungen verbergen.",
      },
      api: {
        title: "Offene Buchungs-API und Widget",
        body: "Binden Sie die Buchung mit einem einzigen Script-Tag auf Ihrer Website ein, synchronisieren Sie über die REST-API mit Ihrer Praxissoftware und abonnieren Sie Kalender-Feeds.",
      },
      roles: {
        title: "Rollen für Ihr Team",
        body: "Inhaber, Administration, Empfang und Behandler sehen jeweils, was sie brauchen. Jeder Zugriff auf eine Patientenakte wird protokolliert.",
      },
      privacy: {
        title: "Datenschutz als Standard",
        body: "Nachrichten und Kalendereinträge nennen die Behandlung nicht. Patienten verwalten ihre Daten und Einwilligungen in einem Datenschutz-Center, ohne Konto.",
      },
      languages: {
        title: "Acht Sprachen",
        body: "Patienten buchen und erhalten Erinnerungen auf Italienisch, Englisch, Deutsch, Französisch, Spanisch, Portugiesisch, Rumänisch oder Polnisch.",
      },
    },
    flow: {
      title: "So funktioniert eine Bestätigung",
      book: "Der Patient bucht online (oder Sie buchen für ihn am Empfang) und erhält eine Bestätigung mit Kalendereinladung.",
      email: "48 Stunden vorher: eine E-Mail mit der Bitte, per Klick zu bestätigen.",
      text: "24 Stunden vorher: eine SMS mit der Bitte, mit JA zu bestätigen oder mit NEIN abzusagen.",
      reply: "JA färbt den Termin in Ihrem Kalender grün. NEIN sagt ihn ab und bietet die Zeit der Warteliste an.",
      other: "Alles andere (\"Kann ich 30 Minuten später kommen?\") landet in Ihrem Posteingang und wird im Kalender markiert.",
    },
    sms: {
      sender: "Studio Bianchi",
      reminder:
        "Studio Bianchi: Erinnerung an Ihren Termin am Mi., 15. Okt. um 10:30, Via Torino 42, Milano. Antworten Sie JA zum Bestätigen, NEIN zum Absagen. Details: sorriso.example/a/… Abmelden: STOP",
      reply: "JA",
      thanks: "Danke! Ihr Termin am Mi., 15. Okt. um 10:30 ist bestätigt. Bis bald!",
      caption: "Eine Erinnerung, wie der Patient sie erhält: Die Behandlung wird nie genannt.",
    },
    noLockIn: "Ihre Daten bleiben Ihre Daten: Exportieren Sie jederzeit alles, ohne Anbieterbindung.",
    apiDocs: "API-Dokumentation lesen",
  },
  developers: {
    metaTitle: "Buchungs-API und Widget",
    metaDescription:
      "Binden Sie die Online-Buchung auf der Website Ihrer Praxis ein, buchen Sie über die REST-API und synchronisieren Sie mit Ihrer Praxissoftware.",
    title: "Buchungs-API und Widget",
    intro:
      "Alles, was die Website {host} tut, läuft über diese API. Ihre Integration kann also alles, was ein Patient kann. JSON über HTTPS, CORS aktiviert, Zeiten in ISO 8601 (UTC).",
    codeSample: "Codebeispiel",
    attribute: "Attribut",
    field: "Feld",
    description: "Beschreibung",
    widget: {
      title: "1. Buchung auf Ihrer Website einbinden",
      button: "Eine schwebende Schaltfläche \"Termin buchen\", die das Buchungsformular in einem Dialog öffnet:",
      inline: "Oder eingebettet in ein Element Ihrer Seite, hier auf Deutsch und für einen Behandler:",
      attributesCaption: "Widget-Attribute",
      attributes: {
        "data-clinic":
          "Pflichtangabe. Die Adresse Ihrer Praxis auf Sorriso (der Slug). Ohne sie zeigt das Script nichts an.",
        "data-lang":
          "Die Sprache des Formulars und der Nachrichten an den Patienten. Ohne Angabe: die Sprache Ihrer Seite (ihr lang-Attribut), dann die des Browsers, dann Italienisch.",
        "data-target":
          "Ein CSS-Selektor: Das Formular wird in diesem Element statt als schwebende Schaltfläche angezeigt. Passt beim Ausführen des Scripts kein Element, wird nichts angezeigt.",
        "data-practitioner": "Öffnet das Formular für einen Behandler (seine ID).",
        "data-service": "Wählt eine Behandlung vor (ihre ID).",
        "data-location": "Wählt einen Standort vor (seine ID).",
        "data-label": "Der Text der schwebenden Schaltfläche. Ohne Angabe: \"Termin buchen\" in der gewählten Sprache.",
        "data-color": "Die Farbe der schwebenden Schaltfläche, als CSS-Farbe.",
        "data-events": "Aktiviert das Ereignis sorriso:booked auf Ihrer Seite, wenn eine Buchung abgeschlossen wird.",
        "data-include-id": "Mit data-events: Die Termin-ID wird in das Ereignis aufgenommen.",
      },
      languages: "Sprachwerte (<code>data-lang</code>, <code>patient.locale</code>):",
      eventsTitle: "Buchungsereignisse",
      events:
        "Mit <code>data-events</code> erhält Ihre Seite ein <code>sorriso:booked</code>-Ereignis, wenn eine Buchung abgeschlossen wird. Es enthält keine personenbezogenen Daten, die Termin-ID nur mit <code>data-include-id</code>. Nachrichten werden nur an den eigenen Origin Ihrer Seite gesendet.",
      eventsWarning:
        "Leiten Sie dieses Ereignis nicht an Werbe- oder Analysetools weiter (etwa Meta- oder Google-Tags): Es verrät, dass ein Besucher einen Zahnarzttermin gebucht hat, und das sind Gesundheitsdaten. Nach dem Auftragsverarbeitungsvertrag dürfen Sie es nur verwenden, um Ihre eigene Bestätigung anzuzeigen.",
      origins:
        "Damit andere Websites Ihr Buchungsformular nicht einbetten können, tragen Sie die Adressen Ihrer Website unter Dashboard, Datenschutzeinstellungen, Zugelassene Websites ein. Anderswo zeigt das Widget dann nur einen Link, der die Buchungsseite in einem neuen Tab öffnet. Die Prüfung beruht auf der Adresse, die die Browser Ihrer Besucher mit dem Frame senden: Das Widget fordert sie an, und wenn Sie Ihren eigenen iframe schreiben, geben Sie ihm kein <code>referrerpolicy=\"no-referrer\"</code>.",
    },
    booking: {
      title: "2. Über die API buchen",
      fieldsCaption: "Buchungsfelder",
      context:
        "Wer für die Buchungsdaten verantwortlich ist, entscheidet der Server, nie ein Feld, das Sie senden: Buchungen über Ihren API-Schlüssel, Ihr Widget oder für Ihre Praxis signierte Links sind Ihre (Sorriso verarbeitet sie in Ihrem Auftrag); Buchungen, die auf den eigenen Seiten von Sorriso beginnen, erfordern die Einwilligung des Patienten gegenüber Sorriso.",
      errors:
        "Fehler haben immer dieselbe Form: ein <code>error</code>-Objekt mit <code>code</code> und <code>message</code>. Ein vergebener Termin liefert 409 mit <code>practitioner_busy</code>, <code>no_room</code>, <code>time_off</code>, <code>outside_hours</code> oder <code>too_soon</code>; ungültige Felder liefern 422 mit einer <code>issues</code>-Liste, eine verletzte Datenschutz- oder Altersregel 422 mit eigenem Code und <code>field</code>.",
    },
    fields: {
      locale:
        "Die Sprache der Nachrichten an den Patienten: <code>it</code>, <code>en</code>, <code>de</code>, <code>fr</code>, <code>es</code>, <code>pt</code>, <code>ro</code> oder <code>pl</code>.",
      phoneCountry:
        "Die Ländervorwahl einer ohne Vorwahl eingegebenen Nummer, etwa <code>39</code> oder <code>49</code>. Nummern, die mit + oder 00 beginnen, behalten ihre eigene.",
      preferredChannel:
        "<code>sms</code>, <code>email</code> oder <code>whatsapp</code>. WhatsApp nur, wenn die Praxis es aktiviert hat, und mit <code>privacy.whatsapp</code> auf true.",
      privacy:
        "Ohne API-Schlüssel erforderlich. <code>noticeVersion</code> (die angezeigte Version der Datenschutzhinweise), <code>locale</code> und die Entscheidungen des Patienten: <code>platformConsent</code>, <code>whatsapp</code>, <code>feedback</code>, <code>marketing</code>. Nicht angekreuzte Kästchen sind false.",
      relation:
        "Für wen der Termin ist: <code>bookedFor</code> ist <code>self</code>, <code>minor</code> (mit <code>guardian</code>: Name, Beziehung, Telefon oder E-Mail) oder <code>other_adult</code>.",
      practiceRef:
        "Die Praxiskennung aus einem Link, den Ihre Praxis veröffentlicht hat (?ref=). Ohne sie gilt die Buchung als auf Sorriso vorgenommen.",
      fundId:
        "Optional: der Gesundheitsfonds oder Versicherer, den der Patient nutzen wird. Wird nur gespeichert, wenn die Praxis diesen Fonds führt.",
    },
    sync: {
      title: "3. Mit Ihrer Praxissoftware synchronisieren",
      keys: "Erstellen Sie unter Dashboard, Einstellungen, API einen API-Schlüssel, wählen Sie seine Berechtigungen und senden Sie ihn als Bearer-Token. Schlüssel können ablaufen und jederzeit widerrufen werden.",
      scopesTitle: "Berechtigungen (Scopes)",
    },
    scopes: {
      "appointments:read": "Termine und die von ihnen genutzten Ressourcen lesen.",
      "appointments:write":
        "Termine anlegen, verschieben und absagen, Bestätigungen, Nichterscheinen und Abschlüsse erfassen.",
      "patients:read": "Namen und Kontaktdaten von Patienten lesen.",
      "patients:write": "Patienten anlegen und aktualisieren.",
      "notes:read":
        "Die Notizen lesen, die Patienten und Mitarbeitende zu Terminen geschrieben haben. Nur klinischer Software gewähren.",
      "patients:erase": "Die Löschung der Daten eines Patienten beantragen (wird als Datenschutzanfrage bearbeitet).",
    },
    export: {
      title: "4. Ihre Daten exportieren",
      body: "Eine Praxis kann jederzeit alle ihre Daten als JSON, CSV und FHIR R4 exportieren. Die Formate sind im <link>Export-Schema</link> beschrieben.",
    },
    reference: "Referenz",
    groups: {
      public: "Öffentliche Buchung (von der Website und dem Widget genutzt)",
      patient: "Patienten-Selfservice (Token aus dem Link des Patienten)",
      partner: "Partner-API (Ihre Praxissoftware)",
      infra: "Infrastruktur",
    },
    auth: {
      public: "öffentlich",
      token: "Token",
      apiKey: "API-Schlüssel",
      secret: "Secret",
    },
    endpoints: {
      clinic: "Praxisprofil, Standorte, Behandler (mit Behandlungen und Standorten) und buchbare Behandlungen.",
      availability:
        "Freie Termine pro Tag. Ohne practitionerId: \"nächster freier Termin\", verteilt auf alle Behandler. Liefert nextAvailable, wenn der Zeitraum leer ist.",
      book: "Einen Termin buchen. Wird in einer Schreibtransaktion erneut geprüft: Zwei Patienten können nie denselben Termin erhalten.",
      waitlist:
        "Auf die Warteliste für eine Behandlung setzen, optional für einen Behandler oder Standort, einen Zeitraum und eine Tageszeit.",
      appointment: "Der Termin und was der Patient noch tun kann (canCancel, canReschedule).",
      confirm: "Teilnahme bestätigen.",
      cancel: "Absagen (der Termin wird der Warteliste angeboten). Optionales Feld im Body: reason.",
      reschedule: "Auf einen anderen freien Termin verschieben. Felder im Body: start sowie optional practitionerId und locationId.",
      resources: "Standorte, Behandlungsstühle, Behandler (mit Arbeitszeiten) und Behandlungen, um IDs zuzuordnen.",
      list: "Termine auflisten. Verwenden Sie updatedSince für eine inkrementelle Synchronisierung.",
      create:
        "Einen Termin mit Empfangsrechten anlegen (eigene Dauer, außerhalb der Arbeitszeiten, bestehende Patienten-ID).",
      update: "Verschieben, absagen, als abgeschlossen oder nicht erschienen markieren oder eine telefonische Bestätigung erfassen.",
      twilio: "Eingehende SMS- und WhatsApp-Antworten (von Twilio signiert). Antwortet direkt mit TwiML.",
      twilioStatus: "Zustellberichte (zugestellt, fehlgeschlagen).",
      cron: "Fällige Erinnerungen senden. Alle 1 bis 5 Minuten mit Authorization: Bearer $CRON_SECRET aufrufen.",
      ics: "Abonnierbarer Kalender-Feed eines Behandlers (Google, Apple, Outlook).",
    },
  },
} satisfies DeepPartial<Messages["site"]>;
