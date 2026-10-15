/**
 * Polish care messages. Discreet: no treatment, practitioner or clinical detail. SMS: straight
 * quotes, no ellipsis; {when} is nominative ("środa, 16 września o 10:30"), so it follows a colon.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  recall: {
    subject: "{clinic}: czas na wizytę kontrolną",
    body: "Nadszedł czas, aby umówić kolejną wizytę kontrolną w gabinecie {clinic}. Dogodny termin można wybrać online lub umówić telefonicznie. Aby nie otrzymywać tych przypomnień, można zrezygnować tutaj: {optout}.",
    cta: "Umów wizytę kontrolną",
    sms: "{clinic}: czas na wizytę kontrolną. Rezerwacja: {url} Rezygnacja z przypomnień: {optout}",
    smsShort: "{clinic}: czas na kontrole. Rezerwacja: {url} Rezygnacja: {optout}",
  },
  practiceMoved: {
    subject: "{clinic}: konieczna zmiana terminu wizyty",
    body: "Przepraszamy: gabinet {clinic} nie może przyjąć pacjenta w zaplanowanym terminie ({when}). Nowy termin można wybrać jednym kliknięciem albo poprosić gabinet o telefon.",
    cta: "Wybierz nowy termin",
    sms: "{clinic}: przepraszamy, musimy przełożyć wizytę: {when}. Nowy termin: {url}",
    smsShort: "{clinic}: zmiana terminu wizyty: {when}. Nowy termin: {url}",
  },
  anamnesisInvite: {
    subject: "{clinic}: prosimy o wypełnienie wywiadu medycznego przed wizytą",
    body: "Przed wizytą ({when}) prosimy o wypełnienie krótkiego formularza wywiadu medycznego. Zajmuje to około trzech minut i pomaga dentyście bezpiecznie przeprowadzić leczenie. Odpowiedzi są szyfrowane i ma do nich dostęp tylko zespół medyczny.",
    cta: "Wypełnij formularz",
    sms: "{clinic}: przed wizytą ({when}) prosimy o wypełnienie wywiadu medycznego: {url}",
    smsShort: "{clinic}: wywiad medyczny przed wizytą ({when}): {url}",
  },
} satisfies DeepPartial<Messages["careMessages"]>;
