import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    title: "Deklaracja dostępności",
    description: "W jakim stopniu strona internetowa i usługa rezerwacji {app} są dostępne, jakie mają znane ograniczenia i jak zgłosić barierę.",
  },
  title: "Deklaracja dostępności",
  translationNotice: "To jest tłumaczenie. W razie rozbieżności rozstrzygająca jest <link>wersja włoska</link>.",
  intro:
    "{provider} dąży do tego, aby strona internetowa i usługa rezerwacji były dostępne dla wszystkich, w tym dla osób korzystających z czytnika ekranu, klawiatury, powiększenia ekranu lub sterowania głosem.",
  legalBasis:
    "Niniejsza deklaracja jest publikowana na podstawie Europejskiego aktu o dostępności (dyrektywa (UE) 2019/882), transponowanego we Włoszech dekretem ustawodawczym nr 82/2022, oraz ustawy nr 4/2004.",
  scope: {
    title: "Zakres deklaracji",
    body: "Publiczna strona internetowa {host}: wyszukiwarka, strony gabinetów i specjalistów, formularze rezerwacji i zapisu na listę oczekujących, strona wizyty otwierana z potwierdzeń i przypomnień, centrum prywatności, strony z informacjami prawnymi oraz widżet rezerwacji, który gabinety osadzają na własnych stronach.",
  },
  status: {
    title: "Status zgodności",
    body: "Projektujemy i testujemy zgodnie z wytycznymi Web Content Accessibility Guidelines (WCAG) 2.2 na poziomie AA. Zharmonizowana norma europejska, do której odwołują się przepisy, EN 301 549 v3.2.1, obejmuje WCAG 2.1 na poziomie AA. Usługa jest częściowo zgodna z WCAG 2.1 na poziomie AA: elementy wymienione w sekcji o znanych ograniczeniach nie są jeszcze w pełni zgodne.",
  },
  features: {
    title: "Nasze działania",
    keyboard:
      "Ze strony można korzystać wyłącznie za pomocą klawiatury: fokus jest wyraźnie widoczny, a link pozwala przejść bezpośrednio do treści głównej.",
    screenReader:
      "Strony mają strukturę nagłówków i punktów orientacyjnych. Pola formularzy mają etykiety, a błędy i komunikaty o stanie są odczytywane przez czytniki ekranu.",
    steps: "Formularz rezerwacji przenosi fokus na każdy kolejny etap, zachowuje wpisane dane po powrocie i wyjaśnia każdy błąd obok danego pola.",
    contrast: "Tekst i elementy formularzy spełniają wymagania WCAG AA dotyczące kontrastu, a żadna informacja nie jest przekazywana wyłącznie kolorem.",
    motion: "Animacje są wyłączane, gdy urządzenie zgłasza preferencję ograniczonego ruchu.",
    zoom: "Strony działają przy powiększeniu 200% i na małych ekranach bez przewijania w poziomie.",
    languages:
      "Strona jest dostępna w ośmiu językach, a każda podstrona deklaruje swój język, dzięki czemu czytniki ekranu poprawnie go wymawiają.",
    help: "Dane kontaktowe gabinetu są wyświetlane w tym samym miejscu w formularzu rezerwacji i na stronie wizyty.",
  },
  limitations: {
    title: "Znane ograniczenia",
    practiceContent:
      "Teksty pisane przez gabinety (opisy zabiegów, biogramy specjalistów) są wyświetlane w języku, w którym gabinet je napisał, a ten może różnić się od języka strony.",
    dates:
      "Pola daty korzystają z wbudowanego selektora daty przeglądarki, którego dostępność różni się w zależności od przeglądarki i czytnika ekranu. Datę zawsze można też wpisać ręcznie.",
    maps: "Mapy na stronach gabinetów są wyłącznie pomocą wizualną: adres jest zawsze podany w formie tekstu.",
    widget:
      "Gdy widżet rezerwacji jest osadzony na własnej stronie gabinetu, za dostępność otaczającej go strony odpowiada gabinet.",
    messages: "Przypomnienia SMS to zwykły tekst bez formatowania; zawarte w nich linki otwierają strony objęte niniejszą deklaracją.",
    exports: "Dane pobierane z centrum prywatności (JSON, CSV) to pliki do odczytu maszynowego, a nie dokumenty przeznaczone do czytania.",
    workaround: "Jeśli któreś z tych ograniczeń uniemożliwia rezerwację, wystarczy zadzwonić do gabinetu: numer telefonu znajduje się na jego stronie i w formularzu rezerwacji.",
  },
  preparation: {
    title: "Sposób przygotowania deklaracji",
    body: "Niniejsza deklaracja została sporządzona w dniu {date} na podstawie samooceny, w oparciu o automatyczne testy kodu strony uruchamiane przy każdej zmianie (etykiety, komunikaty o błędach, obsługa fokusu, współczynniki kontrastu). Ręczny przegląd z użyciem wyłącznie klawiatury oraz czytników ekranu (NVDA z Firefoksem w systemie Windows, VoiceOver z Safari w systemie iOS) nie został jeszcze ukończony; po jego zakończeniu deklaracja zostanie zaktualizowana. Data ostatniego przeglądu: {reviewed}.",
  },
  feedback: {
    title: "Informacje zwrotne i kontakt",
    body: "Aby zgłosić barierę lub poprosić o informacje z tej strony w innym formacie, prosimy o wiadomość na adres <mail>{email}</mail>, z adresem strony i opisem problemu. Odpowiemy w ciągu 30 dni.",
    noEmail:
      "Aby zgłosić barierę lub poprosić o informacje z tej strony w innym formacie, prosimy o kontakt za pomocą danych podanych w <link>informacji o ochronie danych</link>, z adresem strony i opisem problemu. Odpowiemy w ciągu 30 dni.",
  },
  enforcement: {
    title: "Procedura egzekwowania",
    body: "W przypadku niezadowolenia z naszej odpowiedzi lub jej braku w ciągu 30 dni można złożyć zgłoszenie do AgID (Agenzia per l'Italia Digitale), urzędu nadzorującego dostępność cyfrową we Włoszech, za pomocą formularza na stronie <link>form.agid.gov.it</link>.",
  },
} satisfies DeepPartial<Messages["accessibility"]>;
