/**
 * Polish patient messages. SMS: straight quotes only, no ellipsis; Polish letters make an SMS
 * UCS-2, so full texts are short and the `*Short` variants are plain ASCII (GSM-7). {when} and
 * {date} are nominative ("środa, 16 września o 10:30"), so they follow a colon, never a
 * preposition. Reply words: TAK / NIE / STOP / START (src/lib/inbound.ts).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  format: {
    slot: "{day}.{month} {time}",
  },

  email: {
    greeting: "Dzień dobry, {name}!",
    when: "Kiedy",
    where: "Gdzie",
    service: "Zabieg",
    with: "Specjalista",
    patient: "Pacjent",
    manage: "Zarządzaj wizytą",
    confirm: "Potwierdzam obecność",
    cancel: "Odwołaj",
    reschedule: "Zmień termin",
    calendar: "Dodaj do kalendarza",
    detailsOnline: "Wszystkie szczegóły wizyty są dostępne na stronie wizyty.",
  },

  privacyFooter: {
    sender: "{name} · {address}",
    phone: "Tel. {phone}",
    why: "Ta wiadomość została wysłana w związku z wizytą w gabinecie {clinic}.",
    whyGuardian: "Ta wiadomość została wysłana, ponieważ ten adres jest kontaktem w sprawie wizyt pacjenta {patient} w gabinecie {clinic}.",
    whyWaitlist: "Ta wiadomość została wysłana w związku z zapisem na listę oczekujących w gabinecie {clinic}.",
    whyGeneric: "Ta wiadomość została wysłana do pacjenta gabinetu {clinic}.",
    object:
      "W każdej chwili można wnieść sprzeciw wobec przypomnień lub wycofać zgodę w ustawieniach prywatności albo odpowiadając STOP na nasze SMS-y.",
    notice: "Informacja o ochronie danych",
    preferences: "Ustawienia prywatności",
  },

  booked: {
    subject: "Wizyta zarezerwowana - {clinic} - {date}",
    subjectDetailed: "Wizyta zarezerwowana: {service}, {date}",
    body: "Wizyta została zarezerwowana. Przed wizytą wyślemy przypomnienie.",
    sms: "{clinic}: wizyta zarezerwowana: {when}. Zarządzaj: {url} Prywatność: {privacy} STOP - rezygnacja z SMS",
    smsShort: "{clinic}: wizyta zarezerwowana {slot}. Zarzadzaj: {url}",
    smsDetailed: "{clinic}: zarezerwowano: {service}, {practitioner}, {when}. Zarządzaj: {url} STOP - rezygnacja z SMS",
  },

  requested: {
    subject: "Otrzymaliśmy prośbę o wizytę - {clinic} - {date}",
    subjectDetailed: "Otrzymaliśmy prośbę o wizytę: {service}",
    body: "Otrzymaliśmy prośbę o wizytę. Gabinet wkrótce ją potwierdzi, a potwierdzenie przyjdzie e-mailem.",
  },

  approved: {
    subject: "Wizyta potwierdzona - {clinic} - {date}",
    subjectDetailed: "Wizyta potwierdzona przez gabinet: {service}, {date}",
    body: "Gabinet przyjął prośbę o wizytę. Oto szczegóły wizyty.",
    sms: "{clinic}: gabinet potwierdził wizytę: {when}. Zarządzaj: {url} Prywatność: {privacy} STOP - rezygnacja z SMS",
    smsShort: "{clinic}: wizyta potwierdzona {slot}. Zarzadzaj: {url}",
  },

  reminder: {
    subject: "Przypomnienie o wizycie - {clinic} - {date}",
    subjectDetailed: "Przypomnienie o wizycie: {service}, {date}",
    body: "Przypominamy o zbliżającej się wizycie.",
    bodyAsk: "Przypominamy o zbliżającej się wizycie. Prosimy o potwierdzenie obecności jednym kliknięciem.",
    sms: "{clinic}: przypomnienie o wizycie: {when}, {address}. Szczegóły: {url} STOP - rezygnacja z SMS",
    smsAsk:
      "{clinic}: przypomnienie o wizycie: {when}, {address}. Odpowiedz TAK (potwierdzam) lub NIE (odwołuję). {url} STOP - rezygnacja z SMS",
    smsShort: "{clinic}: wizyta {slot}. Szczegoly: {url}",
    smsAskShort: "{clinic}: wizyta {slot}. Odpowiedz TAK, aby potwierdzic, lub NIE, aby odwolac. {url}",
    smsDetailed: "{clinic}: {name}, przypomnienie: {service}, {practitioner}, {when}, {address}. {url}",
    smsAskDetailed:
      "{clinic}: {name}, przypomnienie: {service}, {practitioner}, {when}, {address}. Odpowiedz TAK (potwierdzam) lub NIE (odwołuję). {url}",
  },

  cancelled: {
    subject: "Wizyta odwołana - {clinic} - {date}",
    body: "Zgodnie z prośbą wizyta została odwołana.",
    bodyByPractice: "Niestety gabinet musiał odwołać wizytę. Nowy termin można zarezerwować w dowolnej chwili.",
    sms: "{clinic}: wizyta odwołana: {when}. Nowa rezerwacja: {url}",
    smsShort: "{clinic}: wizyta {slot} odwolana. Nowy termin: {url}",
    rebook: "Zarezerwuj ponownie",
  },

  rescheduled: {
    subject: "Zmiana terminu wizyty - {clinic} - {date}",
    subjectDetailed: "Zmiana terminu wizyty: {service}, {date}",
    body: "Termin wizyty został zmieniony. Oto nowy termin.",
    sms: "{clinic}: nowy termin wizyty: {when}, {address}. Szczegóły: {url}",
    smsShort: "{clinic}: nowy termin wizyty {slot}. {url}",
  },

  waitlist: {
    subject: "Zwolnił się termin - {clinic} - {date}",
    body: "Zwolnił się termin: {when}. Otrzyma go osoba, która zarezerwuje pierwsza, więc warto zrobić to od razu.",
    sms: "{clinic}: zwolnił się termin: {when}. Decyduje kolejność: {url}",
    smsShort: "{clinic}: wolny termin {slot}: {url}",
    cta: "Zarezerwuj ten termin",
  },

  review: {
    subject: "Jak przebiegła wizyta w gabinecie {clinic}?",
    body: "Dziękujemy za wizytę. Zweryfikowana opinia pomaga innym pacjentom wybrać z przekonaniem. Zajmie to minutę.",
    bodyDetailed: "Dziękujemy za wizytę u specjalisty {practitioner}. Zweryfikowana opinia pomaga innym pacjentom wybrać z przekonaniem. Zajmie to minutę.",
    cta: "Wystaw opinię",
  },

  replies: {
    confirmed: "{clinic}: dziękujemy! Obecność potwierdzona: {when}. Do zobaczenia!",
    confirmedShort: "{clinic}: dziekujemy, wizyta {slot} potwierdzona.",
    cancelled: "{clinic}: wizyta odwołana: {when}. Nowy termin: {url}",
    cancelledShort: "{clinic}: wizyta {slot} odwolana. Nowy termin: {url}",
    reschedule: "{clinic}: nowy termin można wybrać tutaj: {url}",
    unknown: "{clinic}: nie zrozumieliśmy. Odpowiedz TAK (potwierdzam) lub NIE (odwołuję) albo wejdź na: {url}",
    none: "{clinic}: nie znaleziono nadchodzącej wizyty dla tego numeru.",
    stop: "{clinic}: nie będziemy już wysyłać SMS-ów. Aby je włączyć, odpowiedz START.",
    start: "{clinic}: SMS-y włączone. Aby je wyłączyć, odpowiedz STOP.",
  },

  unsubscribeConfirmation: {
    subject: "Ustawienia wiadomości - {clinic}",
    body: "Wiadomości ({channel}) o wizytach w gabinecie {clinic} nie będą już wysyłane. Można to zmienić w dowolnej chwili w ustawieniach prywatności.",
    cta: "Ustawienia prywatności",
    sms: "{clinic}: nie będziemy już wysyłać SMS-ów. Aby je włączyć, odpowiedz START.",
  },

  breachNotice: {
    subject: "Ważne: incydent bezpieczeństwa dotyczący danych osobowych - {clinic}",
    body: "Informujemy o naruszeniu ochrony danych osobowych, które może dotyczyć adresata tej wiadomości. Traktujemy je poważnie i chcemy wyjaśnić, co się stało i jakie działania podejmujemy.",
    what: "Co się stało",
    when: "Kiedy",
    data: "Dane, których to dotyczy",
    consequences: "Możliwe skutki",
    measures: "Podjęte działania",
    advice: "Co można zrobić",
    contact: "Pytania",
    contactValue: "Kontakt z naszym inspektorem ochrony danych: {dpo}",
    sms: "{clinic}: ważna informacja dotycząca danych osobowych. Prosimy o uważne zapoznanie się: {url}",
  },

  ics: {
    summary: "Wizyta – {clinic}",
    phone: "Tel. {phone}",
  },

  preview: {
    sampleFirstName: "Anna",
  },
} satisfies DeepPartial<Messages["patientMessages"]>;
