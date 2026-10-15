import type { DeepPartial, Messages } from "../../types";

export default {
  requestReceipt: {
    subject: "Am primit cererea dumneavoastră privind confidențialitatea",
    body: "{controller} a primit cererea dumneavoastră ({type}) la {date}. Veți primi un răspuns până la {due}. Dacă o cerere complexă necesită mai mult timp, veți fi informat despre motiv înainte de această dată.",
    sms: "{controller} a primit cererea dvs. privind datele personale ({type}). Răspuns până la {due}.",
  },
  contactChangedPhone: {
    sms: "Numărul de mobil din dosarul dvs. de la {practice} a fost schimbat prin centrul de confidențialitate Sorriso. Nu ați fost dvs.? Contactați cabinetul.",
  },
  contactChangedEmail: {
    subject: "Datele dumneavoastră de contact au fost modificate",
    body: "Adresa de email din dosarul dumneavoastră de la {practice} a fost schimbată din centrul de confidențialitate Sorriso la {date}. Dacă nu ați fost dumneavoastră, contactați imediat cabinetul.",
  },
  bookedForYou: {
    subject: "V-a fost făcută o programare la {practice}",
    body: "{booker} v-a făcut o programare la {practice} pentru {when}. Cabinetul folosește datele dumneavoastră pentru a o gestiona. Iată cum sunt prelucrate datele dumneavoastră și care sunt drepturile dumneavoastră, inclusiv cum le puteți vedea, rectifica sau șterge.",
    cta: "Citiți nota de informare",
    sms: "{booker} v-a făcut o programare la {practice} pentru {when}. Informare date personale: {url}",
  },
  confirmBooking: {
    subject: "Confirmați programarea făcută pentru dumneavoastră",
    body: "{booker} v-a făcut prin Sorriso o programare la {practice} pentru {when}. Doar dumneavoastră o puteți confirma și puteți accepta modul în care Sorriso gestionează programarea. Dacă nu o confirmați în termen de {hours} ore, programarea va fi anulată.",
    cta: "Confirmați sau refuzați",
    sms: "{booker} v-a făcut o programare la {practice} prin Sorriso. Confirmați în {hours} h: {url}",
  },
  adultNotConfirmed: {
    subject: "Programarea pe care ați făcut-o a fost anulată",
    body: "Programarea pe care ați făcut-o pentru {name} la {practice} pentru {when} a fost anulată, deoarece {name} nu a confirmat-o la timp. Doar pacientul poate confirma o programare făcută pentru el pe Sorriso: se poate programa din nou singur.",
    sms: "Programarea făcută pentru {name} la {practice} pentru {when} a fost anulată: {name} nu a confirmat-o la timp.",
  },
  requestTypes: {
    access: "accesul la datele dumneavoastră",
    rectification: "rectificarea datelor dumneavoastră",
    erasure: "ștergerea datelor dumneavoastră",
    restriction: "restricționarea prelucrării",
    portability: "o copie a datelor dumneavoastră, pentru a le transfera",
    objection: "opoziția la prelucrare",
    consent_withdrawal: "retragerea consimțământului",
  },
  footer: {
    privacyCenter: "Primiți acest mesaj în urma unei cereri făcute în centrul de confidențialitate Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyMessages"]>;
