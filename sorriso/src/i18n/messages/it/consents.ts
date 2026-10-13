/**
 * TESTO DI RIFERIMENTO. L'italiano è la versione autorevole dei testi di consenso e opposizione:
 * l'inglese e le altre lingue sono traduzioni di questo file. Bozze da far rivedere al DPO o a un
 * legale prima della messa in produzione; ogni modifica richiede una nuova CONSENT_TEXT_VERSION.
 *
 * Owned by the lead (frozen), like en/consents.ts. Register: "tu", as in the patient messages.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  platform_booking_art9: {
    title: "Prenotazione tramite Sorriso",
    label:
      "Acconsento al trattamento da parte di Sorriso dei dati relativi alla mia prenotazione, che possono rivelare informazioni sulla mia salute, per inoltrarla allo studio scelto e gestire promemoria e modifiche.",
    description:
      "Serve solo se prenoti dalle pagine di ricerca di Sorriso: per questo servizio Sorriso è titolare autonomo del trattamento (art. 9, par. 2, lett. a) GDPR). Puoi revocare il consenso in qualsiasi momento dal centro privacy. Sorriso interrompe allora il proprio trattamento, mentre lo studio conserva i dati necessari per curarti. La revoca non pregiudica la liceità del trattamento svolto prima. Se preferisci non dare il consenso, puoi prenotare direttamente presso lo studio.",
  },
  whatsapp_channel: {
    title: "Messaggi WhatsApp",
    label: "Accetto di ricevere su WhatsApp i messaggi relativi ai miei appuntamenti.",
    description:
      "WhatsApp è gestito da Meta. I messaggi sono inviati tramite Twilio e possono essere trattati negli Stati Uniti, sulla base del Data Privacy Framework UE-USA e delle clausole contrattuali standard. Meta può sapere che sei in contatto con questo studio. Puoi tornare agli SMS o all'email in qualsiasi momento.",
  },
  sms_channel: {
    title: "Messaggi SMS",
    label: "Inviatemi via SMS conferme e promemoria degli appuntamenti.",
    description:
      "Questi messaggi fanno parte del servizio di prenotazione e contengono solo lo stretto necessario: studio, data, ora e un link. Puoi interromperli in qualsiasi momento rispondendo STOP o dalle tue preferenze.",
  },
  email_channel: {
    title: "Email",
    label: "Inviatemi via email conferme e promemoria degli appuntamenti.",
    description:
      "Queste email fanno parte del servizio di prenotazione. Puoi interromperle in qualsiasi momento con il link di disiscrizione presente in ogni email o dalle tue preferenze.",
  },
  feedback_request: {
    title: "Inviti a lasciare un feedback",
    label: "Dopo la visita, inviatemi un breve invito a lasciare un feedback.",
    description:
      "Riceverai un solo messaggio qualche giorno dopo l'appuntamento. Lasciare un feedback è facoltativo. Puoi revocare questo consenso in qualsiasi momento.",
  },
  review_publication: {
    title: "Pubblicazione della recensione",
    label:
      "Acconsento alla pubblicazione della mia recensione su Sorriso e sulla pagina di {practice}. La recensione indica che ho effettuato una visita con {practitioner}. Posso eliminarla in qualsiasi momento dal centro privacy.",
    description:
      "Per impostazione predefinita la recensione appare come 'Paziente verificato'. Non inserire dettagli sulla tua salute: le recensioni che ne contengono vengono controllate prima della pubblicazione. Se revochi il consenso, la recensione viene rimossa.",
  },
  marketing: {
    title: "Novità e offerte",
    label: "Desidero ricevere novità e offerte da {practice}.",
    description:
      "Facoltativo: non serve per prenotare né per ricevere cure. Puoi revocare il consenso in qualsiasi momento da qualsiasi messaggio o dal centro privacy. Il consenso scade dopo 24 mesi senza contatti.",
  },
  adaptive_reminders: {
    title: "Promemoria adattivi",
    label: "Adattate tempi e numero dei miei promemoria in base ai miei appuntamenti passati.",
    description:
      "Lo studio può inviarti un promemoria in più quando è più probabile che un appuntamento venga mancato, in base allo storico dei tuoi appuntamenti. Si tratta di una profilazione basata sul legittimo interesse, che non limita mai la possibilità di prenotare. Puoi opporti in qualsiasi momento: riceverai i promemoria standard.",
  },
  no_show_tracking: {
    title: "Storico degli appuntamenti mancati",
    label: "Lo studio può registrare gli appuntamenti a cui non mi presento.",
    description:
      "Gli appuntamenti mancati negli ultimi 24 mesi vengono conteggiati per organizzare l'agenda e offrirti aiuto, ad esempio un promemoria in più. Non ti impediscono mai di prenotare. Puoi opporti in qualsiasi momento.",
  },
  recalls: {
    title: "Richiami per i controlli",
    label: "Ricordatemi quando il dentista mi consiglia una visita di controllo.",
    description:
      "I richiami vengono inviati solo se il dentista ha fissato per te un intervallo tra i controlli. Ogni richiamo contiene un modo per interromperli. Puoi opporti in qualsiasi momento.",
  },
} satisfies DeepPartial<Messages["consents"]>;
