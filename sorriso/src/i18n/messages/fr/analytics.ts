import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  title: "Statistiques",
  description:
    "Calculées sur nos serveurs à partir des données de votre cabinet à l'ouverture de cette page. Sans cookies ni suivi.",
  range: {
    label: "Période",
    months: p({ one: "Dernier mois", other: "{count} derniers mois" }),
    window: "{from} – {to}",
  },
  export: "Télécharger le CSV",
  exportHint: "Les mêmes chiffres que sur cette page, pour un tableur.",
  dimension: {
    label: "Ventiler par",
    service: "Soin",
    practitioner: "Praticien",
    weekday: "Jour de la semaine",
    partOfDay: "Moment de la journée",
  },
  showTable: "Afficher sous forme de tableau",
  noData: "Pas encore assez de données sur cette période.",
  none: "–",

  kpi: {
    noShow: "Taux d'absence",
    noShowHint: "{noShows} absences sur {visits} visites",
    lateCancel: "Annulations tardives",
    lateCancelHint: "Annulés par le patient moins de {hours} heures avant",
    confirmation: "Confirmés après un rappel",
    confirmationHint: "{confirmed} sur {sent} rappels demandant une confirmation",
    waitlist: "Taux de remplissage par la liste d'attente",
    waitlistHint: "{booked} réservées sur {closed} inscriptions clôturées",
    recalls: "Conversion des relances",
    recallsHint: "{booked} réservés sur {contacted} patients relancés",
    leadTime: "Délai médian de réservation",
    leadTimeValue: p({ one: "{count} jour", other: "{count} jours" }),
    leadTimeHint: p({ one: "Sur {count} réservation", other: "Sur {count} réservations" }),
  },

  sections: {
    outcomesTotal: "Présence",
    attendance: "Présence aux rendez-vous",
    attendanceHint:
      "Taux d'absence : absences rapportées aux visites qui ont eu lieu ou ont été manquées. Annulations tardives : annulations par le patient dans le délai d'annulation du cabinet, rapportées aux mêmes visites plus ces annulations.",
    byService: "Par soin",
    byPractitioner: "Par praticien",
    byWeekday: "Par jour de la semaine",
    byPartOfDay: "Par moment de la journée",
    noShowChart: "Taux d'absence",
    lateCancelChart: "Taux d'annulation tardive",
    confirmation: "Confirmations",
    confirmationHint:
      "Chaque confirmation est attribuée au dernier rappel envoyé avant elle. Les confirmations recueillies par l'accueil ou à la réservation ne sont pas comptées.",
    confirmationByChannel: "Taux de confirmation par canal",
    confirmationByOffset: "Taux de confirmation selon le moment du rappel",
    waitlist: "Liste d'attente",
    waitlistDetail:
      "{entries} inscriptions · {booked} réservées · {removed} retirées · {expired} expirées · {waiting} toujours en attente",
    recalls: "Relances",
    recallsDetail: "{due} relances arrivées à échéance · {contacted} patients contactés · {booked} réservés",
    bookings: "Réservations",
    leadTime: "Combien de temps à l'avance les patients réservent",
    newBySource: "Nouveaux patients par canal de réservation",
    newByContext: "Nouveaux patients : canaux du cabinet ou Sorriso",
    reviews: "Avis publiés",
    reviewsHint: "Seuls les avis publiés sur votre profil sont comptés.",
    reviewsSummary: p({ one: "{count} avis, moyenne {average}", other: "{count} avis, moyenne {average}" }),
    funnel: "Entonnoir de la place de marché",
    funnelHint:
      "Apparitions dans les résultats de recherche de Sorriso et consultations des profils de vos praticiens, comparées aux réservations commencées sur Sorriso.",
    ranking: "Vos critères de classement",
    rankingHint:
      "Ce que le classement de la place de marché Sorriso sait aujourd'hui de chaque praticien, et le score obtenu sans critère propre à une recherche (distance, ville, langue, fonds de santé). Personne ne peut payer pour être mieux classé.",
    rankingLink: "Comment fonctionne le classement",
  },

  measures: {
    noShowRate: "Taux d'absence (%)",
    lateCancelRate: "Taux d'annulation tardive (%)",
    confirmationRate: "Taux de confirmation (%)",
    fillRate: "Taux de remplissage (%)",
    entries: "Inscriptions",
    recallConversion: "Conversion des relances (%)",
    recallsDue: "Relances à échéance",
    medianDays: "Délai médian (jours)",
    bookings: "Réservations",
    newPatients: "Nouveaux patients",
    reviews: "Avis",
    averageRating: "Note moyenne",
    impressions: "Apparitions dans la recherche",
    profileViews: "Consultations du profil",
    marketplaceBookings: "Réservations sur Sorriso",
    bookingRate: "Réservations par consultation du profil (%)",
    score: "Score de classement (0-100)",
    staffCancelRate: "Annulés par le cabinet, 180 jours (%)",
    completeness: "Complétude du profil (%)",
  },

  table: {
    item: "Élément",
    visits: "Visites",
    noShows: "Absences",
    lateCancels: "Annulations tardives",
    noShowRate: "Taux d'absence",
    lateCancelRate: "Taux d'annulation tardive",
    sent: "Rappels envoyés",
    confirmed: "Confirmés",
    rate: "Taux",
    count: "Nombre",
    month: "Mois",
    average: "Note moyenne",
  },

  partsOfDay: {
    morning: "Matin (avant 13:00)",
    afternoon: "Après-midi (13:00–18:00)",
    evening: "Soir (à partir de 18:00)",
  },

  offsets: {
    h3: "Jusqu'à 3 heures avant",
    h12: "De 3 à 12 heures avant",
    d1: "Environ un jour avant",
    d2: "Environ deux jours avant",
    d3: "Trois jours ou plus avant",
  },

  leadBuckets: {
    sameDay: "Sous 24 heures",
    d2: "1 à 2 jours",
    d7: "3 à 7 jours",
    d14: "8 à 14 jours",
    d30: "15 à 30 jours",
    more: "Plus de 30 jours",
  },

  sources: {
    online: "Page de réservation en ligne",
    widget: "Widget du site",
    api: "Logiciel partenaire",
    staff: "Accueil",
    waitlist: "Liste d'attente",
  },

  contexts: {
    practice: "Canaux du cabinet",
    marketplace: "Place de marché Sorriso",
  },

  funnel: {
    impressions: "Apparitions dans la recherche",
    views: "Consultations du profil",
    bookings: "Réservations sur Sorriso",
    viewRate: "{value} des apparitions ont mené à une consultation du profil",
    bookingRate: "{value} des consultations du profil ont mené à une réservation",
  },

  ranking: {
    practitioner: "Praticien",
    score: "Score obtenu",
    soonest: "Premier créneau libre",
    noSlot: "Aucun dans les 14 prochains jours",
    rating: "Avis",
    ratingValue: p({ one: "{average} ({count} avis)", other: "{average} ({count} avis)" }),
    noReviews: "Pas encore d'avis",
    cancellations: "Annulés par le cabinet",
    cancellationsValue: "{value} (180 jours)",
    completeness: "Profil",
    reasons: "Points forts",
    noReasons: "Rien ne se distingue pour l'instant",
    reasonLabels: {
      soonest: "Créneaux libres prochainement",
      rating: "Avis vérifiés",
      reliability: "Annule rarement",
      completeness: "Profil complet",
      distance: "Proche de la recherche",
      language: "Langue parlée",
      fund: "Fonds de santé",
    },
    globalMean: "Note moyenne de la plateforme utilisée pour la pondération : {value}",
    empty: "Aucun praticien actif pour l'instant.",
  },

  chart: {
    bar: "{label} : {value}",
    column: "{label} : {value}",
  },

  csv: {
    filename: "statistiques",
    section: "Rubrique",
    item: "Élément",
    measure: "Mesure",
    value: "Valeur",
    numerator: "Numérateur",
    denominator: "Dénominateur",
    all: "Tous",
  },

  forbidden: "Vous n'avez pas l'autorisation de consulter les statistiques du cabinet.",
} satisfies DeepPartial<Messages["analytics"]>;
