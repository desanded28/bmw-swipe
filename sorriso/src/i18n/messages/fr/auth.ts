import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    login: "Espace cabinet",
    mfa: "Vérification en deux étapes",
    signup: "Créer votre cabinet",
    reset: "Réinitialiser votre mot de passe",
    resetNew: "Choisir un nouveau mot de passe",
    invite: "Rejoindre un cabinet",
    verify: "Confirmer votre e-mail",
  },
  fields: {
    email: "E-mail",
    password: "Mot de passe",
    name: "Votre nom",
    newPassword: "Nouveau mot de passe",
    confirmPassword: "Répétez le mot de passe",
    passwordHint:
      "Au moins 12 caractères. Une courte phrase est facile à retenir et difficile à deviner.",
    show: "Afficher le mot de passe",
    hide: "Masquer le mot de passe",
  },
  login: {
    title: "Espace cabinet",
    subtitle: "Gérez les agendas, les patients et les rappels.",
    submit: "Se connecter",
    forgot: "Mot de passe oublié ?",
    newPractice: "Nouveau cabinet ?",
    createAccount: "Créer un compte",
    demoTitle: "Comptes de démonstration (mot de passe demo1234)",
    demoOwner: "titulaire, 2 cabinets",
    demoReception: "accueil",
    demoFill: "Remplir avec les identifiants de démonstration",
    notices: {
      noPractice:
        "Votre compte n'est encore membre d'aucun cabinet. Demandez au titulaire du cabinet de vous inviter.",
      passwordChanged: "Votre mot de passe a été modifié. Connectez-vous avec le nouveau.",
      verified: "E-mail confirmé. Vous pouvez maintenant vous connecter.",
      signedOut: "Vous avez été déconnecté.",
      mfaReset: "Reconnectez-vous pour terminer.",
    },
  },
  mfa: {
    title: "Vérification en deux étapes",
    subtitle: "Saisissez le code à 6 chiffres de votre application d'authentification.",
    code: "Code de vérification",
    codeHint: "Vous pouvez aussi saisir l'un de vos codes de récupération.",
    submit: "Vérifier",
    cancel: "Utiliser un autre compte",
    lostDevice:
      "Téléphone perdu ? Utilisez l'un de vos codes de récupération, ou demandez à un titulaire ou à un administrateur de votre cabinet de réinitialiser votre vérification en deux étapes.",
  },
  signup: {
    title: "Créer votre cabinet",
    subtitle:
      "Réservation en ligne, agenda multisite et confirmations par SMS/WhatsApp. Prêt en deux minutes.",
    practiceName: "Nom du cabinet",
    practicePlaceholder: "Cabinet dentaire Rossi",
    address: "Adresse du cabinet",
    addressPlaceholder: "p. ex. Via Roma 1",
    city: "Ville",
    cityPlaceholder: "p. ex. Milano",
    phone: "Téléphone du cabinet",
    phoneHint: "Affiché aux patients et dans les rappels",
    phonePlaceholder: "+39 02 1234 5678",
    isDentist:
      "Je suis aussi dentiste dans ce cabinet (créer mon agenda, du lundi au vendredi 9h–13h / 14h–18h)",
    acceptTerms: "J'accepte les <terms>conditions d'utilisation</terms>.",
    acceptDpa:
      "Au nom du cabinet, j'accepte l'<dpa>accord de traitement des données</dpa> (art. 28 du RGPD) et la liste des <subprocessors>sous-traitants ultérieurs</subprocessors>.",
    submit: "Créer le cabinet",
    haveAccount: "Vous avez déjà un compte ?",
    login: "Se connecter",
    sentTitle: "Consultez votre boîte de réception",
    sentBody:
      "Nous avons envoyé un e-mail à {email}. Ouvrez le lien qu'il contient pour confirmer votre adresse : il est valable 24 heures. Connectez-vous ensuite pour terminer la configuration de votre cabinet.",
    sentNoEmail: "Vous ne l'avez pas reçu ? Vérifiez vos courriers indésirables, ou réessayez dans quelques minutes.",
  },
  starter: {
    room: "Fauteuil {n}",
    firstVisit: "Première consultation dentaire",
    cleaning: "Détartrage professionnel",
    emergency: "Urgence dentaire",
    specialty: "Chirurgien-dentiste généraliste",
    title: "Dr",
  },
  reset: {
    title: "Réinitialiser votre mot de passe",
    subtitle:
      "Saisissez l'e-mail de votre compte et nous vous enverrons un lien pour choisir un nouveau mot de passe.",
    submit: "Envoyer le lien",
    sentTitle: "Consultez votre boîte de réception",
    sentBody:
      "Si un compte existe pour {email}, nous lui avons envoyé un lien pour choisir un nouveau mot de passe. Le lien est valable 30 minutes.",
    back: "Retour à la connexion",
    newTitle: "Choisir un nouveau mot de passe",
    newSubtitle: "Vous serez déconnecté sur tous vos appareils, puis vous pourrez vous connecter avec le nouveau mot de passe.",
    submitNew: "Enregistrer le nouveau mot de passe",
    invalid: "Ce lien n'est pas valide ou a expiré. Demandez-en un nouveau.",
    requestNew: "Demander un nouveau lien",
  },
  verify: {
    title: "Confirmer votre e-mail",
    body: "Confirmez {email} comme adresse e-mail de votre compte Sorriso.",
    bodyPractice:
      "Confirmez {email} comme adresse e-mail de {practice} sur Sorriso. Les réponses des patients et les demandes RGPD arrivent à cette adresse, et la réservation en ligne démarre dès qu'elle est confirmée.",
    submit: "Confirmer mon e-mail",
    submitPractice: "Confirmer cette adresse",
    invalid:
      "Ce lien de confirmation n'est pas valide ou a expiré. Connectez-vous et envoyez-en un nouveau depuis Ma sécurité.",
    login: "Se connecter",
  },
  invite: {
    title: "Rejoindre {practice}",
    body: "{inviter} vous a invité à rejoindre {practice} sur Sorriso en tant que {role}.",
    invalid:
      "Cette invitation n'est pas valide, a expiré ou a déjà été utilisée. Demandez-en une nouvelle au cabinet.",
    existingAccount:
      "Vous avez déjà un compte Sorriso avec cette adresse e-mail. Connectez-vous pour accepter l'invitation.",
    login: "Se connecter pour accepter",
    wrongAccount:
      "Vous êtes connecté avec un autre compte. Déconnectez-vous, puis ouvrez de nouveau le lien d'invitation.",
    logout: "Se déconnecter",
    instructionsLead: "Avant de rejoindre le cabinet, lisez comment il attend que vous traitiez les données des patients.",
    instructionsRequired: "Veuillez confirmer que vous avez lu les instructions.",
    submit: "Rejoindre le cabinet",
    newAccount: "Créer votre compte",
  },
  password: {
    too_short: "Utilisez au moins 12 caractères.",
    too_long: "Utilisez au maximum 128 caractères.",
    common: "Ce mot de passe est trop courant. Choisissez-en un plus difficile à deviner.",
    too_simple: "Ce mot de passe utilise trop peu de caractères différents.",
    contains_personal: "N'utilisez pas votre nom ni votre adresse e-mail dans votre mot de passe.",
    mismatch: "Les deux mots de passe ne correspondent pas.",
  },
  errors: {
    invalidCredentials: "E-mail ou mot de passe incorrect.",
    throttled: "Trop de tentatives. Patientez 15 minutes, puis réessayez.",
    rateLimited: "Trop de requêtes. Veuillez réessayer plus tard.",
    invalidCode: "Ce code n'est pas valide. Vérifiez votre application d'authentification et réessayez.",
    mfaExpired: "Votre connexion a expiré. Veuillez vous reconnecter.",
    termsRequired:
      "Veuillez accepter les conditions d'utilisation et l'accord de traitement des données pour continuer.",
    invalidForm: "Veuillez vérifier les champs signalés.",
    generic: "Une erreur s'est produite. Veuillez réessayer.",
  },
} satisfies DeepPartial<Messages["auth"]>;
