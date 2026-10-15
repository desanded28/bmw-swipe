import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  generic: "Une erreur s'est produite. Veuillez réessayer.",
  network: "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.",
  checkFields: p({
    one: "Veuillez corriger le champ signalé.",
    other: "Veuillez corriger les {count} champs signalés.",
  }),
  slotTaken:
    "Désolé, quelqu'un vient de réserver cet horaire. Veuillez en choisir un autre : tout ce que vous avez saisi est conservé.",
  slotsLoadFailed: "Impossible de charger les horaires disponibles.",
  reload: "Recharger la page",
  fields: {
    required: "Obligatoire",
    contactRequired: "Indiquez un numéro de portable ou une adresse e-mail",
    phoneForText: "Nécessaire pour les rappels par SMS ou WhatsApp",
    emailForEmail: "Nécessaire pour les rappels par e-mail",
    invalidEmail: "Saisissez une adresse e-mail valide, par exemple nom@exemple.fr",
    invalidPhone: "Saisissez un numéro de portable valide",
    invalidDate: "Saisissez une date valide",
    invalidCountryCode: "Choisissez un indicatif pays",
    consentRequired: "Veuillez donner votre consentement pour continuer",
    whatsappRequired: "Veuillez confirmer pour continuer",
    dateOrder: "La date de fin ne peut pas être antérieure à la date de début",
    tooLong: "Ce texte est trop long",
    invalid: "Veuillez vérifier ce champ",
  },
  api: {
    practitioner_busy: "Cet horaire vient d'être pris. Veuillez en choisir un autre.",
    no_room: "Cet horaire vient d'être pris. Veuillez en choisir un autre.",
    time_off: "Cet horaire n'est plus disponible. Veuillez en choisir un autre.",
    outside_hours: "Cet horaire n'est plus disponible. Veuillez en choisir un autre.",
    too_soon:
      "Cet horaire est trop proche pour être réservé en ligne. Choisissez-en un plus tard ou appelez le cabinet.",
    too_far: "Cet horaire est trop lointain pour être réservé en ligne. Veuillez en choisir un plus proche.",
    in_past: "Cet horaire est déjà passé. Veuillez en choisir un autre.",
    not_offered: "Ce soin n'est pas proposé par ce praticien.",
    not_found: "Nous n'avons pas trouvé ce cabinet ou ce rendez-vous. Le lien n'est peut-être plus valable.",
    not_allowed: "Ce rendez-vous ne peut plus être modifié en ligne. Veuillez contacter le cabinet.",
    not_accepting:
      "Ce cabinet n'accepte pas de réservations en ligne pour le moment. Veuillez le contacter directement.",
    privacy_required:
      "Veuillez lire les informations sur la confidentialité et faire vos choix pour continuer.",
    validation_error: "Certaines informations ne sont pas valides. Vérifiez les champs signalés.",
    rate_limited: "Trop de tentatives. Patientez quelques minutes, puis réessayez.",
    internal_error: "Une erreur s'est produite de notre côté. Veuillez réessayer.",
    forbidden: "Cette action n'est pas autorisée.",
    unauthorized: "Cette action n'est pas autorisée.",
    invalid: "Cette réservation ne peut pas être acceptée telle quelle. Veuillez vérifier vos informations.",
    platform_consent_required:
      "Pour réserver via Sorriso, veuillez consentir au traitement des données de votre réservation.",
    whatsapp_consent_required: "Veuillez confirmer que vous souhaitez recevoir des messages sur WhatsApp.",
    whatsapp_unavailable: "Ce cabinet n'envoie pas de messages WhatsApp. Veuillez choisir SMS ou e-mail.",
    guardian_required:
      "Le rendez-vous d'un patient de moins de 14 ans doit être pris par un parent ou un représentant légal.",
    birthdate_required: "Veuillez indiquer la date de naissance du patient.",
    invalid_birthdate: "Veuillez vérifier la date de naissance.",
    not_a_minor: "Le patient aura 18 ans ou plus le jour du rendez-vous.",
    guardian_name_required: "Veuillez indiquer le nom du parent ou du représentant légal.",
    guardian_relation_required: "Veuillez préciser si vous êtes parent ou représentant légal.",
    guardian_contact_required:
      "Veuillez indiquer un numéro de téléphone ou une adresse e-mail du parent ou du représentant légal.",
    other_adult_must_book_themselves:
      "Les adultes prennent eux-mêmes leurs rendez-vous ici. Vous pouvez aussi réserver directement auprès du cabinet.",
    other_adult_contact_required:
      "Veuillez indiquer le numéro de portable ou l'e-mail du patient lui-même, et non les vôtres : c'est par ce biais qu'il confirmera la réservation.",
    notice_outdated:
      "Les informations sur la confidentialité ont été mises à jour depuis l'ouverture de cette page. Rechargez la page pour lire la nouvelle version, puis renvoyez le formulaire.",
  },
} satisfies DeepPartial<Messages["errors"]>;
