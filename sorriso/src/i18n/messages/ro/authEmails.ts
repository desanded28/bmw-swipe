import type { DeepPartial, Messages } from "../../types";

export default {
  greeting: "Bună ziua, {name},",
  footer: {
    why: "Primiți acest email din cauza unei activități în contul dumneavoastră Sorriso.",
    notYou: "Dacă nu ați fost dumneavoastră, schimbați-vă parola și anunțați proprietarul cabinetului.",
  },
  verifyEmail: {
    subject: "Confirmați adresa de email",
    body: "Confirmați că aceasta este adresa dumneavoastră de email pentru a finaliza configurarea {practice} pe Sorriso. Linkul este valabil 24 de ore.",
    cta: "Confirm adresa de email",
  },
  verifyEmailAgain: {
    subject: "Confirmați adresa de email",
    body: "Confirmați că aceasta este adresa de email a contului dumneavoastră Sorriso. Linkul este valabil 24 de ore.",
    cta: "Confirm adresa de email",
  },
  verifyPracticeEmail: {
    subject: "Confirmați adresa de email a {practice}",
    body: "{owner} a introdus această adresă ca email al {practice} pe Sorriso. Răspunsurile pacienților și cererile privind confidențialitatea vor fi trimise aici, iar programarea online rămâne suspendată până la confirmare. Linkul este valabil 24 de ore. Dacă nu cunoașteți acest cabinet, ignorați acest email: nu se schimbă nimic.",
    cta: "Confirmați această adresă",
  },
  signupExisting: {
    subject: "Cineva a încercat să creeze un cont cu adresa dumneavoastră de email",
    body: "Cineva, posibil dumneavoastră, a încercat să creeze un cabinet nou pe Sorriso cu această adresă de email, care are deja un cont. Dacă ați fost dumneavoastră, conectați-vă sau resetați-vă parola, dacă ați uitat-o. Dacă nu ați fost dumneavoastră, puteți ignora acest email: nu s-a modificat nimic.",
    cta: "Conectați-vă",
  },
  passwordReset: {
    subject: "Resetați parola Sorriso",
    body: "Am primit o cerere de resetare a parolei acestui cont. Linkul este valabil 30 de minute și funcționează o singură dată. Dacă nu ați solicitat acest lucru, ignorați acest email: parola rămâne aceeași.",
    cta: "Alegeți o parolă nouă",
  },
  passwordChanged: {
    subject: "Parola dumneavoastră Sorriso a fost schimbată",
    body: "Parola contului dumneavoastră a fost schimbată la {when}, iar toate dispozitivele au fost deconectate. Dacă nu ați fost dumneavoastră, resetați-vă imediat parola.",
    cta: "Resetați parola",
  },
  invite: {
    subject: "{inviter} v-a invitat la {practice} pe Sorriso",
    body: "{inviter} v-a invitat să vă alăturați echipei {practice} pe Sorriso, cu rolul {role}. Invitația este valabilă 7 zile.",
    cta: "Acceptați invitația",
  },
  failedLogins: {
    subject: "Încercări nereușite de conectare la contul dumneavoastră",
    body: "Încercări nereușite de conectare la contul dumneavoastră Sorriso în ultimele 15 minute: {count}. De aceea, alte încercări sunt blocate pentru o vreme. Dacă nu ați fost dumneavoastră, vă recomandăm să vă schimbați parola și să activați verificarea în doi pași.",
    cta: "Verificați securitatea",
  },
  newDevice: {
    subject: "Conectare nouă la contul dumneavoastră Sorriso",
    body: "Contul dumneavoastră a fost accesat de pe un dispozitiv nou ({device}) la {when}. Dacă ați fost dumneavoastră, nu trebuie să faceți nimic. Dacă nu, deconectați acea sesiune și schimbați-vă imediat parola.",
    cta: "Verificați dispozitivele",
  },
  apiKeyCreated: {
    subject: "A fost creată o cheie API nouă pentru {practice}",
    body: "{creator} a creat cheia API „{name}” pentru {practice} la {when}, cu acest acces: {scopes}. Expiră la {expires}. Cheile API permit unui software să citească și să modifice datele pacienților: dacă nu recunoașteți această cheie, revocați-o acum.",
    cta: "Verificați cheile API",
  },
  mfaReset: {
    subject: "Verificarea în doi pași a fost resetată",
    body: "{actor} a resetat verificarea în doi pași a contului dumneavoastră la {practice} la {when}. Ați fost deconectat peste tot și veți configura o aplicație de autentificare nouă la următoarea conectare.",
    cta: "Conectați-vă",
  },
} satisfies DeepPartial<Messages["authEmails"]>;
