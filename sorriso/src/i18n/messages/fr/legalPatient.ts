/**
 * TEXTE JURIDIQUE. Traduction française établie à partir de l'anglais ; la version italienne
 * (it/legalPatient.ts) fait foi. Brouillon à faire relire par un DPO ou un avocat avant la mise en
 * production (docs/i18n/glossary-fr.md, « Needs lawyer review »).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    practiceTitle: "Politique de confidentialité : {practice}",
    practiceDescription: "Comment {practice} traite les données personnelles de ses patients, et quels sont vos droits.",
    minorTitle: "La confidentialité expliquée aux jeunes : {practice}",
    minorDescription: "Ce que {practice} fait des informations qui vous concernent, expliqué simplement.",
    platformTitle: "Politique de confidentialité de Sorriso",
    platformDescription:
      "Comment Sorriso traite les données personnelles lorsque vous cherchez un dentiste, réservez ou rédigez un avis, et quels sont vos droits.",
    staffTitle: "Politique de confidentialité pour le personnel des cabinets",
    staffDescription:
      "Comment vos données sont traitées lorsque vous utilisez le tableau de bord Sorriso, et comment fonctionne le journal des accès.",
    practitionerTitle: "Politique de confidentialité pour les praticiens",
    practitionerDescription: "Comment Sorriso traite les données des praticiens figurant dans son annuaire.",
    cookiesTitle: "Politique relative aux cookies",
    cookiesDescription: "Les quelques cookies techniques utilisés par Sorriso, et pourquoi il n'y a pas de bandeau cookies.",
  },
  page: {
    version: "Version {version}",
    updated: "En vigueur depuis le {date}",
    italianPrevails: "Ceci est une traduction. En cas de divergence, la version italienne prévaut.",
    italianLink: "Lire la version italienne",
    contents: "Sommaire",
    practiceLink: "Politique complète du cabinet",
    minorsLink: "Version pour les jeunes",
    platformLink: "Politique de confidentialité de Sorriso",
    cookiesLink: "Politique relative aux cookies",
    privacyCenterLink: "Accéder à l'espace confidentialité",
    otherNotices: "Autres politiques",
    staffLink: "Pour le personnel des cabinets",
    practitionerLink: "Pour les praticiens",
    patientLink: "Pour les patients",
    backToTop: "Retour en haut de page",
  },
  sections: {
    summary: "En bref",
    controller: "Qui est responsable de vos données",
    roles: "Les deux rôles de Sorriso",
    data: "Quelles données nous traitons",
    purposes: "Pourquoi nous les traitons, et sur quelle base juridique",
    marketplace: "Si vous avez réservé sur Sorriso",
    withdrawal: "Si vous retirez votre consentement",
    recipients: "Qui reçoit vos données",
    transfers: "Transferts hors de l'Espace économique européen",
    retention: "Combien de temps nous conservons vos données",
    rights: "Vos droits",
    complaint: "Réclamations",
    mandatory: "Êtes-vous obligé de nous fournir vos données ?",
    automated: "Décisions automatisées et profilage",
    minors: "Enfants et jeunes",
    monitoring: "Le journal des accès",
    profile: "Votre profil public",
    cookies: "Cookies",
    changes: "Modifications de cette politique",
    who: "Qui s'occupe de tes informations",
    what: "Quelles informations nous utilisons",
    why: "Pourquoi nous les utilisons",
    parents: "Tes parents ou ton représentant légal",
    keep: "Combien de temps nous les gardons",
    youCan: "Ce que tu peux faire",
    help: "Si quelque chose ne va pas",
    full: "La politique complète",
    cookieList: "Les cookies que nous utilisons",
    storage: "Stockage dans votre navigateur",
    thirdParties: "Tiers",
    legalBasis: "Base juridique",
    control: "Comment gérer les cookies",
    widget: "Le widget de réservation sur les sites des cabinets",
  },
  controller: {
    name: "Responsable du traitement : {name}",
    vat: "Numéro de TVA : {vat}",
    address: "Adresse : {address}",
    contact: "Contact confidentialité : {email}",
    phone: "Téléphone : {phone}",
    dpo: "Délégué à la protection des données (DPO) : {name}, {email}",
    dpoEmail: "Délégué à la protection des données (DPO) : {email}",
    noDpo:
      "Le cabinet n'a pas désigné de délégué à la protection des données : pour toute question relative à la confidentialité, écrivez au contact ci-dessus.",
    processor:
      "Sorriso fournit le logiciel de réservation en tant que sous-traitant du cabinet (art. 28 du RGPD) : il agit uniquement sur instruction documentée du cabinet et dans le cadre d'un accord de traitement des données.",
    platformDpo: "Le délégué à la protection des données (DPO) de Sorriso est joignable à l'adresse {email}.",
  },
  bases: {
    art6_1_a: "votre consentement (art. 6, par. 1, point a) du RGPD)",
    art6_1_b:
      "le service que vous demandez, ou les mesures que vous demandez avant celui-ci (art. 6, par. 1, point b) du RGPD)",
    art6_1_c: "une obligation légale du responsable du traitement (art. 6, par. 1, point c) du RGPD)",
    art6_1_f:
      "les intérêts légitimes du responsable du traitement, auxquels vous pouvez vous opposer (art. 6, par. 1, point f) du RGPD)",
    art9_2_a:
      "votre consentement explicite pour les données pouvant concerner votre santé (art. 9, par. 2, point a) du RGPD)",
    art9_2_f: "la constatation, l'exercice ou la défense de droits en justice (art. 9, par. 2, point f) du RGPD)",
    art9_2_h:
      "les soins de santé dispensés par des professionnels soumis au secret professionnel (art. 9, par. 2, point h) et par. 3 du RGPD, art. 2-septies du Code italien en matière de protection des données personnelles)",
  },
  purposes: {
    item: "{title}. {body} Base juridique : {bases}.",
    booking_practice: {
      title: "Réservation",
      body: "Pour recevoir et enregistrer votre réservation, vérifier les disponibilités et vous confirmer le rendez-vous.",
    },
    booking_marketplace: {
      title: "Réservations effectuées sur Sorriso",
      body: "Lorsque vous réservez depuis les pages de recherche de Sorriso : pour transmettre votre réservation au cabinet choisi et gérer les rappels et les modifications. Les données de réservation peuvent révéler des informations sur votre santé : Sorriso vous demande donc votre consentement explicite.",
    },
    appointment_management: {
      title: "Gestion de vos rendez-vous",
      body: "Pour tenir vos rendez-vous et votre dossier au cabinet, organiser le planning et vous permettre de confirmer, déplacer ou annuler en ligne.",
    },
    reminders: {
      title: "Confirmations et rappels",
      body: "Pour envoyer les confirmations de réservation et les rappels par SMS, e-mail ou, si vous le choisissez, WhatsApp. Les messages sont discrets : ils ne mentionnent ni soin ni note, sauf si le cabinet a choisi des messages détaillés et que votre contact a été vérifié. Vous pouvez désactiver chaque canal à tout moment.",
    },
    waitlist: {
      title: "Liste d'attente",
      body: "Si vous vous inscrivez sur la liste d'attente : pour vous prévenir lorsqu'un horaire plus proche se libère.",
    },
    recalls: {
      title: "Relances de contrôle",
      body: "Pour vous prévenir lorsque votre dentiste a fixé un intervalle avant votre prochain contrôle. Chaque relance vous permet de les arrêter, et vous pouvez vous y opposer à tout moment.",
    },
    feedback_requests: {
      title: "Invitations à donner votre avis",
      body: "Uniquement avec votre accord : une seule invitation à donner votre avis après la visite. Vous pouvez retirer votre consentement à tout moment.",
    },
    reviews: {
      title: "Avis",
      body: "Si vous rédigez un avis et acceptez sa publication : pour le publier, montrer qu'il provient d'une véritable visite et le modérer. Vous pouvez le supprimer à tout moment depuis l'espace confidentialité.",
    },
    marketing: {
      title: "Actualités et offres",
      body: "Uniquement avec votre accord : les actualités et les offres du cabinet. Ce n'est jamais nécessaire pour réserver ou être soigné, et votre consentement expire après 24 mois sans contact.",
    },
    no_show_tracking: {
      title: "Historique des rendez-vous manqués",
      body: "Pour enregistrer les rendez-vous manqués au cours des 24 derniers mois, organiser le planning et proposer de l'aide, comme un rappel supplémentaire. Cela ne vous empêche jamais de réserver. Vous pouvez vous y opposer à tout moment.",
    },
    adaptive_reminders: {
      title: "Rappels adaptatifs",
      body: "Pour envoyer un rappel supplémentaire lorsque, d'après l'historique de vos rendez-vous, un rendez-vous risque davantage d'être manqué. Il s'agit d'un profilage (art. 4, point 4) du RGPD) : il ne fait qu'ajouter de l'aide et ne limite jamais votre réservation. Vous pouvez vous y opposer à tout moment et recevoir alors les rappels standard.",
    },
    anamnesis: {
      title: "Questionnaire médical",
      body: "Si le cabinet vous demande de le remplir avant la visite : pour préparer votre soin en toute sécurité. Vos réponses sont chiffrées et consultées uniquement par les soignants.",
    },
    partner_api: {
      title: "Logiciel de cabinet connecté",
      body: "Si le cabinet connecte son propre logiciel de gestion à l'agenda : pour maintenir les deux synchronisés. Ce logiciel est un destinataire choisi par le cabinet.",
    },
    directory: {
      title: "Annuaire",
      body: "Pour présenter les cabinets et les praticiens dans les résultats de recherche de Sorriso et sur leurs pages publiques.",
    },
    ranking: {
      title: "Ordre des résultats de recherche",
      body: "Pour classer les résultats de recherche selon des critères publiés : le premier horaire libre, les notes, la fiabilité, la complétude du profil et la distance. Personne ne peut payer pour être mieux classé. Vous pouvez vous y opposer à tout moment.",
    },
    privacy_center: {
      title: "Espace confidentialité",
      body: "Pour retrouver les dossiers que les cabinets présents sur Sorriso détiennent pour un numéro de téléphone ou une adresse e-mail que vous avez vérifiés avec un code à usage unique, afin que vous puissiez exercer vos droits en un seul endroit.",
    },
    staff_accounts: {
      title: "Comptes du personnel",
      body: "Pour donner au personnel des cabinets un accès personnel et sécurisé au tableau de bord : connexion, vérification en deux étapes, sessions et acceptation des instructions au personnel.",
    },
    security_logs: {
      title: "Sécurité et journal des accès",
      body: "Pour enregistrer qui ouvre et modifie les dossiers des patients, les protéger contre les abus et montrer aux patients qui a accédé à leurs données.",
    },
    privacy_requests: {
      title: "Demandes relatives aux données",
      body: "Pour traiter les demandes que les personnes formulent au sujet de leurs données, y répondre dans les délais légaux et en conserver la preuve.",
    },
  },
  services: {
    hosting: "hébergement de l'application",
    database: "base de données",
    sms: "SMS",
    whatsapp: "messages WhatsApp, uniquement pour les cabinets qui les activent et les patients qui les choisissent",
    email: "e-mail",
    backups: "sauvegardes",
  },
  transferTools: {
    eu: "aucun transfert (UE/EEE)",
    dpf: "cadre de protection des données UE-États-Unis (Data Privacy Framework, décision d'adéquation de la Commission européenne du 10 juillet 2023)",
    scc: "clauses contractuelles types approuvées par la Commission européenne (art. 46 du RGPD)",
    dpf_scc:
      "cadre de protection des données UE-États-Unis (Data Privacy Framework), avec les clauses contractuelles types de la Commission européenne à titre subsidiaire",
  },
  data: {
    intro: "Nous traitons :",
    identity:
      "les données d'identification et de contact : nom, prénom, numéro de portable, adresse e-mail, date de naissance, ainsi que la langue et le canal que vous préférez ;",
    appointments:
      "les données des rendez-vous : date, heure, soin, praticien, site, statut et rendez-vous manqués. Elles peuvent révéler des informations sur votre santé ;",
    yourWords:
      "ce que vous choisissez de nous dire : les notes ajoutées à une réservation, les réponses à nos messages et, si le cabinet l'utilise, le questionnaire médical ;",
    guardian: "pour les enfants : les coordonnées du parent ou du représentant légal qui réserve et reçoit les messages ;",
    records: "l'historique de vos consentements et de vos choix, ainsi que des demandes relatives à vos données ;",
    technical:
      "les données techniques nécessaires à la sécurité : des empreintes chiffrées à clé (HMAC) de votre adresse IP, jamais l'adresse elle-même.",
    source:
      "Nous recevons ces données de vous, ou de la personne qui a réservé pour vous : un parent ou un représentant légal, ou un autre adulte qui a réservé pour votre compte. Dans ce cas, nous envoyons également cette politique à votre propre contact, si nous en disposons (art. 14 du RGPD).",
  },
  platformData: {
    intro: "Sorriso traite, pour ses propres services :",
    booking:
      "lorsque vous réservez depuis ses pages de recherche : votre nom, vos coordonnées, votre date de naissance si elle est indiquée, le cabinet, le soin, la date et l'heure choisis, ainsi que la trace de votre consentement ;",
    reviews: "lorsque vous rédigez un avis : la note, le texte, le nom affiché et la visite concernée ;",
    privacyCenter:
      "lorsque vous utilisez l'espace confidentialité : une empreinte chiffrée à clé du numéro de téléphone ou de l'adresse e-mail que vous vérifiez, les codes à usage unique qui y sont envoyés (conservés uniquement sous forme d'empreintes) et un cookie de session valable 30 minutes ;",
    technical:
      "pour la sécurité : des empreintes chiffrées à clé (HMAC) des adresses IP et des navigateurs, jamais les adresses elles-mêmes.",
  },
  recipients: {
    intro: "Vos données ne sont accessibles qu'aux personnes qui en ont besoin :",
    staff:
      "le personnel autorisé du cabinet (accueil et soignants), chacun disposant de l'accès nécessaire à son rôle ;",
    sorriso: "Sorriso, qui exploite le logiciel de réservation en tant que sous-traitant du cabinet ;",
    practices:
      "le cabinet auprès duquel vous réservez, qui reçoit votre réservation et devient responsable du traitement de sa propre copie ;",
    providers:
      "les prestataires techniques listés ci-dessous (sous-traitants ultérieurs), liés par des accords de traitement des données ;",
    authorities: "les autorités publiques, uniquement lorsque la loi l'exige.",
    notSold: "Vos données ne sont jamais vendues ni utilisées à des fins publicitaires.",
    provider: "{name} ({entity}) : {service}, {region}.",
    providerNoRegion: "{name} ({entity}) : {service}.",
    fullList: "La liste complète et à jour des sous-traitants ultérieurs est disponible à l'adresse {url}.",
  },
  transfers: {
    intro:
      "Certains prestataires appartiennent à des groupes établis aux États-Unis. Même lorsque leurs serveurs se trouvent dans l'UE, cela peut constituer un transfert hors de l'Espace économique européen. Ces transferts sont encadrés par :",
    item: "{name} : {tool}.",
    assessment:
      "Sorriso a évalué ces transferts (analyse d'impact des transferts). Vous pouvez obtenir une copie des garanties en écrivant à {email}.",
    none: "Vos données ne sont pas transférées hors de l'Espace économique européen.",
  },
  retention: {
    intro: "Nous ne conservons les données que le temps nécessaire :",
    patientInactiveMonths:
      "votre dossier au cabinet : {period} après votre dernière visite, ou plus longtemps uniquement lorsque le cabinet est légalement tenu de conserver la documentation clinique ;",
    neverSeenPatientMonths: "les dossiers des personnes qui ne sont jamais venues à une visite : {period} ;",
    patientNoteDays: "les notes que vous ajoutez à une réservation : {period} après le rendez-vous ;",
    messageBodyMonths:
      "le texte des messages : {period}, après quoi seuls la date, le canal et le statut de remise sont conservés ;",
    messageMetaMonths: "l'historique des messages (date, canal, statut de remise) : {period} ;",
    reminderDays: "les calendriers de rappels : {period} après leur envoi ;",
    providerMessageDays: "les copies conservées par le prestataire SMS et WhatsApp : supprimées après {period} ;",
    waitlistDays: "les inscriptions sur la liste d'attente : {period} après leur clôture ;",
    auditMonths: "le journal des accès : {period} ;",
    formSubmissionMonths:
      "les questionnaires médicaux : {period}, et seulement une fois intégrés au dossier clinique du cabinet ;",
    consentMonths: "l'historique de vos consentements et de vos choix : jusqu'à {period}, afin de pouvoir en apporter la preuve ;",
    privacyRequestMonths: "les demandes relatives aux données et leurs réponses : {period} après leur clôture ;",
    marketingLapse: "le consentement aux actualités et aux offres expire après 24 mois sans contact.",
    after:
      "À l'issue de ces durées, les données sont automatiquement supprimées ou pseudonymisées. Les rendez-vous pseudonymisés ne font plus apparaître votre nom ni vos coordonnées et ne sont conservés qu'à des fins statistiques et pour les archives du cabinet.",
    platformBookings:
      "les données des réservations effectuées sur la place de marché : tant que la réservation est gérée, et pas plus longtemps que le cabinet ne conserve sa propre copie ;",
    platformReviews: "les avis publiés : jusqu'à ce que vous les supprimiez ou qu'ils soient retirés ;",
    platformCodes:
      "les codes à usage unique : supprimés {period} après leur expiration ; les sessions de l'espace confidentialité prennent fin au bout de 30 minutes ;",
  },
  rights: {
    intro: "Vous avez le droit :",
    access: "d'accéder à vos données et d'en recevoir une copie (art. 15 du RGPD) ;",
    rectification: "de faire rectifier les données inexactes et compléter les données incomplètes (art. 16) ;",
    erasure:
      "d'obtenir l'effacement de vos données lorsqu'elles ne sont plus nécessaires ou que vous retirez votre consentement, sauf ce que la loi nous impose de conserver (art. 17) ;",
    restriction: "d'obtenir la limitation du traitement, par exemple pendant la vérification d'une rectification (art. 18) ;",
    portability:
      "de recevoir les données que vous nous avez fournies dans un format structuré et lisible par machine, ou de les faire transmettre à un autre responsable du traitement (art. 20) ;",
    objection: "de vous opposer aux traitements fondés sur l'intérêt légitime, y compris le profilage (art. 21) ;",
    withdraw:
      "de retirer votre consentement à tout moment, sans que cela remette en cause le traitement effectué auparavant (art. 7, par. 3) ;",
    automated: "de ne pas faire l'objet d'une décision fondée exclusivement sur un traitement automatisé (art. 22).",
    how: "Comment : en ligne dans l'espace confidentialité à l'adresse {url}, où vous vous connectez avec un code à usage unique envoyé sur votre téléphone ou votre e-mail ; depuis le lien figurant dans les messages relatifs à vos rendez-vous ; ou en écrivant à {email}.",
    howNoContact:
      "Comment : en ligne dans l'espace confidentialité à l'adresse {url}, où vous vous connectez avec un code à usage unique envoyé sur votre téléphone ou votre e-mail, ou depuis le lien figurant dans les messages relatifs à vos rendez-vous.",
    deadline:
      "Nous répondons dans un délai d'un mois. Pour les demandes complexes, ce délai peut être prolongé de deux mois, et nous vous en indiquons les motifs dans le premier mois (art. 12, par. 3 du RGPD). L'exercice de vos droits est gratuit.",
    recipientsInformed:
      "Lorsque nous rectifions ou effaçons vos données, ou en limitons l'utilisation, nous en informons également les destinataires auxquels nous les avons transmises (art. 19 du RGPD).",
  },
  complaint: {
    body: "Si vous estimez que vos données font l'objet d'un traitement illicite, vous pouvez introduire une réclamation auprès de l'autorité italienne de protection des données, le Garante per la protezione dei dati personali (Piazza Venezia 11, 00187 Roma, www.garanteprivacy.it), ou auprès de l'autorité du pays de l'UE où vous résidez ou travaillez (art. 77 du RGPD). Vous pouvez également saisir la justice (art. 79 du RGPD).",
  },
  mandatory: {
    practice:
      "Pour réserver, vous devez indiquer votre nom et un numéro de portable ou une adresse e-mail : sans eux, le cabinet ne peut ni réserver ni vous rappeler le rendez-vous. La date de naissance est facultative, mais obligatoire lorsque vous réservez pour un enfant. Chaque consentement est facultatif : refuser ne vous empêche jamais de réserver ni d'être soigné.",
    platform:
      "Le consentement à la réservation via Sorriso n'est nécessaire que pour réserver depuis les pages de recherche de Sorriso. Si vous préférez ne pas le donner, vous pouvez réserver directement auprès du cabinet, sur son propre site ou par téléphone.",
  },
  automated: {
    none: "Aucune décision vous concernant n'est prise exclusivement par des moyens automatisés (art. 22 du RGPD).",
    profiling:
      "Ce cabinet utilise des rappels adaptatifs : l'historique de vos rendez-vous sert à décider s'il convient de vous envoyer un rappel supplémentaire. Il s'agit d'un profilage, mais il ne fait qu'ajouter de l'aide et ne limite jamais votre réservation. Vous pouvez vous y opposer à tout moment.",
    platform:
      "Les résultats de recherche sont classés selon des critères publiés, et les avis font l'objet d'un contrôle automatique des informations de santé avant publication ; c'est toujours une personne qui décide du retrait d'un avis. Aucune décision produisant des effets juridiques ou des effets similaires significatifs n'est prise exclusivement par des moyens automatisés.",
  },
  minors: {
    body: "Les enfants de moins de 14 ans sont inscrits par un parent ou un représentant légal, qui reçoit les messages et donne les éventuels consentements (art. 2-quinquies du Code italien en matière de protection des données personnelles). À partir de 14 ans, les jeunes peuvent réserver et faire ces choix eux-mêmes. L'accès d'un parent ou d'un représentant légal via l'espace confidentialité prend fin aux 18 ans de l'enfant.",
    link: "Une version de cette politique rédigée pour les jeunes est disponible à l'adresse {url}.",
  },
  marketplace: {
    body: "Si vous avez réservé depuis les pages de recherche de Sorriso, Sorriso est également responsable de traitement autonome pour cette réservation : il la transmet au cabinet et gère les rappels et les modifications, avec votre consentement explicite (art. 9, par. 2, point a) du RGPD). La politique de Sorriso explique comment : {url}.",
    withdraw:
      "Si vous retirez ce consentement, Sorriso cesse son propre traitement, tandis que le cabinet conserve ce dont il a besoin pour vous soigner (art. 9, par. 2, point h) du RGPD).",
  },
  withdrawal: {
    platform:
      "Si vous retirez votre consentement à la réservation via Sorriso, Sorriso cesse son propre traitement de cette réservation : il ne la conserve plus dans votre historique sur la place de marché et n'envoie plus ses propres messages ni invitations à son sujet. Le cabinet conserve ce dont il a besoin pour vous soigner, en tant que responsable du traitement, en vertu de l'art. 9, par. 2, point h) du RGPD, avec Sorriso pour sous-traitant. Le retrait ne remet pas en cause le traitement effectué auparavant.",
  },
  roles: {
    intro: "Sorriso a deux rôles :",
    controller:
      "responsable de traitement autonome pour ses propres services : les réservations commencées sur les pages de recherche de Sorriso, l'annuaire des cabinets et des praticiens, les avis publiés, l'ordre des résultats de recherche et l'espace confidentialité. La présente politique les couvre ;",
    processor:
      "sous-traitant des cabinets (art. 28 du RGPD) pour tout ce qui passe par les propres canaux d'un cabinet : son site, son widget ou ses liens de réservation, son personnel et son logiciel. Pour ces traitements, le cabinet est responsable du traitement et sa propre politique s'applique : vous la trouverez sur la page du cabinet.",
  },
  changes: {
    body: "Nous mettons à jour cette politique lorsque nos traitements évoluent et conservons toutes les versions antérieures : vous pouvez demander celle qui était en vigueur lors de votre réservation. Ceci est la version {version}.",
  },
  cookiesLink: {
    body: "Sorriso utilise uniquement des cookies techniques, et aucun cookie tiers : consultez la politique relative aux cookies à l'adresse {url}.",
  },
  summary: {
    practice:
      "{practice} utilise vos données pour réserver et gérer vos rendez-vous dentaires, vous envoyer des confirmations et des rappels, et tenir votre dossier au cabinet. Ce traitement est nécessaire pour fournir les soins que vous demandez (art. 6, par. 1, point b) et art. 9, par. 2, point h) du RGPD). Tout ce qui est facultatif, comme les invitations à donner votre avis ou les actualités, nécessite votre consentement distinct, que vous pouvez retirer à tout moment.",
    platform:
      "Sorriso vous aide à trouver un cabinet dentaire et à y réserver. Lorsque vous réservez depuis les pages de recherche de Sorriso, Sorriso transmet votre réservation au cabinet avec votre consentement. Lorsque vous réservez via le propre site, le widget de réservation ou le personnel d'un cabinet, c'est le cabinet qui est responsable de vos données, et Sorriso se contente d'exploiter le logiciel pour son compte.",
    rights:
      "Vous pouvez consulter, rectifier, télécharger ou supprimer vos données, en limiter l'utilisation ou vous y opposer et retirer votre consentement à tout moment : en ligne dans l'espace confidentialité avec un code à usage unique, ou en écrivant à {email}. Vous pouvez également introduire une réclamation auprès de l'autorité italienne de protection des données (Garante).",
    rightsNoContact:
      "Vous pouvez consulter, rectifier, télécharger ou supprimer vos données, en limiter l'utilisation ou vous y opposer et retirer votre consentement à tout moment, en ligne dans l'espace confidentialité avec un code à usage unique. Vous pouvez également introduire une réclamation auprès de l'autorité italienne de protection des données (Garante).",
  },
  minor: {
    summary:
      "Cette page t'explique, avec des mots simples, ce que {practice} fait des informations qui te concernent quand tu as un rendez-vous chez le dentiste.",
    who: "{controller} est responsable de tes informations. Si tu as des questions, toi ou tes parents pouvez écrire à {email}.",
    whoNoContact:
      "{controller} est responsable de tes informations. Si tu as des questions, toi ou tes parents pouvez les poser au cabinet.",
    whatIntro: "Nous utilisons :",
    whatName: "ton nom et ta date de naissance ;",
    whatAppointments: "tes rendez-vous : quand ils ont lieu et à quoi ils servent ;",
    whatContact:
      "le numéro de téléphone ou l'e-mail où nous envoyons les rappels : le tien, ou celui de ton parent ou de ton représentant légal ;",
    whatMessages: "les messages que nous envoyons et les réponses que nous recevons.",
    why: "Pour réserver tes visites, te les rappeler et prendre soin de tes dents en toute sécurité. Nous ne les utilisons jamais pour de la publicité, et nous ne les vendons jamais.",
    parents:
      "Si tu as moins de 14 ans, ton parent ou ton représentant légal réserve pour toi, reçoit les rappels et décide de tout ce qui est facultatif. À partir de 14 ans, tu peux réserver et décider toi-même. À tes 18 ans, tes parents ne peuvent plus voir ton dossier via l'espace confidentialité.",
    keep: "Seulement le temps nécessaire pour te soigner, et aussi longtemps que la loi oblige le cabinet à les garder. Ensuite, elles sont supprimées.",
    youCan:
      "Tu peux demander à voir tes informations, à les corriger si quelque chose est faux, ou à les supprimer quand elles ne sont plus nécessaires. Tu peux le faire dans l'espace confidentialité à l'adresse {url}, ou demander à ton parent ou à ton représentant légal de t'aider.",
    help: "Si tu penses que tes informations ne sont pas traitées correctement, toi ou tes parents pouvez porter plainte auprès de l'autorité italienne de protection des données (Garante per la protezione dei dati personali, www.garanteprivacy.it).",
    full: "Ceci est une version simplifiée. La politique complète est disponible à l'adresse {url}.",
  },
  staff: {
    summary:
      "Cette politique s'adresse aux personnes qui utilisent le tableau de bord Sorriso dans un cabinet dentaire : titulaires, administrateurs, accueil et praticiens. Elle explique quelles données vous concernant sont traitées, et comment fonctionne le journal des accès.",
    controllers:
      "Sorriso est responsable du traitement de votre compte utilisateur (connexion, vérification en deux étapes, sessions). Le cabinet pour lequel vous travaillez est responsable du traitement du journal des accès et de tout ce que vous faites par ailleurs dans son agenda ; Sorriso est son sous-traitant.",
    dataIntro: "Nous traitons :",
    dataAccount: "votre nom, votre adresse e-mail, votre rôle et votre langue préférée ;",
    dataSecurity:
      "votre mot de passe (conservé uniquement sous forme d'empreinte), votre secret de vérification en deux étapes (chiffré) et vos codes de récupération (sous forme d'empreintes) ;",
    dataSessions:
      "vos sessions et tentatives de connexion, avec des empreintes chiffrées à clé de l'adresse IP et du navigateur ;",
    dataLog: "le journal des accès : quels dossiers patients vous ouvrez ou modifiez, quand, et avec quelle action ;",
    dataLegal: "votre acceptation des instructions au personnel et des autres documents juridiques.",
    monitoring:
      "Le journal des accès est une mesure de sécurité requise pour les données de santé (art. 32 du RGPD). Il enregistre la date et l'heure, votre utilisateur, le dossier et l'action, jamais le contenu que vous lisez. Le cabinet peut le consulter pour vérifier que les dossiers ne sont ouverts qu'à des fins de soins et d'administration, et pour enquêter sur des abus. Comme vous en êtes informé par la présente politique et par les instructions au personnel, les informations du journal peuvent être utilisées à des fins liées à votre relation de travail, dans les limites de l'art. 4, par. 3 de la loi italienne 300/1970 (Statut des travailleurs) et de la législation sur la protection des données.",
    retentionSessions: "les sessions : jusqu'à leur expiration ; les tentatives de connexion : {period} ;",
    retentionLog: "le journal des accès : selon la durée fixée par le cabinet, au moins {period} ;",
    retentionLegal:
      "les acceptations des documents juridiques : 10 ans, soit le délai de prescription permettant d'en apporter la preuve ;",
    retentionAccount: "votre compte : jusqu'à sa clôture ou votre départ du cabinet.",
    rights:
      "Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition (art. 15 à 21 du RGPD). Pour votre compte, écrivez à Sorriso à l'adresse {email} ; pour le journal des accès, au cabinet pour lequel vous travaillez.",
    rightsNoContact:
      "Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition (art. 15 à 21 du RGPD). Pour votre compte, écrivez à Sorriso ; pour le journal des accès, au cabinet pour lequel vous travaillez.",
  },
  practitioner: {
    summary:
      "Cette politique s'adresse aux dentistes et autres praticiens présentés dans l'annuaire de Sorriso. Elle explique comment Sorriso traite vos données professionnelles, les vérifications de votre inscription à l'ordre et les avis que les patients rédigent à votre sujet.",
    controllers:
      "Sorriso est responsable du traitement de l'annuaire, de votre profil public, des avis et de l'ordre des résultats de recherche. Le cabinet avec lequel vous travaillez est responsable du traitement de votre planning et des données de ses patients ; Sorriso est son sous-traitant pour ces traitements.",
    dataIntro: "Nous traitons :",
    dataProfile:
      "votre nom, votre titre, votre spécialité, votre biographie, les langues que vous parlez, le cabinet et les sites où vous exercez, ainsi que vos disponibilités ;",
    dataAlbo:
      "votre inscription au tableau de l'ordre professionnel (Albo degli Odontoiatri ou dei Medici Chirurghi), la province et le numéro, ainsi que les spécialisations reconnues qui y figurent ;",
    dataReviews:
      "les notes et les avis que les patients rédigent sur les visites effectuées avec vous, vos réponses et les éventuels signalements ;",
    dataMetrics:
      "les indicateurs utilisés pour classer les résultats de recherche : annulations par le cabinet, complétude du profil et consultations de votre profil.",
    profile:
      "Votre profil ne devient public qu'après votre validation ou celle du cabinet, et vous pouvez vous retirer de la place de marché à tout moment. Les spécialisations légalement reconnues ne sont affichées qu'après vérification par Sorriso auprès du registre public.",
    reviews:
      "Seuls les patients ayant effectué une visite vérifiée peuvent laisser un avis sur vous. Vous pouvez répondre à un avis et le signaler ; chaque décision sur un signalement est motivée et peut faire l'objet d'un recours, une fois.",
    retentionProfile: "votre profil : jusqu'à ce que vous ou le cabinet le retiriez de l'annuaire ;",
    retentionReviews: "les avis : jusqu'à ce que leur auteur les supprime ou qu'ils soient retirés ;",
    retentionMetrics: "les indicateurs de classement : calculés sur les 180 derniers jours.",
    rights:
      "Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition (art. 15 à 21 du RGPD), y compris du droit de vous opposer au classement. Écrivez à Sorriso à l'adresse {email}.",
    rightsNoContact:
      "Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, de portabilité et d'opposition (art. 15 à 21 du RGPD), y compris du droit de vous opposer au classement. Écrivez à Sorriso.",
  },
  cookies: {
    summary:
      "Sorriso n'utilise pas de cookies publicitaires ni de traçage, et les pages ne chargent rien depuis les serveurs d'autres entreprises pendant votre navigation. Nous utilisons uniquement les quelques cookies techniques nécessaires au fonctionnement du site. Ils ne requièrent pas votre consentement : c'est pourquoi il n'y a pas de bandeau cookies.",
    item: "{name} : {purpose} Durée : {duration}.",
    staffSession: {
      name: "Session du personnel ({names})",
      purpose:
        "maintient la connexion du personnel des cabinets au tableau de bord. Déposé uniquement lorsqu'un membre du personnel se connecte.",
      duration: "jusqu'à la déconnexion, 24 heures au maximum, et 30 minutes sans activité",
    },
    locale: {
      name: "Langue ({names})",
      purpose:
        "mémorise la langue que vous avez choisie avec le sélecteur de langue. Déposé uniquement lorsque vous choisissez une langue.",
      duration: "1 an",
    },
    privacyCenter: {
      name: "Espace confidentialité ({names})",
      purpose: "maintient votre connexion à l'espace confidentialité après la saisie d'un code à usage unique.",
      duration: "30 minutes",
    },
    storageIntro:
      "En dehors de ces cookies, Sorriso ne conserve que les éléments suivants dans le stockage de votre navigateur. Ils ne quittent jamais votre appareil et ne sont créés que lorsque vous utilisez la fonctionnalité correspondante :",
    storageItem: "{key} : {purpose}",
    storageItems: {
      dashboardPrivacyScreen:
        "mémorise, sur cet appareil, si le personnel du cabinet a activé l'écran de confidentialité du tableau de bord, qui floute le nom des patients dans l'agenda pour que les personnes à l'accueil ne puissent pas les lire. Conservé jusqu'à sa désactivation.",
    },
    thirdPartiesIntro:
      "Les pages ne chargent ni scripts, ni polices, ni images, ni cadres provenant d'autres entreprises. Deux exceptions ne se produisent que si vous les demandez :",
    map: "la carte de la page d'un cabinet n'apparaît qu'après un clic pour l'afficher. Votre navigateur la charge alors depuis OpenStreetMap (OpenStreetMap Foundation), qui reçoit votre adresse IP conformément à sa propre politique de confidentialité : https://osmfoundation.org/wiki/Privacy_Policy ;",
    links: "les liens, comme les itinéraires, ouvrent d'autres sites, par exemple Google Maps, dans un nouvel onglet : ces sites appliquent leurs propres politiques.",
    legalBasis:
      "Les cookies techniques sont autorisés sans consentement par l'art. 122 du Code italien en matière de protection des données personnelles et par les lignes directrices du Garante sur les cookies et autres outils de traçage du 10 juin 2021. La présente politique vous en informe.",
    control:
      "Vous pouvez supprimer les cookies dans les paramètres de votre navigateur à tout moment. Sans les cookies techniques, la connexion et la mémorisation de votre langue ne fonctionneront pas.",
    widget:
      "Le widget de réservation affiché sur le site d'un cabinet ne dépose aucun cookie qui lui soit propre. Le site du cabinet peut utiliser d'autres cookies : consultez sa propre politique relative aux cookies.",
  },
} satisfies DeepPartial<Messages["legalPatient"]>;
