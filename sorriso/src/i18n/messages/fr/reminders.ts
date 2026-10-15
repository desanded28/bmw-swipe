import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  page: {
    title: "Rappels et confirmations",
    description:
      "Quand et comment les patients reçoivent leurs rappels. Les réponses aux rappels par SMS mettent l'agenda à jour automatiquement.",
  },

  schedule: {
    title: "Calendrier des rappels",
    current: "Rappels actuels",
    none: "Aucun rappel : les patients ne reçoivent que la confirmation de réservation.",
    confirmNote: "Dès qu'un patient a confirmé, les rappels suivants ne lui demandent plus de confirmer.",
    asks: "demande une confirmation",
    channel: {
      email: "E-mail",
      text: "SMS",
    },
    offset: {
      days: p({ one: "{count} jour avant", other: "{count} jours avant" }),
      hours: p({ one: "{count} heure avant", other: "{count} heures avant" }),
      minutes: p({ one: "{count} minute avant", other: "{count} minutes avant" }),
    },
    risk: {
      medium: "uniquement risque d'absence moyen ou élevé",
      high: "uniquement risque d'absence élevé",
    },
  },

  rules: {
    channelLabel: "Canal",
    channelEmail: "E-mail",
    channelText: "SMS (ou WhatsApp si le patient l'a choisi)",
    amountLabel: "Combien de temps avant",
    unitLabel: "Unité",
    hoursBefore: "heures avant",
    daysBefore: "jours avant",
    askConfirmation: "Demander une confirmation (réponse OUI/NON)",
    fallbackToEmail: "E-mail à défaut de portable",
    riskLabel: "Envoyer pour",
    riskAll: "Tous les rendez-vous",
    riskMedium: "Risque d'absence moyen ou élevé uniquement",
    riskHigh: "Risque d'absence élevé uniquement",
    riskOff:
      "Les rappels selon le risque sont désactivés dans les paramètres de confidentialité : les règles limitées par le risque ne sont donc jamais envoyées.",
    riskObjection: "Les patients qui se sont opposés aux rappels adaptatifs sont considérés comme sans risque.",
    remove: "Supprimer le rappel {number}",
    rule: "Rappel {number}",
    add: "Ajouter un rappel",
    max: "6 rappels au maximum.",
    flagsTitle: "Autres messages",
    sendBookingConfirmation:
      "Envoyer une confirmation de réservation avec une invitation d'agenda juste après la réservation",
    autoOfferToWaitlist:
      "Proposer automatiquement les créneaux libérés aux patients correspondants de la liste d'attente",
    requestReviews: "Demander un avis vérifié 2 heures après qu'une visite a été marquée comme effectuée",
    requestReviewsHint: "Seuls les patients qui ont accepté d'être sollicités pour un avis reçoivent cet e-mail.",
    smsAsciiFallback: "Envoyer les SMS en espagnol, portugais, français, roumain et polonais sans accents",
    smsAsciiFallbackHint:
      "Les lettres accentuées comme ą ou ș peuvent doubler le coût d'un SMS. Sans elles, un rappel tient en moins de segments SMS.",
    save: "Enregistrer les règles de rappel",
    runNow: "Envoyer maintenant les rappels dus",
    readOnly: "Seuls les titulaires et les administrateurs peuvent modifier les règles de rappel.",
  },

  stats: {
    title: "30 derniers jours",
    sent: "Envoyés",
    pending: "Programmés",
    skipped: "Ignorés",
    failed: "Échecs",
    hint: "Ignorés : le rendez-vous a été annulé ou déplacé, le patient n'est pas joignable sur ce canal, ou une règle ne s'appliquait pas.",
  },

  inbound: {
    title: "Numéro de réponse",
    description:
      "Avec un numéro qui vous est propre (dans le compte Twilio de Sorriso), vos SMS partent de ce numéro et les réponses des patients y reviennent : une réponse ne peut jamais être attribuée à un autre cabinet. Sans numéro propre, les SMS utilisent l'expéditeur partagé et une réponse est attribuée au dernier cabinet qui a écrit au patient depuis celui-ci.",
    label: "Votre numéro ou Messaging Service Twilio",
    placeholder: "+39 02 1234 5678",
    hint: "Format international, par ex. +39 02 1234 5678, ou un SID de Messaging Service (MG…). Laissez vide pour utiliser l'expéditeur partagé.",
    save: "Enregistrer le numéro de réponse",
    ownerOnly: "Seul le titulaire du cabinet peut modifier le numéro de réponse.",
  },

  providers: {
    title: "Fournisseurs d'envoi",
    email: "E-mail",
    sms: "SMS",
    whatsapp: "WhatsApp",
    captured: "Démo : intercepté",
    live: "En production via {provider}",
    emailEnv: "Tout service SMTP disposant d'une région dans l'UE",
    smtpTls: "STARTTLS obligatoire, TLS 1.2 ou supérieur",
    smtpNoTls: "TLS n'est pas imposé (SMTP_REQUIRE_TLS=0) : uniquement pour un serveur de test local",
    smsRegion: "Région Twilio {region} via le point d'accès {edge} (résidence des données dans l'UE)",
    smsDefaultRegion:
      "Région Twilio US1 par défaut : définissez TWILIO_REGION=ie1 et TWILIO_EDGE=dublin pour la résidence des données dans l'UE",
    whatsappTemplates: p({
      one: "{count} modèle approuvé (type et langue)",
      other: "{count} modèles approuvés (type et langue)",
    }),
    whatsappNoTemplates:
      "Aucun modèle approuvé : les patients WhatsApp reçoivent des SMS tant que les modèles ne sont pas configurés.",
    repliesTitle: "Réponses bidirectionnelles",
    repliesBody: "Dans Twilio, configurez « A message comes in » pour votre numéro ou votre expéditeur WhatsApp sur :",
  },

  preview: {
    title: "Aperçu des messages",
    languageLabel: "Langue du patient",
    discreet:
      "Messages discrets : aucun soin, praticien ni note dans les SMS, les objets d'e-mail ou les entrées d'agenda.",
    detailed:
      "Messages détaillés : les SMS et les e-mails peuvent mentionner le soin et le praticien, mais uniquement pour les soins non marqués comme sensibles et les patients dont le contact est vérifié. Tous les autres reçoivent la version discrète.",
    reminderAsk: "Rappel demandant une confirmation",
    reminder: "Rappel après confirmation du patient",
    patientReply: "Réponse du patient",
    automaticAnswer: "Réponse automatique",
    segments: p({ one: "{count} segment SMS", other: "{count} segments SMS" }),
    characters: p({ one: "{encoding}, {count} caractère", other: "{encoding}, {count} caractères" }),
    overBudget: "Dépasse le budget de 2 segments GSM-7 ou 3 segments UCS-2",
    asciiOn: "Envoyé sans accents (l'option est activée)",
    emailTitle: "E-mail",
    subject: "Objet : {subject}",
    emailFrame: "Aperçu de l'e-mail en {language}",
    sampleNote: "Données d'exemple ; les liens ne mènent nulle part.",
  },

  replies: {
    title: "Réponses comprises",
    description:
      "Les patients peuvent répondre dans leur langue. Un message dans une autre langue n'est compris que s'il se compose d'un seul de ces mots ; tout le reste est signalé à l'accueil.",
    language: "Langue",
    confirm: "Confirmer",
    cancel: "Annuler",
    reschedule: "Nouvel horaire",
    stop: "Arrêt des SMS",
    start: "Reprise des SMS",
    emoji: "👍 confirme et 👎 annule dans toutes les langues.",
  },

  messages: {
    title: "Messagerie",
    description: "Tous les rappels, confirmations et réponses des patients, par e-mail, SMS et WhatsApp.",
    filters: "Filtrer les messages",
    all: "Tous",
    inbound: "Réponses des patients",
    attention: "Non compris",
    empty: "Aucun message pour l'instant",
    received: "Reçu",
    sentLabel: "Envoyé",
    reply: "Réponse : {intent}",
    showEmail: "Afficher l'e-mail",
    hideEmail: "Masquer l'e-mail",
    emailFrame: "E-mail : {subject}",
    unknownSender: "Numéro inconnu",
    redacted: "Contenu supprimé par la politique de conservation",
    linkRedacted: "[lien du patient]",
    restrictedPatient: "Patient restreint",
    restrictedBody:
      "Les données de ce patient sont restreintes (art. 18 du RGPD). Ouvrez son rendez-vous dans l'agenda et indiquez un motif pour voir ces messages.",
    status: {
      sent: "Envoyé",
      delivered: "Délivré",
      failed: "Échec",
      received: "Reçu",
      captured: "Intercepté (non envoyé)",
    },
    intent: {
      confirm: "a confirmé",
      cancel: "a annulé",
      reschedule: "souhaite un nouvel horaire",
      unknown: "non compris",
      stop: "a arrêté les SMS",
      start: "a réactivé les SMS",
    },
  },

  simulator: {
    title: "Tester le flux bidirectionnel",
    description:
      "Simulez la réponse d'un patient à son rappel. L'agenda se met à jour exactement comme avec de vraies réponses Twilio.",
    demoOnly: "Le simulateur de réponses n'est disponible qu'en mode démo.",
    noPatients: "Aucun rendez-vous à venir avec un numéro de portable.",
    patient: "Patient ayant une visite à venir",
    patientOption: "{name}, prochaine visite {when}",
    reply: "Sa réponse",
    via: "Via",
    examples: "Exemples",
    submit: "Simuler la réponse",
  },

  actions: {
    saved:
      "Règles de rappel enregistrées. Elles s'appliquent aux nouvelles réservations et à tout rendez-vous que vous déplacez.",
    ran: p({
      one: "{count} rappel dû traité : {sent} envoyé(s), {skipped} ignoré(s), {failed} en échec.",
      other: "{count} rappels dus traités : {sent} envoyé(s), {skipped} ignoré(s), {failed} en échec.",
    }),
    inboundSaved: "Numéro de réponse enregistré.",
    inboundCleared: "Numéro de réponse supprimé : les réponses passent désormais par l'expéditeur partagé.",
    inboundInvalid:
      "Saisissez un numéro de téléphone au format international (+39…) ou un SID de Messaging Service (MG…).",
    inboundTaken: "Ce numéro est déjà utilisé par un autre cabinet.",
    inboundShared:
      "Il s'agit de l'expéditeur partagé de Sorriso, auquel répondent les patients de tous les cabinets. Saisissez un numéro ou un Messaging Service réservé à votre cabinet.",
    ownerOnly: "Seul le titulaire du cabinet peut modifier le numéro de réponse.",
    invalidPhone: "Saisissez un numéro de téléphone valide.",
    noPatient: "Aucun patient de ce cabinet n'a ce numéro.",
    demoOnly: "Le simulateur de réponses n'est disponible qu'en mode démo.",
    simulated: "Compris comme « {intent} ».",
    simulatedReply: "Compris comme « {intent} ». Réponse automatique : {reply}",
  },
} satisfies DeepPartial<Messages["reminders"]>;
