import type { DeepPartial, Messages } from "../../types";

export default {
  skipToContent: "Vai al contenuto principale",
  nav: {
    main: "Principale",
    footer: "Piè di pagina",
    legal: "Informazioni legali",
    patients: "Per i pazienti",
    practices: "Per gli studi",
  },
  language: {
    label: "Lingua",
    current: "Lingua: {language}",
    choose: "Cambia lingua",
  },
  home: "Pagina iniziale di {app}",
  opensInNewTab: "(si apre in una nuova scheda)",
  close: "Chiudi",
  loading: "Caricamento…",
  completed: "completato",
  rating: {
    stars: "Valutazione: {rating} su 5",
  },
} satisfies DeepPartial<Messages["a11y"]>;
