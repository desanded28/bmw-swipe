/**
 * TEXTE JURIDIQUE. Traduction française établie à partir de l'anglais ; la version italienne fait
 * foi. Brouillon à faire relire par un DPO ou un avocat avant la mise en production
 * (docs/i18n/glossary-fr.md, « Needs lawyer review »).
 */
import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  staffInstructions: {
    title: "Instructions au personnel traitant des données de patients",
    intro:
      "Vous êtes autorisé à traiter les données personnelles des patients, y compris des données de santé, pour le compte du cabinet. Respectez ces instructions dans tous les aspects de votre travail.",
    confidentiality:
      "Gardez confidentiel tout ce que vous apprenez sur les patients, pendant et après votre collaboration avec le cabinet. Ne parlez jamais des patients là où d'autres personnes peuvent vous entendre ou voir.",
    needToKnow:
      "N'ouvrez que les patients et les rendez-vous nécessaires à votre tâche. Votre rôle détermine ce que vous pouvez voir ; ne demandez pas à vos collègues un accès dont vous ne disposez pas.",
    freeText:
      "N'écrivez pas d'informations de santé dans des champs partagés hors du cabinet, comme les messages aux patients, les entrées d'agenda ou les notes transmises à d'autres prestataires. Les détails cliniques ont leur place dans le dossier clinique.",
    breaches:
      "Signalez immédiatement au titulaire du cabinet la perte d'un appareil, un message envoyé à la mauvaise personne ou toute autre violation possible : le cabinet dispose de 72 heures pour la notifier au Garante.",
    personalDevices:
      "Ne copiez, n'exportez ni ne transférez de données de patients vers des appareils personnels, une messagerie électronique ou instantanée personnelle, ou tout service non approuvé par le cabinet.",
    calendarSync:
      "Si vous synchronisez votre planning avec un agenda personnel, conservez le réglage de détail minimal : les horaires uniquement, sans nom de patient ni soin.",
    accessLog:
      "Chaque accès aux données des patients est enregistré dans un journal d'audit que le cabinet peut consulter pour protéger les patients. Ce journal n'est pas utilisé pour évaluer votre performance.",
    adTools:
      "Ne connectez jamais le widget de réservation ou le site du cabinet à des outils publicitaires ou d'analyse d'une manière qui leur indiquerait qui a réservé : le fait qu'une personne ait pris rendez-vous chez un dentiste est une information de santé.",
    restricted:
      "Certains dossiers sont restreints à la demande du patient. N'en ouvrez un que si c'est vraiment nécessaire, et indiquez le motif demandé par le système : chaque accès est enregistré.",
    accept: "J'ai lu ces instructions et je m'engage à les respecter",
    version: "Version {version}",
  },

  common: {
    version: "Version {version}",
    effective: "En vigueur à compter du {date}",
    italianPrevails: "Traduction : en cas de divergence, la version italienne prévaut.",
    print: "Imprimer ou enregistrer en PDF",
    contents: "Sommaire",
    notConfigured: "Non configuré",
    onRequest: "Sur demande",
    platformParty: "{name}, {address} (contact confidentialité : {email})",
    platformPartyShort: "{name} (contact confidentialité : {email})",
    backToTop: "Retour en haut",
  },

  purposes: {
    booking_practice: {
      activity: "Prise de rendez-vous (canaux du cabinet)",
      purpose:
        "Réservation, modification et annulation des rendez-vous demandés via le site du cabinet, son widget de réservation, ses propres liens, le téléphone, l'accueil et les intégrations qu'il choisit.",
    },
    booking_marketplace: {
      activity: "Réservations commencées sur les pages de recherche de Sorriso",
      purpose:
        "Transmission de la réservation au cabinet choisi et gestion de celle-ci, avec le consentement explicite du patient (Sorriso en tant que responsable de traitement autonome).",
    },
    appointment_management: {
      activity: "Agenda et dossiers patients",
      purpose:
        "Gestion de l'agenda, des fauteuils et des praticiens du cabinet, de l'historique des rendez-vous des patients et des notes administratives du cabinet.",
    },
    reminders: {
      activity: "Confirmations et rappels",
      purpose:
        "Envoi des confirmations de réservation, rappels, modifications et annulations par SMS, e-mail ou, lorsque le cabinet l'active et que le patient le choisit, WhatsApp ; traitement des réponses.",
    },
    waitlist: {
      activity: "Liste d'attente",
      purpose: "Proposition des créneaux libérés aux patients ayant demandé à être prévenus d'un rendez-vous plus proche.",
    },
    recalls: {
      activity: "Relances de contrôle",
      purpose: "Relance des patients pour un contrôle lorsque leur dentiste a fixé un intervalle pour eux.",
    },
    feedback_requests: {
      activity: "Invitations à donner un avis",
      purpose: "Invitation des patients qui y ont consenti à donner leur avis après une visite.",
    },
    reviews: {
      activity: "Avis publiés",
      purpose:
        "Publication sur Sorriso des avis de patients vérifiés, avec leur consentement (Sorriso en tant que responsable de traitement autonome).",
    },
    marketing: {
      activity: "Actualités et offres",
      purpose: "Envoi des actualités et des offres du cabinet aux patients qui y ont consenti.",
    },
    no_show_tracking: {
      activity: "Historique des rendez-vous manqués",
      purpose:
        "Comptage des rendez-vous manqués au cours des 24 derniers mois pour organiser le planning et proposer une aide supplémentaire ; jamais pour refuser des soins.",
    },
    adaptive_reminders: {
      activity: "Rappels adaptatifs",
      purpose:
        "Estimation, à partir de l'historique des rendez-vous, des cas où un rappel supplémentaire est utile (profilage sans effet sur l'accès aux soins ; le patient peut s'y opposer).",
    },
    anamnesis: {
      activity: "Anamnèse avant la visite",
      purpose:
        "Recueil du questionnaire médical avant la visite, signé avec un code à usage unique, à l'intention du soignant.",
    },
    partner_api: {
      activity: "Intégrations (API partenaire)",
      purpose:
        "Échange de données de réservation avec les logiciels que le cabinet connecte, comme son logiciel de gestion ou son centre d'appels.",
    },
    directory: {
      activity: "Annuaire des cabinets et des praticiens",
      purpose: "Publication des profils des cabinets et des praticiens qui les ont validés.",
    },
    ranking: {
      activity: "Classement des résultats de recherche",
      purpose: "Classement des résultats de recherche selon des critères neutres expliqués aux utilisateurs.",
    },
    privacy_center: {
      activity: "Espace confidentialité des patients",
      purpose:
        "Permettre aux patients de retrouver leurs dossiers dans les différents cabinets, de les télécharger et d'exercer leurs droits.",
    },
    staff_accounts: {
      activity: "Comptes du personnel",
      purpose: "Gestion des comptes du personnel des cabinets et de leurs droits d'accès.",
    },
    security_logs: {
      activity: "Journal des accès et sécurité",
      purpose:
        "Enregistrement des personnes ayant consulté ou modifié des données de patients, afin de protéger les patients et de détecter les abus. Le personnel en est informé (art. 4 de la loi 300/1970) ; le journal n'est pas utilisé pour évaluer la performance.",
    },
    privacy_requests: {
      activity: "Demandes relatives à la protection des données",
      purpose:
        "Réception des demandes d'exercice des droits en matière de protection des données et réponse dans les délais légaux.",
    },
  },

  legalBases: {
    art6_1_a: "Consentement (art. 6, par. 1, point a) du RGPD)",
    art6_1_b: "Contrat ou mesures précontractuelles (art. 6, par. 1, point b))",
    art6_1_c: "Obligation légale (art. 6, par. 1, point c))",
    art6_1_f: "Intérêt légitime (art. 6, par. 1, point f))",
    art9_2_a: "Consentement explicite au traitement de données de santé (art. 9, par. 2, point a))",
    art9_2_f: "Constatation ou défense de droits en justice (art. 9, par. 2, point f))",
    art9_2_h: "Soins de santé sous secret professionnel (art. 9, par. 2, point h) et par. 3)",
  },

  dataCategories: {
    identity: "données d'identification (nom, date de naissance)",
    contact: "coordonnées (téléphone, e-mail)",
    appointment: "données de rendez-vous (date, heure, cabinet, praticien)",
    health_inferred: "données susceptibles de révéler l'état de santé (fait de recevoir des soins dentaires, type de soin)",
    health: "données de santé (notes, antécédents médicaux)",
    minor: "données de mineurs",
    guardian: "données des parents et représentants légaux",
    message_content: "contenu des messages",
    consent_record: "historique des consentements",
    review: "avis",
    professional: "données professionnelles des praticiens",
    account: "données de compte",
    technical: "données techniques (adresse IP pseudonymisée, navigateur)",
    aggregated_metrics: "statistiques agrégées",
  },

  subjects: {
    patients: "patients",
    guardians: "parents et représentants légaux",
    bookers: "personnes réservant pour autrui",
    practitioners: "praticiens",
    staff: "personnel des cabinets",
    reviewers: "auteurs d'avis",
  },

  transferTools: {
    eu: "Aucun transfert : prestataire UE/EEE",
    dpf: "Cadre de protection des données UE-États-Unis (Data Privacy Framework, art. 45 du RGPD)",
    scc: "Clauses contractuelles types (art. 46, par. 2, point c) du RGPD)",
    dpf_scc:
      "Cadre de protection des données UE-États-Unis (Data Privacy Framework), avec les clauses contractuelles types à titre subsidiaire",
  },

  units: {
    months: p({ one: "{count} mois", many: "{count} de mois", other: "{count} mois" }),
    days: p({ one: "{count} jour", many: "{count} de jours", other: "{count} jours" }),
    hours: p({ one: "{count} heure", many: "{count} d'heures", other: "{count} heures" }),
  },

  retention: {
    patientInactiveMonths:
      "Dossier patient : {period} après la dernière visite, puis limité ou pseudonymisé selon le choix du cabinet (plus longtemps lorsque le dossier clinique doit être conservé).",
    neverSeenPatientMonths: "Dossiers des personnes n'ayant jamais eu de rendez-vous : {period}.",
    messageBodyMonths: "Texte des messages : {period}.",
    messageMetaMonths: "Historique des messages (destinataire, date, statut) : {period}.",
    reminderDays: "Rappels programmés : {period} après le rendez-vous.",
    waitlistDays:
      "Inscriptions sur la liste d'attente : {period} après leur dernière date utile ; celles qui sont clôturées après 30 jours.",
    patientNoteDays: "Note de réservation du patient et motif d'annulation : {period} après la visite.",
    auditMonths: "Journal des accès : {period}.",
    providerMessageDays: "Copies conservées par le prestataire de messagerie : {period}.",
    formSubmissionMonths: "Questionnaires médicaux, une fois copiés dans le dossier clinique : {period}.",
    consentMonths: "Historique des consentements des patients qui ne figurent plus au fichier : {period}.",
    privacyRequestMonths: "Demandes clôturées : {period}.",
    marketingLapse: "Le consentement aux actualités et aux offres expire après 24 mois sans contact.",
    contract: "Pendant toute la durée de fourniture du service, puis pendant le délai de prescription.",
  },

  register: {
    title: "Registre des activités de traitement",
    intro:
      "Art. 30, par. 1 du RGPD. Généré à partir de ce que Sorriso fait pour le cabinet et de ses paramètres actuels ; ajoutez les activités que vous exercez en dehors de Sorriso. Tenez-le à jour et présentez-le au Garante sur demande.",
    controller: "Responsable du traitement",
    vat: "Numéro de TVA",
    address: "Siège social",
    contact: "Contact confidentialité",
    dpo: "Délégué à la protection des données",
    none: "—",
    generated: "Généré le {date}",
    columns: {
      activity: "Activité de traitement",
      purpose: "Finalité",
      legalBasis: "Base juridique",
      subjects: "Personnes concernées",
      dataCategories: "Catégories de données personnelles",
      recipients: "Destinataires",
      transfers: "Transferts hors de l'UE",
      retention: "Délais d'effacement",
      security: "Mesures de sécurité",
    },
    recipient: "{name} ({service})",
    processor: "Sorriso, en tant que sous-traitant en vertu de l'accord de traitement",
    transfer: "{name} : {tool}",
    noTransfers: "Aucun",
    security: {
      platform:
        "Chiffrement au niveau des champs des notes et des messages ; accès selon les rôles ; journal des accès infalsifiable ; conservation automatisée ; sauvegardes chiffrées dans l'UE ; personnel formé et tenu à la confidentialité.",
      mfaRequired: "Connexion en deux étapes obligatoire pour tout le personnel.",
      mfaOptional: "Connexion en deux étapes disponible mais non obligatoire.",
      sessions: p({ one: "Les sessions expirent après {count} heure.", other: "Les sessions expirent après {count} heures." }),
      discreet: "Les messages ne mentionnent jamais le soin.",
      detailed: "Les messages peuvent mentionner le soin (choix du cabinet).",
    },
  },

  controls: {
    encryption: {
      title: "Chiffrement des champs sensibles",
      body: "Les notes, les textes des messages, les réponses aux questionnaires médicaux et les autres textes libres sont chiffrés dans la base de données en AES-256-GCM, avec des clés conservées en dehors de la base.",
    },
    transport: {
      title: "Chiffrement des communications",
      body: "Toutes les connexions utilisent TLS ; les navigateurs sont tenus d'utiliser exclusivement HTTPS et les pages appliquent une politique de sécurité du contenu stricte.",
    },
    access_control: {
      title: "Accès selon les rôles",
      body: "Chaque rôle du personnel ne voit que ce dont il a besoin : l'accueil n'a pas accès aux notes cliniques ; les exports, l'effacement et les paramètres sont réservés aux titulaires et aux administrateurs.",
    },
    mfa: {
      title: "Connexion en deux étapes",
      body: "Le personnel se connecte avec un mot de passe et un code d'application d'authentification ; les opérations sensibles redemandent le code.",
    },
    sessions: {
      title: "Limites de session",
      body: "Les sessions expirent après une durée fixée par le cabinet et après une période d'inactivité ; le personnel peut les révoquer.",
    },
    audit_log: {
      title: "Journal des accès infalsifiable",
      body: "Chaque accès aux données des patients et chaque modification sont enregistrés dans un journal chaîné par hachage que le cabinet peut vérifier et exporter ; les têtes de chaîne sont conservées en dehors de la base de données.",
    },
    pseudonymous_logs: {
      title: "Journaux sans données personnelles",
      body: "Les journaux applicatifs masquent les numéros de téléphone et les adresses e-mail ; les adresses IP ne sont conservées que sous forme d'empreintes chiffrées à clé.",
    },
    rate_limiting: {
      title: "Protection contre les abus",
      body: "La connexion, les codes à usage unique et les points d'accès publics de réservation sont soumis à une limitation du nombre de requêtes.",
    },
    links: {
      title: "Liens patients à durée limitée",
      body: "Les liens figurant dans les messages contiennent des jetons aléatoires, conservés uniquement sous forme d'empreintes, qui expirent après la visite.",
    },
    otp: {
      title: "Codes à usage unique",
      body: "Les codes sont conservés uniquement sous forme d'empreintes, expirent au bout de 5 minutes et sont bloqués après plusieurs tentatives erronées.",
    },
    discreet_messages: {
      title: "Messages discrets",
      body: "Par défaut, les SMS, les messages WhatsApp, les objets des e-mails et les entrées d'agenda ne mentionnent jamais le soin, la spécialité ni les notes.",
    },
    retention: {
      title: "Conservation automatisée",
      body: "Une tâche quotidienne supprime, caviarde ou pseudonymise les données à l'expiration de leur durée de conservation.",
    },
    erasure: {
      title: "Effacement et limitation",
      body: "Les cabinets peuvent exporter, pseudonymiser ou restreindre un patient en une seule étape ; les dossiers restreints exigent un motif pour chaque accès.",
    },
    backups: {
      title: "Sauvegardes",
      body: "Des sauvegardes chiffrées à un instant donné sont conservées dans l'UE pendant une durée limitée, puis écrasées.",
    },
    key_rotation: {
      title: "Gestion des clés",
      body: "Les clés de chiffrement peuvent être renouvelées sans interruption de service ; les anciennes clés servent uniquement au déchiffrement.",
    },
    no_trackers: {
      title: "Aucun traceur tiers",
      body: "Les pages de Sorriso ne chargent aucun script, police, pixel ni cookie publicitaire tiers ; ce point est vérifié automatiquement.",
    },
    staff_instructions: {
      title: "Personnel formé",
      body: "Chaque membre du personnel accepte des instructions écrites en matière de protection des données avant de travailler avec des données de patients ; les acceptations sont enregistrées.",
    },
    breach_procedure: {
      title: "Procédure en cas de violation",
      body: "Une procédure documentée pour évaluer, contenir et notifier les violations de données personnelles, avec notification au cabinet dans les 24 heures.",
    },
  },

  subprocessors: {
    title: "Sous-traitants ultérieurs",
    description:
      "Les prestataires auxquels Sorriso fait appel pour traiter les données des cabinets, le lieu de traitement et les garanties encadrant les transferts.",
    intro:
      "Lorsqu'un cabinet utilise Sorriso, Sorriso traite les données des patients pour le compte du cabinet en tant que sous-traitant (art. 28 du RGPD). Sorriso fait appel aux prestataires ci-dessous. Chacun est lié par un accord de traitement des données comportant des obligations au moins aussi strictes que celles de l'accord de traitement de Sorriso.",
    noticeRule:
      "Sorriso informe les cabinets de tout ajout ou remplacement d'un sous-traitant ultérieur au moins 30 jours avant le changement, par e-mail et dans le tableau de bord. Un cabinet peut s'y opposer pendant ce délai ; si aucune solution n'est trouvée, il peut résilier le contrat sans pénalité avant que le changement ne s'applique.",
    transfersNote:
      "Un prestataire dont la société mère est établie aux États-Unis peut être contraint de donner accès aux données même lorsque ses serveurs se trouvent dans l'UE. Ces transferts reposent sur le cadre de protection des données UE-États-Unis (Data Privacy Framework), avec les clauses contractuelles types à titre subsidiaire, et font l'objet d'une analyse d'impact des transferts.",
    columns: {
      name: "Prestataire",
      entity: "Entité juridique",
      service: "Service",
      data: "Données",
      region: "Lieu",
      transfer: "Garantie de transfert",
      dpa: "Accord",
    },
    onlyWhatsapp: "Uniquement pour les cabinets qui activent WhatsApp, et uniquement pour les patients qui le choisissent.",
    parent: "Société mère : {parent}",
    viewDpa: "Accord de traitement du prestataire",
    service: {
      hosting: "Hébergement de l'application",
      database: "Base de données",
      sms: "SMS",
      whatsapp: "Messages WhatsApp",
      email: "Envoi d'e-mails",
      backups: "Sauvegardes",
    },
    data: {
      all_platform_data: "toutes les données stockées dans Sorriso",
      contact: "coordonnées",
      message_content: "contenu des messages",
      message_metadata: "métadonnées des messages",
      technical: "données techniques",
    },
    changelog: "Historique des modifications",
    change: {
      initial: "Première liste publiée.",
      added: "Ajout de {name}.",
      removed: "Retrait de {name}.",
      changed: "Modification des informations relatives à {name}.",
    },
    announced: "Annoncé le {date}",
  },

  dpa: {
    title: "Accord de traitement des données",
    description:
      "L'accord prévu à l'art. 28 du RGPD entre chaque cabinet (responsable du traitement) et Sorriso (sous-traitant).",
    intro:
      "Le présent accord fait partie intégrante des conditions d'utilisation. Il s'applique chaque fois que Sorriso traite des données personnelles pour le compte d'un cabinet. Le cabinet l'accepte dans le tableau de bord ; l'acceptation est enregistrée avec sa version, sa date et sa langue.",
    parties: {
      title: "1. Parties et rôles",
      body: "Responsable du traitement : le cabinet qui utilise Sorriso. Sous-traitant : {platform}.\n\nLe Responsable du traitement détermine les finalités et les moyens du traitement des données des patients pour les réservations qu'il reçoit par ses propres canaux : son site et son widget de réservation, ses propres liens, le téléphone et l'accueil, et les intégrations qu'il connecte. Sorriso traite ces données uniquement en tant que sous-traitant du Responsable du traitement.",
    },
    subject: {
      title: "2. Objet, durée, nature et finalité",
      body: "Objet : le service de réservation en ligne, de rappels, de liste d'attente, de relances et de gestion des patients décrit dans les conditions d'utilisation.\n\nDurée : tant que le compte du cabinet existe, puis jusqu'à la suppression ou la restitution des données conformément à l'article 11.\n\nNature et finalité, types de données et catégories de personnes concernées : tels que décrits à l'annexe I, générée à partir des traitements effectivement réalisés par Sorriso.",
    },
    instructions: {
      title: "3. Instructions documentées (art. 28, par. 3, point a))",
      body: "Sorriso ne traite les données personnelles que sur instruction documentée du Responsable du traitement : le présent accord, les conditions d'utilisation, les paramètres définis par le Responsable du traitement dans le tableau de bord et les opérations effectuées par son personnel. Cela inclut les transferts vers des pays tiers, qui n'ont lieu que dans les conditions décrites à l'annexe III.\n\nLe Responsable du traitement charge Sorriso d'envoyer des invitations à donner un avis aux patients qui y ont consenti, et d'appliquer les durées de conservation définies dans le tableau de bord.\n\nSi le droit de l'Union ou le droit italien impose à Sorriso de traiter les données autrement, Sorriso en informe le Responsable du traitement avant le traitement, sauf si la loi l'interdit. Sorriso informe immédiatement le Responsable du traitement si, selon lui, une instruction constitue une violation du droit de la protection des données.",
    },
    confidentiality: {
      title: "4. Confidentialité (art. 28, par. 3, point b))",
      body: "Sorriso veille à ce que les personnes qu'il autorise à traiter les données soient tenues à la confidentialité, reçoivent des instructions en matière de protection des données et n'accèdent aux données que dans la mesure nécessaire à leur mission. Le personnel de Sorriso n'accède jamais aux dossiers des patients, sauf pour fournir une assistance demandée par le Responsable du traitement, pour assurer la sécurité du service ou lorsque la loi l'exige ; ces accès sont journalisés.",
    },
    security: {
      title: "5. Sécurité (art. 28, par. 3, point c) et art. 32)",
      body: "Sorriso met en œuvre les mesures techniques et organisationnelles décrites à l'annexe II, compte tenu de l'état des connaissances, des coûts et des risques pour les patients, notamment parce que les données peuvent révéler des informations de santé. Sorriso réexamine régulièrement ces mesures et ne réduit pas le niveau global de protection.",
    },
    subprocessors: {
      title: "6. Sous-traitants ultérieurs (art. 28, par. 2 et 4)",
      body: "Le Responsable du traitement donne à Sorriso une autorisation générale de recourir aux sous-traitants ultérieurs listés à l'annexe III et sur la page publique des sous-traitants ultérieurs. Sorriso informe le Responsable du traitement de tout ajout ou remplacement envisagé au moins 30 jours à l'avance, par e-mail et dans le tableau de bord. Le Responsable du traitement peut s'y opposer pendant ce délai pour des motifs raisonnables liés à la protection des données ; si aucune solution n'est trouvée, il peut résilier le service concerné sans pénalité avant que le changement ne s'applique.\n\nSorriso impose contractuellement à chaque sous-traitant ultérieur les mêmes obligations en matière de protection des données que celles du présent accord, et demeure pleinement responsable envers le Responsable du traitement de leur exécution.",
    },
    rights: {
      title: "7. Droits des personnes concernées (art. 28, par. 3, point e))",
      body: "Sorriso aide le Responsable du traitement à répondre aux demandes d'exercice des droits prévus au chapitre III du RGPD grâce aux outils du tableau de bord : la boîte de réception des demandes avec leurs échéances, l'export en JSON, CSV et FHIR, la rectification, la limitation et l'effacement par pseudonymisation.\n\nSi une demande portant sur un traitement du Responsable du traitement parvient à Sorriso, Sorriso la transmet au Responsable du traitement dans un délai de 2 jours ouvrables et n'y répond pas à sa place, si ce n'est pour indiquer au demandeur qu'elle a été transmise.",
    },
    assistance: {
      title: "8. Assistance au Responsable du traitement (art. 28, par. 3, point f))",
      body: "Compte tenu de la nature du traitement et des informations dont il dispose, Sorriso aide le Responsable du traitement à respecter ses obligations en matière de sécurité (art. 32), de notification et de communication des violations (art. 33-34), d'analyse d'impact relative à la protection des données et de consultation préalable (art. 35-36). Sorriso met à disposition sa propre analyse d'impact de la plateforme et son analyse d'impact des transferts.",
    },
    breach: {
      title: "9. Violations de données personnelles",
      body: "Sorriso notifie au Responsable du traitement toute violation de données personnelles affectant ses données dans les meilleurs délais et en tout état de cause dans les 24 heures après en avoir pris connaissance. La notification décrit, dans la mesure où ils sont connus, la nature de la violation, les catégories et le nombre approximatif de patients et d'enregistrements concernés, les conséquences probables et les mesures prises ou proposées. Sorriso complète ces informations au fur et à mesure qu'elles deviennent disponibles, afin que le Responsable du traitement puisse notifier le Garante dans les 72 heures et, le cas échéant, informer les patients.",
    },
    audits: {
      title: "10. Informations et audits (art. 28, par. 3, point h))",
      body: "Sorriso met à la disposition du Responsable du traitement toutes les informations nécessaires pour démontrer le respect de l'art. 28 : le présent accord, le registre des traitements, les mesures de sécurité, les certifications ou rapports d'audit lorsqu'ils existent, et le journal des accès dans le tableau de bord. Sorriso permet la réalisation d'audits et d'inspections par le Responsable du traitement ou par un auditeur qu'il mandate, tenu à la confidentialité, moyennant un préavis d'au moins 30 jours, pendant les heures ouvrables et sans perturber le service ; les audits sont à la charge du Responsable du traitement, sauf s'ils révèlent un manquement important.",
    },
    deletion: {
      title: "11. Restitution et suppression en fin de contrat (art. 28, par. 3, point g))",
      body: "Le Responsable du traitement peut télécharger toutes ses données à tout moment, dans des formats documentés (JSON, CSV et FHIR R4), sans frais. Lorsque le Responsable du traitement ferme son compte, la réservation en ligne s'arrête immédiatement, les données restent disponibles au téléchargement pendant 60 jours (une transition de 30 jours et au moins 30 jours pour les récupérer), puis sont supprimées des systèmes de Sorriso. Sorriso délivre une attestation de suppression indiquant ce qui a été supprimé et à quelle date. Les sauvegardes chiffrées sont écrasées au terme de leur durée de conservation et ne sont restaurées que pour se remettre d'un incident. Sorriso ne conserve les données plus longtemps que lorsque le droit de l'Union ou le droit italien l'exige, et uniquement à cette fin.",
    },
    transfers: {
      title: "12. Transferts hors de l'UE",
      body: "Les données sont hébergées dans l'UE. Certains sous-traitants ultérieurs appartiennent à des groupes établis aux États-Unis ; les garanties applicables à chacun de ces transferts sont listées à l'annexe III, et leur impact a été évalué. Sorriso ne transfère pas les données du Responsable du traitement vers un autre pays tiers sans en informer préalablement le Responsable du traitement conformément à l'article 6.",
    },
    ownPurposes: {
      title: "13. Traitements dont Sorriso est responsable",
      body: "Pour certaines activités, Sorriso est responsable de traitement autonome, et non sous-traitant du Responsable du traitement, et l'indique aux patients dans sa propre politique de confidentialité : les réservations commencées sur les pages de recherche de Sorriso (avec le consentement explicite du patient), les avis publiés, l'annuaire et le classement des résultats de recherche, l'espace confidentialité des patients et les comptes du personnel. Sorriso n'utilise pas les données qu'il traite pour le Responsable du traitement à d'autres fins qui lui seraient propres, et ne les vend jamais ni ne les utilise à des fins publicitaires.",
    },
    controller: {
      title: "14. Obligations du Responsable du traitement",
      body: "Le Responsable du traitement veille à disposer d'une base juridique pour le traitement, fournit aux patients sa politique de confidentialité (Sorriso en génère une à partir des paramètres du cabinet), donne des instructions à son personnel et tient à jour ses paramètres, ses durées de conservation et son registre des traitements. Le Responsable du traitement ne connecte pas le widget de réservation ni les pages de Sorriso à des outils publicitaires ou d'analyse d'une manière qui leur indiquerait qui a réservé.",
    },
    liability: {
      title: "15. Responsabilité et durée",
      body: "Chaque partie est responsable dans les conditions prévues à l'art. 82 du RGPD et dans les conditions d'utilisation. Le présent accord s'applique aussi longtemps que Sorriso traite des données personnelles pour le Responsable du traitement. En cas de contradiction avec les conditions d'utilisation en matière de protection des données, le présent accord prévaut.",
    },
    law: {
      title: "16. Droit applicable",
      body: "Le présent accord est régi par le droit italien. Les litiges relèvent de la juridiction prévue dans les conditions d'utilisation.",
    },
    annex1: {
      title: "Annexe I — Description du traitement",
      intro: "Les traitements que Sorriso réalise en tant que sous-traitant, générés à partir du registre des finalités de la plateforme.",
    },
    annex2: {
      title: "Annexe II — Mesures techniques et organisationnelles",
      intro: "Les mesures en place à ce jour. Cette liste est générée à partir des contrôles mis en œuvre dans la plateforme.",
    },
    annex3: {
      title: "Annexe III — Sous-traitants ultérieurs",
      intro: "La liste en vigueur (version {version}). La page publique conserve l'historique des modifications.",
    },
  },

  terms: {
    title: "Conditions d'utilisation pour les cabinets",
    description: "Le contrat entre Sorriso et les cabinets dentaires qui l'utilisent.",
    intro:
      "Les présentes conditions régissent l'utilisation de Sorriso par les cabinets dentaires (« le cabinet ») et sont conclues avec {platform}. Le cabinet les accepte dans le tableau de bord ; l'acceptation est enregistrée avec sa version, sa date et sa langue.",
    service: {
      title: "1. Le service",
      body: "Sorriso fournit la réservation en ligne pour le site du cabinet et pour les pages de recherche de Sorriso, un agenda pour les praticiens, les fauteuils et les sites, des confirmations et des rappels, une liste d'attente, des relances, des dossiers patients à usage administratif et des outils permettant de respecter les obligations en matière de protection des données. Sorriso n'est pas un prestataire de soins de santé et ne donne pas d'avis médical.",
    },
    account: {
      title: "2. Comptes et personnel",
      body: "Le cabinet désigne un titulaire qui gère son compte et invite le personnel en lui attribuant un rôle. Le cabinet est responsable de l'utilisation du service par son personnel, garde confidentiels les identifiants de connexion et active la connexion en deux étapes. Chaque membre du personnel doit accepter les instructions en matière de protection des données avant de travailler avec des données de patients.",
    },
    data: {
      title: "3. Protection des données",
      body: "Pour les données des patients qui réservent par les propres canaux du cabinet, le cabinet est responsable du traitement et Sorriso son sous-traitant : l'accord de traitement des données s'applique et fait partie intégrante des présentes conditions. Pour les réservations commencées sur les pages de recherche de Sorriso, les avis, l'annuaire et l'espace confidentialité, Sorriso est responsable de traitement autonome, comme l'explique sa politique de confidentialité.",
    },
    obligations: {
      title: "4. Obligations du cabinet",
      body: "Le cabinet fournit des informations exactes sur ses soins, ses prix, ses praticiens et ses disponibilités ; honore les réservations qu'il accepte ; n'utilise les données des patients qu'à des fins de soins et d'administration ; et n'utilise pas Sorriso pour envoyer des communications non sollicitées.",
    },
    marketplace: {
      title: "5. Recherche, classement et avis",
      body: "Les cabinets n'apparaissent dans la recherche de Sorriso que s'ils y sont référencés et avec des praticiens qui ont validé leur profil. Le classement repose sur des critères neutres publiés sur la page consacrée au classement ; aucun paiement n'influence la position. Seuls les patients ayant effectué une visite peuvent laisser un avis, et les cabinets ne peuvent pas supprimer les avis : ils peuvent répondre à un avis et le signaler, Sorriso statuant alors par une décision motivée susceptible d'un recours.",
    },
    availability: {
      title: "6. Disponibilité et assistance",
      body: "Sorriso met en œuvre une diligence raisonnable pour maintenir le service disponible et sécurisé et annonce à l'avance les opérations de maintenance programmées. L'assistance est disponible par e-mail les jours ouvrables.",
    },
    fees: {
      title: "7. Tarifs",
      body: "Les tarifs éventuels sont ceux de la formule choisie par le cabinet, affichés dans le tableau de bord. Sorriso annonce les changements de prix au moins 30 jours à l'avance. Les exports et le passage à un autre prestataire sont gratuits.",
    },
    ip: {
      title: "8. Propriété intellectuelle",
      body: "Le cabinet conserve tous les droits sur ses contenus et ses données. Sorriso conserve tous les droits sur le logiciel. Le cabinet accorde à Sorriso le droit d'afficher son profil public et ses contenus pour les besoins du service.",
    },
    suspension: {
      title: "9. Suspension",
      body: "Sorriso ne peut suspendre un compte qu'en cas de manquement grave aux présentes conditions, de risque pour la sécurité ou d'obligation légale, en communiquant au cabinet les motifs par écrit au préalable lorsque c'est possible, et au plus tard au moment où la suspension prend effet. Le cabinet peut contester la décision via la procédure de réclamation.",
    },
    exit: {
      title: "10. Résiliation, changement de prestataire et récupération des données",
      body: "Le cabinet peut fermer son compte à tout moment depuis le tableau de bord, sans préavis. La réservation en ligne s'arrête immédiatement ; le cabinet conserve l'accès pendant une transition de 30 jours et au moins 30 jours supplémentaires pour récupérer gratuitement ses données en JSON, CSV et FHIR, et Sorriso l'aide à passer à un autre prestataire. Les données sont ensuite supprimées et une attestation de suppression est délivrée. Sorriso peut mettre fin au contrat moyennant un préavis de deux mois, ou immédiatement en cas de manquement grave.",
    },
    liability: {
      title: "11. Responsabilité",
      body: "Aucune des parties n'exclut sa responsabilité en cas de faute intentionnelle ou de faute lourde, ni lorsque la loi ne le permet pas. Pour le reste, la responsabilité de chaque partie est limitée aux dommages directs prévisibles. Sorriso n'est pas responsable des prestations cliniques du cabinet.",
    },
    complaints: {
      title: "12. Réclamations et médiation",
      body: "Le cabinet peut adresser ses réclamations à Sorriso via le tableau de bord ou par e-mail ; Sorriso y répond dans un délai de 15 jours ouvrables. Sorriso accepte de recourir à la médiation pour régler les litiges à l'amiable, conformément au règlement (UE) 2019/1150.",
    },
    changes: {
      title: "13. Modifications des présentes conditions",
      body: "Sorriso annonce les modifications au moins 30 jours à l'avance par e-mail et dans le tableau de bord, sauf si une loi impose une modification plus rapide. Si le cabinet n'est pas d'accord, il peut résilier le contrat sans frais avant que la modification ne s'applique.",
    },
    law: {
      title: "14. Droit applicable et juridiction compétente",
      body: "Les présentes conditions sont régies par le droit italien. Les tribunaux du siège social de Sorriso sont compétents, sous réserve des dispositions impératives.",
    },
  },

  docs: {
    dpa: "Accord de traitement des données",
    terms: "Conditions d'utilisation",
    subprocessors: "Sous-traitants ultérieurs",
    staff_instructions: "Instructions au personnel",
  },
} satisfies DeepPartial<Messages["legalPractice"]>;
