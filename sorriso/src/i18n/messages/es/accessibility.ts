import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    title: "Declaración de accesibilidad",
    description: "Grado de accesibilidad del sitio web y del servicio de reservas de {app}, sus limitaciones conocidas y cómo comunicar una barrera.",
  },
  title: "Declaración de accesibilidad",
  translationNotice: "Esto es una traducción. En caso de discrepancia, prevalece la <link>versión italiana</link>.",
  intro:
    "{provider} quiere que su sitio web y su servicio de reservas puedan ser utilizados por todas las personas, incluidas las que usan un lector de pantalla, el teclado, la ampliación de pantalla o el control por voz.",
  legalBasis:
    "Esta declaración se publica en virtud del Acta Europea de Accesibilidad (Directiva (UE) 2019/882), transpuesta en Italia por el Decreto Legislativo 82/2022, y de la Ley 4/2004.",
  scope: {
    title: "Ámbito de esta declaración",
    body: "El sitio web público {host}: la búsqueda, las páginas de clínicas y profesionales, los formularios de reserva y de lista de espera, la página de la cita a la que se accede desde las confirmaciones y los recordatorios, el centro de privacidad, las páginas legales y el widget de reservas que las clínicas integran en sus propios sitios web.",
  },
  status: {
    title: "Situación de cumplimiento",
    body: "Diseñamos y probamos el servicio conforme a las Pautas de Accesibilidad para el Contenido Web (WCAG) 2.2, nivel AA. La norma europea armonizada a la que remite la ley, EN 301 549 v3.2.1, incorpora las WCAG 2.1 nivel AA. El servicio es parcialmente conforme con las WCAG 2.1 nivel AA: las partes indicadas en las limitaciones conocidas aún no son plenamente conformes.",
  },
  features: {
    title: "Qué hacemos",
    keyboard:
      "El sitio está pensado para utilizarse solo con el teclado, con un indicador de foco visible y un enlace para ir directamente al contenido principal.",
    screenReader:
      "Las páginas están estructuradas con encabezados y regiones. Los campos de los formularios tienen etiquetas, y los lectores de pantalla anuncian los errores y los mensajes de estado.",
    steps: "El formulario de reserva lleva el foco a cada nuevo paso, conserva lo que ha escrito cuando vuelve atrás y explica cada error junto a su campo.",
    contrast: "Los textos y los controles de los formularios cumplen las relaciones de contraste del nivel AA de las WCAG, y ninguna información se transmite solo mediante el color.",
    motion: "Las animaciones se desactivan cuando su dispositivo solicita movimiento reducido.",
    zoom: "Las páginas están pensadas para funcionar con un zoom del 200 % y en pantallas pequeñas sin desplazamiento horizontal.",
    languages:
      "El sitio está disponible en ocho idiomas, y cada página declara su idioma para que los lectores de pantalla lo pronuncien correctamente.",
    help: "Los datos de contacto de la clínica aparecen en el mismo lugar en el formulario de reserva y en la página de su cita.",
  },
  limitations: {
    title: "Limitaciones conocidas",
    practiceContent:
      "Los textos redactados por las clínicas (descripciones de tratamientos, biografías de los profesionales) se muestran en el idioma en que la clínica los escribió, que puede ser distinto del idioma de la página.",
    dates:
      "Los campos de fecha utilizan el selector de fechas del propio navegador, cuya accesibilidad varía según el navegador y el lector de pantalla. Siempre puede escribir la fecha.",
    maps: "Los mapas de las páginas de las clínicas son solo una ayuda visual: la dirección siempre figura también como texto.",
    widget:
      "Cuando el widget de reservas está integrado en el sitio web de una clínica, la accesibilidad del resto de la página es responsabilidad de la clínica.",
    messages: "Los recordatorios por SMS son texto sin formato; sus enlaces abren páginas incluidas en esta declaración.",
    exports: "Las descargas de datos del centro de privacidad (JSON, CSV) son archivos legibles por máquina, no documentos destinados a la lectura.",
    workaround: "Si alguna de estas limitaciones le impide reservar, llame a la clínica: su número de teléfono figura en su página y en el formulario de reserva.",
  },
  preparation: {
    title: "Cómo se ha elaborado esta declaración",
    body: "Esta declaración se elaboró el {date} mediante una autoevaluación, basada en comprobaciones automáticas del código del sitio web que se ejecutan con cada cambio (etiquetas, mensajes de error, gestión del foco, relaciones de contraste). Todavía no se ha completado una revisión manual solo con el teclado y con lectores de pantalla (NVDA con Firefox en Windows, VoiceOver con Safari en iOS); actualizaremos esta declaración cuando se haya realizado. Se revisó por última vez el {reviewed}.",
  },
  feedback: {
    title: "Comentarios y contacto",
    body: "Si encuentra una barrera o necesita información de este sitio web en otro formato, escriba a <mail>{email}</mail>. Indíquenos la dirección de la página y lo que ha ocurrido. Le responderemos en un plazo de 30 días.",
    noEmail:
      "Si encuentra una barrera o necesita información de este sitio web en otro formato, póngase en contacto con nosotros mediante los datos que figuran en la <link>información sobre privacidad</link>. Indíquenos la dirección de la página y lo que ha ocurrido. Le responderemos en un plazo de 30 días.",
  },
  enforcement: {
    title: "Procedimiento de aplicación",
    body: "Si no está satisfecho con nuestra respuesta, o no recibe ninguna en un plazo de 30 días, puede comunicarlo a AgID (Agenzia per l'Italia Digitale), la autoridad que supervisa la accesibilidad digital en Italia, mediante el formulario disponible en <link>form.agid.gov.it</link>.",
  },
} satisfies DeepPartial<Messages["accessibility"]>;
