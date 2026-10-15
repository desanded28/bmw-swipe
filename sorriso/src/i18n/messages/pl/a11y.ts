import type { DeepPartial, Messages } from "../../types";

export default {
  skipToContent: "Przejdź do treści głównej",
  nav: {
    main: "Menu główne",
    footer: "Stopka",
    legal: "Informacje prawne",
    patients: "Dla pacjentów",
    practices: "Dla gabinetów",
  },
  language: {
    label: "Język",
    current: "Język: {language}",
    choose: "Zmień język",
  },
  home: "{app}: strona główna",
  opensInNewTab: "(otwiera się w nowej karcie)",
  close: "Zamknij",
  loading: "Ładowanie…",
  completed: "ukończono",
  rating: {
    stars: "Ocena {rating} na 5",
  },
} satisfies DeepPartial<Messages["a11y"]>;
