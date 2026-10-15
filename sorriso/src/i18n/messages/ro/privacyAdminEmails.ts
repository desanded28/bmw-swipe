import type { DeepPartial, Messages } from "../../types";

export default {
  types: {
    access: "accesul la datele dumneavoastră",
    rectification: "rectificarea datelor dumneavoastră",
    erasure: "ștergerea datelor dumneavoastră",
    restriction: "restricționarea prelucrării datelor dumneavoastră",
    portability: "o copie a datelor dumneavoastră, pentru a le transfera",
    objection: "opoziția la prelucrarea datelor dumneavoastră",
    consent_withdrawal: "retragerea consimțământului dumneavoastră",
  },

  requestExtended: {
    subject: "Cererea dumneavoastră privind datele: avem nevoie de mai mult timp",
    body: "Am primit la {received} cererea dumneavoastră privind {type}. Avem nevoie de mai mult timp pentru a vă răspunde complet, din următorul motiv: {reason}. Veți primi răspunsul nostru până la {until}. GDPR (art. 12 alin. (3)) permite această prelungire cu cel mult încă două luni.",
    sms: "{practice}: avem nevoie de mai mult timp pentru cererea dvs. privind datele din {received}. Motiv: {reason}. Răspuns până la {until}.",
  },
  requestGranted: {
    subject: "Cererea dumneavoastră privind datele a fost soluționată",
    body: "Am soluționat cererea dumneavoastră privind {type}, primită la {received}. Răspunsul nostru: {reason}",
    sms: "{practice}: cererea dvs. privind datele din {received} a fost soluționată. {reason}",
  },
  requestPartiallyGranted: {
    subject: "Răspunsul nostru la cererea dumneavoastră privind datele",
    body: "Am dat curs în parte cererii dumneavoastră privind {type}, primită la {received}. Răspunsul nostru și motivele: {reason}. Dacă nu sunteți de acord, puteți depune o plângere la autoritatea italiană pentru protecția datelor (Garante per la protezione dei dati personali, www.garanteprivacy.it) sau vă puteți adresa instanței.",
    sms: "{practice}: cererea dvs. privind datele din {received} a fost aprobată în parte. Motive: {reason}. Puteți depune plângere la Garante (garanteprivacy.it) sau în instanță.",
  },
  requestRefused: {
    subject: "Răspunsul nostru la cererea dumneavoastră privind datele",
    body: "Nu putem da curs cererii dumneavoastră privind {type}, primită la {received}, din următoarele motive: {reason}. Dacă nu sunteți de acord, puteți depune o plângere la autoritatea italiană pentru protecția datelor (Garante per la protezione dei dati personali, www.garanteprivacy.it) sau vă puteți adresa instanței.",
    sms: "{practice}: nu putem da curs cererii dvs. privind datele din {received}. Motive: {reason}. Puteți depune plângere la Garante (garanteprivacy.it) sau în instanță.",
  },
  restrictionLifted: {
    subject: "Restricționarea datelor dumneavoastră este ridicată",
    body: "La {since}, prelucrarea datelor dumneavoastră la {practice} a fost restricționată. Această restricționare este acum ridicată, așa că cabinetul vă poate folosi din nou datele, de exemplu pentru a vă trimite reamintiri ale programărilor. Dacă aveți întrebări sau considerați că restricționarea ar trebui să continue, contactați cabinetul.",
    sms: "{practice}: restricționarea datelor dvs., în vigoare din {since}, este ridicată. Contactați-ne pentru orice întrebare.",
  },

  ownerDeadline7: {
    subject: "Cerere privind datele cu termen în 7 zile",
    body: "O cerere privind {type}, primită de {practice} la {received}, trebuie soluționată până la {due}. Deschideți-o în panoul de control pentru a o finaliza sau pentru a prelungi termenul, cu un motiv, dacă aveți cu adevărat nevoie de mai mult timp.",
    cta: "Deschideți cererea",
  },
  ownerDeadline2: {
    subject: "Cerere privind datele cu termen în 2 zile",
    body: "O cerere privind {type}, primită de {practice} la {received}, trebuie soluționată până la {due}. Un răspuns întârziat încalcă art. 12 alin. (3) GDPR: vă rugăm să o finalizați acum.",
    cta: "Deschideți cererea",
  },

  subprocessorsChanged: {
    subject: "Lista subîmputerniciților Sorriso s-a modificat",
    body: "Sorriso a actualizat lista subîmputerniciților care prelucrează datele {practice} (versiunea {version}, în vigoare de la {effective}). Vă rugăm să o verificați și să o acceptați în panoul de control. Dacă vă opuneți unei modificări, scrieți la {email} în termen de 30 de zile: vom căuta împreună o soluție și, dacă nu există, puteți rezilia contractul fără penalități.",
    cta: "Verificați lista",
  },

  closureRequested: {
    subject: "Contul dumneavoastră Sorriso este în curs de închidere",
    body: "Am primit la {date} cererea de închidere a contului {practice}. Programarea online a fost oprită, iar cabinetul nu mai apare în căutare. Vă puteți descărca toate datele până la {purge}; la acea dată vor fi șterse definitiv. Puteți anula închiderea până atunci din panoul de control.",
    cta: "Descărcați datele",
  },
  closureCancelled: {
    subject: "Închiderea contului a fost anulată",
    body: "Închiderea contului {practice} a fost anulată și nu va fi ștearsă nicio dată. Programarea online prin propria pagină de programare, widget și linkuri funcționează din nou. Cabinetul rămâne ascuns în căutarea Sorriso până când îl listați din nou din Setări.",
  },
  closureCertificate: {
    subject: "Certificat de ștergere: {practice}",
    body: "La {date} am șters definitiv datele {practice} din sistemele Sorriso, conform acordului de prelucrare a datelor. Copiile de siguranță criptate care le mai conțin expiră la {backups} și sunt apoi suprascrise. Certificatul enumeră ce a fost șters.",
    cta: "Vedeți certificatul",
  },

  footer: {
    rights: "Primiți acest mesaj deoarece v-ați exercitat drepturile privind protecția datelor.",
    staff: "Primiți acest mesaj în calitate de proprietar al unui cabinet care folosește Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyAdminEmails"]>;
