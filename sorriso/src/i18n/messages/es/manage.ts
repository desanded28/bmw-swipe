import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Su cita",
    description: "Consulte, confirme, cambie o cancele su cita.",
  },
  greeting: "Hola, {name}:",
  title: "Su cita en {clinic}",
  status: {
    cancelled: "Cancelada",
    requested: "Pendiente de confirmación por la clínica",
    completed: "Realizada",
    no_show: "No acudió",
    confirmed: "Reservada y confirmada",
    pending: "Reservada: confírmela, por favor",
  },
  details: {
    when: "Cuándo",
    timeRange: "{start}–{end}",
    treatment: "Tratamiento",
    where: "Dónde",
    address: "{address}, {city}",
    phone: "Teléfono",
  },
  confirm: {
    title: "¿Asistirá a la cita?",
    body: "Confirmar ayuda a {clinic} a organizar el día y le garantiza su hora.",
    button: "Sí, asistiré",
    done: "¡Gracias! Su asistencia está confirmada.",
  },
  reschedule: {
    button: "Cambiar la cita",
    title: "Elija una nueva hora con {practitioner}",
    moveTo: "¿Cambiar su cita al {when}?",
    moveToOffice: "¿Cambiar su cita al {when} en {office}?",
    confirm: "Confirmar la nueva hora",
    done: "Hecho: su cita se ha cambiado.",
    closed: p({
      one: "Los cambios en línea dejan de ser posibles {count} hora antes de la visita.",
      other: "Los cambios en línea dejan de ser posibles {count} horas antes de la visita.",
    }),
    call: "Para cambiarla, llame al <tel>{phone}</tel>.",
  },
  cancel: {
    button: "Cancelar la cita",
    title: "¿Cancelar esta cita?",
    late: p({
      one: "Falta menos de {count} hora para su visita. Aun así, al cancelar libera la hora para alguien de la lista de espera: gracias por avisarnos.",
      other: "Faltan menos de {count} horas para su visita. Aun así, al cancelar libera la hora para alguien de la lista de espera: gracias por avisarnos.",
    }),
    body: "Su hora se ofrecerá a los pacientes de la lista de espera.",
    reason: "Motivo",
    reasonHint: "Opcional. Solo lo verá la clínica. No incluya datos de salud.",
    confirm: "Sí, cancelarla",
    keep: "Mantenerla",
    done: "Su cita se ha cancelado.",
  },
  calendar: {
    appleOutlook: "Apple u Outlook",
    google: "Calendario de Google",
  },
  review: {
    title: "¿Qué tal su visita?",
    button: "Dejar una reseña",
  },
  rebook: "Reservar otra cita",
  privateLink: "No comparta este enlace: cualquier persona que lo tenga puede gestionar esta cita.",
  clinicPage: "Página de {clinic}",
  invalid: {
    title: "Este enlace no funciona",
    body: "Puede que esté incompleto o contenga un error. Compruebe que ha abierto el enlace completo de su mensaje o póngase en contacto con su clínica.",
  },
  expired: {
    title: "Este enlace ha caducado",
    body: "Por su privacidad, los enlaces de las citas dejan de funcionar algún tiempo después de la visita. Para volver a reservar o preguntar por una visita anterior, póngase en contacto directamente con su clínica.",
    privacyCenter: "Para consultar los datos que las clínicas tienen sobre usted, utilice el centro de privacidad.",
  },
  rateLimited: {
    title: "Demasiadas solicitudes",
    body: p({
      one: "Esta página se ha abierto demasiadas veces en poco tiempo. Inténtelo de nuevo dentro de {count} minuto.",
      other: "Esta página se ha abierto demasiadas veces en poco tiempo. Inténtelo de nuevo dentro de {count} minutos.",
    }),
  },
  preview: {
    title: "Su cita",
    body: "Abra este enlace en su navegador para consultar y gestionar su cita.",
  },
  home: "Ir a la página de inicio",
} satisfies DeepPartial<Messages["manage"]>;
