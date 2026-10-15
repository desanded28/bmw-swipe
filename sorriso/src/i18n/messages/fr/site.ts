import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "{app} : prenez rendez-vous chez le dentiste en ligne",
    description:
      "Trouvez un dentiste près de chez vous, consultez ses disponibilités réelles et réservez en quelques secondes. Rappels par SMS ou e-mail : confirmez ou déplacez votre rendez-vous d'un geste.",
  },
  header: {
    findDentist: "Trouver un dentiste",
    forPractices: "Pour les cabinets",
    api: "API",
    login: "Espace cabinet",
    bookNow: "Prendre rendez-vous",
  },
  footer: {
    tagline:
      "Prenez rendez-vous chez le dentiste en ligne, avec les disponibilités en temps réel. Des rappels auxquels les patients répondent en un mot.",
    patients: "Pour les patients",
    findDentist: "Trouver un dentiste",
    emergency: "Urgence dentaire",
    cleaning: "Détartrage",
    privacyCenter: "Vos données (espace confidentialité)",
    practices: "Cabinets",
    features: "Fonctionnalités",
    createPractice: "Créer un cabinet",
    apiWidget: "API de réservation et widget",
    legal: "Mentions légales",
    privacy: "Politique de confidentialité",
    cookies: "Politique relative aux cookies",
    terms: "Conditions d'utilisation",
    dpa: "Accord de traitement des données",
    subprocessors: "Sous-traitants ultérieurs",
    accessibility: "Accessibilité",
    reviewPolicy: "Politique relative aux avis",
    ranking: "Classement des résultats",
    copyright: "© {year} {app}",
    demo: "Projet de démonstration : les cabinets et les personnes présentés sont fictifs.",
  },
  notFound: {
    code: "Erreur 404",
  },
  home: {
    badge: "Uniquement des avis vérifiés, issus de vraies consultations",
    heroTitle: "Le dentiste qu'il vous faut, <em>réservé en 30 secondes.</em>",
    heroBody:
      "Les disponibilités en temps réel des cabinets près de chez vous. Sans compte, sans attente au téléphone. Recevez un rappel par SMS ou e-mail : répondez <b>OUI</b> pour confirmer, ou déplacez-le d'un geste.",
    quickLabel: "Soins les plus demandés",
    quick: {
      checkup: "Bilan",
      hygiene: "Détartrage",
      orthodontics: "Aligneurs et appareils",
      pediatric: "Enfants",
      emergency: "Urgence",
    },
    soonestTitle: "Disponibles au plus tôt",
    soonestBody: "Choisissez un horaire et c'est fait : ces horaires sont en temps réel.",
    seeAll: "Voir tous les dentistes",
    how: {
      title: "Comment ça marche",
      step: "Étape {n}",
      findTitle: "Trouvez des disponibilités réelles",
      findBody:
        "Comparez les dentistes par soin, prix, avis vérifiés et prochain créneau libre, dans chacun des cabinets où ils exercent.",
      bookTitle: "Réservez sans compte",
      bookBody:
        "Choisissez un horaire, indiquez votre nom et votre numéro. Vous recevez une confirmation immédiate avec une invitation d'agenda.",
      confirmTitle: "Confirmez par une réponse",
      confirmBody:
        "Nous vous envoyons un rappel par SMS ou e-mail. Répondez OUI pour confirmer ou NON pour annuler, ou déplacez le rendez-vous d'un geste.",
    },
    citiesTitle: "Dentistes par ville",
    cityLink: "Dentistes à {city}",
    cityCount: p({ one: "{count} cabinet", other: "{count} cabinets" }),
    practices: {
      kicker: "Pour les cabinets dentaires",
      title: "Moins de rendez-vous manqués. Tous vos sites dans un seul agenda.",
      body: "Planning multisite avec fauteuils, confirmations par SMS dans les deux sens, liste d'attente automatique qui comble les annulations et API de réservation ouverte.",
      features: "Voir les fonctionnalités",
      demo: "Essayer le tableau de bord de démonstration",
      offices: "Plusieurs sites, praticiens et fauteuils, sans double réservation d'un site à l'autre",
      rules: "Règles de rappel par cabinet : e-mail 48 heures avant, SMS 24 heures avant, WhatsApp si vous l'activez",
      replies: "Les patients répondent OUI ou NON, et l'agenda se met à jour tout seul",
      waitlist: "Les créneaux annulés sont proposés à la liste d'attente en quelques secondes",
    },
  },
  forClinics: {
    metaTitle: "Pour les cabinets dentaires",
    metaDescription:
      "Réservation en ligne, agenda multisite et rappels auxquels les patients répondent, avec la protection des données intégrée. Exportez toutes vos données à tout moment.",
    kicker: "Pour les cabinets dentaires",
    title: "Remplissez vos fauteuils. Arrêtez de courir après les confirmations.",
    body: "Réservation en ligne, agenda multisite et rappels auxquels les patients répondent vraiment, au même endroit.",
    signup: "Créer votre cabinet",
    demo: "Ouvrir le tableau de bord de démonstration",
    featuresTitle: "Fonctionnalités",
    features: {
      offices: {
        title: "Tous vos sites, un seul agenda",
        body: "Les praticiens exercent dans différents sites selon les jours. Les disponibilités sont calculées par site, et personne ne peut être réservé deux fois d'un site à l'autre.",
      },
      chairs: {
        title: "Fauteuils, battements et fermetures",
        body: "Chaque réservation bloque automatiquement un fauteuil. Le temps de remise en état par soin, les jours fériés, la maintenance et les absences personnelles bloquent les disponibilités.",
      },
      twoWay: {
        title: "Rappels SMS avec réponse",
        body: "Les rappels demandent aux patients de répondre OUI ou NON, dans leur propre langue. Les réponses confirment ou annulent immédiatement ; tout le reste est signalé à l'accueil.",
      },
      rules: {
        title: "Des règles de rappel que vous maîtrisez",
        body: "Par exemple : e-mail 48 heures avant, SMS 24 heures avant, SMS court 2 heures avant. WhatsApp seulement si vous l'activez et que le patient l'accepte.",
      },
      waitlist: {
        title: "Les annulations se comblent toutes seules",
        body: "Dès qu'un créneau se libère, il est proposé en quelques secondes aux patients correspondants de la liste d'attente. Le premier qui réserve l'obtient, sans aucun appel.",
      },
      board: {
        title: "Tableau des confirmations",
        body: "Visualisez demain en un coup d'œil : confirmés, en attente et patients à appeler, avec le motif affiché. Il ne fait qu'ajouter de l'aide : aucune réservation n'est refusée.",
      },
      reviews: {
        title: "Uniquement des avis vérifiés",
        body: "Seuls les patients ayant effectué une consultation peuvent laisser un avis, et uniquement avec leur consentement. Les cabinets peuvent répondre, mais pas masquer les avis.",
      },
      api: {
        title: "API de réservation ouverte et widget",
        body: "Intégrez la réservation à votre site avec une seule balise script, synchronisez votre logiciel de cabinet via l'API REST, abonnez-vous aux flux d'agenda.",
      },
      roles: {
        title: "Des rôles pour votre équipe",
        body: "Titulaires, administrateurs, accueil et praticiens voient chacun ce dont ils ont besoin. Chaque accès à un dossier patient est journalisé.",
      },
      privacy: {
        title: "Confidentialité par défaut",
        body: "Les messages et les entrées d'agenda ne mentionnent pas le soin. Les patients gèrent leurs données et leurs consentements dans un espace confidentialité, sans compte.",
      },
      languages: {
        title: "Huit langues",
        body: "Les patients réservent et reçoivent leurs rappels en italien, anglais, allemand, français, espagnol, portugais, roumain ou polonais.",
      },
    },
    flow: {
      title: "Comment fonctionne une confirmation",
      book: "Le patient réserve en ligne (ou vous le réservez à l'accueil) et reçoit une confirmation avec une invitation d'agenda.",
      email: "48 heures avant : un e-mail lui demande de confirmer en un clic.",
      text: "24 heures avant : un SMS lui demande de répondre OUI pour confirmer ou NON pour annuler.",
      reply: "OUI fait passer le rendez-vous au vert dans votre agenda. NON l'annule et propose le créneau à la liste d'attente.",
      other: "Tout autre message (« puis-je venir 30 minutes plus tard ? ») arrive dans votre boîte de réception et est signalé dans l'agenda.",
    },
    sms: {
      sender: "Cabinet Bianchi",
      reminder:
        "Cabinet Bianchi: rappel, rendez-vous le mer. 15 oct. à 10:30, Via Torino 42, Milano. Répondez OUI pour confirmer, NON pour annuler. Détails: sorriso.example/a/… STOP pour ne plus recevoir de SMS",
      reply: "OUI",
      thanks: "Merci ! Votre rendez-vous du mer. 15 oct. à 10:30 est confirmé. Nous vous attendons.",
      caption: "Un rappel tel que le patient le reçoit : le soin n'est jamais mentionné.",
    },
    noLockIn: "Vos données restent les vôtres : exportez-les à tout moment, sans engagement.",
    apiDocs: "Lire la documentation de l'API",
  },
  developers: {
    metaTitle: "API de réservation et widget",
    metaDescription:
      "Intégrez la réservation en ligne au site de votre cabinet, réservez via l'API REST et synchronisez votre logiciel de cabinet.",
    title: "API de réservation et widget",
    intro:
      "Tout ce que fait le site {host} passe par cette API : votre intégration peut donc faire tout ce qu'un patient peut faire. JSON sur HTTPS, CORS activé, horaires au format ISO 8601 (UTC).",
    codeSample: "Exemple de code",
    attribute: "Attribut",
    field: "Champ",
    description: "Descriptif",
    widget: {
      title: "1. Intégrer la réservation à votre site",
      button: "Un bouton flottant « Prendre rendez-vous » qui ouvre le formulaire de réservation dans une boîte de dialogue :",
      inline: "Ou intégré dans un élément de votre page, ici en allemand et pour un seul praticien :",
      attributesCaption: "Attributs du widget",
      attributes: {
        "data-clinic":
          "Obligatoire. L'adresse de votre cabinet sur Sorriso (le slug). Sans lui, le script n'affiche rien.",
        "data-lang":
          "La langue du formulaire et des messages au patient. À défaut : la langue de votre page (son attribut lang), puis celle du navigateur du visiteur, puis l'italien.",
        "data-target":
          "Un sélecteur CSS : affiche le formulaire dans cet élément au lieu d'un bouton flottant. Si aucun élément ne correspond lors de l'exécution du script, rien n'est affiché.",
        "data-practitioner": "Ouvre le formulaire pour un praticien (son identifiant).",
        "data-service": "Présélectionne un soin (son identifiant).",
        "data-location": "Présélectionne un site (son identifiant).",
        "data-label": "Le texte du bouton flottant. À défaut, « Prendre rendez-vous » dans la langue choisie.",
        "data-color": "La couleur du bouton flottant, sous forme de couleur CSS.",
        "data-events": "Active l'événement sorriso:booked sur votre page lorsqu'une réservation est finalisée.",
        "data-include-id": "Avec data-events : inclut l'identifiant du rendez-vous dans l'événement.",
      },
      languages: "Valeurs de langue (<code>data-lang</code>, <code>patient.locale</code>) :",
      eventsTitle: "Événements de réservation",
      events:
        "Avec <code>data-events</code>, votre page reçoit un événement <code>sorriso:booked</code> lorsqu'une réservation est finalisée. Il ne contient aucune donnée personnelle, et l'identifiant du rendez-vous uniquement avec <code>data-include-id</code>. Les messages ne sont envoyés qu'à l'origine de votre propre page.",
      eventsWarning:
        "Ne transmettez pas cet événement à des outils publicitaires ou d'analyse (comme les balises Meta ou Google) : il révèle qu'un visiteur a pris un rendez-vous dentaire, ce qui constitue une donnée de santé. En vertu de l'accord de traitement des données, vous ne pouvez l'utiliser que pour afficher votre propre confirmation.",
      origins:
        "Pour empêcher d'autres sites d'intégrer votre formulaire de réservation, indiquez les adresses de votre site dans Tableau de bord, Paramètres de confidentialité, Sites autorisés. Ailleurs, le widget n'affiche alors qu'un lien qui ouvre la page de réservation dans un nouvel onglet. Le contrôle repose sur l'adresse que le navigateur de vos visiteurs envoie avec le cadre : le widget la demande, et si vous écrivez votre propre iframe, ne lui donnez pas <code>referrerpolicy=\"no-referrer\"</code>.",
    },
    booking: {
      title: "2. Réserver via l'API",
      fieldsCaption: "Champs de réservation",
      context:
        "Le responsable des données de réservation est déterminé par le serveur, jamais par un champ que vous envoyez : les réservations effectuées avec votre clé API, votre widget ou des liens signés pour votre cabinet sont les vôtres (Sorriso les traite pour votre compte) ; les réservations commencées sur les pages de Sorriso nécessitent le consentement du patient envers Sorriso.",
      errors:
        "Les erreurs ont toutes la même forme : un objet <code>error</code> avec un <code>code</code> et un <code>message</code>. Un horaire déjà pris renvoie 409 avec <code>practitioner_busy</code>, <code>no_room</code>, <code>time_off</code>, <code>outside_hours</code> ou <code>too_soon</code> ; des champs non valides renvoient 422 avec une liste <code>issues</code>, une règle de confidentialité ou d'âge non respectée 422 avec son propre code et <code>field</code>.",
    },
    fields: {
      locale:
        "La langue des messages au patient : <code>it</code>, <code>en</code>, <code>de</code>, <code>fr</code>, <code>es</code>, <code>pt</code>, <code>ro</code> ou <code>pl</code>.",
      phoneCountry:
        "L'indicatif pays d'un numéro saisi sans préfixe, par exemple <code>39</code> ou <code>49</code>. Les numéros commençant par + ou 00 gardent le leur.",
      preferredChannel:
        "<code>sms</code>, <code>email</code> ou <code>whatsapp</code>. WhatsApp uniquement si le cabinet l'a activé, et avec <code>privacy.whatsapp</code> à true.",
      privacy:
        "Obligatoire sans clé API. <code>noticeVersion</code> (la version de la politique de confidentialité affichée), <code>locale</code>, et les choix du patient : <code>platformConsent</code>, <code>whatsapp</code>, <code>feedback</code>, <code>marketing</code>. Les cases que le patient n'a pas cochées valent false.",
      relation:
        "Pour qui est le rendez-vous : <code>bookedFor</code> vaut <code>self</code>, <code>minor</code> (avec <code>guardian</code> : nom, lien, téléphone ou e-mail) ou <code>other_adult</code>.",
      practiceRef:
        "Le marqueur du cabinet issu d'un lien publié par votre cabinet (?ref=). Sans lui, la réservation est considérée comme effectuée sur Sorriso.",
      fundId:
        "Facultatif : le fonds de santé ou l'assureur que le patient utilisera. Conservé uniquement si le cabinet propose ce fonds.",
    },
    sync: {
      title: "3. Synchroniser votre logiciel de cabinet",
      keys: "Créez une clé API dans Tableau de bord, Paramètres, API, choisissez ses portées et envoyez-la comme jeton bearer. Les clés peuvent expirer et être révoquées à tout moment.",
      scopesTitle: "Portées",
    },
    scopes: {
      "appointments:read": "Lire les rendez-vous et les ressources qu'ils utilisent.",
      "appointments:write":
        "Créer, déplacer et annuler des rendez-vous, enregistrer les confirmations, les absences et les rendez-vous effectués.",
      "patients:read": "Lire le nom et les coordonnées des patients.",
      "patients:write": "Créer et modifier des patients.",
      "notes:read":
        "Lire les notes rédigées par les patients et le personnel sur les rendez-vous. À n'accorder qu'aux logiciels cliniques.",
      "patients:erase": "Demander l'effacement des données d'un patient (traité comme une demande d'exercice des droits).",
    },
    export: {
      title: "4. Exporter vos données",
      body: "Un cabinet peut exporter toutes ses données à tout moment en JSON, CSV et FHIR R4. Les formats sont décrits dans le <link>schéma d'export</link>.",
    },
    reference: "Référence",
    groups: {
      public: "Réservation publique (utilisée par le site et le widget)",
      patient: "Libre-service patient (jeton issu du lien du patient)",
      partner: "API partenaire (votre logiciel de cabinet)",
      infra: "Infrastructure technique",
    },
    auth: {
      public: "publique",
      token: "jeton",
      apiKey: "clé API",
      secret: "secret partagé",
    },
    endpoints: {
      clinic: "Profil du cabinet, sites, praticiens (avec leurs soins et leurs sites) et soins réservables.",
      availability:
        "Créneaux libres par jour. Sans practitionerId : « premier disponible », réparti entre les praticiens. Renvoie nextAvailable lorsque la période est vide.",
      book: "Réserver un créneau. Revérifié dans une transaction d'écriture : deux patients ne peuvent jamais obtenir le même créneau.",
      waitlist:
        "S'inscrire sur la liste d'attente pour un soin, éventuellement pour un praticien ou un site, une période et un moment de la journée.",
      appointment: "Le rendez-vous et ce que le patient peut encore faire (canCancel, canReschedule).",
      confirm: "Confirmer sa présence.",
      cancel: "Annuler (le créneau est proposé à la liste d'attente). Champ facultatif du corps : reason.",
      reschedule:
        "Déplacer vers un autre créneau libre. Champs du corps : start, et éventuellement practitionerId et locationId.",
      resources: "Sites, fauteuils, praticiens (avec leurs horaires) et soins, pour faire correspondre les identifiants.",
      list: "Lister les rendez-vous. Utilisez updatedSince pour une synchronisation incrémentale.",
      create:
        "Créer un rendez-vous avec les droits de l'accueil (durée personnalisée, hors horaires, identifiant de patient existant).",
      update:
        "Déplacer, annuler, marquer comme effectué ou absent, ou enregistrer une confirmation par téléphone.",
      twilio: "Réponses SMS et WhatsApp entrantes (signées par Twilio). Répond directement en TwiML.",
      twilioStatus: "Accusés de réception (délivré, échec).",
      cron: "Envoyer les rappels dus. À appeler toutes les 1 à 5 minutes avec Authorization: Bearer $CRON_SECRET.",
      ics: "Le flux d'agenda d'un praticien, auquel on peut s'abonner (Google, Apple, Outlook).",
    },
  },
} satisfies DeepPartial<Messages["site"]>;
