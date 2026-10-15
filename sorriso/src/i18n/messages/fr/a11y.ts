import type { DeepPartial, Messages } from "../../types";

export default {
  skipToContent: "Aller au contenu principal",
  nav: {
    main: "Navigation principale",
    footer: "Pied de page",
    legal: "Informations légales",
    patients: "Pour les patients",
    practices: "Pour les cabinets",
  },
  language: {
    label: "Langue",
    current: "Langue : {language}",
    choose: "Changer de langue",
  },
  home: "Page d'accueil de {app}",
  opensInNewTab: "(s'ouvre dans un nouvel onglet)",
  close: "Fermer",
  loading: "Chargement…",
  completed: "terminé",
  rating: {
    stars: "Note : {rating} sur 5",
  },
} satisfies DeepPartial<Messages["a11y"]>;
