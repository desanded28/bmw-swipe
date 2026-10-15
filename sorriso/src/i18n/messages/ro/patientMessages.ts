/**
 * Romanian patient messages. Rules: see messages/en/patientMessages.ts.
 * SMS: straight quotes only. Every Romanian diacritic (ă â î ș ț) switches an SMS to UCS-2, so the
 * full `sms*` texts prefer correct wordings without diacritics where Romanian has one ("DA pentru
 * confirmare"), and the `*Short` texts use plain ASCII letters only. Reply words: DA / NU.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  format: {
    slot: "{day}.{month} {time}",
  },

  email: {
    greeting: "Bună ziua, {name},",
    when: "Când",
    where: "Unde",
    service: "Tratament",
    with: "Cu",
    patient: "Pacient",
    manage: "Gestionați programarea",
    confirm: "Confirm că voi fi prezent",
    cancel: "Anulați",
    reschedule: "Reprogramați",
    calendar: "Adăugați în calendar",
    detailsOnline: "Toate detaliile vizitei se află pe pagina programării dumneavoastră.",
  },

  privacyFooter: {
    sender: "{name} · {address}",
    phone: "Tel. {phone}",
    why: "Primiți acest email deoarece aveți o programare la {clinic}.",
    whyGuardian: "Primiți acest email deoarece sunteți persoana de contact pentru programările făcute pentru {patient} la {clinic}.",
    whyWaitlist: "Primiți acest email deoarece v-ați înscris pe lista de așteptare la {clinic}.",
    whyGeneric: "Primiți acest email deoarece sunteți pacient la {clinic}.",
    object:
      "Vă puteți opune oricând reamintirilor sau vă puteți retrage orice consimțământ din opțiunile de confidențialitate ori răspunzând STOP la SMS-urile noastre.",
    notice: "Informare privind confidențialitatea",
    preferences: "Opțiunile dumneavoastră de confidențialitate",
  },

  booked: {
    subject: "Programare înregistrată - {clinic} - {date}",
    subjectDetailed: "Programare înregistrată: {service}, {date}",
    body: "Programarea dumneavoastră a fost înregistrată. Vă vom trimite o reamintire înainte de vizită.",
    sms: "{clinic}: programare pentru {when}. Detalii: {url} Informare date personale: {privacy} STOP pentru dezabonare",
    smsShort: "{clinic}: programare pentru {slot}. Detalii: {url}",
    smsDetailed: "{clinic}: programare {service} cu {practitioner} {when}. Detalii: {url} STOP pentru dezabonare",
  },

  requested: {
    subject: "Cerere primită - {clinic} - {date}",
    subjectDetailed: "Cerere primită: {service}",
    body: "Am primit cererea dumneavoastră. Cabinetul o va confirma în curând și veți primi un email.",
  },

  approved: {
    subject: "Programare confirmată de cabinet - {clinic} - {date}",
    subjectDetailed: "Programare confirmată de cabinet: {service}, {date}",
    body: "Cabinetul v-a acceptat cererea. Iată detaliile programării dumneavoastră.",
    sms: "{clinic}: v-am confirmat programarea de {when}. Detalii: {url} Informare date personale: {privacy} STOP pentru dezabonare",
    smsShort: "{clinic}: confirmat pentru {slot}. Detalii: {url}",
  },

  reminder: {
    subject: "Reamintire programare - {clinic} - {date}",
    subjectDetailed: "Reamintire programare: {service}, {date}",
    body: "Vă reamintim de următoarea dumneavoastră programare.",
    bodyAsk: "Vă reamintim de următoarea dumneavoastră programare. Puteți confirma prezența cu un singur clic?",
    sms: "{clinic}: reamintire programare {when}, {address}. Detalii: {url} STOP pentru dezabonare",
    smsAsk:
      "{clinic}: reamintire programare {when}, {address}. DA pentru confirmare, NU pentru anulare. Detalii: {url} STOP pentru dezabonare",
    smsShort: "{clinic}: programare {slot}. Detalii: {url}",
    smsAskShort: "{clinic}: programare {slot}. DA pentru confirmare, NU pentru anulare. {url}",
    smsDetailed: "{clinic}: {name}, reamintire {service} cu {practitioner} {when}, {address}. Detalii: {url}",
    smsAskDetailed:
      "{clinic}: {name}, reamintire {service} cu {practitioner} {when}, {address}. DA pentru confirmare, NU pentru anulare. Detalii: {url}",
  },

  cancelled: {
    subject: "Programare anulată - {clinic} - {date}",
    body: "Programarea dumneavoastră a fost anulată, așa cum ați solicitat.",
    bodyByPractice: "Din păcate, cabinetul a trebuit să vă anuleze programarea. Puteți alege o nouă oră oricând doriți.",
    sms: "{clinic}: programarea de {when} a fost anulată. Programare nouă: {url}",
    smsShort: "{clinic}: anulare programare {slot}. Reprogramare: {url}",
    rebook: "Programați-vă din nou",
  },

  rescheduled: {
    subject: "Programare mutată - {clinic} - {date}",
    subjectDetailed: "Programare mutată: {service}, {date}",
    body: "Programarea dumneavoastră a fost mutată. Iată noua oră.",
    sms: "{clinic}: programarea a fost mutată pe {when}, {address}. Detalii: {url}",
    smsShort: "{clinic}: reprogramare pentru {slot}. Detalii: {url}",
  },

  waitlist: {
    subject: "S-a eliberat un loc - {clinic} - {date}",
    body: "S-a eliberat un loc pentru {when}. Îl obține primul care se programează, așa că rezervați-l acum dacă vă convine.",
    sms: "{clinic}: s-a eliberat un loc pentru {when}. Îl obține primul care se programează: {url}",
    smsShort: "{clinic}: loc liber {slot}: {url}",
    cta: "Rezervați această oră",
  },

  review: {
    subject: "Cum a fost vizita la {clinic}?",
    body: "Vă mulțumim pentru vizită. O recenzie verificată îi ajută pe alți pacienți să aleagă cu încredere. Durează doar un minut.",
    bodyDetailed:
      "Vă mulțumim pentru vizita la {practitioner}. O recenzie verificată îi ajută pe alți pacienți să aleagă cu încredere. Durează doar un minut.",
    cta: "Lăsați o recenzie",
  },

  replies: {
    confirmed: "{clinic}: vă mulțumim! Prezența este confirmată pentru {when}. Pe curând!",
    confirmedShort: "{clinic}: confirmat pentru {slot}.",
    cancelled: "{clinic}: programarea de {when} a fost anulată. Alegeți o nouă oră: {url}",
    cancelledShort: "{clinic}: anulare programare {slot}. Reprogramare: {url}",
    reschedule: "{clinic}: reprogramare online: {url}",
    unknown: "{clinic}: nu am înțeles răspunsul. Scrieți DA pentru confirmare, NU pentru anulare sau accesați: {url}",
    none: "{clinic}: nicio programare viitoare pentru acest telefon.",
    stop: "{clinic}: SMS-uri dezactivate. START pentru reactivare.",
    start: "{clinic}: SMS-uri reactivate. STOP pentru dezactivare.",
  },

  unsubscribeConfirmation: {
    subject: "Preferințele dumneavoastră privind mesajele - {clinic}",
    body: "Nu veți mai primi prin {channel} mesaje despre programările dumneavoastră de la {clinic}. Puteți modifica oricând această alegere din opțiunile de confidențialitate.",
    cta: "Opțiunile dumneavoastră de confidențialitate",
    sms: "{clinic}: SMS-uri dezactivate. START pentru reactivare.",
  },

  breachNotice: {
    subject: "Important: un incident de securitate privind datele dumneavoastră - {clinic}",
    body: "Vă scriem pentru a vă informa despre o încălcare a securității datelor cu caracter personal care vă poate afecta. O tratăm cu toată seriozitatea și dorim să știți ce s-a întâmplat și ce facem în această privință.",
    what: "Ce s-a întâmplat",
    when: "Când",
    data: "Date implicate",
    consequences: "Ce poate însemna pentru dumneavoastră",
    measures: "Ce am făcut",
    advice: "Ce puteți face",
    contact: "Întrebări",
    contactValue: "Contactați responsabilul nostru cu protecția datelor: {dpo}",
    sms: "{clinic}: comunicare importantă privind datele dvs. personale. Citiți-o cu atenție: {url}",
  },

  ics: {
    summary: "Programare – {clinic}",
    phone: "Tel. {phone}",
  },

  preview: {
    sampleFirstName: "Andreea",
  },
} satisfies DeepPartial<Messages["patientMessages"]>;
