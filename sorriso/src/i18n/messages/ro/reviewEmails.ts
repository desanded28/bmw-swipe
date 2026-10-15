import type { DeepPartial, Messages } from "../../types";

export default {
  moderationRequestHidden: {
    subject: "Recenzia dumneavoastră despre {practice} a fost semnalată",
    body:
      "Recenzia dumneavoastră despre {practice} a fost semnalată moderatorilor Sorriso și este ascunsă cât timp aceștia o verifică. Ne puteți prezenta punctul dumneavoastră de vedere până la {date}: îl citim înainte de a decide. Vă puteți și șterge recenzia.",
    cta: "Răspundeți moderatorilor",
    sms: "Sorriso: recenzia dvs. despre {practice} a fost semnalată. Puteți răspunde până la {date}: {url}",
  },
  moderationRequestVisible: {
    subject: "Recenzia dumneavoastră despre {practice} a fost semnalată",
    body:
      "Recenzia dumneavoastră despre {practice} a fost semnalată moderatorilor Sorriso. Rămâne publicată cât timp aceștia o verifică. Ne puteți prezenta punctul dumneavoastră de vedere până la {date}: îl citim înainte de a decide. Vă puteți și șterge recenzia.",
    cta: "Răspundeți moderatorilor",
    sms: "Sorriso: recenzia dvs. despre {practice} a fost semnalată. Puteți răspunde până la {date}: {url}",
  },
  decisionKept: {
    subject: "Recenzia dumneavoastră despre {practice}: decizie",
    body:
      "Moderatorii Sorriso au examinat semnalarea privind recenzia dumneavoastră despre {practice} și au decis ca aceasta să rămână publicată. Motive: {reason}",
    cta: "Vedeți decizia",
    sms: "Sorriso: recenzia dvs. despre {practice} rămâne publicată. Detalii: {url}",
  },
  decisionRemoved: {
    subject: "Recenzia dumneavoastră despre {practice}: decizie",
    body:
      "Moderatorii Sorriso au decis să elimine recenzia dumneavoastră despre {practice}. Motive: {reason} Dacă nu sunteți de acord, puteți contesta o singură dată, până la {date}; vă puteți adresa și unui organism certificat de soluționare extrajudiciară a litigiilor sau unei instanțe.",
    cta: "Vedeți decizia sau contestați",
    sms: "Sorriso: recenzia dvs. despre {practice} a fost eliminată. Motive și contestație: {url}",
  },
  finalKept: {
    subject: "Recenzia dumneavoastră despre {practice}: decizia privind contestația",
    body:
      "Un alt moderator a examinat contestația privind recenzia dumneavoastră despre {practice} și a decis ca aceasta să rămână publicată. Motive: {reason} Această decizie este definitivă pe Sorriso.",
    cta: "Vedeți decizia",
    sms: "Sorriso: după contestație, recenzia dvs. despre {practice} rămâne publicată. Detalii: {url}",
  },
  finalRemoved: {
    subject: "Recenzia dumneavoastră despre {practice}: decizia privind contestația",
    body:
      "Un alt moderator a examinat contestația privind recenzia dumneavoastră despre {practice} și a decis să o elimine. Motive: {reason} Această decizie este definitivă pe Sorriso; vă puteți adresa în continuare unui organism certificat de soluționare extrajudiciară a litigiilor sau unei instanțe.",
    cta: "Vedeți decizia",
    sms: "Sorriso: după contestație, recenzia dvs. despre {practice} a fost eliminată. Detalii: {url}",
  },
  heldPublished: {
    subject: "Recenzia dumneavoastră despre {practice} a fost publicată",
    body: "Un moderator a verificat recenzia dumneavoastră despre {practice} și a publicat-o. Vă mulțumim că îi ajutați pe alți pacienți.",
    sms: "Sorriso: recenzia dvs. despre {practice} a fost publicată. Vă mulțumim!",
  },
  heldRemoved: {
    subject: "Recenzia dumneavoastră despre {practice} nu a fost publicată",
    body:
      "Un moderator a verificat recenzia dumneavoastră despre {practice} și nu a publicat-o. Motive: {reason} Dacă nu sunteți de acord, puteți contesta o singură dată, până la {date}.",
    cta: "Vedeți decizia sau contestați",
    sms: "Sorriso: recenzia dvs. despre {practice} nu a fost publicată. Motive și contestație: {url}",
  },
  practice: {
    keptSubject: "Semnalarea unei recenzii: decizie (păstrată)",
    keptBody:
      "Moderatorii Sorriso au examinat semnalarea dumneavoastră privind o recenzie despre {practice} și au decis ca aceasta să rămână publicată. Motive: {reason}",
    removedSubject: "Semnalarea unei recenzii: decizie (eliminată)",
    removedBody:
      "Moderatorii Sorriso au examinat semnalarea dumneavoastră privind o recenzie despre {practice} și au decis să o elimine. Motive: {reason}",
    appeal: "Puteți contesta o singură dată din pagina Recenzii a panoului de control. După aceea, vă puteți adresa unui organism certificat de soluționare extrajudiciară a litigiilor sau unei instanțe.",
    final: "Aceasta a fost decizia privind o contestație și este definitivă pe Sorriso. Vă puteți adresa în continuare unui organism certificat de soluționare extrajudiciară a litigiilor sau unei instanțe.",
    authorMayAppeal: "Autorul recenziei poate contesta această decizie o singură dată; în acest caz, decide un alt moderator și vă vom trimite rezultatul prin email.",
    open: "Deschideți pagina Recenzii",
    footer: "Moderare Sorriso · primiți acest email deoarece cabinetul dumneavoastră a semnalat o recenzie.",
  },
  notice: {
    receivedSubject: "Am primit notificarea dumneavoastră privind o recenzie",
    receivedBody: "Vă mulțumim: am primit notificarea dumneavoastră privind o recenzie despre {practice}. Un moderator va decide fără întârzieri nejustificate și vă va trimite rezultatul prin email.",
    decisionSubject: "Notificarea dumneavoastră privind o recenzie: decizie",
    keptBody: "Am verificat recenzia despre {practice} pe care ați semnalat-o și am decis să o păstrăm. Motive: {reason}",
    removedBody: "Am verificat recenzia despre {practice} pe care ați semnalat-o și am eliminat-o. Motive: {reason}",
    redress: "Dacă nu sunteți de acord, vă puteți adresa unui organism certificat de soluționare extrajudiciară a litigiilor sau unei instanțe.",
    footer: "Moderare Sorriso · primiți acest email deoarece ați trimis o notificare privind o recenzie.",
  },
  detailsReview: "Recenzie",
  detailsGround: "Motivul semnalării",
  detailsDecision: "Decizie",
} satisfies DeepPartial<Messages["reviewEmails"]>;
