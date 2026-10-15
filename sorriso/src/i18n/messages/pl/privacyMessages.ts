/**
 * Polish privacy-center messages. SMS: straight quotes, no ellipsis, short. Discreet: no treatment,
 * practitioner or health detail. Dates ({date}, {due}, {when}) follow a colon, never a preposition.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  requestReceipt: {
    subject: "Otrzymaliśmy wniosek dotyczący prywatności",
    body: "Administrator danych {controller} otrzymał wniosek ({type}). Data wpływu: {date}. Termin odpowiedzi: {due}. Jeśli złożony wniosek będzie wymagał więcej czasu, przed tym terminem zostanie przekazana informacja o przyczynach.",
    sms: "{controller}: otrzymaliśmy wniosek dotyczący prywatności ({type}). Termin odpowiedzi: {due}.",
  },
  contactChangedPhone: {
    sms: "Numer telefonu zapisany w gabinecie {practice} zmieniono w centrum prywatności Sorriso. Jeśli zmiana nie była zamierzona, prosimy o kontakt z gabinetem.",
  },
  contactChangedEmail: {
    subject: "Dane kontaktowe zostały zmienione",
    body: "Adres e-mail zapisany w gabinecie {practice} został zmieniony w centrum prywatności Sorriso. Data zmiany: {date}. Jeśli zmiana nie została dokonana przez właściciela tego adresu, prosimy o niezwłoczny kontakt z gabinetem.",
  },
  bookedForYou: {
    subject: "Zarezerwowano wizytę w gabinecie {practice}",
    body: "Osoba {booker} zarezerwowała dla Pana/Pani wizytę w gabinecie {practice}. Termin: {when}. Gabinet wykorzystuje podane dane do obsługi wizyty. Poniżej opisano, jak przetwarzane są dane osobowe i jakie przysługują prawa, w tym prawo do wglądu w dane, ich sprostowania lub usunięcia.",
    cta: "Przeczytaj informację o ochronie danych",
    sms: "Osoba {booker} zarezerwowała dla Pana/Pani wizytę w gabinecie {practice}: {when}. Ochrona danych: {url}",
  },
  confirmBooking: {
    subject: "Prosimy o potwierdzenie zarezerwowanej wizyty",
    body: "Osoba {booker} zarezerwowała dla Pana/Pani przez Sorriso wizytę w gabinecie {practice}. Termin: {when}. Tylko osoba, dla której zarezerwowano wizytę, może ją potwierdzić i zgodzić się na sposób, w jaki Sorriso obsługuje rezerwację. Rezerwacja niepotwierdzona w ciągu {hours} godz. zostanie anulowana.",
    cta: "Potwierdź lub odrzuć",
    sms: "Osoba {booker} zarezerwowała dla Pana/Pani wizytę w gabinecie {practice} przez Sorriso. Potwierdzenie w ciągu {hours} godz.: {url}",
  },
  adultNotConfirmed: {
    subject: "Zarezerwowana wizyta została odwołana",
    body: "Wizyta zarezerwowana dla osoby {name} w gabinecie {practice} (termin: {when}) została odwołana, ponieważ osoba {name} nie potwierdziła jej na czas. Rezerwację dokonaną dla innej osoby w Sorriso może potwierdzić tylko pacjent: może on zarezerwować wizytę ponownie samodzielnie.",
    sms: "Wizyta dla osoby {name} w gabinecie {practice} ({when}) została odwołana: osoba {name} nie potwierdziła jej na czas.",
  },
  requestTypes: {
    access: "dostęp do danych",
    rectification: "sprostowanie danych",
    erasure: "usunięcie danych",
    restriction: "ograniczenie przetwarzania",
    portability: "kopia danych do przeniesienia",
    objection: "sprzeciw wobec przetwarzania",
    consent_withdrawal: "wycofanie zgody",
  },
  footer: {
    privacyCenter: "Ta wiadomość została wysłana w związku z wnioskiem złożonym w centrum prywatności Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyMessages"]>;
