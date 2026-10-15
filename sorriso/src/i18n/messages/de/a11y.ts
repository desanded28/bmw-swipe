import type { DeepPartial, Messages } from "../../types";

export default {
  skipToContent: "Zum Hauptinhalt springen",
  nav: {
    main: "Hauptnavigation",
    footer: "Fußzeile",
    legal: "Rechtliche Informationen",
    patients: "Für Patienten",
    practices: "Für Praxen",
  },
  language: {
    label: "Sprache",
    current: "Sprache: {language}",
    choose: "Sprache ändern",
  },
  home: "{app} Startseite",
  opensInNewTab: "(öffnet in einem neuen Tab)",
  close: "Schließen",
  loading: "Wird geladen…",
  completed: "abgeschlossen",
  rating: {
    stars: "Bewertet mit {rating} von 5",
  },
} satisfies DeepPartial<Messages["a11y"]>;
