/**
 * French privacy messages. SMS texts: straight quotes, no ellipsis, GSM-7 letters only
 * (é è à ù are GSM-7; ê â ô î û ç and capital À are not). requestTypes are also slotted into SMS ({type}).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  requestReceipt: {
    subject: "Nous avons bien reçu votre demande relative à vos données",
    body: "{controller} a reçu votre demande ({type}) le {date}. Vous recevrez une réponse au plus tard le {due}. Si une demande complexe nécessite un délai supplémentaire, vous en serez informé, avec les motifs, avant cette date.",
    sms: "{controller} a bien enregistré votre demande RGPD ({type}). Réponse au plus tard le {due}.",
  },
  contactChangedPhone: {
    sms: "Le numéro de portable de votre dossier chez {practice} a été modifié via l'espace confidentialité Sorriso. Ce n'est pas vous ? Contactez le cabinet.",
  },
  contactChangedEmail: {
    subject: "Vos coordonnées ont été modifiées",
    body: "L'adresse e-mail de votre dossier chez {practice} a été modifiée depuis l'espace confidentialité Sorriso le {date}. Si ce n'est pas vous, contactez immédiatement le cabinet.",
  },
  bookedForYou: {
    subject: "Un rendez-vous a été pris pour vous chez {practice}",
    body: "{booker} a pris pour vous un rendez-vous chez {practice} le {when}. Le cabinet utilise vos données pour le gérer. Voici comment vos données sont traitées et quels sont vos droits, notamment pour les consulter, les rectifier ou les supprimer.",
    cta: "Lire la politique de confidentialité",
    sms: "{booker} a pris pour vous un rendez-vous chez {practice} le {when}. Confidentialité: {url}",
  },
  confirmBooking: {
    subject: "Merci de confirmer le rendez-vous pris pour vous",
    body: "{booker} a pris pour vous un rendez-vous chez {practice} le {when} via Sorriso. Vous seul pouvez le confirmer et accepter la manière dont Sorriso traite la réservation. Si vous ne le confirmez pas dans les {hours} heures, il sera annulé.",
    cta: "Confirmer ou refuser",
    sms: "{booker} a pris pour vous un rendez-vous chez {practice} via Sorriso. Confirmez sous {hours}h: {url}",
  },
  adultNotConfirmed: {
    subject: "Le rendez-vous que vous avez pris a été annulé",
    body: "Le rendez-vous que vous avez pris pour {name} chez {practice} le {when} a été annulé, car {name} ne l'a pas confirmé à temps. Seul le patient peut confirmer une réservation faite pour lui sur Sorriso : il peut réserver lui-même à nouveau.",
    sms: "Le rendez-vous que vous avez pris pour {name} chez {practice} le {when} a été annulé: {name} ne l'a pas confirmé à temps.",
  },
  requestTypes: {
    access: "accès à vos données",
    rectification: "rectification de vos données",
    erasure: "effacement de vos données",
    restriction: "limitation du traitement",
    portability: "copie de vos données pour les transférer ailleurs",
    objection: "opposition au traitement",
    consent_withdrawal: "retrait du consentement",
  },
  footer: {
    privacyCenter: "Vous recevez ce message suite à une demande effectuée dans l'espace confidentialité Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyMessages"]>;
