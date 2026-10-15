import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    login: "Praxis-Login",
    mfa: "Zwei-Faktor-Authentifizierung",
    signup: "Praxis anlegen",
    reset: "Passwort zurücksetzen",
    resetNew: "Neues Passwort wählen",
    invite: "Einer Praxis beitreten",
    verify: "E-Mail-Adresse bestätigen",
  },
  fields: {
    email: "E-Mail",
    password: "Passwort",
    name: "Ihr Name",
    newPassword: "Neues Passwort",
    confirmPassword: "Passwort wiederholen",
    passwordHint: "Mindestens 12 Zeichen. Ein kurzer Satz ist leicht zu merken und schwer zu erraten.",
    show: "Passwort anzeigen",
    hide: "Passwort ausblenden",
  },
  login: {
    title: "Praxis-Login",
    subtitle: "Kalender, Patienten und Erinnerungen verwalten.",
    submit: "Anmelden",
    forgot: "Passwort vergessen?",
    newPractice: "Neue Praxis?",
    createAccount: "Konto erstellen",
    demoTitle: "Demokonten (Passwort demo1234)",
    demoOwner: "Inhaber, 2 Praxen",
    demoReception: "Empfang",
    demoFill: "Demo-Anmeldedaten einfügen",
    notices: {
      noPractice: "Ihr Konto ist noch keiner Praxis zugeordnet. Bitten Sie den Inhaber der Praxis, Sie einzuladen.",
      passwordChanged: "Ihr Passwort wurde geändert. Melden Sie sich mit dem neuen Passwort an.",
      verified: "E-Mail-Adresse bestätigt. Sie können sich jetzt anmelden.",
      signedOut: "Sie wurden abgemeldet.",
      mfaReset: "Melden Sie sich erneut an, um den Vorgang abzuschließen.",
    },
  },
  mfa: {
    title: "Zwei-Faktor-Authentifizierung",
    subtitle: "Geben Sie den 6-stelligen Code aus Ihrer Authenticator-App ein.",
    code: "Bestätigungscode",
    codeHint: "Sie können auch einen Ihrer Wiederherstellungscodes eingeben.",
    submit: "Bestätigen",
    cancel: "Anderes Konto verwenden",
    lostDevice:
      "Telefon verloren? Verwenden Sie einen Ihrer Wiederherstellungscodes oder bitten Sie einen Inhaber oder Administrator Ihrer Praxis, Ihre Zwei-Faktor-Authentifizierung zurückzusetzen.",
  },
  signup: {
    title: "Praxis anlegen",
    subtitle:
      "Online-Buchung, Kalender für mehrere Standorte und Bestätigungen per SMS/WhatsApp. In zwei Minuten eingerichtet.",
    practiceName: "Name der Praxis",
    practicePlaceholder: "Studio Dentistico Rossi",
    address: "Adresse des Standorts",
    addressPlaceholder: "Via Roma 1",
    city: "Stadt",
    cityPlaceholder: "Milano",
    phone: "Telefon der Praxis",
    phoneHint: "Wird Patienten und in Erinnerungen angezeigt",
    phonePlaceholder: "+39 02 1234 5678",
    isDentist:
      "Ich bin auch Zahnarzt in dieser Praxis (meinen Kalender anlegen, Mo–Fr 9–13 / 14–18 Uhr)",
    acceptTerms: "Ich akzeptiere die <terms>Nutzungsbedingungen</terms>.",
    acceptDpa:
      "Im Namen der Praxis akzeptiere ich den <dpa>Auftragsverarbeitungsvertrag</dpa> (Art. 28 DSGVO) und die Liste der <subprocessors>Unterauftragsverarbeiter</subprocessors>.",
    submit: "Praxis anlegen",
    haveAccount: "Sie haben bereits ein Konto?",
    login: "Anmelden",
    sentTitle: "Prüfen Sie Ihren Posteingang",
    sentBody:
      "Wir haben eine E-Mail an {email} gesendet. Öffnen Sie den darin enthaltenen Link, um Ihre Adresse zu bestätigen: Er ist 24 Stunden gültig. Melden Sie sich dann an, um die Einrichtung Ihrer Praxis abzuschließen.",
    sentNoEmail: "Nichts erhalten? Prüfen Sie Ihren Spam-Ordner oder versuchen Sie es in einigen Minuten erneut.",
  },
  starter: {
    room: "Behandlungsstuhl {n}",
    firstVisit: "Zahnärztliche Erstuntersuchung",
    cleaning: "Professionelle Zahnreinigung",
    emergency: "Zahnärztlicher Notfall",
    specialty: "Allgemeine Zahnheilkunde",
    title: "Dr.",
  },
  reset: {
    title: "Passwort zurücksetzen",
    subtitle:
      "Geben Sie die E-Mail-Adresse Ihres Kontos ein, und wir senden Ihnen einen Link, um ein neues Passwort zu wählen.",
    submit: "Link senden",
    sentTitle: "Prüfen Sie Ihren Posteingang",
    sentBody:
      "Falls für {email} ein Konto besteht, haben wir einen Link gesendet, um ein neues Passwort zu wählen. Der Link ist 30 Minuten gültig.",
    back: "Zurück zur Anmeldung",
    newTitle: "Neues Passwort wählen",
    newSubtitle: "Sie werden auf allen Geräten abgemeldet und können sich dann mit dem neuen Passwort anmelden.",
    submitNew: "Neues Passwort speichern",
    invalid: "Dieser Link ist ungültig oder abgelaufen. Fordern Sie einen neuen an.",
    requestNew: "Neuen Link anfordern",
  },
  verify: {
    title: "E-Mail-Adresse bestätigen",
    body: "Bestätigen Sie {email} als E-Mail-Adresse Ihres Sorriso-Kontos.",
    bodyPractice:
      "Bestätigen Sie {email} als E-Mail-Adresse von {practice} auf Sorriso. Antworten von Patienten und Datenschutzanfragen gehen an diese Adresse, und die Online-Buchung startet, sobald sie bestätigt ist.",
    submit: "E-Mail-Adresse bestätigen",
    submitPractice: "Diese Adresse bestätigen",
    invalid:
      "Dieser Bestätigungslink ist ungültig oder abgelaufen. Melden Sie sich an und senden Sie unter Meine Sicherheit einen neuen.",
    login: "Anmelden",
  },
  invite: {
    title: "{practice} beitreten",
    body: "{inviter} hat Sie eingeladen, {practice} auf Sorriso als {role} beizutreten.",
    invalid:
      "Diese Einladung ist ungültig, abgelaufen oder wurde bereits verwendet. Bitten Sie die Praxis um eine neue.",
    existingAccount:
      "Sie haben bereits ein Sorriso-Konto mit dieser E-Mail-Adresse. Melden Sie sich an, um die Einladung anzunehmen.",
    login: "Anmelden und annehmen",
    wrongAccount:
      "Sie sind mit einem anderen Konto angemeldet. Melden Sie sich ab und öffnen Sie dann den Einladungslink erneut.",
    logout: "Abmelden",
    instructionsLead: "Bevor Sie beitreten, lesen Sie, wie die Praxis von Ihnen den Umgang mit Patientendaten erwartet.",
    instructionsRequired: "Bitte bestätigen Sie, dass Sie die Anweisungen gelesen haben.",
    submit: "Der Praxis beitreten",
    newAccount: "Konto erstellen",
  },
  password: {
    too_short: "Verwenden Sie mindestens 12 Zeichen.",
    too_long: "Verwenden Sie höchstens 128 Zeichen.",
    common: "Dieses Passwort ist zu verbreitet. Wählen Sie etwas, das schwerer zu erraten ist.",
    too_simple: "Dieses Passwort verwendet zu wenige unterschiedliche Zeichen.",
    contains_personal: "Verwenden Sie nicht Ihren Namen oder Ihre E-Mail-Adresse in Ihrem Passwort.",
    mismatch: "Die beiden Passwörter stimmen nicht überein.",
  },
  errors: {
    invalidCredentials: "E-Mail-Adresse oder Passwort falsch.",
    throttled: "Zu viele Versuche. Bitte warten Sie 15 Minuten und versuchen Sie es dann erneut.",
    rateLimited: "Zu viele Anfragen. Bitte versuchen Sie es später erneut.",
    invalidCode: "Dieser Code ist ungültig. Prüfen Sie Ihre Authenticator-App und versuchen Sie es erneut.",
    mfaExpired: "Ihre Anmeldung ist abgelaufen. Bitte melden Sie sich erneut an.",
    termsRequired:
      "Bitte akzeptieren Sie die Nutzungsbedingungen und den Auftragsverarbeitungsvertrag, um fortzufahren.",
    invalidForm: "Bitte prüfen Sie die markierten Felder.",
    generic: "Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.",
  },
} satisfies DeepPartial<Messages["auth"]>;
