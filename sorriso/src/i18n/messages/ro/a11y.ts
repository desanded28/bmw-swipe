import type { DeepPartial, Messages } from "../../types";

export default {
  skipToContent: "Salt la conținutul principal",
  nav: {
    main: "Principal",
    footer: "Subsol",
    legal: "Informații juridice",
    patients: "Pentru pacienți",
    practices: "Pentru cabinete",
  },
  language: {
    label: "Limba",
    current: "Limba: {language}",
    choose: "Schimbați limba",
  },
  home: "Pagina principală {app}",
  opensInNewTab: "(se deschide într-o filă nouă)",
  close: "Închideți",
  loading: "Se încarcă…",
  completed: "finalizat",
  rating: {
    stars: "Evaluare: {rating} din 5",
  },
} satisfies DeepPartial<Messages["a11y"]>;
