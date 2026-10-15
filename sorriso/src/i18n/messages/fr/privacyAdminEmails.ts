/**
 * French privacy-admin emails. SMS texts (sms): straight quotes, no ellipsis, GSM-7 letters only
 * (é è à ù are GSM-7; ê â ô î û ç and capital À are not). types are slotted into sentences.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  types: {
    access: "accès à vos données",
    rectification: "rectification de vos données",
    erasure: "effacement de vos données",
    restriction: "limitation du traitement de vos données",
    portability: "copie de vos données pour les transférer ailleurs",
    objection: "opposition au traitement de vos données",
    consent_withdrawal: "retrait de votre consentement",
  },

  requestExtended: {
    subject: "Votre demande relative à vos données : nous avons besoin de plus de temps",
    body: "Nous avons reçu le {received} votre demande ({type}). Nous avons besoin de plus de temps pour y répondre de manière complète, pour la raison suivante : {reason}. Vous recevrez notre réponse au plus tard le {until}. Le RGPD (art. 12, par. 3) autorise cette prolongation de deux mois au maximum.",
    sms: "{practice}: nous avons besoin de plus de temps pour votre demande RGPD du {received}. Motif: {reason}. Réponse au plus tard le {until}.",
  },
  requestGranted: {
    subject: "Votre demande relative à vos données a été traitée",
    body: "Nous avons traité votre demande ({type}), reçue le {received}. Notre réponse : {reason}",
    sms: "{practice}: votre demande RGPD du {received} a été traitée. {reason}",
  },
  requestPartiallyGranted: {
    subject: "Notre réponse à votre demande relative à vos données",
    body: "Nous avons fait droit en partie à votre demande ({type}), reçue le {received}. Notre réponse et ses motifs : {reason}. Si vous n'êtes pas d'accord, vous pouvez introduire une réclamation auprès de l'autorité italienne de protection des données (Garante per la protezione dei dati personali, www.garanteprivacy.it) ou saisir la justice.",
    sms: "{practice}: votre demande RGPD du {received} a été acceptée en partie. Motifs: {reason}. Vous pouvez saisir le Garante (garanteprivacy.it) ou la justice.",
  },
  requestRefused: {
    subject: "Notre réponse à votre demande relative à vos données",
    body: "Nous ne pouvons pas faire droit à votre demande ({type}), reçue le {received}, pour les motifs suivants : {reason}. Si vous n'êtes pas d'accord, vous pouvez introduire une réclamation auprès de l'autorité italienne de protection des données (Garante per la protezione dei dati personali, www.garanteprivacy.it) ou saisir la justice.",
    sms: "{practice}: nous ne pouvons pas accepter votre demande RGPD du {received}. Motifs: {reason}. Vous pouvez saisir le Garante (garanteprivacy.it) ou la justice.",
  },
  restrictionLifted: {
    subject: "La limitation de vos données va être levée",
    body: "Le {since}, le traitement de vos données chez {practice} a été limité. Cette limitation va maintenant être levée : le cabinet pourra de nouveau utiliser vos données, par exemple pour vous envoyer des rappels de rendez-vous. Si vous avez des questions ou estimez qu'elle devrait être maintenue, veuillez contacter le cabinet.",
    sms: "{practice}: la limitation de vos données, en place depuis le {since}, va être levée. Contactez-nous pour toute question.",
  },

  ownerDeadline7: {
    subject: "Demande RGPD à traiter dans 7 jours",
    body: "Une demande ({type}) reçue par {practice} le {received} doit recevoir une réponse au plus tard le {due}. Ouvrez-la dans le tableau de bord pour la traiter, ou pour prolonger le délai en indiquant un motif si vous avez vraiment besoin de plus de temps.",
    cta: "Ouvrir la demande",
  },
  ownerDeadline2: {
    subject: "Demande RGPD à traiter dans 2 jours",
    body: "Une demande ({type}) reçue par {practice} le {received} doit recevoir une réponse au plus tard le {due}. Répondre en retard enfreint l'art. 12, par. 3 du RGPD : veuillez la traiter dès maintenant.",
    cta: "Ouvrir la demande",
  },

  subprocessorsChanged: {
    subject: "La liste des sous-traitants ultérieurs de Sorriso a changé",
    body: "Sorriso a mis à jour la liste des sous-traitants ultérieurs qui traitent les données de {practice} (version {version}, en vigueur à compter du {effective}). Veuillez la consulter et l'accepter dans le tableau de bord. Si vous vous opposez à un changement, écrivez à {email} dans un délai de 30 jours : nous chercherons une solution avec vous et, à défaut, vous pourrez résilier le contrat sans pénalité.",
    cta: "Consulter la liste",
  },

  closureRequested: {
    subject: "Votre compte Sorriso est en cours de fermeture",
    body: "Nous avons reçu le {date} la demande de fermeture du compte de {practice}. La réservation en ligne est arrêtée et le cabinet n'apparaît plus dans la recherche. Vous pouvez télécharger toutes vos données jusqu'au {purge} ; à cette date, elles seront définitivement supprimées. D'ici là, vous pouvez annuler la fermeture depuis le tableau de bord.",
    cta: "Télécharger vos données",
  },
  closureCancelled: {
    subject: "Fermeture du compte annulée",
    body: "La fermeture du compte de {practice} a été annulée et aucune donnée ne sera supprimée. La réservation en ligne via votre propre page de réservation, votre widget et vos liens fonctionne de nouveau. Le cabinet reste masqué dans la recherche de Sorriso jusqu'à ce que vous le référenciez de nouveau dans Paramètres.",
  },
  closureCertificate: {
    subject: "Attestation de suppression : {practice}",
    body: "Le {date}, nous avons définitivement supprimé les données de {practice} des systèmes de Sorriso, comme le prévoit l'accord de traitement des données. Les copies de sauvegarde chiffrées qui les contiennent encore expirent le {backups} et sont ensuite écrasées. L'attestation indique ce qui a été supprimé.",
    cta: "Voir l'attestation",
  },

  footer: {
    rights: "Vous recevez ce message car vous avez exercé vos droits en matière de protection des données.",
    staff: "Vous recevez ce message en tant que titulaire d'un cabinet qui utilise Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyAdminEmails"]>;
