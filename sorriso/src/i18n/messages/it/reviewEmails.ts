/**
 * SMS: solo apostrofi dritti, brevi (GSM-7). Discreti: nessuna prestazione, nessun testo della
 * recensione, nessuna informazione sulla salute.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  moderationRequestHidden: {
    subject: "La tua recensione di {practice} è stata segnalata",
    body: "La tua recensione di {practice} è stata segnalata ai moderatori di Sorriso ed è nascosta mentre la verificano. Puoi esporci la tua versione fino al {date}: la leggeremo prima di decidere. Puoi anche eliminare la tua recensione.",
    cta: "Rispondi ai moderatori",
    sms: "Sorriso: la tua recensione di {practice} è stata segnalata. Puoi rispondere fino al {date}: {url}",
  },
  moderationRequestVisible: {
    subject: "La tua recensione di {practice} è stata segnalata",
    body: "La tua recensione di {practice} è stata segnalata ai moderatori di Sorriso. Resta pubblicata mentre la verificano. Puoi esporci la tua versione fino al {date}: la leggeremo prima di decidere. Puoi anche eliminare la tua recensione.",
    cta: "Rispondi ai moderatori",
    sms: "Sorriso: la tua recensione di {practice} è stata segnalata. Puoi rispondere fino al {date}: {url}",
  },
  decisionKept: {
    subject: "La tua recensione di {practice}: decisione",
    body: "I moderatori di Sorriso hanno esaminato la segnalazione sulla tua recensione di {practice} e hanno deciso di mantenerla pubblicata. Motivazioni: {reason}",
    cta: "Vedi la decisione",
    sms: "Sorriso: la tua recensione di {practice} resta pubblicata. Dettagli: {url}",
  },
  decisionRemoved: {
    subject: "La tua recensione di {practice}: decisione",
    body: "I moderatori di Sorriso hanno deciso di rimuovere la tua recensione di {practice}. Motivazioni: {reason} Se non sei d'accordo puoi presentare ricorso una volta, fino al {date}; puoi anche rivolgerti a un organismo certificato di risoluzione extragiudiziale delle controversie o all'autorità giudiziaria.",
    cta: "Vedi la decisione o presenta ricorso",
    sms: "Sorriso: la tua recensione di {practice} è stata rimossa. Motivi e ricorso: {url}",
  },
  finalKept: {
    subject: "La tua recensione di {practice}: decisione sul ricorso",
    body: "Un altro moderatore ha esaminato il ricorso sulla tua recensione di {practice} e ha deciso di mantenerla pubblicata. Motivazioni: {reason} Questa decisione è definitiva su Sorriso.",
    cta: "Vedi la decisione",
    sms: "Sorriso: dopo il ricorso, la tua recensione di {practice} resta pubblicata. Dettagli: {url}",
  },
  finalRemoved: {
    subject: "La tua recensione di {practice}: decisione sul ricorso",
    body: "Un altro moderatore ha esaminato il ricorso sulla tua recensione di {practice} e ha deciso di rimuoverla. Motivazioni: {reason} Questa decisione è definitiva su Sorriso; puoi comunque rivolgerti a un organismo certificato di risoluzione extragiudiziale delle controversie o all'autorità giudiziaria.",
    cta: "Vedi la decisione",
    sms: "Sorriso: dopo il ricorso, la tua recensione di {practice} è stata rimossa. Dettagli: {url}",
  },
  heldPublished: {
    subject: "La tua recensione di {practice} è pubblicata",
    body: "Un moderatore ha controllato la tua recensione di {practice} e l'ha pubblicata. Grazie per aiutare altri pazienti.",
    sms: "Sorriso: la tua recensione di {practice} è ora pubblicata. Grazie!",
  },
  heldRemoved: {
    subject: "La tua recensione di {practice} non è stata pubblicata",
    body: "Un moderatore ha controllato la tua recensione di {practice} e non l'ha pubblicata. Motivazioni: {reason} Se non sei d'accordo puoi presentare ricorso una volta, fino al {date}.",
    cta: "Vedi la decisione o presenta ricorso",
    sms: "Sorriso: la tua recensione di {practice} non è stata pubblicata. Motivi e ricorso: {url}",
  },
  practice: {
    keptSubject: "Segnalazione di una recensione: decisione (mantenuta)",
    keptBody:
      "I moderatori di Sorriso hanno esaminato la vostra segnalazione su una recensione di {practice} e hanno deciso di mantenerla pubblicata. Motivazioni: {reason}",
    removedSubject: "Segnalazione di una recensione: decisione (rimossa)",
    removedBody:
      "I moderatori di Sorriso hanno esaminato la vostra segnalazione su una recensione di {practice} e hanno deciso di rimuoverla. Motivazioni: {reason}",
    appeal:
      "Potete presentare ricorso una volta dalla pagina Recensioni del pannello. Dopo di che, potete rivolgervi a un organismo certificato di risoluzione extragiudiziale delle controversie o all'autorità giudiziaria.",
    final:
      "Questa era la decisione su un ricorso ed è definitiva su Sorriso. Potete comunque rivolgervi a un organismo certificato di risoluzione extragiudiziale delle controversie o all'autorità giudiziaria.",
    authorMayAppeal:
      "L'autore della recensione può presentare ricorso contro questa decisione una volta; in tal caso deciderà un altro moderatore e vi comunicheremo l'esito via email.",
    open: "Apri la pagina Recensioni",
    footer: "Moderazione Sorriso · ricevete questa email perché il vostro studio ha segnalato una recensione.",
  },
  notice: {
    receivedSubject: "Abbiamo ricevuto la tua segnalazione su una recensione",
    receivedBody:
      "Grazie: abbiamo ricevuto la tua segnalazione su una recensione di {practice}. Un moderatore deciderà senza indebito ritardo e ti comunicherà l'esito via email.",
    decisionSubject: "La tua segnalazione su una recensione: decisione",
    keptBody: "Abbiamo verificato la recensione di {practice} che hai segnalato e abbiamo deciso di mantenerla. Motivazioni: {reason}",
    removedBody: "Abbiamo verificato la recensione di {practice} che hai segnalato e l'abbiamo rimossa. Motivazioni: {reason}",
    redress: "Se non sei d'accordo, puoi rivolgerti a un organismo certificato di risoluzione extragiudiziale delle controversie o all'autorità giudiziaria.",
    footer: "Moderazione Sorriso · ricevi questa email perché hai inviato una segnalazione su una recensione.",
  },
  detailsReview: "Recensione",
  detailsGround: "Motivo segnalato",
  detailsDecision: "Decisione",
} satisfies DeepPartial<Messages["reviewEmails"]>;
