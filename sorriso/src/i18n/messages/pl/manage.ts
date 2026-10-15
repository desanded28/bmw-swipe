import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Moja wizyta",
    description: "Sprawdź, potwierdź, przełóż lub odwołaj wizytę.",
  },
  greeting: "Dzień dobry, {name}!",
  title: "Wizyta – {clinic}",
  status: {
    cancelled: "Odwołana",
    requested: "Oczekuje na potwierdzenie gabinetu",
    completed: "Odbyta",
    no_show: "Nieodbyta",
    confirmed: "Zarezerwowana i potwierdzona",
    pending: "Zarezerwowana: prosimy o potwierdzenie",
  },
  details: {
    when: "Kiedy",
    timeRange: "{start}–{end}",
    treatment: "Zabieg",
    where: "Gdzie",
    address: "{address}, {city}",
    phone: "Telefon",
  },
  confirm: {
    title: "Potwierdzić obecność?",
    body: "Potwierdzenie pomaga gabinetowi {clinic} zaplanować dzień i gwarantuje zachowanie terminu.",
    button: "Tak, będę",
    done: "Dziękujemy! Obecność została potwierdzona.",
  },
  reschedule: {
    button: "Zmień termin",
    title: "Wybierz nowy termin: {practitioner}",
    moveTo: "Przenieść wizytę na nowy termin: {when}?",
    moveToOffice: "Przenieść wizytę na nowy termin: {when}, placówka {office}?",
    confirm: "Potwierdź nowy termin",
    done: "Gotowe: wizyta została przeniesiona.",
    closed: p({
      one: "Zmiana terminu online jest możliwa najpóźniej {count} godzinę przed wizytą.",
      few: "Zmiana terminu online jest możliwa najpóźniej {count} godziny przed wizytą.",
      many: "Zmiana terminu online jest możliwa najpóźniej {count} godzin przed wizytą.",
      other: "Zmiana terminu online jest możliwa najpóźniej {count} godziny przed wizytą.",
    }),
    call: "Aby zmienić termin, zadzwoń: <tel>{phone}</tel>.",
  },
  cancel: {
    button: "Odwołaj wizytę",
    title: "Odwołać tę wizytę?",
    late: p({
      one: "Do wizyty została mniej niż {count} godzina. Odwołanie nadal zwalnia termin dla osoby z listy oczekujących: dziękujemy za informację.",
      few: "Do wizyty zostały mniej niż {count} godziny. Odwołanie nadal zwalnia termin dla osoby z listy oczekujących: dziękujemy za informację.",
      many: "Do wizyty zostało mniej niż {count} godzin. Odwołanie nadal zwalnia termin dla osoby z listy oczekujących: dziękujemy za informację.",
      other: "Do wizyty zostało mniej niż {count} godziny. Odwołanie nadal zwalnia termin dla osoby z listy oczekujących: dziękujemy za informację.",
    }),
    body: "Termin zostanie zaproponowany pacjentom z listy oczekujących.",
    reason: "Powód",
    reasonHint: "Opcjonalnie. Widoczne tylko dla gabinetu. Nie podawaj informacji o zdrowiu.",
    confirm: "Tak, odwołaj",
    keep: "Zachowaj wizytę",
    done: "Wizyta została odwołana.",
  },
  calendar: {
    appleOutlook: "Apple / Outlook",
    google: "Kalendarz Google",
  },
  review: {
    title: "Jak przebiegła wizyta?",
    button: "Wystaw opinię",
  },
  rebook: "Umów kolejną wizytę",
  privateLink: "Nie udostępniaj tego linku: każdy, kto go ma, może zarządzać tą wizytą.",
  clinicPage: "Strona gabinetu {clinic}",
  invalid: {
    title: "Ten link nie działa",
    body: "Może być niepełny lub zawierać błąd. Sprawdź, czy został otwarty cały link z wiadomości, albo skontaktuj się z gabinetem.",
  },
  expired: {
    title: "Ten link wygasł",
    body: "Ze względu na ochronę prywatności linki do wizyt przestają działać jakiś czas po wizycie. Aby umówić się ponownie lub zapytać o wcześniejszą wizytę, skontaktuj się bezpośrednio z gabinetem.",
    privacyCenter: "Dane przechowywane przez gabinety można sprawdzić w centrum prywatności.",
  },
  rateLimited: {
    title: "Zbyt wiele żądań",
    body: p({
      one: "Ta strona została otwarta zbyt wiele razy w krótkim czasie. Spróbuj ponownie za {count} minutę.",
      few: "Ta strona została otwarta zbyt wiele razy w krótkim czasie. Spróbuj ponownie za {count} minuty.",
      many: "Ta strona została otwarta zbyt wiele razy w krótkim czasie. Spróbuj ponownie za {count} minut.",
      other: "Ta strona została otwarta zbyt wiele razy w krótkim czasie. Spróbuj ponownie za {count} minuty.",
    }),
  },
  preview: {
    title: "Moja wizyta",
    body: "Otwórz ten link w przeglądarce, aby zobaczyć wizytę i nią zarządzać.",
  },
  home: "Przejdź do strony głównej",
} satisfies DeepPartial<Messages["manage"]>;
