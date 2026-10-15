import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    title: "Déclaration d'accessibilité",
    description:
      "Niveau d'accessibilité du site et du service de réservation {app}, limites connues et comment signaler un obstacle.",
  },
  title: "Déclaration d'accessibilité",
  translationNotice:
    "Ceci est une traduction. En cas de divergence, la <link>version italienne</link> prévaut.",
  intro:
    "{provider} souhaite que son site et son service de réservation soient utilisables par tous, y compris par les personnes qui utilisent un lecteur d'écran, le clavier, une loupe d'écran ou la commande vocale.",
  legalBasis:
    "Cette déclaration est publiée en application de l'Acte européen sur l'accessibilité (directive (UE) 2019/882), transposé en Italie par le décret législatif 82/2022, et de la loi 4/2004.",
  scope: {
    title: "Périmètre de cette déclaration",
    body: "Le site public {host} : la recherche, les pages des cabinets et des praticiens, les formulaires de réservation et de liste d'attente, la page de rendez-vous accessible depuis les confirmations et les rappels, l'espace confidentialité, les pages légales et le widget de réservation que les cabinets intègrent à leur propre site.",
  },
  status: {
    title: "État de conformité",
    body: "Nous concevons et testons le service selon les Règles pour l'accessibilité des contenus web (WCAG) 2.2, niveau AA. La norme européenne harmonisée à laquelle renvoie la loi, EN 301 549 v3.2.1, intègre les WCAG 2.1 niveau AA. Le service est partiellement conforme aux WCAG 2.1 niveau AA : les éléments listés dans les limites connues ne sont pas encore entièrement conformes.",
  },
  features: {
    title: "Ce que nous faisons",
    keyboard:
      "Le site est conçu pour être utilisé au clavier seul, avec un indicateur de focus visible et un lien d'accès direct au contenu principal.",
    screenReader:
      "Les pages sont structurées par des titres et des repères de navigation. Les champs de formulaire ont des libellés, et les erreurs et messages d'état sont annoncés par les lecteurs d'écran.",
    steps:
      "Le formulaire de réservation place le focus sur chaque nouvelle étape, conserve votre saisie lorsque vous revenez en arrière et explique chaque erreur à côté du champ concerné.",
    contrast:
      "Les textes et les commandes de formulaire respectent les rapports de contraste WCAG AA, et aucune information n'est transmise par la seule couleur.",
    motion: "Les animations sont désactivées lorsque votre appareil demande à réduire les mouvements.",
    zoom: "Les pages sont conçues pour fonctionner avec un zoom de 200 % et sur petit écran sans défilement horizontal.",
    languages:
      "Le site est disponible en huit langues, et chaque page déclare sa langue pour que les lecteurs d'écran la prononcent correctement.",
    help: "Les coordonnées du cabinet sont affichées au même endroit dans le formulaire de réservation et sur votre page de rendez-vous.",
  },
  limitations: {
    title: "Limites connues",
    practiceContent:
      "Les textes rédigés par les cabinets (descriptions des soins, biographies des praticiens) sont affichés dans la langue dans laquelle le cabinet les a écrits, qui peut différer de celle de la page.",
    dates:
      "Les champs de date utilisent le sélecteur de date de votre navigateur, dont l'accessibilité varie selon les navigateurs et les lecteurs d'écran. Vous pouvez toujours saisir la date au clavier.",
    maps: "Les cartes des pages des cabinets ne sont qu'une aide visuelle : l'adresse est toujours indiquée en texte.",
    widget:
      "Lorsque le widget de réservation est intégré au site d'un cabinet, l'accessibilité de la page qui l'entoure relève de la responsabilité du cabinet.",
    messages:
      "Les rappels par SMS sont en texte brut et ne peuvent pas être mis en forme ; leurs liens ouvrent des pages couvertes par cette déclaration.",
    exports:
      "Les téléchargements de données de l'espace confidentialité (JSON, CSV) sont des fichiers lisibles par machine, et non des documents destinés à la lecture.",
    workaround:
      "Si l'une de ces limites vous empêche de réserver, appelez le cabinet : son numéro figure sur sa page et dans le formulaire de réservation.",
  },
  preparation: {
    title: "Établissement de cette déclaration",
    body: "Cette déclaration a été établie le {date} par auto-évaluation, sur la base de contrôles automatisés du code du site exécutés à chaque modification (libellés, messages d'erreur, gestion du focus, rapports de contraste). Un audit manuel au clavier seul et avec des lecteurs d'écran (NVDA avec Firefox sous Windows, VoiceOver avec Safari sous iOS) n'a pas encore été réalisé ; nous mettrons à jour cette déclaration lorsqu'il l'aura été. Elle a été révisée pour la dernière fois le {reviewed}.",
  },
  feedback: {
    title: "Retour d'information et contact",
    body: "Si vous rencontrez un obstacle, ou si vous avez besoin d'une information de ce site dans un autre format, écrivez à <mail>{email}</mail>. Indiquez-nous l'adresse de la page et ce qui s'est passé. Nous vous répondrons sous 30 jours.",
    noEmail:
      "Si vous rencontrez un obstacle, ou si vous avez besoin d'une information de ce site dans un autre format, contactez-nous à l'aide des coordonnées figurant dans la <link>politique de confidentialité</link>. Indiquez-nous l'adresse de la page et ce qui s'est passé. Nous vous répondrons sous 30 jours.",
  },
  enforcement: {
    title: "Voies de recours",
    body: "Si notre réponse ne vous satisfait pas, ou si vous n'en recevez aucune sous 30 jours, vous pouvez le signaler à l'AgID (Agenzia per l'Italia Digitale), l'autorité qui contrôle l'accessibilité numérique en Italie, au moyen du formulaire disponible sur <link>form.agid.gov.it</link>.",
  },
} satisfies DeepPartial<Messages["accessibility"]>;
