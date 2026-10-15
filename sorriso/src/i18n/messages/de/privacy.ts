/**
 * German privacy texts (booking forms, privacy center, appointment link). The first-layer notice
 * (booking.firstLayer) is a legal text: it needs lawyer review (docs/i18n/glossary-de.md).
 */
import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  booking: {
    heading: "Datenschutz",
    firstLayer: {
      practice:
        "{controller} verwendet Ihre Angaben, um diesen Termin zu buchen und zu verwalten und Ihnen Bestätigungen und Erinnerungen zu senden.",
      practiceWaitlist:
        "{controller} verwendet Ihre Angaben, um Sie zu kontaktieren, wenn ein früherer Termin frei wird.",
      marketplace:
        "Sorriso leitet Ihre Buchung an die Praxis weiter und verwaltet Erinnerungen und Änderungen als eigenständiger Verantwortlicher, mit Ihrer untenstehenden Einwilligung.",
      basis:
        "Dies ist für die von Ihnen gewünschte Behandlung erforderlich (Art. 6 Abs. 1 lit. b und Art. 9 Abs. 2 lit. h DSGVO). Freiwillige Optionen erfordern Ihre Einwilligung, die Sie jederzeit widerrufen können.",
      rights:
        "Sie können Ihre Daten jederzeit im <link>Datenschutz-Center</link> einsehen, berichtigen, herunterladen oder löschen.",
      otherAdult:
        "Sie buchen für eine andere Person: Wir senden ihr an die Handynummer oder E-Mail-Adresse, die Sie als ihre angeben, eine Nachricht über diese Buchung mit den Datenschutzhinweisen der Praxis (Art. 14 DSGVO). Bitte informieren Sie sie auch selbst.",
      otherAdultWaitlist:
        "Sie stellen die Anfrage für eine andere Person: Bitte informieren Sie sie über diese Anfrage und weisen Sie sie auf die untenstehenden Datenschutzhinweise der Praxis hin (Art. 14 DSGVO).",
      guardian: "Als Elternteil oder gesetzlicher Vertreter treffen Sie diese Entscheidungen für das Kind.",
    },
    links: {
      practice: "Datenschutzhinweise von {controller}",
      platform: "Datenschutzhinweise von Sorriso",
      minors: "Version für junge Menschen",
      newTab: "(öffnet in einem neuen Tab)",
    },
    required: "Erforderlich",
    platformHeading: "Buchung über Sorriso",
    whatThisMeans: "Was das bedeutet",
    whatsappHeading: "Nachrichten über WhatsApp",
    optionalHeading: "Freiwillig",
    optionalHint: "Für die Buchung nicht erforderlich. Sie können Ihre Entscheidung jederzeit im Datenschutz-Center ändern.",
    otherAdult: {
      choices:
        "Nur die Person selbst kann für sich einwilligen, daher werden Sie hier nach keinen Entscheidungen gefragt. Sie kann ihre eigenen später treffen, über den Link in ihren Nachrichten oder im Datenschutz-Center.",
      whatsapp:
        "WhatsApp kann nicht für eine andere Person gewählt werden, da dafür ihre eigene Einwilligung nötig ist: Bitte wählen Sie SMS oder E-Mail. Sie kann später selbst zu WhatsApp wechseln.",
      marketplaceRefused:
        "Auf Sorriso kann nur der Patient selbst der Verarbeitung seiner Buchung durch Sorriso zustimmen, daher buchen Erwachsene hier für sich selbst. Bitten Sie die Person, selbst zu buchen, oder buchen Sie direkt bei der Praxis über deren eigene Website oder telefonisch.",
      marketplaceHeld:
        "Die Person erhält eine Nachricht mit der Bitte, diese Buchung zu bestätigen und Sorriso gegenüber selbst einzuwilligen. Bestätigt sie nicht innerhalb von 48 Stunden, wird die Buchung storniert.",
      marketplaceWaitlist:
        "Auf Sorriso kann nur der Patient selbst der Verarbeitung seiner Anfrage durch Sorriso zustimmen, daher tragen sich Erwachsene hier selbst auf die Warteliste ein. Bitten Sie die Person, sich selbst einzutragen, oder wenden Sie sich direkt an die Praxis über deren eigene Website oder telefonisch.",
    },
  },
  relation: {
    legend: "Für wen ist dieser Termin?",
    options: {
      self: "Für mich",
      minor: "Für einen Minderjährigen",
      other_adult: "Für einen anderen Erwachsenen",
    },
    hints: {
      self: "Sie sind der Patient",
      minor: "Sie buchen als Elternteil oder gesetzlicher Vertreter",
      other_adult: "Sie buchen in seinem Namen",
    },
    teen: "Ab 14 Jahren können Sie selbst buchen. Die Datenschutzhinweise der Praxis gibt es auch in einer Version für junge Menschen, die unten verlinkt ist.",
    under14:
      "Unter 14 Jahren muss ein Elternteil oder gesetzlicher Vertreter buchen. Wählen Sie „Für einen Minderjährigen“ und geben Sie Ihre Angaben als Elternteil oder gesetzlicher Vertreter ein.",
    minor: {
      intro:
        "Geben Sie unten Namen und Geburtsdatum des Kindes als Patientendaten ein. Wenn das Kind keine eigene Handynummer oder E-Mail-Adresse hat, geben Sie dort auch Ihre ein. Bis das Kind 14 Jahre alt ist, gehen Erinnerungen an Sie.",
      birthDateNeeded: "Das Geburtsdatum des Kindes ist erforderlich.",
      adult: "Am Tag des Termins ist diese Person 18 Jahre oder älter: Wählen Sie „Für mich“ oder „Für einen anderen Erwachsenen“.",
      guardianHeading: "Elternteil oder gesetzlicher Vertreter",
      name: "Ihr vollständiger Name",
      relationLegend: "Sie sind für das Kind",
      relations: {
        parent: "Elternteil",
        legal_guardian: "Gesetzlicher Vertreter",
      },
      phone: "Ihre Handynummer",
      email: "Ihre E-Mail-Adresse",
      contactHint: "Geben Sie mindestens eine Angabe an: Nachrichten für das Kind gehen hierher.",
      access:
        "Ihre Angaben werden im Datensatz des Kindes gespeichert. Sie können die Daten des Kindes im Datenschutz-Center einsehen, bis es 18 Jahre alt ist.",
    },
    other: {
      intro: "Geben Sie unten die eigenen Angaben des Patienten ein. Nur er selbst kann für sich einwilligen.",
      heading: "Wer bucht",
      name: "Ihr Name",
      phone: "Ihre Handynummer",
      email: "Ihre E-Mail-Adresse",
      hint: "Wird nur bei diesem Termin gespeichert, nie als Kontakt des Patienten.",
      marketplaceHeld:
        "Auf Sorriso bestätigt die Person diese Buchung selbst. Geben Sie unten ihre eigene Handynummer oder E-Mail-Adresse ein, nicht Ihre: Dort bitten wir sie um die Bestätigung.",
      marketplace:
        "Auf den Suchseiten von Sorriso buchen Erwachsene für sich selbst. Sie können auch direkt bei der Praxis buchen, über deren eigene Website oder telefonisch.",
      marketplaceWaitlist:
        "Auf den Suchseiten von Sorriso tragen sich Erwachsene selbst auf die Warteliste ein. Sie können sich auch direkt an die Praxis wenden, über deren eigene Website oder telefonisch.",
    },
    errors: {
      nameRequired: "Geben Sie einen Namen ein",
      contactRequired: "Geben Sie eine Handynummer oder eine E-Mail-Adresse an",
    },
  },
  manageCard: {
    title: "Ihr Datenschutz",
    body: "Wählen Sie Sprache und Kanal Ihrer Nachrichten, widerrufen Sie freiwillige Einwilligungen, oder sehen Sie alles ein, was die Praxis über Sie gespeichert hat, und laden Sie es herunter.",
    preferences: "Datenschutz und Nachrichten",
    privacyCenter: "Datenschutz-Center",
    notice: "Datenschutzhinweise der Praxis",
  },
  center: {
    meta: {
      title: "Datenschutz-Center",
      description:
        "Sehen Sie ein, welche Daten Zahnarztpraxen auf Sorriso über Sie gespeichert haben, und laden Sie sie herunter, berichtigen oder löschen Sie sie. Kein Konto nötig.",
    },
    eyebrow: "Kein Konto nötig",
    title: "Ihr Datenschutz-Center",
    intro:
      "Sehen Sie, welche Zahnarztpraxen auf Sorriso Daten über Sie oder Ihre Kinder gespeichert haben, laden Sie sie herunter, berichtigen Sie sie, ändern Sie Ihre Entscheidungen oder beantragen Sie ihre Löschung. Wir senden einen Einmalcode an Ihr Telefon oder Ihre E-Mail-Adresse, um zu prüfen, dass Sie es sind.",
    signIn: {
      heading: "Mit einem Einmalcode anmelden",
      contactLabel: "Handynummer oder E-Mail-Adresse",
      contactHint:
        "Die Angabe, die Sie bei der Buchung gemacht haben. Für Handynummern ohne Ländervorwahl wird die ausgewählte verwendet.",
      countryCode: "Ländervorwahl",
      dialOption: "+{code}",
      submit: "Code senden",
      sending: "Wird gesendet…",
      neutral:
        "Wenn eine Praxis auf Sorriso Daten zu diesem Kontakt gespeichert hat, erhalten Sie einen 6-stelligen Code. Andernfalls erhalten Sie nichts.",
      continue: "Weiter zu Ihren Daten",
      signedIn: "Sie sind angemeldet als {contact}.",
    },
    steps: {
      heading: "So funktioniert es",
      one: "Geben Sie die Handynummer oder E-Mail-Adresse ein, mit der Sie gebucht haben.",
      two: "Geben Sie den 6-stelligen Code ein, den wir dorthin senden. Er ist 5 Minuten gültig.",
      three: "Sehen Sie 30 Minuten lang Ihre Daten bei jeder Praxis ein. Danach melden Sie sich erneut an.",
    },
    rights: {
      heading: "Ihre Rechte",
      intro: "Nach der DSGVO können Sie jederzeit und kostenlos:",
      access: {
        title: "Ihre Daten einsehen",
        body: "und eine Kopie von allem erhalten, was eine Praxis über Sie gespeichert hat (Art. 15).",
      },
      rectification: { title: "Sie berichtigen", body: "wenn etwas falsch oder unvollständig ist (Art. 16)." },
      erasure: {
        title: "Sie löschen lassen",
        body: "wenn sie nicht mehr benötigt werden, außer dem, was eine Praxis gesetzlich aufbewahren muss (Art. 17).",
      },
      restriction: {
        title: "Ihre Verwendung einschränken",
        body: "zum Beispiel, während eine Berichtigung geprüft wird (Art. 18).",
      },
      portability: {
        title: "Sie mitnehmen",
        body: "in einem Format, das andere Software lesen kann (Art. 20).",
      },
      objection: {
        title: "Widersprechen",
        body: "einer Verarbeitung auf Grundlage berechtigter Interessen, etwa angepassten Erinnerungen (Art. 21).",
      },
      withdraw: {
        title: "Einwilligungen widerrufen",
        body: "für alles, dem Sie zugestimmt haben, ohne dass dies das zuvor Geschehene berührt (Art. 7).",
      },
      deadline:
        "Praxen müssen innerhalb eines Monats antworten. Sie können sich auch direkt an die Praxis wenden: Ihre Kontaktdaten stehen in ihren Datenschutzhinweisen.",
    },
    complaint: {
      heading: "Beschwerden",
      body: "Wenn Sie meinen, dass Ihre Daten nicht ordnungsgemäß verarbeitet werden, können Sie sich bei der italienischen Datenschutzbehörde, dem <link>Garante per la protezione dei dati personali</link>, oder bei der Aufsichtsbehörde des EU-Landes, in dem Sie leben, beschweren.",
    },
    controller: {
      heading: "Wer diese Seite betreibt",
      body: "Das Datenschutz-Center wird von Sorriso betrieben. Sorriso verarbeitet den von Ihnen bestätigten Kontakt nur, um Ihre Datensätze zu finden und Sie angemeldet zu halten. <link>Datenschutzhinweise von Sorriso</link>.",
    },
    errors: {
      invalidContact: "Geben Sie eine gültige Handynummer oder E-Mail-Adresse ein.",
      rateLimited: "Zu viele Codes angefordert. Bitte warten Sie 15 Minuten und versuchen Sie es dann erneut.",
      generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
    },
  },
  verify: {
    meta: { title: "Code eingeben" },
    title: "Code eingeben",
    sentTo:
      "Wenn eine Praxis auf Sorriso Daten zu {contact} gespeichert hat, haben wir dorthin einen 6-stelligen Code gesendet. Er läuft in 5 Minuten ab.",
    codeLabel: "6-stelliger Code",
    submit: "Weiter",
    checking: "Wird geprüft…",
    again: "Kein Code? Das kann eine Minute dauern. <link>Neuen Code anfordern</link>.",
    errors: {
      invalid: "Dieser Code stimmt nicht. Prüfen Sie ihn und versuchen Sie es erneut.",
      expired: "Dieser Code ist abgelaufen. Fordern Sie einen neuen an.",
      too_many_attempts: "Zu viele falsche Codes. Fordern Sie einen neuen Code an.",
      ticket: "Diese Anmeldung ist abgelaufen. Bitte beginnen Sie von vorn.",
      format: "Geben Sie die 6 Ziffern des Codes ein.",
    },
  },
  me: {
    meta: { title: "Ihre Daten" },
    title: "Ihre Daten",
    signedInAs: "Angemeldet als {contact}",
    until: "Zu Ihrer Sicherheit werden Sie um {time} automatisch abgemeldet.",
    signOut: "Abmelden",
    signedOut: "Sie sind abgemeldet.",
    expired: "Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an, um fortzufahren.",
    contents: "Praxen",
    empty: {
      title: "Wir haben zu diesem Kontakt keine Daten gefunden",
      body: "Keine Praxis auf Sorriso hat einen Datensatz mit dieser Handynummer oder E-Mail-Adresse. Wenn Sie mit einer anderen gebucht haben, melden Sie sich mit dieser an.",
    },
    yours: "Ihr Datensatz",
    familyBadge: "Ihr Kind {name}",
    familyNote:
      "Sie sehen diesen Datensatz, weil Ihr Kontakt als Elternteil oder gesetzlicher Vertreter von {name} gespeichert ist, der oder die unter 18 Jahre alt ist.",
    restricted: "Verarbeitung eingeschränkt seit {date}: Die Praxis bewahrt die Daten auf, verwendet sie aber nicht.",
    challenge: {
      title: "Bei {practice} besteht ein Datensatz",
      body: "Dieser Kontakt erscheint auch im Datensatz einer anderen Person, oder er wurde für diesen nie bestätigt. Um ihn einzusehen, bestätigen Sie Nachnamen und Geburtsdatum des Patienten.",
      lastName: "Nachname",
      birthDate: "Geburtsdatum",
      submit: "Bestätigen",
      wrong: "Diese Angaben stimmen nicht überein. Prüfen Sie sie und versuchen Sie es erneut.",
      rateLimited: "Zu viele Versuche. Versuchen Sie es morgen erneut oder wenden Sie sich an die Praxis.",
      unavailable: "Dieser Datensatz kann hier nicht bestätigt werden. Bitte wenden Sie sich an die Praxis.",
      help: "Bestätigung nicht möglich? Wenden Sie sich an die Praxis: {contact}.",
      noBirthDate:
        "{practice} hat in diesem Datensatz kein Geburtsdatum hinterlegt, daher kann er hier nicht bestätigt werden. Um ihn einzusehen, wenden Sie sich an die Praxis: {contact}.",
      noBirthDateNoContact:
        "{practice} hat in diesem Datensatz kein Geburtsdatum hinterlegt, daher kann er hier nicht bestätigt werden. Um ihn einzusehen, wenden Sie sich an die Praxis.",
    },
    sections: {
      details: "Ihre Angaben",
      appointments: "Termine",
      messages: "Nachrichten",
      waitlist: "Warteliste",
      choices: "Ihre Entscheidungen",
      preferences: "Sprache und Kanal",
      contact: "Kontaktdaten berichtigen",
      reviews: "Bewertungen",
      accessLog: "Wer auf diesen Datensatz zugegriffen hat",
      requests: "Anfragen",
      download: "Ihre Daten herunterladen",
    },
    counts: {
      appointments: p({ one: "{count} Termin", other: "{count} Termine" }),
      messages: p({ one: "{count} Nachricht", other: "{count} Nachrichten" }),
      entries: p({ one: "{count} Eintrag", other: "{count} Einträge" }),
    },
    details: {
      name: "Name",
      birthDate: "Geburtsdatum",
      phone: "Handynummer",
      email: "E-Mail",
      language: "Sprache der Nachrichten",
      channel: "Bevorzugter Kanal",
      guardian: "Elternteil oder gesetzlicher Vertreter",
      none: "Nicht angegeben",
      verified: "bestätigt",
    },
    appointments: {
      empty: "Keine Termine.",
      viaSorriso: "Über Sorriso gebucht",
      bookedByOther: "Von jemand anderem für Sie gebucht",
    },
    messages: {
      empty: "Keine Nachrichten.",
      inbound: "Ihre Antwort",
      outbound: "An Sie gesendet",
      redacted: "Der Text wurde am Ende der Aufbewahrungsfrist gelöscht.",
      intro: "Nachrichten werden für den in den Datenschutzhinweisen der Praxis festgelegten Zeitraum aufbewahrt.",
    },
    waitlist: {
      range: "{from} bis {to}",
      statuses: {
        active: "Wartend",
        booked: "Gebucht",
        removed: "Geschlossen",
      },
    },
    choices: {
      intro:
        "Änderungen gelten sofort und werden als Nachweis gespeichert. Das Ausschalten berührt nie, was zuvor geschehen ist.",
      on: "An",
      off: "Aus",
      objected: "Widersprochen",
      since: "Seit {date}",
      default: "Standard",
      turnOn: "Einschalten",
      turnOff: "Ausschalten",
      withdraw: "Widerrufen",
      object: "Widersprechen",
      undoObjection: "Widerspruch zurücknehmen",
      kinds: {
        consent: "Einwilligung",
        channel: "Servicenachrichten",
        objection: "Sie können widersprechen",
      },
      whatsappHint: "Um Nachrichten über WhatsApp zu erhalten, wählen Sie es unten als Ihren Kanal.",
      guardianRequired: "Bei einem Kind unter 14 Jahren muss ein Elternteil oder gesetzlicher Vertreter diese Entscheidung treffen.",
      notAllowed: "Diese Entscheidung kann hier nicht geändert werden.",
      saved: "Gespeichert.",
    },
    preferences: {
      language: "Sprache der Nachrichten",
      channel: "Kanal",
      save: "Speichern",
      saved: "Gespeichert.",
      unavailable: "Dieser Kanal ist für diesen Datensatz nicht verfügbar.",
      whatsappRequired: "Bitte bestätigen Sie, dass Sie Nachrichten über WhatsApp erhalten möchten.",
    },
    contact: {
      intro:
        "Wir senden einen Code an den neuen Kontakt, um ihn zu prüfen. Die Praxis wird über die Änderung informiert, ebenso der alte Kontakt.",
      kind: "Was soll geändert werden",
      kinds: {
        phone: "Handynummer",
        email: "E-Mail-Adresse",
      },
      newValue: "Neuer Wert",
      applyAll: "Bei allen Praxen ändern, bei denen er hinterlegt ist",
      send: "Code senden",
      codeSent: "Wir haben einen Code an {contact} gesendet. Geben Sie ihn ein, um die Änderung zu bestätigen.",
      code: "Code",
      confirm: "Änderung bestätigen",
      done: "Ihre Kontaktdaten wurden aktualisiert.",
      errors: {
        invalid_contact: "Geben Sie eine gültige Handynummer oder E-Mail-Adresse ein.",
        unchanged: "Das ist bereits der hinterlegte Kontakt.",
        not_found: "Dieser Datensatz kann hier nicht geändert werden.",
        rate_limited: "Zu viele Codes angefordert. Bitte warten Sie 15 Minuten und versuchen Sie es dann erneut.",
        invalid: "Dieser Code stimmt nicht.",
        expired: "Dieser Code ist abgelaufen. Senden Sie einen neuen.",
        too_many_attempts: "Zu viele falsche Codes. Senden Sie einen neuen.",
      },
    },
    reviews: {
      rating: "{rating} von 5",
      withdraw: "Bewertung löschen",
      confirm: "Diese Bewertung endgültig löschen? Sie verschwindet von allen öffentlichen Seiten.",
      withdrawn: "Bewertung gelöscht.",
      statuses: {
        pending: "Wartet auf Veröffentlichung",
        published: "Veröffentlicht",
        under_review: "In Prüfung",
        removed: "Entfernt",
        withdrawn: "Von Ihnen gelöscht",
      },
    },
    accessLog: {
      intro:
        "Jedes Mal, wenn jemand diesen Datensatz öffnet oder ändert, wird dies protokolliert. Mitarbeitende erscheinen mit ihrer Rolle.",
      empty: "Noch keine Zugriffe erfasst.",
      when: "Wann",
      who: "Wer",
      what: "Was",
      formerStaff: "Ehemaliger Mitarbeiter",
      actors: {
        patient_session: "Sie, im Datenschutz-Center",
        patient_link: "Sie, über Ihren Terminlink",
        api_key: "Die Software der Praxis",
        system: "Automatischer Vorgang",
        platform_admin: "Sorriso-Administrator",
        webhook: "Ihre Antwort auf eine Nachricht",
        user: "Mitarbeitende",
      },
      actions: {
        patient_view: "Hat Ihren Datensatz geöffnet",
        patient_create: "Hat Ihren Datensatz angelegt",
        patient_update: "Hat Ihre Angaben geändert",
        patient_export: "Hat Ihre Daten exportiert",
        patient_erase: "Hat Ihre Daten gelöscht",
        patient_restrict: "Hat die Verarbeitung eingeschränkt",
        patient_unrestrict: "Hat die Einschränkung aufgehoben",
        patient_restricted_access: "Hat Ihren eingeschränkten Datensatz mit Begründung geöffnet",
        patient_clinical_view: "Hat Ihre Anamnese geöffnet",
        patient_merge: "Hat doppelte Datensätze zusammengeführt",
        appointment_view: "Hat einen Termin geöffnet",
        appointment_create: "Hat einen Termin gebucht",
        appointment_update: "Hat einen Termin geändert",
        appointment_cancel: "Hat einen Termin abgesagt",
        appointment_note_update: "Hat eine Terminnotiz geändert",
        appointment_link_issue: "Hat einen Link zu Ihrer Terminseite erstellt",
        adult_confirmation_request: "Hat Sie gebeten, eine für Sie vorgenommene Buchung zu bestätigen",
        adult_confirmation_confirm: "Hat eine für Sie vorgenommene Buchung bestätigt",
        adult_confirmation_decline: "Hat eine für Sie vorgenommene Buchung abgelehnt",
        adult_confirmation_expire: "Hat eine für Sie vorgenommene, nicht rechtzeitig bestätigte Buchung storniert",
        waitlist_update: "Hat Ihren Wartelisteneintrag geändert",
        message_view: "Hat eine Nachricht an Sie oder von Ihnen geöffnet",
        recall_update: "Hat Ihre Erinnerung an Kontrolltermine geändert",
        form_submit: "Hat Ihren Anamnesebogen erhalten",
        form_export: "Hat Ihren Anamnesebogen in Ihre Patientenakte übernommen",
        consent_record: "Hat eine Datenschutzentscheidung erfasst",
        privacy_request_create: "Hat eine Datenschutzanfrage erhalten",
        privacy_request_view: "Hat eine Datenschutzanfrage geöffnet",
        privacy_request_update: "Hat eine Datenschutzanfrage bearbeitet",
        privacy_center_view: "Im Datenschutz-Center angesehen",
        privacy_center_export: "Aus dem Datenschutz-Center heruntergeladen",
        other: "Sonstige Aktivität",
      },
    },
    requests: {
      intro:
        "Stellen Sie eine Anfrage an die Praxis. Sie muss innerhalb eines Monats antworten, und Sie erhalten eine Eingangsbestätigung mit Datum.",
      type: "Was möchten Sie?",
      types: {
        access: {
          title: "Eine vollständige Kopie meiner Daten",
          body: "Alles, was die Praxis gespeichert hat, und wie sie es verwendet.",
        },
        rectification: { title: "Meine Daten berichtigen", body: "Teilen Sie der Praxis im Feld unten mit, was falsch ist." },
        erasure: {
          title: "Meine Daten löschen",
          body: "Was die Praxis gesetzlich aufbewahren muss, etwa die Patientenakte, wird aufbewahrt, aber nicht mehr verwendet.",
        },
        restriction: {
          title: "Die Verwendung meiner Daten einschränken",
          body: "Die Praxis bewahrt sie auf, verwendet sie aber nicht, zum Beispiel während eine Berichtigung geprüft wird.",
        },
        objection: {
          title: "Der Verwendung meiner Daten widersprechen",
          body: "Bei einer Verarbeitung auf Grundlage berechtigter Interessen, etwa dem Verlauf versäumter Termine.",
        },
        portability: {
          title: "Meine Daten in einem übertragbaren Format",
          body: "Die von Ihnen angegebenen Daten, zur Mitnahme zu einem anderen Anbieter.",
        },
      },
      to: "Senden an",
      toPractice: "{practice}",
      toSorriso: "Sorriso, für Buchungen über seine Suchseiten",
      details: "Details (optional)",
      detailsHint: "Machen Sie keine Gesundheitsangaben, es sei denn, sie sind für Ihre Anfrage erforderlich.",
      submit: "Anfrage senden",
      filed: "Anfrage eingegangen. Sie erhalten spätestens am {date} eine Antwort.",
      duplicate: "Sie haben bereits eine offene Anfrage dieser Art. Die Antwort ist spätestens am {date} fällig.",
      listHeading: "Ihre Anfragen",
      empty: "Noch keine Anfragen.",
      received: "Eingegangen am {date}",
      due: "Antwort fällig bis {date}",
      closed: "Abgeschlossen am {date}",
      sorriso: "An Sorriso",
      statuses: {
        open: "Eingegangen",
        in_progress: "In Bearbeitung",
        extended: "Verlängert",
        completed: "Erledigt",
        rejected: "Abgelehnt",
      },
      typeLabels: {
        access: "Auskunft",
        rectification: "Berichtigung",
        erasure: "Löschung",
        restriction: "Einschränkung",
        portability: "Datenübertragbarkeit",
        objection: "Widerspruch",
        consent_withdrawal: "Widerruf der Einwilligung",
      },
    },
    download: {
      body: "Eine ZIP-Datei mit allem, was diese Praxis zu diesem Datensatz gespeichert hat: eine lesbare Zusammenfassung, die Daten als JSON und CSV und eine FHIR-Datei, die andere Gesundheitssoftware importieren kann.",
      button: "Herunterladen (ZIP)",
    },
    errors: {
      generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
      session: "Ihre Sitzung ist abgelaufen. Melden Sie sich erneut an.",
    },
  },
  linkPage: {
    meta: { title: "Ihre Datenschutzeinstellungen" },
    title: "Ihre Datenschutzeinstellungen",
    intro: "Für Ihren Termin bei {practice}. Änderungen gelten für die Nachrichten zu all Ihren Terminen dort.",
    choicesHeading: "Freiwillige Einwilligungen und Nachrichten",
    choicesIntro: "Sie können diese hier widerrufen. Um etwas wieder einzuschalten, nutzen Sie das Datenschutz-Center.",
    unsubscribe: {
      heading: "Nachrichten abbestellen",
      sms: "SMS abbestellen",
      email: "E-Mails abbestellen",
      smsDone: "Sie erhalten keine SMS mehr von {practice}.",
      emailDone: "Sie erhalten keine E-Mails mehr von {practice}.",
      warning: "Ohne SMS oder E-Mail erhalten Sie keine Erinnerungen an Ihre Termine.",
    },
    full: {
      heading: "Alle Ihre Daten einsehen",
      body: "Um alles einzusehen, was die Praxis gespeichert hat, es herunterzuladen oder eine Anfrage zu stellen, senden wir zuerst einen Einmalcode an den hinterlegten Kontakt.",
      choose: "Code senden an",
      send: "Code senden",
      noContact: "Es ist kein Kontakt hinterlegt, an den ein Code gesendet werden kann. Wenden Sie sich an die Praxis.",
    },
    notice: "Datenschutzhinweise von {practice}",
    saved: "Gespeichert.",
    asGuardian: "Sie verwalten diese Einstellungen als Elternteil oder gesetzlicher Vertreter von {name}.",
    locked: {
      intro:
        "Dieser Termin bei {practice} wurde von jemand anderem für den Patienten gebucht. Zum Schutz der Privatsphäre des Patienten kann nur er selbst seine Einstellungen einsehen und ändern.",
      heading: "Sind Sie der Patient?",
      stepUp:
        "Wir senden einen Einmalcode an den eigenen hinterlegten Kontakt des Patienten. Damit können Sie Ihre Daten einsehen, Ihre Einstellungen ändern und alles herunterladen.",
      refused: "Nur der Patient selbst kann diese Einstellungen ändern. Verwenden Sie den Einmalcode, der an seinen eigenen Kontakt gesendet wurde.",
    },
    invalid: "Dieser Link ist ungültig oder abgelaufen. Sie können weiterhin das <link>Datenschutz-Center</link> nutzen.",
  },
  confirm: {
    meta: { title: "Bestätigen Sie Ihren Termin" },
    title: "Für Sie wurde ein Termin gebucht",
    body: "{booker} hat über Sorriso für Sie einen Termin bei {practice} am {when} gebucht.",
    explain:
      "Nur Sie selbst können ihn bestätigen und der Verarbeitung der Buchung durch Sorriso zustimmen. Wenn Sie ihn nicht bis {deadline} bestätigen, wird er storniert.",
    confirmButton: "Termin bestätigen",
    declineButton: "Stornieren",
    declineHint: "Nicht für Sie oder nicht nötig? Stornieren Sie ihn, und mit dieser Buchung geschieht nichts weiter.",
    consentRequired: "Bitte erteilen Sie Ihre Einwilligung, um den Termin zu bestätigen.",
    confirmed: "Vielen Dank: Ihr Termin ist bestätigt.",
    requested: "Vielen Dank. Die Praxis bestätigt den Termin nun.",
    declined: "Der Termin wurde storniert. Mit dieser Buchung geschieht nichts weiter.",
    notWaiting: "Dieser Termin braucht Ihre Bestätigung nicht.",
    codeHeading: "Zuerst einen Code anfordern",
    codeIntro: "Um sicherzugehen, dass Sie es wirklich sind, senden wir einen Einmalcode an Ihren eigenen hinterlegten Kontakt.",
    sendCode: "Code senden",
    resend: "Neuen Code senden",
    codeSent: "Wir haben einen 6-stelligen Code an {contact} gesendet. Er läuft in 5 Minuten ab.",
    noContact:
      "Es ist kein eigener Kontakt von Ihnen hinterlegt, an den ein Code gesendet werden kann, daher kann die Buchung hier nicht bestätigt werden. Bitte wenden Sie sich an die Praxis.",
    neededToConfirm: "Zum Bestätigen erforderlich",
  },
  unsubscribe: {
    title: "Abbestellen",
    confirm: {
      email: "E-Mails von {practice} abbestellen?",
      sms: "SMS von {practice} abbestellen?",
      whatsapp: "WhatsApp-Nachrichten von {practice} abbestellen?",
    },
    body: "Sie erhalten über diesen Kanal keine Terminbestätigungen und Erinnerungen mehr. Sie können sie im Datenschutz-Center wieder einschalten.",
    button: "Abbestellen",
    done: {
      email: "Sie erhalten keine E-Mails mehr von {practice}.",
      sms: "Sie erhalten keine SMS mehr von {practice}.",
      whatsapp: "Sie erhalten keine WhatsApp-Nachrichten mehr von {practice}.",
    },
    doneBody: "Um Ihre Einstellungen erneut zu ändern, nutzen Sie das Datenschutz-Center: {url}",
    invalid: "Dieser Abmeldelink ist ungültig. Sie können Ihre Nachrichten im Datenschutz-Center verwalten: {url}",
    rateLimited: "Zu viele Anfragen. Bitte versuchen Sie es in einigen Minuten erneut.",
  },
} satisfies DeepPartial<Messages["privacy"]>;
