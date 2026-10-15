/**
 * German translation of the patient-side privacy notices. LEGAL TEXT, ITALIAN AUTHORITATIVE:
 * translated from the English version; every non-Italian page says the Italian version prevails
 * (page.italianPrevails). Draft: needs DPO or lawyer review (docs/i18n/glossary-de.md).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    practiceTitle: "Datenschutzhinweise: {practice}",
    practiceDescription: "Wie {practice} die personenbezogenen Daten seiner Patienten verarbeitet, und Ihre Rechte.",
    minorTitle: "Datenschutz für junge Menschen: {practice}",
    minorDescription: "Was {practice} mit Informationen über Sie macht, in einfachen Worten.",
    platformTitle: "Datenschutzhinweise von Sorriso",
    platformDescription:
      "Wie Sorriso personenbezogene Daten verarbeitet, wenn Sie einen Zahnarzt suchen, buchen oder eine Bewertung schreiben, und Ihre Rechte.",
    staffTitle: "Datenschutzhinweise für Praxispersonal",
    staffDescription: "Wie Ihre Daten verarbeitet werden, wenn Sie das Sorriso-Dashboard nutzen, und wie das Zugriffsprotokoll funktioniert.",
    practitionerTitle: "Datenschutzhinweise für Behandler",
    practitionerDescription: "Wie Sorriso die Daten der in seinem Verzeichnis aufgeführten Behandler verarbeitet.",
    cookiesTitle: "Cookie-Hinweise",
    cookiesDescription: "Die wenigen technischen Cookies, die Sorriso verwendet, und warum es kein Cookie-Banner gibt.",
  },
  page: {
    version: "Version {version}",
    updated: "In Kraft seit {date}",
    italianPrevails: "Dies ist eine Übersetzung. Im Fall von Abweichungen ist die italienische Fassung maßgeblich.",
    italianLink: "Italienische Fassung lesen",
    contents: "Inhalt",
    practiceLink: "Vollständige Datenschutzhinweise der Praxis",
    minorsLink: "Version für junge Menschen",
    platformLink: "Datenschutzhinweise von Sorriso",
    cookiesLink: "Cookie-Hinweise",
    privacyCenterLink: "Zum Datenschutz-Center",
    otherNotices: "Weitere Hinweise",
    staffLink: "Für Praxispersonal",
    practitionerLink: "Für Behandler",
    patientLink: "Für Patienten",
    backToTop: "Nach oben",
  },
  sections: {
    summary: "Kurz gesagt",
    controller: "Wer für Ihre Daten verantwortlich ist",
    roles: "Die zwei Rollen von Sorriso",
    data: "Welche Daten wir verarbeiten",
    purposes: "Warum wir sie verarbeiten und auf welcher Rechtsgrundlage",
    marketplace: "Wenn Sie über Sorriso gebucht haben",
    withdrawal: "Wenn Sie Ihre Einwilligung widerrufen",
    recipients: "Wer Ihre Daten erhält",
    transfers: "Übermittlungen außerhalb des Europäischen Wirtschaftsraums",
    retention: "Wie lange wir Ihre Daten aufbewahren",
    rights: "Ihre Rechte",
    complaint: "Beschwerden",
    mandatory: "Müssen Sie uns Ihre Daten angeben?",
    automated: "Automatisierte Entscheidungen und Profiling",
    minors: "Kinder und Jugendliche",
    monitoring: "Das Zugriffsprotokoll",
    profile: "Ihr öffentliches Profil",
    cookies: "Cookies",
    changes: "Änderungen dieser Hinweise",
    who: "Wer sich um Ihre Informationen kümmert",
    what: "Welche Informationen wir verwenden",
    why: "Warum wir sie verwenden",
    parents: "Ihre Eltern oder Ihr gesetzlicher Vertreter",
    keep: "Wie lange wir sie aufbewahren",
    youCan: "Was Sie tun können",
    help: "Wenn etwas nicht stimmt",
    full: "Die vollständigen Hinweise",
    cookieList: "Cookies, die wir verwenden",
    storage: "Speicherung in Ihrem Browser",
    thirdParties: "Dritte",
    legalBasis: "Rechtsgrundlage",
    control: "Wie Sie Cookies steuern können",
    widget: "Das Buchungs-Widget auf Praxis-Websites",
  },
  controller: {
    name: "Verantwortlicher: {name}",
    vat: "USt-IdNr. (Partita IVA): {vat}",
    address: "Anschrift: {address}",
    contact: "Kontakt für Datenschutzfragen: {email}",
    phone: "Telefon: {phone}",
    dpo: "Datenschutzbeauftragter (DSB): {name}, {email}",
    dpoEmail: "Datenschutzbeauftragter (DSB): {email}",
    noDpo:
      "Die Praxis hat keinen Datenschutzbeauftragten benannt: Wenden Sie sich bei allen Datenschutzfragen an den oben genannten Kontakt.",
    processor:
      "Sorriso stellt die Buchungssoftware als Auftragsverarbeiter der Praxis bereit (Art. 28 DSGVO): Es handelt nur auf dokumentierte Weisung der Praxis und auf Grundlage eines Auftragsverarbeitungsvertrags.",
    platformDpo: "Der Datenschutzbeauftragte (DSB) von Sorriso ist unter {email} erreichbar.",
  },
  bases: {
    art6_1_a: "Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO)",
    art6_1_b: "der von Ihnen gewünschte Dienst oder vorvertragliche Maßnahmen auf Ihre Anfrage (Art. 6 Abs. 1 lit. b DSGVO)",
    art6_1_c: "eine rechtliche Verpflichtung des Verantwortlichen (Art. 6 Abs. 1 lit. c DSGVO)",
    art6_1_f: "die berechtigten Interessen des Verantwortlichen, denen Sie widersprechen können (Art. 6 Abs. 1 lit. f DSGVO)",
    art9_2_a: "Ihre ausdrückliche Einwilligung für Daten, die Ihre Gesundheit betreffen können (Art. 9 Abs. 2 lit. a DSGVO)",
    art9_2_f: "die Geltendmachung, Ausübung oder Verteidigung von Rechtsansprüchen (Art. 9 Abs. 2 lit. f DSGVO)",
    art9_2_h:
      "die Gesundheitsversorgung durch Berufsangehörige, die dem Berufsgeheimnis unterliegen (Art. 9 Abs. 2 lit. h und Abs. 3 DSGVO, Art. 2-septies des italienischen Datenschutzkodex)",
  },
  purposes: {
    item: "{title}. {body} Rechtsgrundlage: {bases}.",
    booking_practice: {
      title: "Buchung",
      body: "Um Ihre Buchung entgegenzunehmen und zu erfassen, die Verfügbarkeit zu prüfen und Ihnen den Termin zu bestätigen.",
    },
    booking_marketplace: {
      title: "Buchungen über Sorriso",
      body: "Wenn Sie über die Suchseiten von Sorriso buchen: um Ihre Buchung an die gewählte Praxis weiterzuleiten und Erinnerungen und Änderungen zu verwalten. Buchungsdaten können Informationen über Ihre Gesundheit offenbaren, daher bittet Sorriso um Ihre ausdrückliche Einwilligung.",
    },
    appointment_management: {
      title: "Verwaltung Ihrer Termine",
      body: "Um Ihre Termine und Ihre Akte in der Praxis zu führen, den Terminplan zu organisieren und Ihnen zu ermöglichen, online zu bestätigen, zu verschieben oder abzusagen.",
    },
    reminders: {
      title: "Bestätigungen und Erinnerungen",
      body: "Um Buchungsbestätigungen und Erinnerungen per SMS, E-Mail oder, wenn Sie es wählen, WhatsApp zu senden. Die Nachrichten sind diskret: Sie zeigen keine Behandlung und keine Notizen, es sei denn, die Praxis hat ausführliche Nachrichten gewählt und Ihr Kontakt wurde bestätigt. Sie können jeden Kanal jederzeit abschalten.",
    },
    waitlist: {
      title: "Warteliste",
      body: "Wenn Sie sich auf die Warteliste setzen: um Ihnen mitzuteilen, wenn ein früherer Termin frei wird.",
    },
    recalls: {
      title: "Erinnerungen an Kontrolltermine",
      body: "Um Sie zu erinnern, wenn Ihr Zahnarzt ein Intervall für Ihre nächste Kontrolle festgelegt hat. Mit jeder Erinnerung können Sie diese abbestellen, und Sie können jederzeit widersprechen.",
    },
    feedback_requests: {
      title: "Einladungen zum Feedback",
      body: "Nur wenn Sie einwilligen: eine einzige Einladung, nach dem Besuch Feedback zu geben. Sie können Ihre Einwilligung jederzeit widerrufen.",
    },
    reviews: {
      title: "Bewertungen",
      body: "Wenn Sie eine Bewertung schreiben und in ihre Veröffentlichung einwilligen: um sie zu veröffentlichen, zu zeigen, dass sie auf einem echten Besuch beruht, und sie zu moderieren. Sie können sie jederzeit im Datenschutz-Center löschen.",
    },
    marketing: {
      title: "Neuigkeiten und Angebote",
      body: "Nur wenn Sie einwilligen: Neuigkeiten und Angebote der Praxis. Dies ist nie erforderlich, um zu buchen oder behandelt zu werden, und Ihre Einwilligung erlischt nach 24 Monaten ohne Kontakt.",
    },
    no_show_tracking: {
      title: "Verlauf versäumter Termine",
      body: "Um die in den letzten 24 Monaten versäumten Termine zu erfassen, den Terminplan zu organisieren und Unterstützung anzubieten, etwa eine zusätzliche Erinnerung. Dies hindert Sie nie am Buchen. Sie können jederzeit widersprechen.",
    },
    adaptive_reminders: {
      title: "Angepasste Erinnerungen",
      body: "Um eine zusätzliche Erinnerung zu senden, wenn ein Termin anhand Ihres Terminverlaufs eher versäumt werden könnte. Dies ist ein Profiling (Art. 4 Nr. 4 DSGVO): Es bietet nur Unterstützung und schränkt Ihre Buchung nie ein. Sie können jederzeit widersprechen und erhalten dann die Standarderinnerungen.",
    },
    anamnesis: {
      title: "Anamnesebogen",
      body: "Wenn die Praxis Sie bittet, ihn vor dem Besuch auszufüllen: um Ihre Behandlung sicher vorzubereiten. Ihre Antworten werden verschlüsselt und nur vom Behandlungsteam eingesehen.",
    },
    partner_api: {
      title: "Angebundene Praxissoftware",
      body: "Wenn die Praxis ihre eigene Verwaltungssoftware an den Terminkalender anbindet: um beide synchron zu halten. Diese Software ist ein von der Praxis gewählter Empfänger.",
    },
    directory: {
      title: "Verzeichnis",
      body: "Um Praxen und Behandler in den Suchergebnissen von Sorriso und auf ihren öffentlichen Seiten anzuzeigen.",
    },
    ranking: {
      title: "Reihenfolge der Suchergebnisse",
      body: "Um Suchergebnisse nach veröffentlichten Kriterien zu ordnen: nächster freier Termin, Bewertungen, Zuverlässigkeit, Vollständigkeit des Profils und Entfernung. Niemand kann für eine bessere Position bezahlen. Sie können jederzeit widersprechen.",
    },
    privacy_center: {
      title: "Datenschutz-Center",
      body: "Um die Datensätze zu finden, die Praxen auf Sorriso zu einer Telefonnummer oder E-Mail-Adresse gespeichert haben, die Sie mit einem Einmalcode bestätigt haben, damit Sie Ihre Rechte an einem Ort ausüben können.",
    },
    staff_accounts: {
      title: "Mitarbeiterkonten",
      body: "Um dem Praxispersonal einen persönlichen, sicheren Zugang zum Dashboard zu geben: Anmeldung, Zwei-Faktor-Authentifizierung, Sitzungen und die Annahme der Anweisungen für Mitarbeitende.",
    },
    security_logs: {
      title: "Sicherheit und Zugriffsprotokoll",
      body: "Um zu erfassen, wer Patientendatensätze öffnet und ändert, sie vor Missbrauch zu schützen und Patienten zu zeigen, wer auf ihre Daten zugegriffen hat.",
    },
    privacy_requests: {
      title: "Datenschutzanfragen",
      body: "Um die Anfragen zu bearbeiten, die Personen zu ihren Daten stellen, sie innerhalb der gesetzlichen Fristen zu beantworten und dies nachzuweisen.",
    },
  },
  services: {
    hosting: "Hosting der Anwendung",
    database: "Datenbank",
    sms: "SMS-Nachrichten",
    whatsapp: "WhatsApp-Nachrichten, nur für Praxen, die sie aktivieren, und Patienten, die sie wählen",
    email: "E-Mail",
    backups: "Sicherungskopien",
  },
  transferTools: {
    eu: "keine Übermittlung (EU/EWR)",
    dpf: "EU-US Data Privacy Framework (Angemessenheitsbeschluss der Europäischen Kommission vom 10. Juli 2023)",
    scc: "von der Europäischen Kommission genehmigte Standardvertragsklauseln (Art. 46 DSGVO)",
    dpf_scc: "EU-US Data Privacy Framework, ersatzweise die Standardvertragsklauseln der Europäischen Kommission",
  },
  data: {
    intro: "Wir verarbeiten:",
    identity:
      "Identifikations- und Kontaktdaten: Vorname, Nachname, Handynummer, E-Mail-Adresse, Geburtsdatum sowie die von Ihnen bevorzugte Sprache und den bevorzugten Kanal;",
    appointments:
      "Termindaten: Datum, Uhrzeit, Behandlung, Behandler, Standort, Status und versäumte Termine. Sie können Informationen über Ihre Gesundheit offenbaren;",
    yourWords:
      "was Sie uns freiwillig mitteilen: Notizen zu einer Buchung, Antworten auf unsere Nachrichten und, wenn die Praxis ihn nutzt, den Anamnesebogen;",
    guardian: "bei Kindern: die Angaben des Elternteils oder gesetzlichen Vertreters, der bucht und die Nachrichten erhält;",
    records: "Nachweise Ihrer Einwilligungen und Entscheidungen sowie Ihrer Datenschutzanfragen;",
    technical:
      "für die Sicherheit erforderliche technische Daten: verschlüsselte Hashwerte (HMAC) Ihrer IP-Adresse, nie die Adresse selbst.",
    source:
      "Wir erhalten diese Daten von Ihnen oder von der Person, die für Sie gebucht hat: einem Elternteil oder gesetzlichen Vertreter oder einem anderen Erwachsenen, der in Ihrem Namen gebucht hat. In diesem Fall senden wir diese Hinweise auch an Ihren eigenen Kontakt, sofern wir einen haben (Art. 14 DSGVO).",
  },
  platformData: {
    intro: "Sorriso verarbeitet für seine eigenen Dienste:",
    booking:
      "wenn Sie über seine Suchseiten buchen: Ihren Namen, Ihre Kontaktdaten, gegebenenfalls Ihr Geburtsdatum, die gewählte Praxis, Behandlung, Datum und Uhrzeit sowie den Nachweis Ihrer Einwilligung;",
    reviews: "wenn Sie eine Bewertung schreiben: die Bewertung, den Text, den angezeigten Namen und den Besuch, auf den sie sich bezieht;",
    privacyCenter:
      "wenn Sie das Datenschutz-Center nutzen: einen verschlüsselten Hashwert der von Ihnen bestätigten Telefonnummer oder E-Mail-Adresse, die dorthin gesendeten Einmalcodes (nur als Hashwerte gespeichert) und ein 30 Minuten gültiges Sitzungs-Cookie;",
    technical: "für die Sicherheit: verschlüsselte Hashwerte (HMAC) von IP-Adressen und Browsern, nie die Adressen selbst.",
  },
  recipients: {
    intro: "Ihre Daten sehen nur diejenigen, die sie benötigen:",
    staff: "das befugte Personal der Praxis (Empfang und Behandlungsteam), jeweils mit dem Zugriff, den seine Rolle erfordert;",
    sorriso: "Sorriso, das die Buchungssoftware als Auftragsverarbeiter der Praxis betreibt;",
    practices: "die Praxis, bei der Sie buchen, die Ihre Buchung erhält und Verantwortlicher für ihre eigene Kopie wird;",
    providers: "die unten aufgeführten technischen Dienstleister (Unterauftragsverarbeiter), die durch Auftragsverarbeitungsverträge gebunden sind;",
    authorities: "Behörden, nur soweit das Gesetz es verlangt.",
    notSold: "Ihre Daten werden nie verkauft oder für Werbung verwendet.",
    provider: "{name} ({entity}): {service}, {region}.",
    providerNoRegion: "{name} ({entity}): {service}.",
    fullList: "Die vollständige, aktuelle Liste der Unterauftragsverarbeiter finden Sie unter {url}.",
  },
  transfers: {
    intro:
      "Einige Dienstleister gehören zu Unternehmensgruppen mit Sitz in den Vereinigten Staaten. Auch wenn ihre Server in der EU stehen, kann dies als Übermittlung außerhalb des Europäischen Wirtschaftsraums gelten. Diese Übermittlungen sind abgesichert durch:",
    item: "{name}: {tool}.",
    assessment:
      "Sorriso hat diese Übermittlungen bewertet (Transfer Impact Assessment). Sie können eine Kopie der Garantien anfordern, indem Sie an {email} schreiben.",
    none: "Ihre Daten werden nicht außerhalb des Europäischen Wirtschaftsraums übermittelt.",
  },
  retention: {
    intro: "Wir bewahren Daten nur so lange auf, wie sie benötigt werden:",
    patientInactiveMonths:
      "Ihre Akte in der Praxis: {period} nach Ihrem letzten Besuch, länger nur, wenn die Praxis klinische Unterlagen gesetzlich aufbewahren muss;",
    neverSeenPatientMonths: "Datensätze von Personen, die nie zu einem Besuch erschienen sind: {period};",
    patientNoteDays: "Notizen, die Sie einer Buchung hinzufügen: {period} nach dem Termin;",
    messageBodyMonths: "der Text von Nachrichten: {period}, danach bleiben nur Datum, Kanal und Zustellstatus;",
    messageMetaMonths: "Nachrichtenprotokolle (Datum, Kanal, Zustellstatus): {period};",
    reminderDays: "Erinnerungspläne: {period} nach dem Versand;",
    providerMessageDays: "beim SMS- und WhatsApp-Anbieter gespeicherte Kopien: nach {period} gelöscht;",
    waitlistDays: "Wartelisteneinträge: {period} nach ihrem Abschluss;",
    auditMonths: "das Zugriffsprotokoll: {period};",
    formSubmissionMonths: "Anamnesebögen: {period}, und nur, nachdem sie in die Patientenakte der Praxis übernommen wurden;",
    consentMonths: "Nachweise Ihrer Einwilligungen und Entscheidungen: bis zu {period}, um sie belegen zu können;",
    privacyRequestMonths: "Datenschutzanfragen und ihre Antworten: {period} nach ihrem Abschluss;",
    marketingLapse: "die Einwilligung in Neuigkeiten und Angebote erlischt nach 24 Monaten ohne Kontakt.",
    after:
      "Nach Ablauf dieser Fristen werden die Daten automatisch gelöscht oder pseudonymisiert. Pseudonymisierte Termindatensätze zeigen weder Ihren Namen noch Ihre Kontaktdaten und werden nur für Statistiken und die Unterlagen der Praxis aufbewahrt.",
    platformBookings:
      "Buchungsdaten des Marktplatzes: solange die Buchung verwaltet wird und nicht länger, als die Praxis ihre eigene Kopie aufbewahrt;",
    platformReviews: "veröffentlichte Bewertungen: bis Sie sie löschen oder sie entfernt werden;",
    platformCodes: "Einmalcodes: {period} nach ihrem Ablauf gelöscht; Sitzungen im Datenschutz-Center enden nach 30 Minuten;",
  },
  rights: {
    intro: "Sie haben das Recht:",
    access: "auf Auskunft über Ihre Daten und eine Kopie davon (Art. 15 DSGVO);",
    rectification: "auf Berichtigung unrichtiger und Vervollständigung unvollständiger Daten (Art. 16);",
    erasure:
      "auf Löschung Ihrer Daten, wenn sie nicht mehr benötigt werden oder Sie Ihre Einwilligung widerrufen, außer dem, was wir gesetzlich aufbewahren müssen (Art. 17);",
    restriction: "auf Einschränkung der Verarbeitung, zum Beispiel während eine Berichtigung geprüft wird (Art. 18);",
    portability:
      "die von Ihnen bereitgestellten Daten in einem strukturierten, maschinenlesbaren Format zu erhalten oder an einen anderen Verantwortlichen übermitteln zu lassen (Art. 20);",
    objection: "einer Verarbeitung auf Grundlage berechtigter Interessen, einschließlich Profiling, zu widersprechen (Art. 21);",
    withdraw:
      "Ihre Einwilligung jederzeit zu widerrufen, ohne dass die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung berührt wird (Art. 7 Abs. 3);",
    automated: "keiner ausschließlich auf einer automatisierten Verarbeitung beruhenden Entscheidung unterworfen zu werden (Art. 22).",
    how: "So geht es: online im Datenschutz-Center unter {url}, wo Sie sich mit einem an Ihr Telefon oder Ihre E-Mail-Adresse gesendeten Einmalcode anmelden; über den Link in Ihren Terminnachrichten; oder schriftlich an {email}.",
    howNoContact:
      "So geht es: online im Datenschutz-Center unter {url}, wo Sie sich mit einem an Ihr Telefon oder Ihre E-Mail-Adresse gesendeten Einmalcode anmelden, oder über den Link in Ihren Terminnachrichten.",
    deadline:
      "Wir antworten innerhalb eines Monats. Bei komplexen Anfragen kann diese Frist um zwei weitere Monate verlängert werden; den Grund teilen wir Ihnen innerhalb des ersten Monats mit (Art. 12 Abs. 3 DSGVO). Die Ausübung Ihrer Rechte ist kostenlos.",
    recipientsInformed:
      "Wenn wir Ihre Daten berichtigen, löschen oder ihre Verwendung einschränken, teilen wir dies auch den Empfängern mit, denen wir sie übermittelt haben (Art. 19 DSGVO).",
  },
  complaint: {
    body: "Wenn Sie der Ansicht sind, dass Ihre Daten rechtswidrig verarbeitet werden, können Sie Beschwerde bei der italienischen Datenschutzbehörde, dem Garante per la protezione dei dati personali (Piazza Venezia 11, 00187 Roma, www.garanteprivacy.it), oder bei der Aufsichtsbehörde des EU-Landes einlegen, in dem Sie leben oder arbeiten (Art. 77 DSGVO). Sie können auch den Rechtsweg beschreiten (Art. 79 DSGVO).",
  },
  mandatory: {
    practice:
      "Für eine Buchung müssen Sie Ihren Namen und eine Handynummer oder E-Mail-Adresse angeben: Ohne diese kann die Praxis den Termin weder buchen noch Sie daran erinnern. Das Geburtsdatum ist freiwillig, bei der Buchung für ein Kind jedoch erforderlich. Jede Einwilligung ist freiwillig: Eine Ablehnung hindert Sie nie am Buchen oder an einer Behandlung.",
    platform:
      "Die Einwilligung in die Buchung über Sorriso ist nur erforderlich, um über die Suchseiten von Sorriso zu buchen. Wenn Sie sie nicht erteilen möchten, können Sie direkt bei der Praxis buchen, über deren eigene Website oder telefonisch.",
  },
  automated: {
    none: "Es wird keine Entscheidung über Sie ausschließlich automatisiert getroffen (Art. 22 DSGVO).",
    profiling:
      "Diese Praxis verwendet angepasste Erinnerungen: Ihr Terminverlauf wird verwendet, um zu entscheiden, ob Ihnen eine zusätzliche Erinnerung gesendet wird. Dies ist ein Profiling, bietet aber nur Unterstützung und schränkt Ihre Buchung nie ein. Sie können jederzeit widersprechen.",
    platform:
      "Suchergebnisse werden nach veröffentlichten Kriterien geordnet, und Bewertungen werden vor der Veröffentlichung automatisch auf Gesundheitsangaben geprüft; ob eine Bewertung entfernt wird, entscheidet immer ein Mensch. Es wird keine Entscheidung mit rechtlicher oder ähnlich erheblicher Wirkung ausschließlich automatisiert getroffen.",
  },
  minors: {
    body: "Kinder unter 14 Jahren werden von einem Elternteil oder gesetzlichen Vertreter angemeldet, der die Nachrichten erhält und alle Einwilligungen erteilt (Art. 2-quinquies des italienischen Datenschutzkodex). Ab 14 Jahren können Jugendliche selbst buchen und diese Entscheidungen treffen. Der Zugriff eines Elternteils oder gesetzlichen Vertreters über das Datenschutz-Center endet, wenn das Kind 18 Jahre alt wird.",
    link: "Eine Version dieser Hinweise für junge Menschen finden Sie unter {url}.",
  },
  marketplace: {
    body: "Wenn Sie über die Suchseiten von Sorriso gebucht haben, ist Sorriso für diese Buchung auch eigenständiger Verantwortlicher: Es leitet sie an die Praxis weiter und verwaltet Erinnerungen und Änderungen, mit Ihrer ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO). Wie, erklären die Datenschutzhinweise von Sorriso: {url}.",
    withdraw:
      "Wenn Sie diese Einwilligung widerrufen, beendet Sorriso die eigene Verarbeitung, während die Praxis behält, was sie für Ihre Behandlung benötigt (Art. 9 Abs. 2 lit. h DSGVO).",
  },
  withdrawal: {
    platform:
      "Wenn Sie Ihre Einwilligung in die Buchung über Sorriso widerrufen, beendet Sorriso die eigene Verarbeitung dieser Buchung: Es führt sie nicht mehr in Ihrem Marktplatz-Verlauf und sendet dazu keine eigenen Nachrichten und Einladungen mehr. Die Praxis behält als Verantwortlicher, was sie für Ihre Behandlung benötigt, nach Art. 9 Abs. 2 lit. h DSGVO, mit Sorriso als ihrem Auftragsverarbeiter. Der Widerruf berührt nicht die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung.",
  },
  roles: {
    intro: "Sorriso hat zwei Rollen:",
    controller:
      "eigenständiger Verantwortlicher für seine eigenen Dienste: auf den Suchseiten von Sorriso begonnene Buchungen, das Verzeichnis der Praxen und Behandler, veröffentlichte Bewertungen, die Reihenfolge der Suchergebnisse und das Datenschutz-Center. Diese Hinweise gelten dafür;",
    processor:
      "Auftragsverarbeiter der Praxen (Art. 28 DSGVO) für alles, was über die eigenen Kanäle einer Praxis kommt: ihre Website, ihr Buchungs-Widget oder ihre Links, ihr Personal und ihre Software. Dafür ist die Praxis der Verantwortliche, und es gelten ihre eigenen Datenschutzhinweise: Sie finden sie auf der Seite der Praxis.",
  },
  changes: {
    body: "Wir aktualisieren diese Hinweise, wenn sich unsere Verarbeitung ändert, und bewahren jede frühere Version auf: Sie können die Version anfordern, die zum Zeitpunkt Ihrer Buchung galt. Dies ist Version {version}.",
  },
  cookiesLink: {
    body: "Sorriso verwendet nur technische Cookies und keine Cookies von Drittanbietern: siehe die Cookie-Hinweise unter {url}.",
  },
  summary: {
    practice:
      "{practice} verwendet Ihre Angaben, um Ihre Zahnarzttermine zu buchen und zu verwalten, Ihnen Bestätigungen und Erinnerungen zu senden und Ihre Akte in der Praxis zu führen. Dies ist für die von Ihnen gewünschte Behandlung erforderlich (Art. 6 Abs. 1 lit. b und Art. 9 Abs. 2 lit. h DSGVO). Alles Freiwillige, etwa Einladungen zum Feedback oder Neuigkeiten, erfordert Ihre gesonderte Einwilligung, die Sie jederzeit widerrufen können.",
    platform:
      "Sorriso hilft Ihnen, eine Zahnarztpraxis zu finden und dort zu buchen. Wenn Sie über die Suchseiten von Sorriso buchen, leitet Sorriso Ihre Buchung mit Ihrer Einwilligung an die Praxis weiter. Wenn Sie über die eigene Website, das Buchungs-Widget oder das Personal einer Praxis buchen, ist die Praxis für Ihre Daten verantwortlich, und Sorriso betreibt nur die Software für sie.",
    rights:
      "Sie können Ihre Daten jederzeit einsehen, berichtigen, herunterladen oder löschen, ihre Verwendung einschränken oder ihr widersprechen und Einwilligungen widerrufen: online im Datenschutz-Center mit einem Einmalcode oder schriftlich an {email}. Sie können sich auch bei der italienischen Datenschutzbehörde (Garante) beschweren.",
    rightsNoContact:
      "Sie können Ihre Daten jederzeit einsehen, berichtigen, herunterladen oder löschen, ihre Verwendung einschränken oder ihr widersprechen und Einwilligungen widerrufen, online im Datenschutz-Center mit einem Einmalcode. Sie können sich auch bei der italienischen Datenschutzbehörde (Garante) beschweren.",
  },
  minor: {
    summary:
      "Diese Seite erklärt in einfachen Worten, was {practice} mit Informationen über Sie macht, wenn Sie einen Zahnarzttermin haben.",
    who: "{controller} ist für Ihre Informationen verantwortlich. Wenn Sie Fragen haben, können Sie oder Ihre Eltern an {email} schreiben.",
    whoNoContact:
      "{controller} ist für Ihre Informationen verantwortlich. Wenn Sie Fragen haben, können Sie oder Ihre Eltern in der Praxis nachfragen.",
    whatIntro: "Wir verwenden:",
    whatName: "Ihren Namen und Ihr Geburtsdatum;",
    whatAppointments: "Ihre Termine: wann sie sind und wofür;",
    whatContact:
      "die Telefonnummer oder E-Mail-Adresse, an die wir Erinnerungen senden: Ihre oder die Ihrer Eltern oder Ihres gesetzlichen Vertreters;",
    whatMessages: "die Nachrichten, die wir senden, und die Antworten, die wir erhalten.",
    why: "Um Ihre Besuche zu buchen, Sie daran zu erinnern und Ihre Zähne sicher zu behandeln. Wir verwenden sie nie für Werbung und verkaufen sie nie.",
    parents:
      "Wenn Sie unter 14 Jahre alt sind, bucht ein Elternteil oder Ihr gesetzlicher Vertreter für Sie, erhält die Erinnerungen und entscheidet über alles Freiwillige. Ab 14 können Sie selbst buchen und entscheiden. Wenn Sie 18 werden, können Ihre Eltern Ihre Daten nicht mehr über das Datenschutz-Center einsehen.",
    keep: "Nur so lange, wie es für Ihre Behandlung nötig ist und wie die Praxis sie gesetzlich aufbewahren muss. Danach werden sie gelöscht.",
    youCan:
      "Sie können verlangen, Ihre Informationen einzusehen, sie zu berichtigen, wenn etwas falsch ist, oder sie zu löschen, wenn sie nicht mehr benötigt werden. Das geht im Datenschutz-Center unter {url}, oder Sie bitten Ihre Eltern oder Ihren gesetzlichen Vertreter um Hilfe.",
    help: "Wenn Sie meinen, dass Ihre Informationen nicht richtig behandelt werden, können Sie oder Ihre Eltern sich bei der italienischen Datenschutzbehörde beschweren (Garante per la protezione dei dati personali, www.garanteprivacy.it).",
    full: "Dies ist eine vereinfachte Fassung. Die vollständigen Hinweise finden Sie unter {url}.",
  },
  staff: {
    summary:
      "Diese Hinweise richten sich an die Personen, die das Sorriso-Dashboard in einer Zahnarztpraxis nutzen: Inhaber, Administratoren, Empfang und Behandler. Sie erklären, welche Daten über Sie verarbeitet werden und wie das Zugriffsprotokoll funktioniert.",
    controllers:
      "Sorriso ist Verantwortlicher für Ihr Benutzerkonto (Anmeldung, Zwei-Faktor-Authentifizierung, Sitzungen). Die Praxis, für die Sie arbeiten, ist Verantwortlicher für das Zugriffsprotokoll und für alles andere, was Sie in ihrem Terminkalender tun; Sorriso ist ihr Auftragsverarbeiter.",
    dataIntro: "Wir verarbeiten:",
    dataAccount: "Ihren Namen, Ihre E-Mail-Adresse, Ihre Rolle und Ihre bevorzugte Sprache;",
    dataSecurity:
      "Ihr Passwort (nur als Hashwert gespeichert), Ihr Geheimnis für die Zwei-Faktor-Authentifizierung (verschlüsselt) und Ihre Wiederherstellungscodes (als Hashwerte);",
    dataSessions: "Ihre Sitzungen und Anmeldeversuche, mit verschlüsselten Hashwerten der IP-Adresse und des Browsers;",
    dataLog: "das Zugriffsprotokoll: welche Patientendatensätze Sie wann öffnen oder ändern und mit welcher Aktion;",
    dataLegal: "Ihre Annahme der Anweisungen für Mitarbeitende und anderer Rechtsdokumente.",
    monitoring:
      "Das Zugriffsprotokoll ist eine für Gesundheitsdaten vorgeschriebene Sicherheitsmaßnahme (Art. 32 DSGVO). Es erfasst Datum und Uhrzeit, Ihren Benutzer, den Datensatz und die Aktion, nie die gelesenen Inhalte. Die Praxis kann es prüfen, um sicherzustellen, dass Datensätze nur zu Behandlungs- und Verwaltungszwecken geöffnet werden, und um Missbrauch aufzuklären. Da Sie in diesen Hinweisen und in den Anweisungen für Mitarbeitende darüber informiert werden, dürfen Informationen aus dem Protokoll in den Grenzen von Art. 4 Abs. 3 des Gesetzes Nr. 300/1970 (Arbeitnehmerstatut) und des Datenschutzrechts für Zwecke im Zusammenhang mit Ihrem Arbeitsverhältnis verwendet werden.",
    retentionSessions: "Sitzungen: bis zu ihrem Ablauf; Anmeldeversuche: {period};",
    retentionLog: "das Zugriffsprotokoll: wie von der Praxis festgelegt, mindestens {period};",
    retentionLegal: "Annahmen von Rechtsdokumenten: 10 Jahre, die Verjährungsfrist für ihren Nachweis;",
    retentionAccount: "Ihr Konto: bis es geschlossen wird oder Sie die Praxis verlassen.",
    rights:
      "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15-21 DSGVO). Wenden Sie sich für Ihr Konto an Sorriso unter {email}, für das Zugriffsprotokoll an die Praxis, für die Sie arbeiten.",
    rightsNoContact:
      "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15-21 DSGVO). Wenden Sie sich für Ihr Konto an Sorriso, für das Zugriffsprotokoll an die Praxis, für die Sie arbeiten.",
  },
  practitioner: {
    summary:
      "Diese Hinweise richten sich an Zahnärzte und andere Behandler, die im Verzeichnis von Sorriso aufgeführt sind. Sie erklären, wie Sorriso Ihre beruflichen Daten verarbeitet, wie Ihre Registereintragung geprüft wird und wie mit Bewertungen umgegangen wird, die Patienten über Sie schreiben.",
    controllers:
      "Sorriso ist Verantwortlicher für das Verzeichnis, Ihr öffentliches Profil, Bewertungen und die Reihenfolge der Suchergebnisse. Die Praxis, mit der Sie arbeiten, ist Verantwortlicher für Ihren Terminplan und die Daten ihrer Patienten; dafür ist Sorriso ihr Auftragsverarbeiter.",
    dataIntro: "Wir verarbeiten:",
    dataProfile:
      "Ihren Namen, Titel, Fachgebiet, Lebenslauf, gesprochene Sprachen, die Praxis und Standorte, an denen Sie arbeiten, sowie Ihre Verfügbarkeit;",
    dataAlbo:
      "Ihre Eintragung im Berufsregister (Albo degli Odontoiatri oder dei Medici Chirurghi), Provinz und Nummer sowie die dort aufgeführten anerkannten Fachrichtungen;",
    dataReviews: "die Bewertungen, die Patienten zu Besuchen bei Ihnen abgeben, Ihre Antworten und etwaige Meldungen;",
    dataMetrics:
      "die Kennzahlen für die Reihenfolge der Suchergebnisse: Absagen durch die Praxis, Vollständigkeit des Profils und Aufrufe Ihres Profils.",
    profile:
      "Ihr Profil wird erst öffentlich, nachdem Sie oder die Praxis es freigegeben haben, und Sie können sich jederzeit vom Marktplatz abmelden. Gesetzlich anerkannte Fachrichtungen werden erst angezeigt, nachdem Sorriso sie im öffentlichen Register geprüft hat.",
    reviews:
      "Nur Patienten mit einem verifizierten Besuch können Sie bewerten. Sie können antworten und eine Bewertung melden; jede Entscheidung über eine Meldung wird begründet und kann einmal angefochten werden.",
    retentionProfile: "Ihr Profil: bis Sie oder die Praxis es aus dem Verzeichnis entfernen;",
    retentionReviews: "Bewertungen: bis der Verfasser sie löscht oder sie entfernt werden;",
    retentionMetrics: "Ranking-Kennzahlen: berechnet über die letzten 180 Tage.",
    rights:
      "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15-21 DSGVO), einschließlich des Rechts, dem Ranking zu widersprechen. Schreiben Sie an Sorriso unter {email}.",
    rightsNoContact:
      "Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15-21 DSGVO), einschließlich des Rechts, dem Ranking zu widersprechen. Schreiben Sie an Sorriso.",
  },
  cookies: {
    summary:
      "Sorriso verwendet keine Werbe- oder Tracking-Cookies, und während Sie surfen, laden die Seiten nichts von Servern anderer Unternehmen. Wir verwenden nur die wenigen technischen Cookies, die für den Betrieb der Website nötig sind. Sie erfordern keine Einwilligung, deshalb gibt es kein Cookie-Banner.",
    item: "{name}: {purpose} Dauer: {duration}.",
    staffSession: {
      name: "Sitzung des Praxispersonals ({names})",
      purpose: "hält Praxispersonal im Dashboard angemeldet. Wird nur gesetzt, wenn sich Mitarbeitende anmelden.",
      duration: "bis zur Abmeldung, höchstens 24 Stunden, und 30 Minuten ohne Aktivität",
    },
    locale: {
      name: "Sprache ({names})",
      purpose: "speichert die Sprache, die Sie mit der Sprachauswahl gewählt haben. Wird nur gesetzt, wenn Sie eine Sprache wählen.",
      duration: "1 Jahr",
    },
    privacyCenter: {
      name: "Datenschutz-Center ({names})",
      purpose: "hält Sie im Datenschutz-Center angemeldet, nachdem Sie einen Einmalcode eingegeben haben.",
      duration: "30 Minuten",
    },
    storageIntro:
      "Neben diesen Cookies speichert Sorriso nur Folgendes im Speicher Ihres Browsers. Es verlässt nie Ihr Gerät und wird nur gesetzt, wenn Sie die Funktion nutzen:",
    storageItem: "{key}: {purpose}",
    storageItems: {
      dashboardPrivacyScreen:
        "speichert auf diesem Gerät, ob das Praxispersonal den Sichtschutz des Dashboards eingeschaltet hat, der Patientennamen im Kalender unscharf macht, damit Personen am Empfang sie nicht lesen können. Bleibt gespeichert, bis er ausgeschaltet wird.",
    },
    thirdPartiesIntro:
      "Die Seiten laden keine Skripte, Schriftarten, Bilder oder Frames anderer Unternehmen. Zwei Ausnahmen gibt es nur, wenn Sie sie anfordern:",
    map: "die Karte auf der Seite einer Praxis erscheint erst, nachdem Sie zum Anzeigen geklickt haben. Ihr Browser lädt sie dann von OpenStreetMap (OpenStreetMap Foundation), die Ihre IP-Adresse nach ihrer eigenen Datenschutzrichtlinie erhält: https://osmfoundation.org/wiki/Privacy_Policy;",
    links: "Links wie Routenbeschreibungen öffnen andere Websites, zum Beispiel Google Maps, in einem neuen Tab: Diese Websites wenden ihre eigenen Richtlinien an.",
    legalBasis:
      "Technische Cookies sind ohne Einwilligung zulässig nach Art. 122 des italienischen Datenschutzkodex und den Leitlinien des Garante zu Cookies und anderen Tracking-Instrumenten vom 10. Juni 2021. Diese Hinweise informieren Sie darüber.",
    control:
      "Sie können Cookies jederzeit in den Einstellungen Ihres Browsers löschen. Ohne die technischen Cookies funktionieren die Anmeldung und das Speichern Ihrer Sprache nicht.",
    widget:
      "Das auf der Website einer Praxis angezeigte Buchungs-Widget setzt keine eigenen Cookies. Die Website der Praxis kann andere Cookies verwenden: siehe deren eigene Cookie-Hinweise.",
  },
} satisfies DeepPartial<Messages["legalPatient"]>;
