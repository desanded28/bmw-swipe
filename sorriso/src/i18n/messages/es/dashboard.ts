import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Panel",
    template: "{page} · {app}",
  },
  skipToContent: "Ir al contenido principal",

  nav: {
    label: "Panel",
    overview: "Resumen",
    calendar: "Calendario",
    confirmations: "Confirmaciones",
    messages: "Mensajes",
    patients: "Pacientes",
    duplicates: "Posibles duplicados",
    waitlist: "Lista de espera",
    recalls: "Avisos de revisión",
    reviews: "Reseñas",
    analytics: "Estadísticas",
    team: "Equipo y horarios",
    services: "Tratamientos",
    locations: "Sedes y sillones",
    reminders: "Recordatorios",
    settings: "Ajustes",
    funds: "Fondos sanitarios",
    api: "API",
    privacyRequests: "Solicitudes de privacidad",
    privacySettings: "Ajustes de privacidad",
    audit: "Registro de auditoría",
    security: "Mi seguridad",
    platform: "Plataforma",
    platformPrivacy: "Bandeja de privacidad de la plataforma",
    groups: {
      setup: "Configuración",
      privacy: "Privacidad",
      account: "Cuenta",
    },
    count: p({ one: "{count} pendiente", other: "{count} pendientes" }),
  },

  sidebar: {
    home: "Resumen del panel",
    publicPage: "Página pública",
    publicPageNewTab: "Su página pública (se abre en una pestaña nueva)",
    switchPractice: "Cambiar de clínica",
    logout: "Cerrar sesión",
    language: "Idioma del panel",
    languageAuto: "Automático ({language})",
  },

  language: {
    saved: "Idioma guardado.",
    invalid: "Elija uno de los idiomas de la lista.",
  },

  toast: {
    region: "Notificaciones",
    dismiss: "Descartar",
  },

  form: {
    saved: "Guardado.",
  },

  notFound: {
    title: "Página no encontrada",
    body: "Esta página del panel no existe o se ha trasladado.",
    back: "Volver al resumen",
  },

  denied: "No tiene permiso para abrir esa página. Si la necesita, pídalo a un titular o a un administrador de la clínica.",

  overview: {
    title: "Resumen",
    greeting: {
      morning: "Buenos días, {name}",
      afternoon: "Buenas tardes, {name}",
      evening: "Buenas noches, {name}",
    },
    subtitle: "{date} · {practice}",
    openCalendar: "Abrir el calendario",
    welcome: {
      title: "¡Bienvenido! Cuatro pasos para empezar",
      team: "Añada a sus dentistas e higienistas, con sus horarios en cada sede",
      services: "Defina los tratamientos, sus duraciones y precios",
      reminders: "Elija cuándo se envían los recordatorios (SMS, WhatsApp, correo electrónico)",
      widget: "Integre el widget de reservas en su sitio web",
    },
    stats: {
      today: "Hoy",
      todayHint: p({ one: "{count} confirmada o realizada", other: "{count} confirmadas o realizadas" }),
      tomorrow: "Confirmadas para mañana",
      tomorrowHint: "{confirmed} de {total} · {open} por confirmar",
      noShow: "Tasa de ausencias (30 días)",
      noShowHint: "Ausencias: {noShows} · visitas: {visits}",
      online: "Reservas en línea (7 días)",
      onlineHint: "Recuperadas desde la lista de espera (30 días): {refilled} · en espera: {waiting}",
      none: "–",
    },
    demo: {
      all: "Modo de demostración: los correos, SMS y mensajes de WhatsApp se guardan en la página Mensajes en lugar de enviarse.",
      email: "Modo de demostración: los correos se guardan en la página Mensajes en lugar de enviarse.",
      text: "Modo de demostración: los SMS y mensajes de WhatsApp se guardan en la página Mensajes en lugar de enviarse.",
      connect: "Conectar proveedores",
    },
    attention: "Requiere su atención",
    attentionCount: p({ one: "{count} cita", other: "{count} citas" }),
    agenda: "Agenda de hoy",
    noneToday: "No hay citas hoy.",
    tomorrowLink: "Confirmaciones de mañana",
  },

  confirmations: {
    title: "Confirmaciones",
    tabs: {
      label: "Qué citas",
      tomorrow: "Mañana",
      week: "Próximos 7 días",
      requests: "Solicitudes en línea",
      outcome: "Registrar resultado",
      cancelled: "Canceladas recientemente",
    },
    descriptions: {
      tomorrow: "Quién viene mañana. Contacte con quienes aún no han confirmado: se señalan los pacientes con ausencias anteriores.",
      week: "Todo lo reservado para la próxima semana.",
      requests: "Reservas en línea pendientes de su aprobación (cuando la clínica revisa las reservas en línea).",
      outcome: "Visitas pasadas sin resultado. Márquelas como realizadas (se envía la solicitud de reseña) o como ausencia.",
      cancelled: "Huecos próximos liberados por cancelaciones. Se ofrecieron automáticamente a los pacientes de la lista de espera que encajaban.",
    },
    onlyPending: "Solo pendientes de confirmación ({count})",
    riskSorted: "Las visitas sin confirmar con mayor riesgo de ausencia aparecen primero en cada día.",
    empty: "No hay nada que mostrar.",
  },

  waitlist: {
    title: "Lista de espera",
    description:
      "Cuando una cita se cancela o se cambia, el hueco se ofrece hasta a 3 pacientes que encajan, por SMS, WhatsApp o correo electrónico. Se lo queda quien reserva primero.",
    emptyTitle: "No hay nadie esperando",
    emptyBody: "Los pacientes pueden apuntarse desde la página de reserva cuando ninguna hora les viene bien.",
    waiting: "En espera",
    anyPractitioner: "Cualquier profesional",
    anyOffice: "Cualquier sede",
    preference: "{practitioner} · {office}",
    window: "{from} – {to}",
    partOfDay: {
      any: "Cualquier hora",
      morning: "Mañanas",
      afternoon: "Tardes",
    },
    offers: p({ one: "{count} oferta enviada", other: "{count} ofertas enviadas" }),
    remove: "Quitar",
    removeConfirm: "¿Quitar a este paciente de la lista de espera?",
    note: "Nota del paciente: {note}",
    restricted: "Ficha restringida: los datos de contacto y la nota están ocultos.",
    openRecord: "Abrir la ficha del paciente (se requiere un motivo)",
    booked: "Reservadas recientemente desde la lista de espera",
    bookedBadge: "Reservada",
  },
} satisfies DeepPartial<Messages["dashboard"]>;
