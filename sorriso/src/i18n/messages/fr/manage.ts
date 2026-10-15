import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Votre rendez-vous",
    description: "Consultez, confirmez, déplacez ou annulez votre rendez-vous.",
  },
  greeting: "Bonjour {name},",
  title: "Votre rendez-vous chez {clinic}",
  status: {
    cancelled: "Annulé",
    requested: "En attente de confirmation par le cabinet",
    completed: "Effectué",
    no_show: "Manqué",
    confirmed: "Réservé et confirmé",
    pending: "Réservé : merci de confirmer",
  },
  details: {
    when: "Quand",
    timeRange: "{start}–{end}",
    treatment: "Soin",
    where: "Où",
    address: "{address}, {city}",
    phone: "Téléphone",
  },
  confirm: {
    title: "Serez-vous présent ?",
    body: "Confirmer aide {clinic} à organiser la journée et vous garantit votre créneau.",
    button: "Oui, je serai présent",
    done: "Merci ! Votre présence est confirmée.",
  },
  reschedule: {
    button: "Déplacer",
    title: "Choisissez un nouvel horaire avec {practitioner}",
    moveTo: "Déplacer votre rendez-vous au {when} ?",
    moveToOffice: "Déplacer votre rendez-vous au {when} sur le site {office} ?",
    confirm: "Confirmer le nouvel horaire",
    done: "C'est fait : votre rendez-vous a été déplacé.",
    closed: p({
      one: "Le déplacement en ligne n'est plus possible à moins de {count} heure de la visite.",
      other: "Le déplacement en ligne n'est plus possible à moins de {count} heures de la visite.",
    }),
    call: "Pour le déplacer, appelez le <tel>{phone}</tel>.",
  },
  cancel: {
    button: "Annuler le rendez-vous",
    title: "Annuler ce rendez-vous ?",
    late: p({
      one: "Votre visite a lieu dans moins de {count} heure. Annuler libère tout de même le créneau pour une personne de la liste d'attente : merci de nous prévenir.",
      other:
        "Votre visite a lieu dans moins de {count} heures. Annuler libère tout de même le créneau pour une personne de la liste d'attente : merci de nous prévenir.",
    }),
    body: "Votre créneau sera proposé aux patients de la liste d'attente.",
    reason: "Motif",
    reasonHint: "Facultatif. Visible uniquement par le cabinet. N'indiquez aucune information de santé.",
    confirm: "Oui, l'annuler",
    keep: "Le conserver",
    done: "Votre rendez-vous a été annulé.",
  },
  calendar: {
    appleOutlook: "Agenda Apple / Outlook",
    google: "Google Agenda",
  },
  review: {
    title: "Comment s'est passée votre visite ?",
    button: "Laisser un avis",
  },
  rebook: "Prendre un autre rendez-vous",
  privateLink: "Gardez ce lien privé : toute personne qui le possède peut gérer ce rendez-vous.",
  clinicPage: "Page de {clinic}",
  invalid: {
    title: "Ce lien ne fonctionne pas",
    body: "Il est peut-être incomplet ou mal saisi. Vérifiez que vous avez ouvert le lien complet depuis votre message, ou contactez votre cabinet.",
  },
  expired: {
    title: "Ce lien a expiré",
    body: "Pour protéger votre vie privée, les liens de rendez-vous cessent de fonctionner quelque temps après la visite. Pour réserver à nouveau ou poser une question sur une visite passée, contactez directement votre cabinet.",
    privacyCenter: "Pour consulter les données que les cabinets détiennent à votre sujet, utilisez l'espace confidentialité.",
  },
  rateLimited: {
    title: "Trop de requêtes",
    body: p({
      one: "Cette page a été ouverte trop de fois en peu de temps. Veuillez réessayer dans {count} minute.",
      other: "Cette page a été ouverte trop de fois en peu de temps. Veuillez réessayer dans {count} minutes.",
    }),
  },
  preview: {
    title: "Votre rendez-vous",
    body: "Ouvrez ce lien dans votre navigateur pour consulter et gérer votre rendez-vous.",
  },
  home: "Aller à la page d'accueil",
} satisfies DeepPartial<Messages["manage"]>;
