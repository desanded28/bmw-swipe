/**
 * Polish translation of the consent and objection texts. The Italian file (it/consents.ts) is
 * authoritative; this is a draft translation pending review by a lawyer or DPO
 * (docs/i18n/glossary-pl.md, "Needs lawyer review").
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  platform_booking_art9: {
    title: "Rezerwacja przez Sorriso",
    label:
      "Wyrażam zgodę na przetwarzanie przez Sorriso danych dotyczących mojej rezerwacji, które mogą ujawniać informacje o moim zdrowiu, w celu przekazania ich do wybranego gabinetu oraz obsługi przypomnień i zmian.",
    description:
      "Zgoda jest potrzebna tylko przy rezerwacji z wyszukiwarki Sorriso: w zakresie tej usługi Sorriso jest samodzielnym administratorem danych (art. 9 ust. 2 lit. a RODO). Zgodę można wycofać w dowolnym momencie w centrum prywatności. Sorriso zaprzestaje wtedy własnego przetwarzania, a gabinet zachowuje dane potrzebne do leczenia. Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania dokonanego przed jej wycofaniem. Bez wyrażenia zgody można umówić wizytę bezpośrednio w gabinecie.",
  },
  whatsapp_channel: {
    title: "Wiadomości WhatsApp",
    label: "Zgadzam się na otrzymywanie wiadomości o moich wizytach przez WhatsApp.",
    description:
      "WhatsApp należy do firmy Meta. Wiadomości są wysyłane za pośrednictwem Twilio i mogą być przetwarzane w Stanach Zjednoczonych na podstawie ramowego porozumienia UE-USA w sprawie ochrony danych (Data Privacy Framework) oraz standardowych klauzul umownych. Meta może wiedzieć o kontakcie z tym gabinetem. W każdej chwili można wrócić do SMS-ów lub e-maili.",
  },
  sms_channel: {
    title: "Wiadomości SMS",
    label: "Proszę o przesyłanie potwierdzeń i przypomnień o wizytach SMS-em.",
    description:
      "Te wiadomości są częścią usługi rezerwacji i zawierają tylko niezbędne informacje: gabinet, datę, godzinę i link. Można je wyłączyć w każdej chwili, odpowiadając STOP lub w ustawieniach.",
  },
  email_channel: {
    title: "E-maile",
    label: "Proszę o przesyłanie potwierdzeń i przypomnień o wizytach e-mailem.",
    description:
      "Te e-maile są częścią usługi rezerwacji. Można je wyłączyć w każdej chwili za pomocą linku do rezygnacji w każdym e-mailu lub w ustawieniach.",
  },
  feedback_request: {
    title: "Zaproszenia do wystawienia opinii",
    label: "Po wizycie proszę o przesłanie krótkiego zaproszenia do wystawienia opinii.",
    description:
      "Kilka dni po wizycie zostanie wysłana jedna wiadomość. Wystawienie opinii jest dobrowolne. Tę zgodę można wycofać w dowolnym momencie.",
  },
  review_publication: {
    title: "Publikacja mojej opinii",
    label:
      "Wyrażam zgodę na publikację tej opinii w serwisie Sorriso i na stronie gabinetu {practice}. Opinia wskazuje, że odbyła się moja wizyta u specjalisty {practitioner}. Mogę ją usunąć w dowolnym momencie w centrum prywatności.",
    description:
      "Domyślnie opinia jest podpisana jako 'Zweryfikowany pacjent'. Prosimy nie podawać informacji o swoim zdrowiu: opinie, które je zawierają, są sprawdzane przed publikacją. Po wycofaniu zgody opinia zostaje usunięta.",
  },
  marketing: {
    title: "Nowości i oferty",
    label: "Chcę otrzymywać nowości i oferty od gabinetu {practice}.",
    description:
      "Dobrowolne: nie jest potrzebne do rezerwacji ani do leczenia. Zgodę można wycofać w dowolnym momencie z poziomu każdej wiadomości lub w centrum prywatności. Zgoda wygasa po 24 miesiącach bez kontaktu.",
  },
  adaptive_reminders: {
    title: "Przypomnienia dopasowane",
    label: "Proszę dostosowywać termin i liczbę przypomnień na podstawie moich wcześniejszych wizyt.",
    description:
      "Gabinet może wysłać dodatkowe przypomnienie, gdy na podstawie historii wizyt istnieje większe ryzyko nieobecności. Jest to profilowanie oparte na prawnie uzasadnionym interesie, które nigdy nie ogranicza możliwości rezerwacji. W każdej chwili można wnieść sprzeciw: wtedy wysyłane są standardowe przypomnienia.",
  },
  no_show_tracking: {
    title: "Historia opuszczonych wizyt",
    label: "Gabinet może odnotowywać wizyty, na które się nie stawię.",
    description:
      "Opuszczone wizyty z ostatnich 24 miesięcy są liczone w celu organizacji terminarza i zaoferowania pomocy, np. dodatkowego przypomnienia. Nigdy nie blokują możliwości rezerwacji. W każdej chwili można wnieść sprzeciw.",
  },
  recalls: {
    title: "Przypomnienia o kontroli",
    label: "Proszę o przypomnienie, gdy dentysta zaleci wizytę kontrolną.",
    description:
      "Przypomnienia o kontroli są wysyłane tylko wtedy, gdy dentysta ustalił odstęp między wizytami kontrolnymi. Każde przypomnienie zawiera sposób ich wyłączenia. W każdej chwili można wnieść sprzeciw.",
  },
} satisfies DeepPartial<Messages["consents"]>;
