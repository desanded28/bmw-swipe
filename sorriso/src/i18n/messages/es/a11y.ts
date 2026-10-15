import type { DeepPartial, Messages } from "../../types";

export default {
  skipToContent: "Ir al contenido principal",
  nav: {
    main: "Principal",
    footer: "Pie de página",
    legal: "Información legal",
    patients: "Para pacientes",
    practices: "Para clínicas",
  },
  language: {
    label: "Idioma",
    current: "Idioma: {language}",
    choose: "Cambiar de idioma",
  },
  home: "Página de inicio de {app}",
  opensInNewTab: "(se abre en una pestaña nueva)",
  close: "Cerrar",
  loading: "Cargando…",
  completed: "completado",
  rating: {
    stars: "Valoración: {rating} de 5",
  },
} satisfies DeepPartial<Messages["a11y"]>;
