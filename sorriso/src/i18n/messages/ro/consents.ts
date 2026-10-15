/**
 * Romanian translation of the consent texts. Translated from the authoritative Italian
 * (it/consents.ts) and checked against the English. Draft: needs lawyer/DPO review
 * (docs/i18n/glossary-ro.md).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  platform_booking_art9: {
    title: "Programare prin Sorriso",
    label:
      "Îmi exprim consimțământul ca Sorriso să prelucreze datele privind programarea mea, care pot dezvălui informații despre sănătatea mea, pentru a o transmite cabinetului ales și pentru a gestiona reamintirile și modificările.",
    description:
      "Este necesar doar dacă vă programați din paginile de căutare Sorriso: pentru acest serviciu, Sorriso este operator independent (art. 9 alin. (2) lit. (a) din GDPR). Vă puteți retrage consimțământul în orice moment din centrul de confidențialitate. Sorriso își încetează atunci propria prelucrare, iar cabinetul păstrează datele de care are nevoie pentru a vă trata. Retragerea nu afectează legalitatea prelucrării efectuate înainte de aceasta. Dacă preferați să nu vă dați consimțământul, vă puteți programa direct la cabinet.",
  },
  whatsapp_channel: {
    title: "Mesaje WhatsApp",
    label: "Sunt de acord să primesc pe WhatsApp mesajele privind programările mele.",
    description:
      "WhatsApp este operat de Meta. Mesajele sunt trimise prin Twilio și pot fi prelucrate în Statele Unite, în temeiul Cadrului UE-SUA privind confidențialitatea datelor (Data Privacy Framework) și al clauzelor contractuale standard. Meta poate afla că sunteți în contact cu acest cabinet. Puteți reveni oricând la SMS sau email.",
  },
  sms_channel: {
    title: "Mesaje SMS",
    label: "Trimiteți-mi prin SMS confirmările și reamintirile programărilor.",
    description:
      "Aceste mesaje fac parte din serviciul de programare și conțin doar strictul necesar: cabinetul, data, ora și un link. Le puteți opri oricând răspunzând STOP sau din preferințele dumneavoastră.",
  },
  email_channel: {
    title: "Emailuri",
    label: "Trimiteți-mi prin email confirmările și reamintirile programărilor.",
    description:
      "Aceste emailuri fac parte din serviciul de programare. Le puteți opri oricând prin linkul de dezabonare din fiecare email sau din preferințele dumneavoastră.",
  },
  feedback_request: {
    title: "Invitații la feedback",
    label: "După vizită, trimiteți-mi o scurtă invitație de a lăsa un feedback.",
    description:
      "Veți primi un singur mesaj la câteva zile după programare. Feedbackul este opțional. Vă puteți retrage oricând acest consimțământ.",
  },
  review_publication: {
    title: "Publicarea recenziei mele",
    label:
      "Îmi exprim consimțământul pentru publicarea recenziei mele pe Sorriso și pe pagina {practice}. Recenzia arată că am avut o vizită la {practitioner}. O pot șterge oricând din centrul de confidențialitate.",
    description:
      "Implicit, recenzia apare ca „Pacient verificat”. Nu includeți detalii despre sănătatea dumneavoastră: recenziile care conțin astfel de detalii sunt verificate înainte de publicare. Dacă vă retrageți consimțământul, recenzia este eliminată.",
  },
  marketing: {
    title: "Noutăți și oferte",
    label: "Doresc să primesc noutăți și oferte de la {practice}.",
    description:
      "Opțional: nu este necesar pentru programare sau pentru a primi îngrijiri. Vă puteți retrage consimțământul oricând, din orice mesaj sau din centrul de confidențialitate. Consimțământul expiră după 24 de luni fără contact.",
  },
  adaptive_reminders: {
    title: "Reamintiri adaptive",
    label: "Adaptați momentul și numărul reamintirilor mele în funcție de programările mele anterioare.",
    description:
      "Cabinetul vă poate trimite o reamintire suplimentară atunci când este mai probabil ca o programare să fie ratată, pe baza istoricului programărilor dumneavoastră. Este o creare de profiluri bazată pe interesul legitim și nu vă limitează niciodată posibilitatea de a vă programa. Vă puteți opune oricând: veți primi atunci reamintirile standard.",
  },
  no_show_tracking: {
    title: "Istoricul programărilor ratate",
    label: "Cabinetul poate înregistra programările la care nu mă prezint.",
    description:
      "Programările ratate din ultimele 24 de luni sunt numărate pentru organizarea programului și pentru a vă oferi ajutor, de exemplu o reamintire suplimentară. Nu vă împiedică niciodată să vă programați. Vă puteți opune oricând.",
  },
  recalls: {
    title: "Rechemări la control",
    label: "Anunțați-mă când medicul dentist îmi recomandă un control.",
    description:
      "Rechemările sunt trimise doar dacă medicul dentist v-a stabilit un interval între controale. Fiecare rechemare include o modalitate de a le opri. Vă puteți opune oricând.",
  },
} satisfies DeepPartial<Messages["consents"]>;
