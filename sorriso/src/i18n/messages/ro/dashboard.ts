import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Panou de control",
    template: "{page} · {app}",
  },
  skipToContent: "Salt la conținutul principal",

  nav: {
    label: "Panou de control",
    overview: "Prezentare generală",
    calendar: "Calendar",
    confirmations: "Confirmări",
    messages: "Mesaje",
    patients: "Pacienți",
    duplicates: "Posibile duplicate",
    waitlist: "Listă de așteptare",
    recalls: "Rechemări",
    reviews: "Recenzii",
    analytics: "Statistici",
    team: "Echipă și program",
    services: "Tratamente",
    locations: "Sedii și fotolii",
    reminders: "Reamintiri",
    settings: "Setări",
    funds: "Fonduri de sănătate",
    api: "API",
    privacyRequests: "Cereri privind confidențialitatea",
    privacySettings: "Setări de confidențialitate",
    audit: "Jurnal de audit",
    security: "Securitatea mea",
    platform: "Platformă",
    platformPrivacy: "Cereri de confidențialitate ale platformei",
    groups: {
      setup: "Configurare",
      privacy: "Confidențialitate",
      account: "Cont",
    },
    count: p({ one: "{count} de gestionat", few: "{count} de gestionat", other: "{count} de gestionat" }),
  },

  sidebar: {
    home: "Prezentarea generală a panoului",
    publicPage: "Pagina publică",
    publicPageNewTab: "Pagina dumneavoastră publică (se deschide într-o filă nouă)",
    switchPractice: "Schimbați cabinetul",
    logout: "Deconectare",
    language: "Limba panoului",
    languageAuto: "Automat ({language})",
  },

  language: {
    saved: "Limba a fost salvată.",
    invalid: "Alegeți una dintre limbile din listă.",
  },

  toast: {
    region: "Notificări",
    dismiss: "Închideți",
  },

  form: {
    saved: "Salvat.",
  },

  notFound: {
    title: "Pagina nu a fost găsită",
    body: "Această pagină a panoului nu există sau a fost mutată.",
    back: "Înapoi la prezentarea generală",
  },

  denied: "Nu aveți permisiunea de a deschide pagina respectivă. Cereți-o unui proprietar sau unui administrator al cabinetului, dacă aveți nevoie de ea.",

  overview: {
    title: "Prezentare generală",
    greeting: {
      morning: "Bună dimineața, {name}",
      afternoon: "Bună ziua, {name}",
      evening: "Bună seara, {name}",
    },
    subtitle: "{date} · {practice}",
    openCalendar: "Deschideți calendarul",
    welcome: {
      title: "Bun venit! Patru pași până la lansare",
      team: "Adăugați medicii dentiști și igieniștii, cu programul lor la fiecare sediu",
      services: "Stabiliți tratamentele, duratele și prețurile",
      reminders: "Alegeți când se trimit reamintirile (SMS, WhatsApp, email)",
      widget: "Integrați widgetul de programare pe site-ul dumneavoastră",
    },
    stats: {
      today: "Azi",
      todayHint: p({ one: "{count} confirmată sau efectuată", few: "{count} confirmate sau efectuate", other: "{count} de confirmate sau efectuate" }),
      tomorrow: "Confirmate pentru mâine",
      tomorrowHint: "{confirmed} din {total} · {open} de urmărit",
      noShow: "Rata de neprezentare (30 de zile)",
      noShowHint: "Neprezentări: {noShows} · vizite: {visits}",
      online: "Programări online (7 zile)",
      onlineHint: "Reocupate din lista de așteptare (30 de zile): {refilled} · în așteptare: {waiting}",
      none: "–",
    },
    demo: {
      all: "Mod demo: emailurile, SMS-urile și mesajele WhatsApp sunt reținute pe pagina Mesaje în loc să fie livrate.",
      email: "Mod demo: emailurile sunt reținute pe pagina Mesaje în loc să fie livrate.",
      text: "Mod demo: SMS-urile și mesajele WhatsApp sunt reținute pe pagina Mesaje în loc să fie livrate.",
      connect: "Conectați furnizorii",
    },
    attention: "Necesită atenția dumneavoastră",
    attentionCount: p({ one: "{count} programare", few: "{count} programări", other: "{count} de programări" }),
    agenda: "Agenda zilei",
    noneToday: "Nicio programare azi.",
    tomorrowLink: "Confirmările de mâine",
  },

  confirmations: {
    title: "Confirmări",
    tabs: {
      label: "Ce programări",
      tomorrow: "Mâine",
      week: "Următoarele 7 zile",
      requests: "Cereri online",
      outcome: "Înregistrați rezultatul",
      cancelled: "Anulate recent",
    },
    descriptions: {
      tomorrow: "Cine vine mâine. Urmăriți-i pe cei care nu au confirmat încă: pacienții cu neprezentări anterioare sunt semnalați.",
      week: "Tot ce este programat pentru săptămâna următoare.",
      requests: "Programări online care așteaptă aprobarea dumneavoastră (când cabinetul verifică programările online).",
      outcome: "Vizite trecute fără rezultat. Marcați-le ca efectuate (se trimite cererea de recenzie) sau ca neprezentare.",
      cancelled: "Intervale viitoare eliberate prin anulări. Au fost oferite automat pacienților potriviți de pe lista de așteptare.",
    },
    onlyPending: "Doar cele neconfirmate ({count})",
    riskSorted: "Vizitele neconfirmate cu risc mai mare de neprezentare sunt afișate primele în fiecare zi.",
    empty: "Nimic de afișat aici.",
  },

  waitlist: {
    title: "Listă de așteptare",
    description:
      "Când o programare este anulată sau mutată, intervalul este oferit prin SMS, WhatsApp sau email până la 3 pacienți potriviți. Îl obține primul care se programează.",
    emptyTitle: "Nu așteaptă nimeni",
    emptyBody: "Pacienții se pot înscrie din pagina de programare când nicio oră nu le convine.",
    waiting: "În așteptare",
    anyPractitioner: "Orice medic",
    anyOffice: "Orice sediu",
    preference: "{practitioner} · {office}",
    window: "{from} – {to}",
    partOfDay: {
      any: "Oricând",
      morning: "Dimineața",
      afternoon: "După-amiaza",
    },
    offers: p({ one: "{count} ofertă trimisă", few: "{count} oferte trimise", other: "{count} de oferte trimise" }),
    remove: "Eliminați",
    removeConfirm: "Eliminați acest pacient de pe lista de așteptare?",
    note: "Nota pacientului: {note}",
    restricted: "Dosar restricționat: datele de contact și nota sunt ascunse.",
    openRecord: "Deschideți dosarul pacientului (este necesar un motiv)",
    booked: "Programați recent din lista de așteptare",
    bookedBadge: "Programat",
  },
} satisfies DeepPartial<Messages["dashboard"]>;
