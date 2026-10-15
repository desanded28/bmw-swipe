/**
 * French patient messages. SMS texts (sms*, replies.*): straight quotes only, no ellipsis, GSM-7
 * letters only (é è à ù are GSM-7; ê â ô î û ç and capital À are not). Confirm word OUI, cancel
 * word NON (src/lib/inbound.ts KEYWORDS.fr).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  format: {
    slot: "{day}/{month} {time}",
  },

  email: {
    greeting: "Bonjour {name},",
    when: "Quand",
    where: "Où",
    service: "Soin",
    with: "Avec",
    patient: "Patient(e)",
    manage: "Gérer le rendez-vous",
    confirm: "Je confirme ma présence",
    cancel: "Annuler",
    reschedule: "Déplacer",
    calendar: "Ajouter à l'agenda",
    detailsOnline: "Vous trouverez tous les détails de votre visite sur la page de votre rendez-vous.",
  },

  privacyFooter: {
    sender: "{name} · {address}",
    phone: "Tél. {phone}",
    why: "Vous recevez cet e-mail car vous avez un rendez-vous chez {clinic}.",
    whyGuardian: "Vous recevez cet e-mail car vous êtes le contact pour les rendez-vous de {patient} chez {clinic}.",
    whyWaitlist: "Vous recevez cet e-mail car vous vous êtes inscrit sur la liste d'attente de {clinic}.",
    whyGeneric: "Vous recevez cet e-mail car vous êtes patient de {clinic}.",
    object:
      "Vous pouvez vous opposer aux rappels ou retirer un consentement à tout moment depuis vos choix de confidentialité, ou en répondant STOP à nos SMS.",
    notice: "Politique de confidentialité",
    preferences: "Vos choix de confidentialité",
  },

  booked: {
    subject: "Rendez-vous réservé - {clinic} - {date}",
    subjectDetailed: "Rendez-vous réservé : {service}, {date}",
    body: "votre rendez-vous est réservé. Nous vous enverrons un rappel avant votre visite.",
    sms: "{clinic}: rendez-vous réservé le {when}. Gérer: {url} Confidentialité: {privacy} STOP pour ne plus recevoir de SMS",
    smsShort: "{clinic}: RDV pris le {slot}. Gerer: {url}",
    smsDetailed:
      "{clinic}: rendez-vous réservé, {service} avec {practitioner} le {when}. Gérer: {url} STOP pour ne plus recevoir de SMS",
  },

  requested: {
    subject: "Demande reçue - {clinic} - {date}",
    subjectDetailed: "Demande reçue : {service}",
    body: "nous avons bien reçu votre demande. Le cabinet la confirmera sous peu et vous recevrez un e-mail.",
  },

  approved: {
    subject: "Rendez-vous confirmé - {clinic} - {date}",
    subjectDetailed: "Rendez-vous confirmé par le cabinet : {service}, {date}",
    body: "le cabinet a accepté votre demande. Voici les détails de votre rendez-vous.",
    sms: "{clinic}: votre rendez-vous du {when} est confirmé. Gérer: {url} Confidentialité: {privacy} STOP pour ne plus recevoir de SMS",
    smsShort: "{clinic}: RDV confirme le {slot}. Gerer: {url}",
  },

  reminder: {
    subject: "Rappel de rendez-vous - {clinic} - {date}",
    subjectDetailed: "Rappel de rendez-vous : {service}, {date}",
    body: "nous vous rappelons votre prochain rendez-vous.",
    bodyAsk: "nous vous rappelons votre prochain rendez-vous. Pouvez-vous confirmer votre présence en un clic ?",
    sms: "{clinic}: rappel, rendez-vous le {when}, {address}. Détails: {url} STOP pour ne plus recevoir de SMS",
    smsAsk:
      "{clinic}: rappel, rendez-vous le {when}, {address}. Répondez OUI pour confirmer, NON pour annuler. Détails: {url} STOP pour ne plus recevoir de SMS",
    smsShort: "{clinic}: RDV le {slot}. Details: {url}",
    smsAskShort: "{clinic}: RDV le {slot}. OUI pour confirmer, NON pour annuler. {url}",
    smsDetailed: "{clinic}: bonjour {name}, rappel: {service} avec {practitioner} le {when}, {address}. Détails: {url}",
    smsAskDetailed:
      "{clinic}: bonjour {name}, rappel: {service} avec {practitioner} le {when}, {address}. Répondez OUI pour confirmer, NON pour annuler. Détails: {url}",
  },

  cancelled: {
    subject: "Rendez-vous annulé - {clinic} - {date}",
    body: "votre rendez-vous a été annulé comme demandé.",
    bodyByPractice:
      "malheureusement, le cabinet a dû annuler votre rendez-vous. Vous pouvez réserver un nouveau créneau quand vous le souhaitez.",
    sms: "{clinic}: votre rendez-vous du {when} a été annulé. Réserver à nouveau: {url}",
    smsShort: "{clinic}: RDV du {slot} annule. {url}",
    rebook: "Réserver à nouveau",
  },

  rescheduled: {
    subject: "Rendez-vous déplacé - {clinic} - {date}",
    subjectDetailed: "Rendez-vous déplacé : {service}, {date}",
    body: "votre rendez-vous a été déplacé. Voici le nouvel horaire.",
    sms: "{clinic}: votre rendez-vous a été déplacé au {when}, {address}. Détails: {url}",
    smsShort: "{clinic}: RDV deplace au {slot}. {url}",
  },

  waitlist: {
    subject: "Un créneau vient de se libérer - {clinic} - {date}",
    body: "un créneau vient de se libérer le {when}. Il revient à la première personne qui le réserve : s'il vous convient, réservez-le dès maintenant.",
    sms: "{clinic}: un créneau s'est libéré le {when}. Le premier qui réserve l'obtient: {url}",
    smsShort: "{clinic}: creneau libre {slot}: {url}",
    cta: "Réserver ce créneau",
  },

  review: {
    subject: "Comment s'est passée votre visite chez {clinic} ?",
    body: "merci pour votre visite. Un avis vérifié aide d'autres patients à choisir en toute confiance. Cela ne prend qu'une minute.",
    bodyDetailed:
      "merci d'avoir consulté {practitioner}. Un avis vérifié aide d'autres patients à choisir en toute confiance. Cela ne prend qu'une minute.",
    cta: "Laisser un avis",
  },

  replies: {
    confirmed: "{clinic}: merci, présence confirmée pour le {when}. Nous vous attendons.",
    confirmedShort: "{clinic}: merci, RDV confirme le {slot}.",
    cancelled: "{clinic}: votre rendez-vous du {when} est annulé. Réserver un autre créneau: {url}",
    cancelledShort: "{clinic}: RDV du {slot} annule. Reserver: {url}",
    reschedule: "{clinic}: choisissez un nouvel horaire ici: {url}",
    unknown: "{clinic}: désolé, nous n'avons pas compris. Répondez OUI pour confirmer ou NON pour annuler, ou consultez: {url}",
    none: "{clinic}: aucun rendez-vous à venir n'est associé à ce numéro.",
    stop: "{clinic}: vous ne recevrez plus de SMS de notre part. Répondez START pour les réactiver.",
    start: "{clinic}: les SMS sont réactivés. Répondez STOP pour ne plus les recevoir.",
  },

  unsubscribeConfirmation: {
    subject: "Vos préférences de messages - {clinic}",
    body: "vous ne recevrez plus de messages par {channel} concernant vos rendez-vous chez {clinic}. Vous pouvez changer d'avis à tout moment depuis vos choix de confidentialité.",
    cta: "Vos choix de confidentialité",
    sms: "{clinic}: vous ne recevrez plus de SMS de notre part. Répondez START pour les réactiver.",
  },

  breachNotice: {
    subject: "Important : un incident de sécurité concernant vos données - {clinic}",
    body: "nous vous écrivons pour vous informer d'une violation de données personnelles susceptible de vous concerner. Nous la prenons très au sérieux et souhaitons vous expliquer ce qui s'est passé et ce que nous faisons.",
    what: "Ce qui s'est passé",
    when: "Quand",
    data: "Données concernées",
    consequences: "Ce que cela peut signifier pour vous",
    measures: "Ce que nous avons fait",
    advice: "Ce que vous pouvez faire",
    contact: "Des questions ?",
    contactValue: "Contactez notre délégué à la protection des données : {dpo}",
    sms: "{clinic}: information importante concernant vos données personnelles. Merci de la lire attentivement: {url}",
  },

  ics: {
    summary: "Rendez-vous – {clinic}",
    phone: "Tél. {phone}",
  },

  preview: {
    sampleFirstName: "Camille",
  },
} satisfies DeepPartial<Messages["patientMessages"]>;
