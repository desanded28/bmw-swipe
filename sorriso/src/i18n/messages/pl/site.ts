import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "{app}: umów wizytę u dentysty online",
    description:
      "Znajdź dentystę w pobliżu, sprawdź rzeczywiste wolne terminy i zarezerwuj wizytę w kilka sekund. Przypomnienia SMS-em lub e-mailem: potwierdzenie lub zmiana terminu jednym kliknięciem.",
  },
  header: {
    findDentist: "Znajdź dentystę",
    forPractices: "Dla gabinetów",
    api: "API",
    login: "Logowanie dla gabinetów",
    bookNow: "Umów wizytę",
  },
  footer: {
    tagline: "Rezerwacja wizyt u dentysty online z dostępnością w czasie rzeczywistym. Przypomnienia, na które pacjent odpowiada jednym słowem.",
    patients: "Pacjenci",
    findDentist: "Znajdź dentystę",
    emergency: "Pomoc doraźna",
    cleaning: "Higienizacja",
    privacyCenter: "Moje dane (centrum prywatności)",
    practices: "Gabinety",
    features: "Funkcje",
    createPractice: "Załóż konto gabinetu",
    apiWidget: "API i widżet rezerwacji",
    legal: "Informacje prawne",
    privacy: "Informacja o ochronie danych",
    cookies: "Pliki cookie",
    terms: "Regulamin",
    dpa: "Umowa powierzenia przetwarzania danych",
    subprocessors: "Dalsze podmioty przetwarzające",
    accessibility: "Dostępność",
    reviewPolicy: "Zasady dotyczące opinii",
    ranking: "Jak ustalana jest kolejność wyników",
    copyright: "© {year} {app}",
    demo: "Projekt demonstracyjny: przedstawione gabinety i osoby są fikcyjne.",
  },
  notFound: {
    code: "Błąd 404",
  },
  home: {
    badge: "Wyłącznie zweryfikowane opinie po prawdziwych wizytach",
    heroTitle: "Dentysta, jakiego potrzebujesz, <em>zarezerwowany w 30 sekund.</em>",
    heroBody:
      "Wolne terminy w czasie rzeczywistym w gabinetach w pobliżu. Bez zakładania konta, bez czekania na linii. Przypomnienie SMS-em lub e-mailem: wystarczy odpowiedzieć <b>TAK</b>, aby potwierdzić, lub zmienić termin jednym kliknięciem.",
    quickLabel: "Popularne zabiegi",
    quick: {
      checkup: "Przegląd",
      hygiene: "Higienizacja",
      orthodontics: "Nakładki i aparaty",
      pediatric: "Dzieci",
      emergency: "Pomoc doraźna",
    },
    soonestTitle: "Najszybciej dostępni",
    soonestBody: "Wystarczy wybrać godzinę: te terminy są aktualne.",
    seeAll: "Zobacz wszystkich dentystów",
    how: {
      title: "Jak to działa",
      step: "Krok {n}",
      findTitle: "Rzeczywiste wolne terminy",
      findBody: "Porównaj dentystów pod względem zabiegów, cen, zweryfikowanych opinii i najbliższego wolnego terminu we wszystkich placówkach, w których przyjmują.",
      bookTitle: "Rezerwacja bez konta",
      bookBody: "Wybierz godzinę, podaj imię i numer telefonu. Potwierdzenie z zaproszeniem do kalendarza przychodzi od razu.",
      confirmTitle: "Potwierdzenie jedną odpowiedzią",
      confirmBody: "Przypomnienie przychodzi SMS-em lub e-mailem. Wystarczy odpowiedzieć TAK, aby potwierdzić, lub NIE, aby odwołać, albo zmienić termin jednym kliknięciem.",
    },
    citiesTitle: "Dentyści według miast",
    cityLink: "Dentyści: {city}",
    cityCount: p({ one: "{count} gabinet", few: "{count} gabinety", many: "{count} gabinetów", other: "{count} gabinetu" }),
    practices: {
      kicker: "Dla gabinetów stomatologicznych",
      title: "Mniej nieobecności. Wszystkie placówki w jednym kalendarzu.",
      body: "Planowanie dla wielu placówek z uwzględnieniem foteli, dwustronne potwierdzenia SMS, automatyczna lista oczekujących, która zapełnia odwołane terminy, oraz otwarte API rezerwacji.",
      features: "Zobacz funkcje",
      demo: "Wypróbuj panel demonstracyjny",
      offices: "Wiele placówek, specjalistów i foteli bez podwójnych rezerwacji między lokalizacjami",
      rules: "Reguły przypomnień dla każdego gabinetu: e-mail 48 godzin wcześniej, SMS 24 godziny wcześniej, WhatsApp po włączeniu",
      replies: "Pacjenci odpowiadają TAK lub NIE, a kalendarz aktualizuje się sam",
      waitlist: "Odwołane terminy trafiają do listy oczekujących w ciągu kilku sekund",
    },
  },
  forClinics: {
    metaTitle: "Dla gabinetów stomatologicznych",
    metaDescription:
      "Rezerwacja online, kalendarz dla wielu placówek i przypomnienia, na które pacjenci odpowiadają, z wbudowaną ochroną prywatności. Eksport wszystkich danych w dowolnym momencie.",
    kicker: "Dla gabinetów stomatologicznych",
    title: "Zapełnione fotele. Koniec z dopytywaniem o potwierdzenia.",
    body: "Rezerwacja online, kalendarz dla wielu placówek i przypomnienia, na które pacjenci naprawdę odpowiadają, w jednym miejscu.",
    signup: "Załóż konto gabinetu",
    demo: "Otwórz panel demonstracyjny",
    featuresTitle: "Funkcje",
    features: {
      offices: {
        title: "Wszystkie placówki, jeden kalendarz",
        body: "Specjaliści pracują w różnych placówkach w różne dni. Dostępność jest liczona dla każdej placówki osobno i nikogo nie można zarezerwować podwójnie w dwóch lokalizacjach.",
      },
      chairs: {
        title: "Fotele, przerwy i zamknięcia",
        body: "Rezerwacja automatycznie przydziela fotel. Czas na przygotowanie po zabiegu, święta, przeglądy techniczne i nieobecności personelu blokują dostępność.",
      },
      twoWay: {
        title: "Dwustronne przypomnienia SMS",
        body: "Przypomnienia proszą pacjentów o odpowiedź TAK lub NIE w ich własnym języku. Odpowiedź od razu potwierdza lub odwołuje wizytę; każda inna jest oznaczana dla recepcji.",
      },
      rules: {
        title: "Własne reguły przypomnień",
        body: "Na przykład: e-mail 48 godzin wcześniej, SMS 24 godziny wcześniej, krótki SMS 2 godziny wcześniej. WhatsApp tylko po włączeniu i za zgodą pacjenta.",
      },
      waitlist: {
        title: "Odwołane terminy zapełniają się same",
        body: "Zwolniony termin w ciągu kilku sekund trafia do pasujących pacjentów z listy oczekujących. Otrzymuje go osoba, która zarezerwuje pierwsza, bez żadnych telefonów.",
      },
      board: {
        title: "Tablica potwierdzeń",
        body: "Jutrzejszy dzień w jednym widoku: potwierdzone, oczekujące i osoby, do których warto zadzwonić, wraz z powodem. To wyłącznie pomoc: nikt nie traci możliwości rezerwacji.",
      },
      reviews: {
        title: "Tylko zweryfikowane opinie",
        body: "Opinię może wystawić tylko pacjent po odbytej wizycie i tylko za swoją zgodą. Gabinety mogą odpowiadać na opinie, ale nie mogą ich ukrywać.",
      },
      api: {
        title: "Otwarte API i widżet rezerwacji",
        body: "Osadź rezerwację na stronie gabinetu jednym znacznikiem script, synchronizuj dane z oprogramowaniem gabinetu przez REST API i subskrybuj kanały kalendarza.",
      },
      roles: {
        title: "Role w zespole",
        body: "Właściciele, administratorzy, recepcja i specjaliści widzą to, czego potrzebują. Każdy dostęp do danych pacjenta jest rejestrowany.",
      },
      privacy: {
        title: "Prywatność domyślnie",
        body: "Wiadomości i wpisy w kalendarzu nie zawierają nazwy zabiegu. Pacjenci zarządzają swoimi danymi i zgodami w centrum prywatności, bez zakładania konta.",
      },
      languages: {
        title: "Osiem języków",
        body: "Pacjenci rezerwują wizyty i otrzymują przypomnienia po włosku, angielsku, niemiecku, francusku, hiszpańsku, portugalsku, rumuńsku lub polsku.",
      },
    },
    flow: {
      title: "Jak działa potwierdzenie",
      book: "Pacjent rezerwuje wizytę online (lub recepcja rezerwuje ją na miejscu) i otrzymuje potwierdzenie z zaproszeniem do kalendarza.",
      email: "48 godzin wcześniej: e-mail z prośbą o potwierdzenie jednym kliknięciem.",
      text: "24 godziny wcześniej: SMS z prośbą o odpowiedź TAK (potwierdzenie) lub NIE (odwołanie).",
      reply: "TAK zmienia kolor wizyty w kalendarzu na zielony. NIE odwołuje wizytę i proponuje termin osobom z listy oczekujących.",
      other: "Każda inna odpowiedź (\"czy mogę przyjść 30 minut później?\") trafia do skrzynki odbiorczej i jest oznaczana w kalendarzu.",
    },
    sms: {
      sender: "Studio Bianchi",
      reminder:
        "Studio Bianchi: przypomnienie o wizycie: śr., 15 paź o 10:30, Via Torino 42, Milano. Odpowiedz TAK (potwierdzam) lub NIE (odwołuję). sorriso.example/a/... STOP - rezygnacja z SMS",
      reply: "TAK",
      thanks: "Dziękujemy! Obecność potwierdzona: śr., 15 paź o 10:30. Do zobaczenia!",
      caption: "Przypomnienie w takiej postaci, w jakiej otrzymuje je pacjent: nazwa zabiegu nigdy się nie pojawia.",
    },
    noLockIn: "Dane należą do gabinetu: eksport wszystkiego w dowolnym momencie, bez uzależnienia od dostawcy.",
    apiDocs: "Dokumentacja API",
  },
  developers: {
    metaTitle: "API i widżet rezerwacji",
    metaDescription:
      "Osadź rezerwację online na stronie gabinetu, rezerwuj przez REST API i synchronizuj dane z oprogramowaniem gabinetu.",
    title: "API i widżet rezerwacji",
    intro:
      "Wszystko, co robi strona {host}, przechodzi przez to API, więc integracja może zrobić wszystko, co pacjent. JSON przez HTTPS, włączony CORS, czas w formacie ISO 8601 (UTC).",
    codeSample: "Przykładowy kod",
    attribute: "Atrybut",
    field: "Pole",
    description: "Opis",
    widget: {
      title: "1. Osadzanie rezerwacji na stronie",
      button: "Pływający przycisk \"Umów wizytę\", który otwiera formularz rezerwacji w oknie dialogowym:",
      inline: "Lub bezpośrednio w elemencie strony, tutaj po niemiecku i dla jednego specjalisty:",
      attributesCaption: "Atrybuty widżetu",
      attributes: {
        "data-clinic": "Wymagany. Adres gabinetu w Sorriso (slug). Bez niego skrypt niczego nie wyświetla.",
        "data-lang":
          "Język formularza i wiadomości do pacjenta. Domyślnie: język strony (jej atrybut lang), następnie język przeglądarki odwiedzającego, a w ostateczności włoski.",
        "data-target":
          "Selektor CSS: formularz wyświetla się wewnątrz wskazanego elementu zamiast pływającego przycisku. Jeśli w chwili uruchomienia skryptu żaden element nie pasuje, nic nie jest wyświetlane.",
        "data-practitioner": "Otwiera formularz dla jednego specjalisty (jego id).",
        "data-service": "Wstępnie wybiera zabieg (jego id).",
        "data-location": "Wstępnie wybiera placówkę (jej id).",
        "data-label": "Tekst pływającego przycisku. Domyślnie \"Umów wizytę\" w wybranym języku.",
        "data-color": "Kolor pływającego przycisku jako kolor CSS.",
        "data-events": "Włącza zdarzenie sorriso:booked na stronie po zakończeniu rezerwacji.",
        "data-include-id": "Razem z data-events: dołącza id wizyty do zdarzenia.",
      },
      languages: "Wartości języka (<code>data-lang</code>, <code>patient.locale</code>):",
      eventsTitle: "Zdarzenia rezerwacji",
      events:
        "Z atrybutem <code>data-events</code> strona otrzymuje zdarzenie <code>sorriso:booked</code> po zakończeniu rezerwacji. Nie zawiera ono danych osobowych, a id wizyty tylko z <code>data-include-id</code>. Komunikaty są wysyłane wyłącznie do źródła (origin) strony.",
      eventsWarning:
        "Nie należy przekazywać tego zdarzenia do narzędzi reklamowych ani analitycznych (takich jak tagi Meta czy Google): ujawnia ono, że odwiedzający zarezerwował wizytę u dentysty, a to są dane dotyczące zdrowia. Zgodnie z umową powierzenia przetwarzania danych można go używać wyłącznie do wyświetlenia własnego potwierdzenia.",
      origins:
        "Aby inne strony nie mogły osadzać formularza rezerwacji, należy podać adresy strony gabinetu w Panel, Ustawienia prywatności, Dozwolone strony. Gdzie indziej widżet wyświetla wtedy tylko link otwierający stronę rezerwacji w nowej karcie. Kontrola opiera się na adresie, który przeglądarka odwiedzającego wysyła wraz z ramką: widżet o niego prosi, a we własnym elemencie iframe nie należy ustawiać <code>referrerpolicy=\"no-referrer\"</code>.",
    },
    booking: {
      title: "2. Rezerwacja przez API",
      fieldsCaption: "Pola rezerwacji",
      context:
        "O tym, kto odpowiada za dane rezerwacji, decyduje serwer, a nie przesyłane pole: rezerwacje dokonane za pomocą klucza API gabinetu, jego widżetu lub linków podpisanych dla gabinetu należą do gabinetu (Sorriso przetwarza je w jego imieniu); rezerwacje rozpoczęte na stronach Sorriso wymagają zgody pacjenta wyrażonej wobec Sorriso.",
      errors:
        "Błędy mają jeden format: obiekt <code>error</code> z polami <code>code</code> i <code>message</code>. Zajęty termin zwraca 409 z kodem <code>practitioner_busy</code>, <code>no_room</code>, <code>time_off</code>, <code>outside_hours</code> lub <code>too_soon</code>; nieprawidłowe pola zwracają 422 z listą <code>issues</code>, a niespełniona reguła prywatności lub wieku 422 z własnym kodem i polem <code>field</code>.",
    },
    fields: {
      locale:
        "Język wiadomości do pacjenta: <code>it</code>, <code>en</code>, <code>de</code>, <code>fr</code>, <code>es</code>, <code>pt</code>, <code>ro</code> lub <code>pl</code>.",
      phoneCountry:
        "Numer kierunkowy kraju dla numeru wpisanego bez prefiksu, np. <code>39</code> lub <code>49</code>. Numery zaczynające się od + lub 00 zachowują własny.",
      preferredChannel:
        "<code>sms</code>, <code>email</code> lub <code>whatsapp</code>. WhatsApp tylko wtedy, gdy gabinet go włączył, i z <code>privacy.whatsapp</code> ustawionym na true.",
      privacy:
        "Wymagane bez klucza API. <code>noticeVersion</code> (wersja wyświetlonej informacji o ochronie danych), <code>locale</code> oraz wybory pacjenta: <code>platformConsent</code>, <code>whatsapp</code>, <code>feedback</code>, <code>marketing</code>. Niezaznaczone pola mają wartość false.",
      relation:
        "Dla kogo jest wizyta: <code>bookedFor</code> to <code>self</code>, <code>minor</code> (z <code>guardian</code>: imię i nazwisko, relacja, telefon lub e-mail) albo <code>other_adult</code>.",
      practiceRef: "Znacznik gabinetu z linku opublikowanego przez gabinet (?ref=). Bez niego rezerwacja jest traktowana jako dokonana w Sorriso.",
      fundId: "Opcjonalnie: fundusz zdrowotny lub ubezpieczyciel, z którego pacjent skorzysta. Zapisywany tylko wtedy, gdy gabinet ma ten fundusz na liście.",
    },
    sync: {
      title: "3. Synchronizacja z oprogramowaniem gabinetu",
      keys: "Utwórz klucz API w Panel, Ustawienia, API, wybierz jego zakresy i przesyłaj go jako token typu bearer. Klucze mogą wygasać i można je w każdej chwili unieważnić.",
      scopesTitle: "Zakresy",
    },
    scopes: {
      "appointments:read": "Odczyt wizyt i zasobów, z których korzystają.",
      "appointments:write": "Tworzenie, przenoszenie i odwoływanie wizyt, rejestrowanie potwierdzeń, nieobecności i odbytych wizyt.",
      "patients:read": "Odczyt imion, nazwisk i danych kontaktowych pacjentów.",
      "patients:write": "Tworzenie i aktualizacja pacjentów.",
      "notes:read": "Odczyt notatek pacjentów i personelu dotyczących wizyt. Należy go przyznawać wyłącznie oprogramowaniu medycznemu.",
      "patients:erase": "Żądanie usunięcia danych pacjenta (obsługiwane jako wniosek dotyczący prywatności).",
    },
    export: {
      title: "4. Eksport danych",
      body: "Gabinet może w każdej chwili wyeksportować wszystkie swoje dane w formatach JSON, CSV i FHIR R4. Formaty są opisane w <link>schemacie eksportu</link>.",
    },
    reference: "Dokumentacja techniczna",
    groups: {
      public: "Rezerwacja publiczna (używana przez stronę i widżet)",
      patient: "Samoobsługa pacjenta (token z linku pacjenta)",
      partner: "API partnerskie (oprogramowanie gabinetu)",
      infra: "Infrastruktura",
    },
    auth: {
      public: "publiczny",
      token: "token",
      apiKey: "klucz API",
      secret: "sekret",
    },
    endpoints: {
      clinic: "Profil gabinetu, placówki, specjaliści (z zabiegami i placówkami) oraz zabiegi dostępne do rezerwacji.",
      availability:
        "Wolne terminy według dni. Bez practitionerId: \"pierwszy dostępny\", rozłożone na specjalistów. Zwraca nextAvailable, gdy przedział jest pusty.",
      book: "Rezerwacja terminu. Sprawdzana ponownie w transakcji zapisu: dwóch pacjentów nigdy nie otrzyma tego samego terminu.",
      waitlist: "Zapis na listę oczekujących na zabieg, opcjonalnie do specjalisty lub placówki, w przedziale dat i porze dnia.",
      appointment: "Wizyta i czynności, które pacjent nadal może wykonać (canCancel, canReschedule).",
      confirm: "Potwierdzenie obecności.",
      cancel: "Odwołanie (termin trafia do listy oczekujących). Opcjonalne pole w treści: reason.",
      reschedule: "Przeniesienie na inny wolny termin. Pola w treści: start oraz opcjonalnie practitionerId i locationId.",
      resources: "Placówki, fotele, specjaliści (z grafikami) i zabiegi, do mapowania id.",
      list: "Lista wizyt. Do synchronizacji przyrostowej służy updatedSince.",
      create: "Utworzenie wizyty z uprawnieniami recepcji (własny czas trwania, poza godzinami pracy, istniejące id pacjenta).",
      update: "Zmiana terminu, odwołanie, oznaczenie jako odbyta lub nieobecność albo zapisanie potwierdzenia telefonicznego.",
      twilio: "Przychodzące odpowiedzi SMS i WhatsApp (podpisane przez Twilio). Odpowiada bezpośrednio w TwiML.",
      twilioStatus: "Potwierdzenia doręczenia (dostarczone, nieudane).",
      cron: "Wysyłka należnych przypomnień. Wywoływać co 1 do 5 minut z nagłówkiem Authorization: Bearer $CRON_SECRET.",
      ics: "Subskrybowany kanał kalendarza specjalisty (Google, Apple, Outlook).",
    },
  },
} satisfies DeepPartial<Messages["site"]>;
