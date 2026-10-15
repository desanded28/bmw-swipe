import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Panel",
    template: "{page} · {app}",
  },
  skipToContent: "Przejdź do treści głównej",

  nav: {
    label: "Panel",
    overview: "Przegląd",
    calendar: "Kalendarz",
    confirmations: "Potwierdzenia",
    messages: "Wiadomości",
    patients: "Pacjenci",
    duplicates: "Możliwe duplikaty",
    waitlist: "Lista oczekujących",
    recalls: "Przypomnienia o kontroli",
    reviews: "Opinie",
    analytics: "Statystyki",
    team: "Zespół i godziny pracy",
    services: "Zabiegi",
    locations: "Placówki i fotele",
    reminders: "Przypomnienia",
    settings: "Ustawienia",
    funds: "Fundusze zdrowotne",
    api: "API",
    privacyRequests: "Wnioski RODO",
    privacySettings: "Ustawienia prywatności",
    audit: "Dziennik zdarzeń",
    security: "Moje bezpieczeństwo",
    platform: "Platforma",
    platformPrivacy: "Skrzynka prywatności platformy",
    groups: {
      setup: "Konfiguracja",
      privacy: "Prywatność",
      account: "Konto",
    },
    count: p({
      one: "{count} do obsłużenia",
      few: "{count} do obsłużenia",
      many: "{count} do obsłużenia",
      other: "{count} do obsłużenia",
    }),
  },

  sidebar: {
    home: "Przegląd panelu",
    publicPage: "Strona publiczna",
    publicPageNewTab: "Strona publiczna gabinetu (otwiera się w nowej karcie)",
    switchPractice: "Zmień gabinet",
    logout: "Wyloguj",
    language: "Język panelu",
    languageAuto: "Automatycznie ({language})",
  },

  language: {
    saved: "Zapisano język.",
    invalid: "Wybierz jeden z języków z listy.",
  },

  toast: {
    region: "Powiadomienia",
    dismiss: "Zamknij",
  },

  form: {
    saved: "Zapisano.",
  },

  notFound: {
    title: "Nie znaleziono strony",
    body: "Ta strona panelu nie istnieje lub została przeniesiona.",
    back: "Wróć do przeglądu",
  },

  denied: "Brak uprawnień do otwarcia tej strony. W razie potrzeby należy zwrócić się do właściciela lub administratora gabinetu.",

  overview: {
    title: "Przegląd",
    greeting: {
      morning: "Dzień dobry, {name}",
      afternoon: "Dzień dobry, {name}",
      evening: "Dobry wieczór, {name}",
    },
    subtitle: "{date} · {practice}",
    openCalendar: "Otwórz kalendarz",
    welcome: {
      title: "Witamy! Cztery kroki do uruchomienia",
      team: "Dodaj dentystów i higienistki wraz z godzinami pracy w każdej placówce",
      services: "Ustaw zabiegi, czas trwania i ceny",
      reminders: "Wybierz, kiedy wysyłać przypomnienia (SMS, WhatsApp, e-mail)",
      widget: "Osadź widżet rezerwacji na stronie gabinetu",
    },
    stats: {
      today: "Dzisiaj",
      todayHint: p({
        one: "{count} potwierdzona lub odbyta",
        few: "{count} potwierdzone lub odbyte",
        many: "{count} potwierdzonych lub odbytych",
        other: "{count} potwierdzonej lub odbytej",
      }),
      tomorrow: "Potwierdzone na jutro",
      tomorrowHint: "{confirmed} z {total} · {open} do przypomnienia",
      noShow: "Odsetek nieobecności (30 dni)",
      noShowHint: "Nieobecności: {noShows} · wizyty: {visits}",
      online: "Rezerwacje online (7 dni)",
      onlineHint: "Zapełnione z listy oczekujących (30 dni): {refilled} · oczekujący: {waiting}",
      none: "–",
    },
    demo: {
      all: "Tryb demonstracyjny: e-maile, SMS-y i wiadomości WhatsApp nie są dostarczane, tylko zapisywane na stronie Wiadomości.",
      email: "Tryb demonstracyjny: e-maile nie są dostarczane, tylko zapisywane na stronie Wiadomości.",
      text: "Tryb demonstracyjny: SMS-y i wiadomości WhatsApp nie są dostarczane, tylko zapisywane na stronie Wiadomości.",
      connect: "Połącz dostawców",
    },
    attention: "Wymaga uwagi",
    attentionCount: p({ one: "{count} wizyta", few: "{count} wizyty", many: "{count} wizyt", other: "{count} wizyty" }),
    agenda: "Plan dnia",
    noneToday: "Brak wizyt na dzisiaj.",
    tomorrowLink: "Potwierdzenia na jutro",
  },

  confirmations: {
    title: "Potwierdzenia",
    tabs: {
      label: "Które wizyty",
      tomorrow: "Jutro",
      week: "Następne 7 dni",
      requests: "Prośby online",
      outcome: "Zapisz wynik",
      cancelled: "Ostatnio odwołane",
    },
    descriptions: {
      tomorrow: "Kto przychodzi jutro. Warto przypomnieć się osobom, które jeszcze nie potwierdziły: pacjenci z wcześniejszymi nieobecnościami są oznaczeni.",
      week: "Wszystkie wizyty zarezerwowane na najbliższy tydzień.",
      requests: "Rezerwacje online oczekujące na akceptację (gdy gabinet sprawdza rezerwacje online).",
      outcome: "Minione wizyty bez zapisanego wyniku. Oznacz je jako odbyte (to wysyła prośbę o opinię) lub jako nieobecność.",
      cancelled: "Nadchodzące terminy zwolnione przez odwołania. Zostały automatycznie zaproponowane pasującym pacjentom z listy oczekujących.",
    },
    onlyPending: "Tylko oczekujące na potwierdzenie ({count})",
    riskSorted: "Niepotwierdzone wizyty z wyższym ryzykiem nieobecności są wyświetlane na początku każdego dnia.",
    empty: "Brak pozycji do wyświetlenia.",
  },

  waitlist: {
    title: "Lista oczekujących",
    description:
      "Gdy wizyta zostanie odwołana lub przeniesiona, termin jest proponowany maksymalnie 3 pasującym pacjentom SMS-em, przez WhatsApp lub e-mailem. Otrzymuje go osoba, która zarezerwuje pierwsza.",
    emptyTitle: "Nikt nie oczekuje",
    emptyBody: "Pacjenci mogą zapisać się na stronie rezerwacji, gdy żaden termin im nie odpowiada.",
    waiting: "Oczekuje",
    anyPractitioner: "Dowolny specjalista",
    anyOffice: "Dowolna placówka",
    preference: "{practitioner} · {office}",
    window: "{from} – {to}",
    partOfDay: {
      any: "Dowolna pora",
      morning: "Rano",
      afternoon: "Po południu",
    },
    offers: p({
      one: "Wysłano {count} propozycję",
      few: "Wysłano {count} propozycje",
      many: "Wysłano {count} propozycji",
      other: "Wysłano {count} propozycji",
    }),
    remove: "Usuń",
    removeConfirm: "Usunąć tego pacjenta z listy oczekujących?",
    note: "Notatka pacjenta: {note}",
    restricted: "Dane z ograniczonym przetwarzaniem: dane kontaktowe i notatka są ukryte.",
    openRecord: "Otwórz kartę pacjenta (wymagane podanie powodu)",
    booked: "Ostatnio zarezerwowane z listy oczekujących",
    bookedBadge: "Zarezerwowano",
  },
} satisfies DeepPartial<Messages["dashboard"]>;
