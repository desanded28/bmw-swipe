/**
 * Traduction française des textes de consentement et d'opposition, établie à partir de la version
 * italienne de référence (it/consents.ts), qui fait foi, et vérifiée par rapport à l'anglais.
 * Brouillon : à faire relire par le DPO ou un avocat avant la mise en production (voir
 * docs/i18n/glossary-fr.md). Registre : « vous ».
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  platform_booking_art9: {
    title: "Réservation via Sorriso",
    label:
      "Je consens au traitement par Sorriso des données relatives à ma réservation, qui peuvent révéler des informations sur ma santé, afin de la transmettre au cabinet choisi et de gérer les rappels et les modifications.",
    description:
      "Nécessaire uniquement si vous réservez depuis les pages de recherche de Sorriso : pour ce service, Sorriso est responsable de traitement autonome (art. 9, par. 2, point a) du RGPD). Vous pouvez retirer votre consentement à tout moment depuis l'espace confidentialité. Sorriso cesse alors son propre traitement, tandis que le cabinet conserve les données nécessaires pour vous soigner. Le retrait ne remet pas en cause la licéité du traitement effectué auparavant. Si vous préférez ne pas donner votre consentement, vous pouvez réserver directement auprès du cabinet.",
  },
  whatsapp_channel: {
    title: "Messages WhatsApp",
    label: "J'accepte de recevoir sur WhatsApp les messages relatifs à mes rendez-vous.",
    description:
      "WhatsApp est exploité par Meta. Les messages sont envoyés via Twilio et peuvent être traités aux États-Unis, sur la base du cadre de protection des données UE-États-Unis (Data Privacy Framework) et des clauses contractuelles types. Meta peut savoir que vous êtes en contact avec ce cabinet. Vous pouvez revenir aux SMS ou à l'e-mail à tout moment.",
  },
  sms_channel: {
    title: "Messages SMS",
    label: "Envoyez-moi par SMS les confirmations et les rappels de mes rendez-vous.",
    description:
      "Ces messages font partie du service de réservation et ne contiennent que le strict nécessaire : cabinet, date, heure et un lien. Vous pouvez les arrêter à tout moment en répondant STOP ou depuis vos préférences.",
  },
  email_channel: {
    title: "E-mails",
    label: "Envoyez-moi par e-mail les confirmations et les rappels de mes rendez-vous.",
    description:
      "Ces e-mails font partie du service de réservation. Vous pouvez les arrêter à tout moment grâce au lien de désinscription présent dans chaque e-mail ou depuis vos préférences.",
  },
  feedback_request: {
    title: "Invitations à donner votre avis",
    label: "Après la visite, envoyez-moi une courte invitation à donner mon avis.",
    description:
      "Vous recevrez un seul message quelques jours après le rendez-vous. Donner votre avis est facultatif. Vous pouvez retirer ce consentement à tout moment.",
  },
  review_publication: {
    title: "Publication de mon avis",
    label:
      "Je consens à la publication de mon avis sur Sorriso et sur la page de {practice}. L'avis indique que j'ai consulté {practitioner}. Je peux le supprimer à tout moment depuis l'espace confidentialité.",
    description:
      "Par défaut, votre avis apparaît sous la mention « Patient vérifié ». N'y mentionnez aucun détail sur votre santé : les avis qui en contiennent sont contrôlés avant publication. Si vous retirez votre consentement, l'avis est supprimé.",
  },
  marketing: {
    title: "Actualités et offres",
    label: "Je souhaite recevoir les actualités et les offres de {practice}.",
    description:
      "Facultatif : ce consentement n'est nécessaire ni pour réserver ni pour recevoir des soins. Vous pouvez le retirer à tout moment depuis n'importe quel message ou depuis l'espace confidentialité. Le consentement expire après 24 mois sans contact.",
  },
  adaptive_reminders: {
    title: "Rappels adaptatifs",
    label: "Adaptez le moment et le nombre de mes rappels en fonction de mes rendez-vous passés.",
    description:
      "Le cabinet peut vous envoyer un rappel supplémentaire lorsqu'un rendez-vous risque davantage d'être manqué, en fonction de l'historique de vos rendez-vous. Il s'agit d'un profilage fondé sur l'intérêt légitime, qui ne limite jamais votre possibilité de réserver. Vous pouvez vous y opposer à tout moment : vous recevrez alors les rappels standard.",
  },
  no_show_tracking: {
    title: "Historique des rendez-vous manqués",
    label: "Le cabinet peut enregistrer les rendez-vous auxquels je ne me présente pas.",
    description:
      "Les rendez-vous manqués au cours des 24 derniers mois sont comptabilisés pour organiser le planning et vous proposer de l'aide, par exemple un rappel supplémentaire. Ils ne vous empêchent jamais de réserver. Vous pouvez vous y opposer à tout moment.",
  },
  recalls: {
    title: "Relances pour les contrôles",
    label: "Prévenez-moi lorsque mon dentiste me recommande une visite de contrôle.",
    description:
      "Les relances ne sont envoyées que si votre dentiste a fixé pour vous un intervalle entre les contrôles. Chaque relance contient un moyen de les arrêter. Vous pouvez vous y opposer à tout moment.",
  },
} satisfies DeepPartial<Messages["consents"]>;
