import type { DeepPartial, Messages } from "../../types";

export default {
  skipToContent: "Saltar para o conteúdo principal",
  nav: {
    main: "Principal",
    footer: "Rodapé",
    legal: "Informação legal",
    patients: "Para pacientes",
    practices: "Para clínicas",
  },
  language: {
    label: "Idioma",
    current: "Idioma: {language}",
    choose: "Mudar de idioma",
  },
  home: "Página inicial da {app}",
  opensInNewTab: "(abre num novo separador)",
  close: "Fechar",
  loading: "A carregar…",
  completed: "concluído",
  rating: {
    stars: "Classificação de {rating} em 5",
  },
} satisfies DeepPartial<Messages["a11y"]>;
