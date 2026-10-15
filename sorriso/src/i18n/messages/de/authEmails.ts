import type { DeepPartial, Messages } from "../../types";

export default {
  greeting: "Hallo {name},",
  footer: {
    why: "Sie erhalten diese E-Mail aufgrund von Aktivitäten in Ihrem Sorriso-Konto.",
    notYou: "Wenn Sie das nicht waren, ändern Sie Ihr Passwort und informieren Sie den Inhaber Ihrer Praxis.",
  },
  verifyEmail: {
    subject: "Bestätigen Sie Ihre E-Mail-Adresse",
    body: "Bitte bestätigen Sie, dass dies Ihre E-Mail-Adresse ist, um die Einrichtung von {practice} auf Sorriso abzuschließen. Der Link ist 24 Stunden gültig.",
    cta: "E-Mail-Adresse bestätigen",
  },
  verifyEmailAgain: {
    subject: "Bestätigen Sie Ihre E-Mail-Adresse",
    body: "Bitte bestätigen Sie, dass dies die E-Mail-Adresse Ihres Sorriso-Kontos ist. Der Link ist 24 Stunden gültig.",
    cta: "E-Mail-Adresse bestätigen",
  },
  verifyPracticeEmail: {
    subject: "Bestätigen Sie die E-Mail-Adresse von {practice}",
    body: "{owner} hat diese Adresse als E-Mail-Adresse von {practice} auf Sorriso angegeben. Antworten von Patienten und Datenschutzanfragen werden hierher gesendet, und die Online-Buchung bleibt pausiert, bis sie bestätigt ist. Der Link ist 24 Stunden gültig. Wenn Sie diese Praxis nicht kennen, ignorieren Sie diese E-Mail: Es ändert sich nichts.",
    cta: "Diese Adresse bestätigen",
  },
  signupExisting: {
    subject: "Jemand wollte mit Ihrer E-Mail-Adresse ein Konto anlegen",
    body: "Jemand, möglicherweise Sie, hat versucht, mit dieser E-Mail-Adresse, zu der bereits ein Konto besteht, eine neue Praxis auf Sorriso anzulegen. Wenn Sie es waren, melden Sie sich stattdessen an oder setzen Sie Ihr Passwort zurück, falls Sie es vergessen haben. Wenn Sie es nicht waren, können Sie diese E-Mail ignorieren: Es wurde nichts geändert.",
    cta: "Anmelden",
  },
  passwordReset: {
    subject: "Setzen Sie Ihr Sorriso-Passwort zurück",
    body: "Wir haben eine Anfrage erhalten, das Passwort dieses Kontos zurückzusetzen. Der Link ist 30 Minuten gültig und funktioniert nur einmal. Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail: Ihr Passwort bleibt unverändert.",
    cta: "Neues Passwort wählen",
  },
  passwordChanged: {
    subject: "Ihr Sorriso-Passwort wurde geändert",
    body: "Das Passwort Ihres Kontos wurde am {when} geändert, und alle Geräte wurden abgemeldet. Wenn Sie das nicht waren, setzen Sie Ihr Passwort sofort zurück.",
    cta: "Passwort zurücksetzen",
  },
  invite: {
    subject: "{inviter} hat Sie zu {practice} auf Sorriso eingeladen",
    body: "{inviter} hat Sie eingeladen, {practice} auf Sorriso als {role} beizutreten. Die Einladung ist 7 Tage gültig.",
    cta: "Einladung annehmen",
  },
  failedLogins: {
    subject: "Fehlgeschlagene Anmeldeversuche bei Ihrem Konto",
    body: "In den letzten 15 Minuten gab es {count} fehlgeschlagene Versuche, sich bei Ihrem Sorriso-Konto anzumelden. Weitere Versuche sind daher eine Zeit lang gesperrt. Wenn Sie das nicht waren, sollten Sie Ihr Passwort ändern und die Zwei-Faktor-Authentifizierung aktivieren.",
    cta: "Sicherheit überprüfen",
  },
  newDevice: {
    subject: "Neue Anmeldung bei Ihrem Sorriso-Konto",
    body: "Am {when} wurde Ihr Konto von einem neuen Gerät ({device}) aus angemeldet. Wenn Sie das waren, müssen Sie nichts tun. Wenn nicht, melden Sie diese Sitzung ab und ändern Sie sofort Ihr Passwort.",
    cta: "Geräte überprüfen",
  },
  apiKeyCreated: {
    subject: "Für {practice} wurde ein neuer API-Schlüssel erstellt",
    body: "{creator} hat am {when} den API-Schlüssel \"{name}\" für {practice} erstellt, mit folgenden Zugriffsrechten: {scopes}. Er läuft am {expires} ab. Mit API-Schlüsseln kann Software Patientendaten lesen und ändern: Wenn Sie diesen Schlüssel nicht kennen, widerrufen Sie ihn jetzt.",
    cta: "API-Schlüssel überprüfen",
  },
  mfaReset: {
    subject: "Ihre Zwei-Faktor-Authentifizierung wurde zurückgesetzt",
    body: "{actor} hat am {when} die Zwei-Faktor-Authentifizierung Ihres Kontos bei {practice} zurückgesetzt. Sie wurden überall abgemeldet und richten bei der nächsten Anmeldung eine neue Authenticator-App ein.",
    cta: "Anmelden",
  },
} satisfies DeepPartial<Messages["authEmails"]>;
