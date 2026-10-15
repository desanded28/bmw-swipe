import type { DeepPartial, Messages } from "../../types";

export default {
  greeting: "Dzień dobry, {name}!",
  footer: {
    why: "Ta wiadomość została wysłana w związku z aktywnością na koncie Sorriso.",
    notYou: "Jeśli to nie była czynność właściciela konta, należy zmienić hasło i poinformować właściciela gabinetu.",
  },
  verifyEmail: {
    subject: "Potwierdź adres e-mail",
    body: "Prosimy o potwierdzenie tego adresu e-mail, aby dokończyć konfigurację gabinetu {practice} w Sorriso. Link jest ważny przez 24 godziny.",
    cta: "Potwierdź adres e-mail",
  },
  verifyEmailAgain: {
    subject: "Potwierdź adres e-mail",
    body: "Prosimy o potwierdzenie, że to jest adres e-mail konta Sorriso. Link jest ważny przez 24 godziny.",
    cta: "Potwierdź adres e-mail",
  },
  verifyPracticeEmail: {
    subject: "Potwierdź adres e-mail gabinetu {practice}",
    body: "{owner} podał(a) ten adres jako adres e-mail gabinetu {practice} w Sorriso. Będą na niego trafiać odpowiedzi pacjentów i wnioski dotyczące prywatności, a rezerwacja online pozostaje wstrzymana do czasu jego potwierdzenia. Link jest ważny przez 24 godziny. Jeśli ten gabinet nie jest znany, wystarczy zignorować tę wiadomość: nic się nie zmieni.",
    cta: "Potwierdź ten adres",
  },
  signupExisting: {
    subject: "Próba założenia konta z tym adresem e-mail",
    body: "Ktoś, być może właściciel tego adresu, próbował założyć nowy gabinet w Sorriso z tym adresem e-mail, który ma już konto. Jeśli to była próba właściciela, wystarczy się zalogować lub zresetować zapomniane hasło. W przeciwnym razie można zignorować tę wiadomość: nic nie zostało zmienione.",
    cta: "Zaloguj się",
  },
  passwordReset: {
    subject: "Resetowanie hasła Sorriso",
    body: "Otrzymaliśmy prośbę o zresetowanie hasła do tego konta. Link jest ważny przez 30 minut i działa jednorazowo. Jeśli prośba nie pochodzi od właściciela konta, wystarczy zignorować tę wiadomość: hasło pozostanie bez zmian.",
    cta: "Ustaw nowe hasło",
  },
  passwordChanged: {
    subject: "Hasło Sorriso zostało zmienione",
    body: "Hasło do konta zostało zmienione ({when}), a wszystkie urządzenia zostały wylogowane. Jeśli zmiana nie została dokonana przez właściciela konta, należy natychmiast zresetować hasło.",
    cta: "Zresetuj hasło",
  },
  invite: {
    subject: "Zaproszenie do gabinetu {practice} w Sorriso",
    body: "{inviter} zaprasza do gabinetu {practice} w Sorriso w roli: {role}. Zaproszenie jest ważne przez 7 dni.",
    cta: "Przyjmij zaproszenie",
  },
  failedLogins: {
    subject: "Nieudane próby logowania na konto",
    body: "Liczba nieudanych prób logowania na konto Sorriso w ciągu ostatnich 15 minut: {count}. Kolejne próby są na jakiś czas zablokowane. Jeśli to nie były próby właściciela konta, warto zmienić hasło i włączyć weryfikację dwuetapową.",
    cta: "Sprawdź bezpieczeństwo",
  },
  newDevice: {
    subject: "Nowe logowanie na konto Sorriso",
    body: "Nastąpiło logowanie na konto z nowego urządzenia ({device}): {when}. Jeśli to logowanie właściciela konta, nie trzeba nic robić. W przeciwnym razie należy natychmiast wylogować tę sesję i zmienić hasło.",
    cta: "Sprawdź urządzenia",
  },
  apiKeyCreated: {
    subject: "Utworzono nowy klucz API dla gabinetu {practice}",
    body: "{creator} utworzył(a) klucz API \"{name}\" dla gabinetu {practice} ({when}) z następującymi uprawnieniami: {scopes}. Data wygaśnięcia: {expires}. Klucze API pozwalają oprogramowaniu odczytywać i zmieniać dane pacjentów: jeśli ten klucz jest nieznany, należy go natychmiast unieważnić.",
    cta: "Sprawdź klucze API",
  },
  mfaReset: {
    subject: "Weryfikacja dwuetapowa została zresetowana",
    body: "{actor} zresetował(a) weryfikację dwuetapową konta w gabinecie {practice} ({when}). Nastąpiło wylogowanie ze wszystkich urządzeń, a przy następnym logowaniu trzeba będzie skonfigurować nową aplikację uwierzytelniającą.",
    cta: "Zaloguj się",
  },
} satisfies DeepPartial<Messages["authEmails"]>;
