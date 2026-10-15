import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Programarea dumneavoastră",
    description: "Vedeți, confirmați, mutați sau anulați programarea.",
  },
  greeting: "Bună ziua, {name},",
  title: "Programarea dumneavoastră la {clinic}",
  status: {
    cancelled: "Anulată",
    requested: "Se așteaptă confirmarea cabinetului",
    completed: "Efectuată",
    no_show: "Ratată",
    confirmed: "Programată și confirmată",
    pending: "Programată: vă rugăm să confirmați",
  },
  details: {
    when: "Când",
    timeRange: "{start}–{end}",
    treatment: "Tratament",
    where: "Unde",
    address: "{address}, {city}",
    phone: "Telefon",
  },
  confirm: {
    title: "Veți fi prezent?",
    body: "Confirmarea ajută {clinic} să își planifice ziua și vă păstrează ora.",
    button: "Da, voi fi prezent",
    done: "Vă mulțumim! Prezența dumneavoastră este confirmată.",
  },
  reschedule: {
    button: "Reprogramați",
    title: "Alegeți o oră nouă cu {practitioner}",
    moveTo: "Mutați programarea pe {when}?",
    moveToOffice: "Mutați programarea pe {when} la {office}?",
    confirm: "Confirmați noua oră",
    done: "Gata: programarea a fost mutată.",
    closed: p({
      one: "Reprogramarea online nu mai este posibilă cu mai puțin de {count} oră înainte de vizită.",
      few: "Reprogramarea online nu mai este posibilă cu mai puțin de {count} ore înainte de vizită.",
      other: "Reprogramarea online nu mai este posibilă cu mai puțin de {count} de ore înainte de vizită.",
    }),
    call: "Pentru a o muta, sunați la <tel>{phone}</tel>.",
  },
  cancel: {
    button: "Anulați programarea",
    title: "Anulați această programare?",
    late: p({
      one: "Vizita are loc în mai puțin de {count} oră. Anularea eliberează totuși ora pentru cineva de pe lista de așteptare: vă mulțumim că ne anunțați.",
      few: "Vizita are loc în mai puțin de {count} ore. Anularea eliberează totuși ora pentru cineva de pe lista de așteptare: vă mulțumim că ne anunțați.",
      other: "Vizita are loc în mai puțin de {count} de ore. Anularea eliberează totuși ora pentru cineva de pe lista de așteptare: vă mulțumim că ne anunțați.",
    }),
    body: "Ora dumneavoastră va fi oferită pacienților de pe lista de așteptare.",
    reason: "Motiv",
    reasonHint: "Opțional. Vizibil doar pentru cabinet. Nu includeți detalii despre sănătate.",
    confirm: "Da, anulați-o",
    keep: "Păstrați-o",
    done: "Programarea dumneavoastră a fost anulată.",
  },
  calendar: {
    appleOutlook: "Calendar Apple / Outlook",
    google: "Calendar Google",
  },
  review: {
    title: "Cum a fost vizita?",
    button: "Lăsați o recenzie",
  },
  rebook: "Faceți o altă programare",
  privateLink: "Păstrați acest link privat: oricine îl are poate gestiona această programare.",
  clinicPage: "Pagina {clinic}",
  invalid: {
    title: "Acest link nu funcționează",
    body: "Este posibil să fie incomplet sau scris greșit. Verificați că ați deschis linkul întreg din mesaj sau contactați cabinetul.",
  },
  expired: {
    title: "Acest link a expirat",
    body: "Pentru protecția datelor dumneavoastră, linkurile programărilor nu mai funcționează la un anumit timp după vizită. Pentru o nouă programare sau pentru întrebări despre o vizită anterioară, contactați direct cabinetul.",
    privacyCenter: "Pentru a vedea datele pe care cabinetele le dețin despre dumneavoastră, folosiți centrul de confidențialitate.",
  },
  rateLimited: {
    title: "Prea multe solicitări",
    body: p({
      one: "Această pagină a fost deschisă de prea multe ori într-un timp scurt. Încercați din nou peste {count} minut.",
      few: "Această pagină a fost deschisă de prea multe ori într-un timp scurt. Încercați din nou peste {count} minute.",
      other: "Această pagină a fost deschisă de prea multe ori într-un timp scurt. Încercați din nou peste {count} de minute.",
    }),
  },
  preview: {
    title: "Programarea dumneavoastră",
    body: "Deschideți acest link în browser pentru a vedea și gestiona programarea.",
  },
  home: "Mergeți la pagina principală",
} satisfies DeepPartial<Messages["manage"]>;
