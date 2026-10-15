import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  booking: {
    heading: "Confidentialité",
    firstLayer: {
      practice:
        "{controller} utilise vos données pour réserver et gérer ce rendez-vous et pour vous envoyer des confirmations et des rappels.",
      practiceWaitlist: "{controller} utilise vos données pour vous contacter si un horaire plus proche se libère.",
      marketplace:
        "Sorriso transmet votre réservation au cabinet et gère les rappels et les modifications en tant que responsable de traitement autonome, avec votre consentement ci-dessous.",
      basis:
        "Ce traitement est nécessaire aux soins que vous demandez (art. 6, par. 1, point b) et art. 9, par. 2, point h) du RGPD). Les choix facultatifs nécessitent votre consentement, que vous pouvez retirer à tout moment.",
      rights:
        "Vous pouvez consulter, rectifier, télécharger ou supprimer vos données à tout moment dans l'<link>espace confidentialité</link>.",
      otherAdult:
        "Vous réservez pour une autre personne : nous lui enverrons un message concernant cette réservation, avec la politique de confidentialité du cabinet (art. 14 du RGPD), au numéro de portable ou à l'adresse e-mail que vous indiquez comme étant les siens. Pensez à l'en informer vous aussi.",
      otherAdultWaitlist:
        "Vous faites cette demande pour une autre personne : informez-la de cette demande et indiquez-lui la politique de confidentialité du cabinet ci-dessous (art. 14 du RGPD).",
      guardian: "En tant que parent ou représentant légal, vous faites ces choix pour l'enfant.",
    },
    links: {
      practice: "Politique de confidentialité de {controller}",
      platform: "Politique de confidentialité de Sorriso",
      minors: "Version pour les jeunes",
      newTab: "(s'ouvre dans un nouvel onglet)",
    },
    required: "Obligatoire",
    platformHeading: "Réservation via Sorriso",
    whatThisMeans: "Ce que cela signifie",
    whatsappHeading: "Messages sur WhatsApp",
    optionalHeading: "Facultatif",
    optionalHint: "Non nécessaire pour réserver. Vous pouvez changer d'avis à tout moment dans l'espace confidentialité.",
    otherAdult: {
      choices:
        "Seule la personne concernée peut donner son consentement : aucun choix ne vous est donc demandé ici. Elle pourra faire ses propres choix plus tard, via le lien figurant dans ses messages ou dans l'espace confidentialité.",
      whatsapp:
        "WhatsApp ne peut pas être choisi pour une autre personne, car cela nécessite son propre consentement : veuillez choisir SMS ou e-mail. Elle pourra passer elle-même à WhatsApp plus tard.",
      marketplaceRefused:
        "Sur Sorriso, seul le patient peut accepter la manière dont Sorriso traite sa réservation : les adultes réservent donc eux-mêmes ici. Demandez-lui de réserver, ou réservez directement auprès du cabinet, sur son propre site ou par téléphone.",
      marketplaceHeld:
        "Elle recevra un message lui demandant de confirmer cette réservation et de donner son propre consentement à Sorriso. Si elle ne confirme pas dans les 48 heures, la réservation est annulée.",
      marketplaceWaitlist:
        "Sur Sorriso, seul le patient peut accepter la manière dont Sorriso traite sa demande : les adultes s'inscrivent donc eux-mêmes sur la liste d'attente ici. Demandez-lui de s'inscrire, ou contactez directement le cabinet, sur son propre site ou par téléphone.",
    },
  },
  relation: {
    legend: "Pour qui est ce rendez-vous ?",
    options: {
      self: "Moi",
      minor: "Un mineur",
      other_adult: "Un autre adulte",
    },
    hints: {
      self: "Vous êtes le patient",
      minor: "Vous réservez en tant que parent ou représentant légal",
      other_adult: "Vous réservez pour son compte",
    },
    teen: "À partir de 14 ans, vous pouvez réserver seul. La politique de confidentialité du cabinet existe dans une version rédigée pour les jeunes, accessible ci-dessous.",
    under14:
      "Avant 14 ans, la réservation doit être faite par un parent ou un représentant légal. Choisissez « Un mineur » et indiquez vos coordonnées de parent ou de représentant légal.",
    minor: {
      intro:
        "Indiquez ci-dessous le nom et la date de naissance de l'enfant comme coordonnées du patient. Si l'enfant n'a pas de numéro de portable ni d'adresse e-mail à lui, indiquez-y les vôtres. Jusqu'aux 14 ans de l'enfant, les rappels vous sont envoyés.",
      birthDateNeeded: "La date de naissance de l'enfant est obligatoire.",
      adult:
        "Le jour du rendez-vous, cette personne aura 18 ans ou plus : choisissez « Moi » ou « Un autre adulte ».",
      guardianHeading: "Parent ou représentant légal",
      name: "Vos nom et prénom",
      relationLegend: "Vous êtes, pour l'enfant,",
      relations: {
        parent: "Parent",
        legal_guardian: "Représentant légal",
      },
      phone: "Votre numéro de portable",
      email: "Votre e-mail",
      contactHint: "Indiquez au moins l'un des deux : les messages concernant l'enfant y seront envoyés.",
      access:
        "Vos coordonnées sont enregistrées dans le dossier de l'enfant. Vous pouvez consulter les données de l'enfant dans l'espace confidentialité jusqu'à ses 18 ans.",
    },
    other: {
      intro: "Indiquez ci-dessous les coordonnées du patient lui-même. Lui seul peut donner son consentement.",
      heading: "Qui réserve",
      name: "Votre nom",
      phone: "Votre numéro de portable",
      email: "Votre e-mail",
      hint: "Conservé uniquement avec ce rendez-vous, jamais comme contact du patient.",
      marketplaceHeld:
        "Sur Sorriso, le patient confirme lui-même cette réservation. Indiquez ci-dessous son propre numéro de portable ou son e-mail, et non les vôtres : c'est là que nous lui demanderons de confirmer.",
      marketplace:
        "Sur les pages de recherche de Sorriso, les adultes réservent eux-mêmes. Vous pouvez aussi réserver directement auprès du cabinet, sur son propre site ou par téléphone.",
      marketplaceWaitlist:
        "Sur les pages de recherche de Sorriso, les adultes s'inscrivent eux-mêmes sur la liste d'attente. Vous pouvez aussi contacter directement le cabinet, sur son propre site ou par téléphone.",
    },
    errors: {
      nameRequired: "Indiquez un nom",
      contactRequired: "Indiquez un numéro de portable ou une adresse e-mail",
    },
  },
  manageCard: {
    title: "Votre confidentialité",
    body: "Choisissez la langue et le canal de vos messages, retirez des consentements facultatifs, ou consultez et téléchargez tout ce que le cabinet détient à votre sujet.",
    preferences: "Confidentialité et messages",
    privacyCenter: "Espace confidentialité",
    notice: "Politique de confidentialité du cabinet",
  },
  center: {
    meta: {
      title: "Espace confidentialité",
      description:
        "Consultez, téléchargez, rectifiez ou supprimez les données que les cabinets dentaires présents sur Sorriso détiennent à votre sujet. Sans compte.",
    },
    eyebrow: "Sans compte",
    title: "Votre espace confidentialité",
    intro:
      "Découvrez quels cabinets dentaires présents sur Sorriso détiennent des données vous concernant, vous ou vos enfants, téléchargez-les, rectifiez-les, modifiez vos choix ou demandez leur suppression. Nous envoyons un code à usage unique sur votre téléphone ou votre e-mail pour vérifier qu'il s'agit bien de vous.",
    signIn: {
      heading: "Connexion avec un code à usage unique",
      contactLabel: "Numéro de portable ou adresse e-mail",
      contactHint:
        "Celui que vous avez indiqué lors de la réservation. Les numéros de portable sans indicatif pays utilisent celui sélectionné.",
      countryCode: "Indicatif pays",
      dialOption: "+{code}",
      submit: "M'envoyer un code",
      sending: "Envoi en cours…",
      neutral:
        "Si un cabinet présent sur Sorriso détient des données pour ce contact, vous recevrez un code à 6 chiffres. Sinon, vous ne recevrez rien.",
      continue: "Accéder à vos données",
      signedIn: "Vous êtes connecté en tant que {contact}.",
    },
    steps: {
      heading: "Comment ça marche",
      one: "Saisissez le numéro de portable ou l'adresse e-mail utilisé pour réserver.",
      two: "Tapez le code à 6 chiffres que nous y envoyons. Il est valable 5 minutes.",
      three: "Consultez vos données dans chaque cabinet pendant 30 minutes. Ensuite, vous devez vous reconnecter.",
    },
    rights: {
      heading: "Vos droits",
      intro: "En vertu du RGPD, vous pouvez, à tout moment et gratuitement :",
      access: {
        title: "Consulter vos données",
        body: "et obtenir une copie de tout ce qu'un cabinet détient à votre sujet (art. 15).",
      },
      rectification: { title: "Les rectifier", body: "si une information est inexacte ou incomplète (art. 16)." },
      erasure: {
        title: "Les faire supprimer",
        body: "lorsqu'elles ne sont plus nécessaires, sauf ce qu'un cabinet doit conserver en vertu de la loi (art. 17).",
      },
      restriction: {
        title: "En limiter l'utilisation",
        body: "par exemple pendant la vérification d'une rectification (art. 18).",
      },
      portability: { title: "Les transférer ailleurs", body: "dans un format lisible par d'autres logiciels (art. 20)." },
      objection: {
        title: "Vous opposer",
        body: "aux traitements fondés sur l'intérêt légitime, comme les rappels adaptatifs (art. 21).",
      },
      withdraw: {
        title: "Retirer votre consentement",
        body: "pour tout ce que vous avez accepté, sans remettre en cause ce qui a été fait auparavant (art. 7).",
      },
      deadline:
        "Les cabinets doivent répondre dans un délai d'un mois. Vous pouvez aussi écrire directement au cabinet : ses coordonnées figurent dans sa politique de confidentialité.",
    },
    complaint: {
      heading: "Réclamations",
      body: "Si vous estimez que vos données ne sont pas traitées correctement, vous pouvez introduire une réclamation auprès de l'autorité italienne de protection des données, le <link>Garante per la protezione dei dati personali</link>, ou auprès de l'autorité du pays de l'UE où vous résidez.",
    },
    controller: {
      heading: "Qui gère cette page",
      body: "L'espace confidentialité est géré par Sorriso, qui traite le contact que vous vérifiez uniquement pour retrouver vos dossiers et maintenir votre connexion. <link>Politique de confidentialité de Sorriso</link>.",
    },
    errors: {
      invalidContact: "Saisissez un numéro de portable ou une adresse e-mail valide.",
      rateLimited: "Trop de codes demandés. Patientez 15 minutes, puis réessayez.",
      generic: "Une erreur s'est produite. Veuillez réessayer.",
    },
  },
  verify: {
    meta: { title: "Saisissez votre code" },
    title: "Saisissez votre code",
    sentTo:
      "Si un cabinet présent sur Sorriso détient des données pour {contact}, nous y avons envoyé un code à 6 chiffres. Il expire dans 5 minutes.",
    codeLabel: "Code à 6 chiffres",
    submit: "Continuer",
    checking: "Vérification…",
    again: "Pas de code ? Cela peut prendre une minute. <link>Demander un nouveau code</link>.",
    errors: {
      invalid: "Ce code est incorrect. Vérifiez-le et réessayez.",
      expired: "Ce code a expiré. Demandez-en un nouveau.",
      too_many_attempts: "Trop de codes erronés. Demandez un nouveau code.",
      ticket: "Cette connexion a expiré. Veuillez recommencer.",
      format: "Saisissez les 6 chiffres du code.",
    },
  },
  me: {
    meta: { title: "Vos données" },
    title: "Vos données",
    signedInAs: "Connecté en tant que {contact}",
    until: "Pour votre sécurité, vous serez automatiquement déconnecté à {time}.",
    signOut: "Se déconnecter",
    signedOut: "Vous êtes déconnecté.",
    expired: "Votre session a pris fin. Reconnectez-vous pour continuer.",
    contents: "Cabinets",
    empty: {
      title: "Aucune donnée trouvée pour ce contact",
      body: "Aucun cabinet présent sur Sorriso ne détient de dossier avec ce numéro de portable ou cette adresse e-mail. Si vous avez réservé avec un autre contact, connectez-vous avec celui-ci.",
    },
    yours: "Votre dossier",
    familyBadge: "Votre enfant {name}",
    familyNote:
      "Vous voyez ce dossier car votre contact est enregistré comme parent ou représentant légal de {name}, qui a moins de 18 ans.",
    restricted: "Traitement limité depuis le {date} : le cabinet conserve les données mais ne les utilise pas.",
    challenge: {
      title: "Un dossier existe chez {practice}",
      body: "Ce contact figure également dans le dossier d'une autre personne, ou n'a jamais été confirmé pour celui-ci. Pour le consulter, confirmez le nom de famille et la date de naissance du patient.",
      lastName: "Nom de famille",
      birthDate: "Date de naissance",
      submit: "Confirmer",
      wrong: "Ces informations ne correspondent pas. Vérifiez-les et réessayez.",
      rateLimited: "Trop de tentatives. Réessayez demain ou contactez le cabinet.",
      unavailable: "Ce dossier ne peut pas être confirmé ici. Veuillez contacter le cabinet.",
      help: "Impossible de confirmer ? Contactez le cabinet : {contact}.",
      noBirthDate:
        "{practice} n'a pas de date de naissance dans ce dossier : il ne peut donc pas être confirmé ici. Pour le consulter, contactez le cabinet : {contact}.",
      noBirthDateNoContact:
        "{practice} n'a pas de date de naissance dans ce dossier : il ne peut donc pas être confirmé ici. Pour le consulter, contactez le cabinet.",
    },
    sections: {
      details: "Vos coordonnées",
      appointments: "Rendez-vous",
      messages: "Messagerie",
      waitlist: "Liste d'attente",
      choices: "Vos choix",
      preferences: "Langue et canal",
      contact: "Rectifier vos coordonnées",
      reviews: "Avis",
      accessLog: "Qui a consulté ce dossier",
      requests: "Demandes",
      download: "Télécharger vos données",
    },
    counts: {
      appointments: p({ one: "{count} rendez-vous", other: "{count} rendez-vous" }),
      messages: p({ one: "{count} message", other: "{count} messages" }),
      entries: p({ one: "{count} inscription", other: "{count} inscriptions" }),
    },
    details: {
      name: "Nom",
      birthDate: "Date de naissance",
      phone: "Numéro de portable",
      email: "E-mail",
      language: "Langue des messages",
      channel: "Canal préféré",
      guardian: "Parent ou représentant légal",
      none: "Non renseigné",
      verified: "vérifié",
    },
    appointments: {
      empty: "Aucun rendez-vous.",
      viaSorriso: "Réservé sur Sorriso",
      bookedByOther: "Réservé pour vous par une autre personne",
    },
    messages: {
      empty: "Aucun message.",
      inbound: "Votre réponse",
      outbound: "Envoyé à vous",
      redacted: "Le texte a été supprimé à la fin de la durée de conservation.",
      intro: "Les messages sont conservés pendant la durée fixée dans la politique de confidentialité du cabinet.",
    },
    waitlist: {
      range: "Du {from} au {to}",
      statuses: {
        active: "En attente",
        booked: "Réservé",
        removed: "Clôturé",
      },
    },
    choices: {
      intro:
        "Les modifications s'appliquent immédiatement et sont enregistrées comme preuve. Désactiver un choix ne remet jamais en cause ce qui a été fait auparavant.",
      on: "Activé",
      off: "Désactivé",
      objected: "Opposition exprimée",
      since: "Depuis le {date}",
      default: "Par défaut",
      turnOn: "Activer",
      turnOff: "Désactiver",
      withdraw: "Retirer",
      object: "M'opposer",
      undoObjection: "Retirer l'opposition",
      kinds: {
        consent: "Consentement",
        channel: "Messages de service",
        objection: "Vous pouvez vous opposer",
      },
      whatsappHint: "Pour recevoir des messages sur WhatsApp, choisissez-le comme canal ci-dessous.",
      guardianRequired: "Pour un enfant de moins de 14 ans, ce choix doit être fait par un parent ou un représentant légal.",
      notAllowed: "Ce choix ne peut pas être modifié ici.",
      saved: "Enregistré.",
    },
    preferences: {
      language: "Langue des messages",
      channel: "Canal",
      save: "Enregistrer",
      saved: "Enregistré.",
      unavailable: "Ce canal n'est pas disponible pour ce dossier.",
      whatsappRequired: "Veuillez confirmer pour recevoir des messages sur WhatsApp.",
    },
    contact: {
      intro:
        "Nous envoyons un code au nouveau contact pour le vérifier. Le cabinet est informé de la modification, de même que l'ancien contact.",
      kind: "Que voulez-vous modifier ?",
      kinds: {
        phone: "Numéro de portable",
        email: "Adresse e-mail",
      },
      newValue: "Nouvelle valeur",
      applyAll: "Le modifier dans tous les cabinets où il est enregistré",
      send: "Envoyer un code",
      codeSent: "Nous avons envoyé un code à {contact}. Saisissez-le pour confirmer la modification.",
      code: "Code",
      confirm: "Confirmer la modification",
      done: "Vos coordonnées ont été mises à jour.",
      errors: {
        invalid_contact: "Saisissez un numéro de portable ou une adresse e-mail valide.",
        unchanged: "C'est déjà le contact enregistré.",
        not_found: "Ce dossier ne peut pas être modifié depuis cette page.",
        rate_limited: "Trop de codes demandés. Patientez 15 minutes, puis réessayez.",
        invalid: "Ce code est incorrect.",
        expired: "Ce code a expiré. Envoyez-en un nouveau.",
        too_many_attempts: "Trop de codes erronés. Envoyez-en un nouveau.",
      },
    },
    reviews: {
      rating: "{rating} sur 5",
      withdraw: "Supprimer l'avis",
      confirm: "Supprimer définitivement cet avis ? Il disparaîtra de toutes les pages publiques.",
      withdrawn: "Avis supprimé.",
      statuses: {
        pending: "En attente de publication",
        published: "Publié",
        under_review: "En cours de vérification",
        removed: "Retiré",
        withdrawn: "Supprimé par vous",
      },
    },
    accessLog: {
      intro:
        "Chaque fois que quelqu'un ouvre ou modifie ce dossier, c'est enregistré. Les membres du personnel apparaissent selon leur rôle.",
      empty: "Aucun accès enregistré pour l'instant.",
      when: "Quand",
      who: "Qui",
      what: "Quoi",
      formerStaff: "Ancien membre du personnel",
      actors: {
        patient_session: "Vous, dans l'espace confidentialité",
        patient_link: "Vous, depuis le lien de votre rendez-vous",
        api_key: "Le logiciel du cabinet",
        system: "Processus automatique",
        platform_admin: "Administrateur Sorriso",
        webhook: "Votre réponse à un message",
        user: "Personnel",
      },
      actions: {
        patient_view: "A ouvert votre dossier",
        patient_create: "A créé votre dossier",
        patient_update: "A modifié vos coordonnées",
        patient_export: "A exporté vos données",
        patient_erase: "A effacé vos données",
        patient_restrict: "A limité le traitement",
        patient_unrestrict: "A levé la limitation",
        patient_restricted_access: "A ouvert votre dossier restreint en indiquant un motif",
        patient_clinical_view: "A ouvert vos antécédents médicaux",
        patient_merge: "A fusionné des dossiers en double",
        appointment_view: "A ouvert un rendez-vous",
        appointment_create: "A réservé un rendez-vous",
        appointment_update: "A modifié un rendez-vous",
        appointment_cancel: "A annulé un rendez-vous",
        appointment_note_update: "A modifié une note de rendez-vous",
        appointment_link_issue: "A créé un lien vers la page de votre rendez-vous",
        adult_confirmation_request: "Vous a demandé de confirmer une réservation faite pour vous",
        adult_confirmation_confirm: "A confirmé une réservation faite pour vous",
        adult_confirmation_decline: "A refusé une réservation faite pour vous",
        adult_confirmation_expire: "A annulé une réservation faite pour vous qui n'a pas été confirmée à temps",
        waitlist_update: "A modifié votre inscription sur la liste d'attente",
        message_view: "A ouvert un message qui vous était destiné ou que vous avez envoyé",
        recall_update: "A modifié votre relance de contrôle",
        form_submit: "A reçu votre questionnaire médical",
        form_export: "A ajouté votre questionnaire médical à votre dossier clinique",
        consent_record: "A enregistré un choix de confidentialité",
        privacy_request_create: "A reçu une demande relative à vos données",
        privacy_request_view: "A ouvert une demande relative à vos données",
        privacy_request_update: "A traité une demande relative à vos données",
        privacy_center_view: "Consulté dans l'espace confidentialité",
        privacy_center_export: "Téléchargé depuis l'espace confidentialité",
        other: "Autre activité",
      },
    },
    requests: {
      intro:
        "Adressez une demande au cabinet. Il doit répondre dans un délai d'un mois, et vous recevrez un accusé de réception daté.",
      type: "Que souhaitez-vous ?",
      types: {
        access: {
          title: "Une copie complète de mes données",
          body: "Tout ce que le cabinet détient, et la manière dont il l'utilise.",
        },
        rectification: {
          title: "Rectifier mes données",
          body: "Indiquez au cabinet ce qui est inexact dans le champ ci-dessous.",
        },
        erasure: {
          title: "Supprimer mes données",
          body: "Ce que le cabinet doit conserver en vertu de la loi, comme le dossier clinique, est conservé mais n'est plus utilisé.",
        },
        restriction: {
          title: "Limiter l'utilisation de mes données",
          body: "Le cabinet les conserve mais ne les utilise pas, par exemple pendant la vérification d'une rectification.",
        },
        objection: {
          title: "M'opposer à l'utilisation de mes données",
          body: "Pour les traitements fondés sur l'intérêt légitime, comme l'historique des rendez-vous manqués.",
        },
        portability: {
          title: "Mes données dans un format portable",
          body: "Les données que vous avez fournies, pour les transmettre à un autre prestataire.",
        },
      },
      to: "Destinataire",
      toPractice: "{practice}",
      toSorriso: "Sorriso, pour les réservations effectuées sur ses pages de recherche",
      details: "Précisions (facultatif)",
      detailsHint: "N'indiquez aucune information de santé, sauf si elle est nécessaire à votre demande.",
      submit: "Envoyer la demande",
      filed: "Demande reçue. Vous recevrez une réponse au plus tard le {date}.",
      duplicate: "Vous avez déjà une demande de ce type en cours. La réponse est attendue au plus tard le {date}.",
      listHeading: "Vos demandes",
      empty: "Aucune demande pour l'instant.",
      received: "Reçue le {date}",
      due: "Réponse attendue au plus tard le {date}",
      closed: "Clôturée le {date}",
      sorriso: "À Sorriso",
      statuses: {
        open: "Reçue",
        in_progress: "En cours",
        extended: "Délai prolongé",
        completed: "Traitée",
        rejected: "Refusée",
      },
      typeLabels: {
        access: "Accès",
        rectification: "Rectification",
        erasure: "Effacement",
        restriction: "Limitation",
        portability: "Portabilité",
        objection: "Opposition",
        consent_withdrawal: "Retrait du consentement",
      },
    },
    download: {
      body: "Un fichier ZIP contenant tout ce que ce cabinet détient pour ce dossier : un résumé lisible, les données en JSON et CSV, et un fichier FHIR que d'autres logiciels de santé peuvent importer.",
      button: "Télécharger (ZIP)",
    },
    errors: {
      generic: "Une erreur s'est produite. Veuillez réessayer.",
      session: "Votre session a pris fin. Reconnectez-vous.",
    },
  },
  linkPage: {
    meta: { title: "Vos choix de confidentialité" },
    title: "Vos choix de confidentialité",
    intro:
      "Pour votre rendez-vous chez {practice}. Les modifications s'appliquent aux messages concernant tous vos rendez-vous dans ce cabinet.",
    choicesHeading: "Consentements facultatifs et messages",
    choicesIntro: "Vous pouvez les retirer ici. Pour réactiver un choix, utilisez l'espace confidentialité.",
    unsubscribe: {
      heading: "Arrêter les messages",
      sms: "Arrêter les SMS",
      email: "Arrêter les e-mails",
      smsDone: "Vous ne recevrez plus de SMS de {practice}.",
      emailDone: "Vous ne recevrez plus d'e-mails de {practice}.",
      warning: "Sans SMS ni e-mail, vous ne recevrez pas de rappels pour vos rendez-vous.",
    },
    full: {
      heading: "Voir toutes vos données",
      body: "Pour consulter tout ce que le cabinet détient, le télécharger ou faire une demande, nous envoyons d'abord un code à usage unique au contact enregistré.",
      choose: "Envoyer le code à",
      send: "Envoyer le code",
      noContact: "Aucun contact n'est enregistré pour l'envoi d'un code. Contactez le cabinet.",
    },
    notice: "Politique de confidentialité de {practice}",
    saved: "Enregistré.",
    asGuardian: "Vous gérez ces choix en tant que parent ou représentant légal de {name}.",
    locked: {
      intro:
        "Ce rendez-vous chez {practice} a été pris pour le patient par une autre personne. Pour protéger la vie privée du patient, ses choix ne peuvent être consultés et modifiés que par lui-même.",
      heading: "Êtes-vous le patient ?",
      stepUp:
        "Nous envoyons un code à usage unique au contact personnel du patient enregistré au dossier. Grâce à ce code, vous pouvez consulter vos données, modifier vos choix et tout télécharger.",
      refused:
        "Seul le patient peut modifier ces choix. Utilisez le code à usage unique envoyé à son contact personnel.",
    },
    invalid:
      "Ce lien n'est pas valide ou a expiré. Vous pouvez toujours utiliser l'<link>espace confidentialité</link>.",
  },
  confirm: {
    meta: { title: "Confirmez votre rendez-vous" },
    title: "Un rendez-vous a été pris pour vous",
    body: "{booker} a pris pour vous un rendez-vous chez {practice} le {when}, via Sorriso.",
    explain:
      "Vous seul pouvez le confirmer et accepter la manière dont Sorriso traite la réservation. Si vous ne le confirmez pas avant le {deadline}, il sera annulé.",
    confirmButton: "Confirmer le rendez-vous",
    declineButton: "L'annuler",
    declineHint:
      "Ce rendez-vous ne vous concerne pas ou n'est pas nécessaire ? Annulez-le et plus rien ne sera fait avec cette réservation.",
    consentRequired: "Veuillez donner votre consentement pour confirmer le rendez-vous.",
    confirmed: "Merci : votre rendez-vous est confirmé.",
    requested: "Merci. Le cabinet va maintenant confirmer le rendez-vous.",
    declined: "Le rendez-vous a été annulé. Plus rien ne sera fait avec cette réservation.",
    notWaiting: "Ce rendez-vous ne nécessite pas votre confirmation.",
    codeHeading: "Commencez par obtenir un code",
    codeIntro: "Pour nous assurer qu'il s'agit bien de vous, nous envoyons un code à usage unique à votre propre contact enregistré.",
    sendCode: "Envoyer le code",
    resend: "Envoyer un nouveau code",
    codeSent: "Nous avons envoyé un code à 6 chiffres à {contact}. Il expire dans 5 minutes.",
    noContact:
      "Aucun contact personnel n'est enregistré pour vous envoyer un code : la réservation ne peut donc pas être confirmée ici. Veuillez contacter le cabinet.",
    neededToConfirm: "Nécessaire pour confirmer",
  },
  unsubscribe: {
    title: "Se désabonner",
    confirm: {
      email: "Ne plus recevoir d'e-mails de {practice} ?",
      sms: "Ne plus recevoir de SMS de {practice} ?",
      whatsapp: "Ne plus recevoir de messages WhatsApp de {practice} ?",
    },
    body: "Vous ne recevrez plus de confirmations ni de rappels de rendez-vous sur ce canal. Vous pouvez les réactiver dans l'espace confidentialité.",
    button: "Se désabonner",
    done: {
      email: "Vous ne recevrez plus d'e-mails de {practice}.",
      sms: "Vous ne recevrez plus de SMS de {practice}.",
      whatsapp: "Vous ne recevrez plus de messages WhatsApp de {practice}.",
    },
    doneBody: "Pour modifier à nouveau vos choix, utilisez l'espace confidentialité : {url}",
    invalid: "Ce lien de désabonnement n'est pas valide. Vous pouvez gérer vos messages dans l'espace confidentialité : {url}",
    rateLimited: "Trop de requêtes. Veuillez réessayer dans quelques minutes.",
  },
} satisfies DeepPartial<Messages["privacy"]>;
