/**
 * Testo autorevole della dichiarazione di accessibilità (l'inglese ne è la traduzione).
 * Bozza: da far rivedere a un legale prima della messa in produzione (docs/i18n/glossary-it.md).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    title: "Dichiarazione di accessibilità",
    description:
      "Il livello di accessibilità del sito e del servizio di prenotazione {app}, i limiti noti e come segnalare una barriera.",
  },
  title: "Dichiarazione di accessibilità",
  translationNotice: "Questa è la <link>versione italiana</link>, che prevale in caso di discordanza con le traduzioni.",
  intro:
    "{provider} si impegna a rendere il proprio sito web e il servizio di prenotazione utilizzabili da tutti, comprese le persone che usano un lettore di schermo, la sola tastiera, l'ingrandimento dello schermo o il controllo vocale.",
  legalBasis:
    "La presente dichiarazione è pubblicata ai sensi dell'Atto europeo sull'accessibilità (Direttiva (UE) 2019/882), recepito in Italia dal Decreto legislativo 27 maggio 2022, n. 82, e della Legge 9 gennaio 2004, n. 4.",
  scope: {
    title: "Ambito della dichiarazione",
    body: "Il sito web pubblico {host}: la ricerca, le pagine degli studi e dei professionisti, i moduli di prenotazione e di iscrizione alla lista d'attesa, la pagina dell'appuntamento raggiungibile dalle conferme e dai promemoria, il centro privacy, le pagine legali e il widget di prenotazione che gli studi integrano nei propri siti web.",
  },
  status: {
    title: "Stato di conformità",
    body: "Progettiamo e verifichiamo il servizio secondo le Linee guida per l'accessibilità dei contenuti web (WCAG) 2.2, livello AA. La norma armonizzata europea richiamata dalla legge, EN 301 549 v3.2.1, recepisce le WCAG 2.1 livello AA. Il servizio è parzialmente conforme alle WCAG 2.1 livello AA: le parti indicate tra i limiti noti non sono ancora pienamente conformi.",
  },
  features: {
    title: "Cosa facciamo",
    keyboard:
      "Il sito è realizzato per essere utilizzato con la sola tastiera, con un indicatore di focus visibile e un link per passare direttamente al contenuto principale.",
    screenReader:
      "Le pagine sono strutturate con titoli e punti di riferimento (landmark). I campi dei moduli hanno etichette, e gli errori e i messaggi di stato vengono annunciati dai lettori di schermo.",
    steps: "Il modulo di prenotazione sposta il focus su ogni nuovo passaggio, conserva quanto inserito se torni indietro e spiega ogni errore accanto al relativo campo.",
    contrast: "Testi e controlli dei moduli rispettano i rapporti di contrasto WCAG AA, e nessuna informazione è comunicata solo attraverso il colore.",
    motion: "Le animazioni vengono disattivate quando il tuo dispositivo richiede la riduzione del movimento.",
    zoom: "Le pagine sono realizzate per funzionare con ingrandimento al 200% e su schermi piccoli senza scorrimento orizzontale.",
    languages:
      "Il sito è disponibile in otto lingue e ogni pagina dichiara la propria lingua, così che i lettori di schermo la pronuncino correttamente.",
    help: "I recapiti dello studio sono mostrati nella stessa posizione nel modulo di prenotazione e nella pagina del tuo appuntamento.",
  },
  limitations: {
    title: "Limiti noti",
    practiceContent:
      "I testi scritti dagli studi (descrizioni delle prestazioni, biografie dei professionisti) sono mostrati nella lingua in cui lo studio li ha redatti, che può essere diversa da quella della pagina.",
    dates:
      "I campi data usano il selettore di date del browser, la cui accessibilità varia tra browser e lettori di schermo. Puoi sempre digitare la data.",
    maps: "Le mappe nelle pagine degli studi sono solo un ausilio visivo: l'indirizzo è sempre indicato anche come testo.",
    widget:
      "Quando il widget di prenotazione è integrato nel sito web di uno studio, l'accessibilità della pagina che lo contiene è responsabilità dello studio.",
    messages: "I promemoria via SMS sono testo semplice e non possono contenere formattazione; i loro link aprono pagine coperte dalla presente dichiarazione.",
    exports: "I file scaricabili dal centro privacy (JSON, CSV) sono file leggibili da una macchina, non documenti destinati alla lettura.",
    workaround: "Se uno di questi limiti ti impedisce di prenotare, chiama lo studio: il numero di telefono è nella sua pagina e nel modulo di prenotazione.",
  },
  preparation: {
    title: "Redazione della dichiarazione",
    body: "La presente dichiarazione è stata redatta il {date} tramite autovalutazione, sulla base di verifiche automatiche del codice del sito eseguite a ogni modifica (etichette, messaggi di errore, gestione del focus, rapporti di contrasto). Una verifica manuale con la sola tastiera e con lettori di schermo (NVDA con Firefox su Windows, VoiceOver con Safari su iOS) non è ancora stata completata; aggiorneremo la dichiarazione quando lo sarà. Ultimo riesame: {reviewed}.",
  },
  feedback: {
    title: "Segnalazioni e contatti",
    body: "Se incontri una barriera, o hai bisogno di informazioni di questo sito in un altro formato, scrivi a <mail>{email}</mail>. Indicaci l'indirizzo della pagina e cosa è successo. Ti risponderemo entro 30 giorni.",
    noEmail:
      "Se incontri una barriera, o hai bisogno di informazioni di questo sito in un altro formato, contattaci ai recapiti indicati nell'<link>informativa privacy</link>. Indicaci l'indirizzo della pagina e cosa è successo. Ti risponderemo entro 30 giorni.",
  },
  enforcement: {
    title: "Procedura di attuazione",
    body: "Se la nostra risposta non ti soddisfa, o non ricevi risposta entro 30 giorni, puoi inviare una segnalazione ad AgID (Agenzia per l'Italia Digitale), l'autorità che vigila sull'accessibilità digitale in Italia, tramite il modulo disponibile su <link>form.agid.gov.it</link>.",
  },
} satisfies DeepPartial<Messages["accessibility"]>;
