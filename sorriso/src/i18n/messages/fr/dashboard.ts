import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Tableau de bord",
    template: "{page} · {app}",
  },
  skipToContent: "Aller au contenu principal",

  nav: {
    label: "Tableau de bord",
    overview: "Vue d'ensemble",
    calendar: "Agenda",
    confirmations: "Suivi des confirmations",
    messages: "Messagerie",
    patients: "Patientèle",
    duplicates: "Doublons possibles",
    waitlist: "Liste d'attente",
    recalls: "Relances",
    reviews: "Avis",
    analytics: "Statistiques",
    team: "Équipe et horaires",
    services: "Soins",
    locations: "Sites et fauteuils",
    reminders: "Rappels",
    settings: "Paramètres",
    funds: "Fonds de santé",
    api: "API",
    privacyRequests: "Demandes RGPD",
    privacySettings: "Paramètres de confidentialité",
    audit: "Journal d'audit",
    security: "Ma sécurité",
    platform: "Plateforme",
    platformPrivacy: "Boîte RGPD de la plateforme",
    groups: {
      setup: "Configuration",
      privacy: "Confidentialité",
      account: "Compte",
    },
    count: p({ one: "{count} à traiter", other: "{count} à traiter" }),
  },

  sidebar: {
    home: "Vue d'ensemble du tableau de bord",
    publicPage: "Page publique",
    publicPageNewTab: "Votre page publique (s'ouvre dans un nouvel onglet)",
    switchPractice: "Changer de cabinet",
    logout: "Se déconnecter",
    language: "Langue du tableau de bord",
    languageAuto: "Automatique ({language})",
  },

  language: {
    saved: "Langue enregistrée.",
    invalid: "Choisissez l'une des langues proposées.",
  },

  toast: {
    region: "Zone de notifications",
    dismiss: "Fermer",
  },

  form: {
    saved: "Enregistré.",
  },

  notFound: {
    title: "Page introuvable",
    body: "Cette page du tableau de bord n'existe pas ou a été déplacée.",
    back: "Retour à la vue d'ensemble",
  },

  denied:
    "Vous n'avez pas l'autorisation d'ouvrir cette page. Si vous en avez besoin, demandez-la à un titulaire ou à un administrateur du cabinet.",

  overview: {
    title: "Vue d'ensemble",
    greeting: {
      morning: "Bonjour, {name}",
      afternoon: "Bon après-midi, {name}",
      evening: "Bonsoir, {name}",
    },
    subtitle: "{date} · {practice}",
    openCalendar: "Ouvrir l'agenda",
    welcome: {
      title: "Bienvenue ! Quatre étapes pour démarrer",
      team: "Ajoutez vos dentistes et hygiénistes, avec leurs horaires sur chaque site",
      services: "Définissez les soins, leurs durées et leurs prix",
      reminders: "Choisissez quand partent les rappels (SMS, WhatsApp, e-mail)",
      widget: "Intégrez le widget de réservation à votre site",
    },
    stats: {
      today: "Aujourd'hui",
      todayHint: p({ one: "{count} confirmé ou effectué", other: "{count} confirmés ou effectués" }),
      tomorrow: "Confirmés pour demain",
      tomorrowHint: "{confirmed} sur {total} · {open} à relancer",
      noShow: "Taux d'absence (30 jours)",
      noShowHint: "Absences : {noShows} · visites : {visits}",
      online: "Réservations en ligne (7 jours)",
      onlineHint: "Comblés via la liste d'attente (30 jours) : {refilled} · en attente : {waiting}",
      none: "–",
    },
    demo: {
      all: "Mode démo : les e-mails, SMS et messages WhatsApp sont interceptés sur la page Messagerie au lieu d'être envoyés.",
      email: "Mode démo : les e-mails sont interceptés sur la page Messagerie au lieu d'être envoyés.",
      text: "Mode démo : les SMS et messages WhatsApp sont interceptés sur la page Messagerie au lieu d'être envoyés.",
      connect: "Connecter les fournisseurs",
    },
    attention: "Requiert votre attention",
    attentionCount: p({ one: "{count} rendez-vous", other: "{count} rendez-vous" }),
    agenda: "Programme du jour",
    noneToday: "Aucun rendez-vous aujourd'hui.",
    tomorrowLink: "Confirmations de demain",
  },

  confirmations: {
    title: "Suivi des confirmations",
    tabs: {
      label: "Quels rendez-vous",
      tomorrow: "Demain",
      week: "7 prochains jours",
      requests: "Demandes en ligne",
      outcome: "Saisir l'issue",
      cancelled: "Annulés récemment",
    },
    descriptions: {
      tomorrow:
        "Qui vient demain. Relancez ceux qui n'ont pas encore confirmé : les patients ayant déjà manqué des rendez-vous sont signalés.",
      week: "Tout ce qui est réservé pour la semaine à venir.",
      requests: "Réservations en ligne en attente de votre validation (lorsque le cabinet valide les réservations en ligne).",
      outcome:
        "Visites passées sans issue saisie. Marquez-les comme effectuées (ce qui envoie la demande d'avis) ou comme absences.",
      cancelled:
        "Créneaux à venir libérés par des annulations. Ils ont été proposés automatiquement aux patients correspondants de la liste d'attente.",
    },
    onlyPending: "Uniquement en attente de confirmation ({count})",
    riskSorted: "Les visites non confirmées présentant un risque d'absence plus élevé apparaissent en premier chaque jour.",
    empty: "Rien à afficher ici.",
  },

  waitlist: {
    title: "Liste d'attente",
    description:
      "Lorsqu'un rendez-vous est annulé ou déplacé, le créneau est proposé à 3 patients correspondants au maximum, par SMS, WhatsApp ou e-mail. Le premier qui réserve l'obtient.",
    emptyTitle: "Personne n'attend",
    emptyBody: "Les patients peuvent s'inscrire depuis la page de réservation lorsqu'aucun horaire ne leur convient.",
    waiting: "En attente",
    anyPractitioner: "Tous les praticiens",
    anyOffice: "Tous les sites",
    preference: "{practitioner} · {office}",
    window: "{from} – {to}",
    partOfDay: {
      any: "Indifférent",
      morning: "Le matin",
      afternoon: "L'après-midi",
    },
    offers: p({ one: "{count} offre envoyée", other: "{count} offres envoyées" }),
    remove: "Retirer",
    removeConfirm: "Retirer ce patient de la liste d'attente ?",
    note: "Note du patient : {note}",
    restricted: "Dossier restreint : les coordonnées et la note sont masquées.",
    openRecord: "Ouvrir le dossier patient (un motif est requis)",
    booked: "Réservés récemment via la liste d'attente",
    bookedBadge: "Réservé",
  },
} satisfies DeepPartial<Messages["dashboard"]>;
