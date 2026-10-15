import type { DeepPartial, Messages } from "../../types";

export default {
  greeting: "Bonjour {name},",
  footer: {
    why: "Vous recevez cet e-mail en raison d'une activité sur votre compte Sorriso.",
    notYou: "Si ce n'était pas vous, changez votre mot de passe et prévenez le titulaire de votre cabinet.",
  },
  verifyEmail: {
    subject: "Confirmez votre adresse e-mail",
    body: "Veuillez confirmer qu'il s'agit bien de votre adresse e-mail pour terminer la configuration de {practice} sur Sorriso. Le lien est valable 24 heures.",
    cta: "Confirmer mon e-mail",
  },
  verifyEmailAgain: {
    subject: "Confirmez votre adresse e-mail",
    body: "Veuillez confirmer qu'il s'agit bien de l'adresse e-mail de votre compte Sorriso. Le lien est valable 24 heures.",
    cta: "Confirmer mon e-mail",
  },
  verifyPracticeEmail: {
    subject: "Confirmez l'adresse e-mail de {practice}",
    body: "{owner} a indiqué cette adresse comme e-mail de {practice} sur Sorriso. Les réponses des patients et les demandes RGPD y seront envoyées, et la réservation en ligne reste suspendue jusqu'à sa confirmation. Le lien est valable 24 heures. Si vous ne connaissez pas ce cabinet, ignorez cet e-mail : rien ne change.",
    cta: "Confirmer cette adresse",
  },
  signupExisting: {
    subject: "Quelqu'un a tenté de créer un compte avec votre e-mail",
    body: "Quelqu'un, peut-être vous, a tenté de créer un nouveau cabinet sur Sorriso avec cette adresse e-mail, qui possède déjà un compte. Si c'était vous, connectez-vous plutôt, ou réinitialisez votre mot de passe si vous l'avez oublié. Si ce n'était pas vous, vous pouvez ignorer cet e-mail : rien n'a été modifié.",
    cta: "Se connecter",
  },
  passwordReset: {
    subject: "Réinitialisez votre mot de passe Sorriso",
    body: "Nous avons reçu une demande de réinitialisation du mot de passe de ce compte. Le lien est valable 30 minutes et ne fonctionne qu'une fois. Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe reste inchangé.",
    cta: "Choisir un nouveau mot de passe",
  },
  passwordChanged: {
    subject: "Votre mot de passe Sorriso a été modifié",
    body: "Le mot de passe de votre compte a été modifié le {when}, et tous les appareils ont été déconnectés. Si ce n'était pas vous, réinitialisez immédiatement votre mot de passe.",
    cta: "Réinitialiser mon mot de passe",
  },
  invite: {
    subject: "{inviter} vous invite à rejoindre {practice} sur Sorriso",
    body: "{inviter} vous a invité à rejoindre {practice} sur Sorriso en tant que {role}. L'invitation est valable 7 jours.",
    cta: "Accepter l'invitation",
  },
  failedLogins: {
    subject: "Tentatives de connexion infructueuses sur votre compte",
    body: "{count} tentatives de connexion infructueuses à votre compte Sorriso ont eu lieu au cours des 15 dernières minutes : les nouvelles tentatives sont donc bloquées pendant un certain temps. Si ce n'était pas vous, pensez à changer votre mot de passe et à activer la vérification en deux étapes.",
    cta: "Vérifier ma sécurité",
  },
  newDevice: {
    subject: "Nouvelle connexion à votre compte Sorriso",
    body: "Une connexion à votre compte a eu lieu depuis un nouvel appareil ({device}) le {when}. Si c'était vous, vous n'avez rien à faire. Sinon, déconnectez cette session et changez immédiatement votre mot de passe.",
    cta: "Vérifier mes appareils",
  },
  apiKeyCreated: {
    subject: "Une nouvelle clé API a été créée pour {practice}",
    body: "{creator} a créé la clé API « {name} » pour {practice} le {when}, avec les accès suivants : {scopes}. Elle expire le {expires}. Les clés API permettent à des logiciels de lire et de modifier des données de patients : si vous ne reconnaissez pas cette clé, révoquez-la dès maintenant.",
    cta: "Vérifier les clés API",
  },
  mfaReset: {
    subject: "Votre vérification en deux étapes a été réinitialisée",
    body: "{actor} a réinitialisé la vérification en deux étapes de votre compte chez {practice} le {when}. Vous avez été déconnecté partout, et vous configurerez une nouvelle application d'authentification lors de votre prochaine connexion.",
    cta: "Se connecter",
  },
} satisfies DeepPartial<Messages["authEmails"]>;
