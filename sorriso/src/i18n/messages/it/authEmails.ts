import type { DeepPartial, Messages } from "../../types";

export default {
  greeting: "Ciao {name},",
  footer: {
    why: "Ricevi questa email a causa di un'attività sul tuo account Sorriso.",
    notYou: "Se non sei stato tu, cambia la password e avvisa il titolare del tuo studio.",
  },
  verifyEmail: {
    subject: "Conferma il tuo indirizzo email",
    body: "Conferma che questo è il tuo indirizzo email per completare la configurazione di {practice} su Sorriso. Il link è valido per 24 ore.",
    cta: "Conferma la mia email",
  },
  verifyEmailAgain: {
    subject: "Conferma il tuo indirizzo email",
    body: "Conferma che questo è l'indirizzo email del tuo account Sorriso. Il link è valido per 24 ore.",
    cta: "Conferma la mia email",
  },
  verifyPracticeEmail: {
    subject: "Conferma l'indirizzo email di {practice}",
    body: "{owner} ha indicato questo indirizzo come email di {practice} su Sorriso. Le risposte dei pazienti e le richieste privacy saranno inviate qui, e la prenotazione online resta sospesa finché l'indirizzo non viene confermato. Il link è valido per 24 ore. Se non conosci questo studio, ignora questa email: non cambierà nulla.",
    cta: "Conferma questo indirizzo",
  },
  signupExisting: {
    subject: "Qualcuno ha provato a creare un account con la tua email",
    body: "Qualcuno, forse tu, ha provato a creare un nuovo studio su Sorriso con questo indirizzo email, che ha già un account. Se sei stato tu, accedi invece di registrarti, oppure reimposta la password se l'hai dimenticata. Se non sei stato tu, puoi ignorare questa email: non è stato modificato nulla.",
    cta: "Accedi",
  },
  passwordReset: {
    subject: "Reimposta la tua password Sorriso",
    body: "Abbiamo ricevuto una richiesta di reimpostazione della password di questo account. Il link è valido per 30 minuti e funziona una sola volta. Se non l'hai richiesta tu, ignora questa email: la tua password resta invariata.",
    cta: "Scegli una nuova password",
  },
  passwordChanged: {
    subject: "La tua password Sorriso è stata cambiata",
    body: "La password del tuo account è stata cambiata il {when} e tutti i dispositivi sono stati disconnessi. Se non sei stato tu, reimposta subito la password.",
    cta: "Reimposta la mia password",
  },
  invite: {
    subject: "{inviter} ti ha invitato in {practice} su Sorriso",
    body: "{inviter} ti ha invitato a unirti a {practice} su Sorriso con il ruolo di {role}. L'invito è valido per 7 giorni.",
    cta: "Accetta l'invito",
  },
  failedLogins: {
    subject: "Tentativi di accesso non riusciti sul tuo account",
    body: "Negli ultimi 15 minuti ci sono stati {count} tentativi non riusciti di accedere al tuo account Sorriso, quindi gli ulteriori tentativi sono bloccati per un po'. Se non sei stato tu, valuta di cambiare la password e di attivare la verifica in due passaggi.",
    cta: "Controlla la mia sicurezza",
  },
  newDevice: {
    subject: "Nuovo accesso al tuo account Sorriso",
    body: "È stato effettuato un accesso al tuo account da un nuovo dispositivo ({device}) il {when}. Se sei stato tu, non devi fare nulla. In caso contrario, chiudi quella sessione e cambia subito la password.",
    cta: "Controlla i miei dispositivi",
  },
  apiKeyCreated: {
    subject: "È stata creata una nuova chiave API per {practice}",
    body: "{creator} ha creato la chiave API \"{name}\" per {practice} il {when}, con questi accessi: {scopes}. Scade il {expires}. Le chiavi API consentono a un software di leggere e modificare i dati dei pazienti: se non riconosci questa chiave, revocala subito.",
    cta: "Controlla le chiavi API",
  },
  mfaReset: {
    subject: "La tua verifica in due passaggi è stata reimpostata",
    body: "{actor} ha reimpostato la verifica in due passaggi del tuo account presso {practice} il {when}. Sei stato disconnesso ovunque e configurerai una nuova app di autenticazione al prossimo accesso.",
    cta: "Accedi",
  },
} satisfies DeepPartial<Messages["authEmails"]>;
