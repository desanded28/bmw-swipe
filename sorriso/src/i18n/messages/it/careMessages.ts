/**
 * SMS: solo apostrofi dritti, niente puntini di sospensione, nessun dettaglio clinico (GSM-7).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  recall: {
    subject: "{clinic}: è ora del tuo controllo periodico",
    body: "È il momento di prenotare il prossimo controllo periodico presso {clinic}. Scegli online l'orario che preferisci, oppure chiama lo studio. Se non vuoi ricevere questi promemoria, puoi disattivarli da {optout}.",
    cta: "Prenota il controllo",
    sms: "{clinic}: è ora del tuo controllo periodico. Prenota: {url} Per non ricevere questi promemoria: {optout}",
    smsShort: "{clinic}: è ora del controllo. Prenota: {url} Stop: {optout}",
  },
  practiceMoved: {
    subject: "{clinic} deve spostare il tuo appuntamento",
    body: "Ci dispiace: {clinic} non può riceverti {when} come previsto. Scegli un nuovo orario con un tocco, oppure chiedi allo studio di richiamarti.",
    cta: "Scegli un nuovo orario",
    sms: "{clinic}: ci dispiace, dobbiamo spostare il tuo appuntamento di {when}. Scegli un nuovo orario: {url}",
    smsShort: "{clinic}: dobbiamo spostare la visita di {when}. Nuovo orario: {url}",
  },
  anamnesisInvite: {
    subject: "{clinic}: compila il questionario anamnestico prima della visita",
    body: "Prima della visita di {when}, compila un breve questionario anamnestico. Richiede circa tre minuti e aiuta il dentista a curarti in sicurezza. Le tue risposte sono cifrate e può leggerle solo il team clinico.",
    cta: "Compila il questionario",
    sms: "{clinic}: prima della visita di {when}, compila il questionario anamnestico: {url}",
    smsShort: "{clinic}: compila il questionario anamnestico prima di {when}: {url}",
  },
} satisfies DeepPartial<Messages["careMessages"]>;
