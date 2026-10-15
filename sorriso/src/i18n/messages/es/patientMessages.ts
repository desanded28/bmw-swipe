/**
 * Spanish (Spain) patient messages. Rules: see messages/en/patientMessages.ts.
 * SMS: straight quotes only. "é", "ñ", "ü", "¿" and "¡" are GSM-7; "á", "í", "ó" and "ú" are not, so
 * the full SMS texts avoid them where natural, and the `*Short` texts are plain ASCII.
 * The confirm keyword is SI (without the accent, which is not GSM-7).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  format: {
    slot: "{day}/{month} {time}",
  },

  email: {
    greeting: "Hola, {name}:",
    when: "Cuándo",
    where: "Dónde",
    service: "Servicio",
    with: "Con",
    patient: "Paciente",
    manage: "Gestionar la cita",
    confirm: "Confirmo que asistiré",
    cancel: "Cancelar",
    reschedule: "Cambiar la cita",
    calendar: "Añadir al calendario",
    detailsOnline: "Encontrará todos los detalles de su visita en la página de su cita.",
  },

  privacyFooter: {
    sender: "{name} · {address}",
    phone: "Tel. {phone}",
    why: "Recibe este correo porque tiene una cita en {clinic}.",
    whyGuardian: "Recibe este correo porque es la persona de contacto para las citas de {patient} en {clinic}.",
    whyWaitlist: "Recibe este correo porque se ha apuntado a la lista de espera de {clinic}.",
    whyGeneric: "Recibe este correo porque es paciente de {clinic}.",
    object:
      "Puede oponerse a los recordatorios o retirar cualquier consentimiento en cualquier momento desde sus opciones de privacidad, o respondiendo STOP a nuestros SMS.",
    notice: "Información sobre privacidad",
    preferences: "Sus opciones de privacidad",
  },

  booked: {
    subject: "Cita reservada - {clinic} - {date}",
    subjectDetailed: "Cita reservada: {service}, {date}",
    body: "Su cita está reservada. Le enviaremos un recordatorio antes de la visita.",
    sms: "{clinic}: cita reservada para el {when}. Gestionar: {url} Privacidad: {privacy} STOP para no recibir SMS",
    smsShort: "{clinic}: cita reservada {slot}. Gestionar: {url}",
    smsDetailed: "{clinic}: cita reservada, {service} con {practitioner} el {when}. Gestionar: {url} STOP para no recibir SMS",
  },

  requested: {
    subject: "Solicitud recibida - {clinic} - {date}",
    subjectDetailed: "Solicitud recibida: {service}",
    body: "Hemos recibido su solicitud. La clínica la confirmará en breve y recibirá un correo electrónico.",
  },

  approved: {
    subject: "Cita confirmada - {clinic} - {date}",
    subjectDetailed: "Cita confirmada por la clínica: {service}, {date}",
    body: "La clínica ha aceptado su solicitud. Estos son los detalles de su cita.",
    sms: "{clinic}: su cita del {when} queda confirmada. Gestionar: {url} Privacidad: {privacy} STOP para no recibir SMS",
    smsShort: "{clinic}: cita confirmada {slot}. Gestionar: {url}",
  },

  reminder: {
    subject: "Recordatorio de cita - {clinic} - {date}",
    subjectDetailed: "Recordatorio de cita: {service}, {date}",
    body: "Le recordamos su próxima cita.",
    bodyAsk: "Le recordamos su próxima cita. ¿Puede confirmar su asistencia con un solo clic?",
    sms: "{clinic}: recordatorio de cita el {when}, {address}. Detalles: {url} STOP para no recibir SMS",
    smsAsk:
      "{clinic}: recordatorio de cita el {when}, {address}. Responda SI para confirmar, NO para cancelar. Detalles: {url} STOP para no recibir SMS",
    smsShort: "{clinic}: cita {slot}. Detalles: {url}",
    smsAskShort: "{clinic}: cita {slot}. SI confirma, NO cancela. {url}",
    smsDetailed: "{clinic}: hola, {name}. Recordatorio: {service} con {practitioner} el {when}, {address}. Detalles: {url}",
    smsAskDetailed:
      "{clinic}: hola, {name}. Recordatorio: {service} con {practitioner} el {when}, {address}. Responda SI para confirmar, NO para cancelar. Detalles: {url}",
  },

  cancelled: {
    subject: "Cita cancelada - {clinic} - {date}",
    body: "Su cita se ha cancelado, tal como solicitó.",
    bodyByPractice: "Lamentablemente, la clínica ha tenido que cancelar su cita. Puede reservar otra hora cuando quiera.",
    sms: "{clinic}: su cita del {when} se ha cancelado. Reservar de nuevo: {url}",
    smsShort: "{clinic}: cita {slot} cancelada. {url}",
    rebook: "Reservar de nuevo",
  },

  rescheduled: {
    subject: "Cita cambiada - {clinic} - {date}",
    subjectDetailed: "Cita cambiada: {service}, {date}",
    body: "Su cita ha cambiado de fecha u hora. Esta es la nueva hora.",
    sms: "{clinic}: su cita se ha cambiado al {when}, {address}. Detalles: {url}",
    smsShort: "{clinic}: cita cambiada al {slot}. {url}",
  },

  waitlist: {
    subject: "Se ha liberado una hora - {clinic} - {date}",
    body: "Se ha liberado una hora el {when}. Será para quien reserve primero, así que resérvela ahora si le viene bien.",
    sms: "{clinic}: se ha liberado una hora el {when}. Para quien reserve primero: {url}",
    smsShort: "{clinic}: hora libre {slot}: {url}",
    cta: "Reservar esta hora",
  },

  review: {
    subject: "¿Qué tal su visita a {clinic}?",
    body: "Gracias por su visita. Una reseña verificada ayuda a otros pacientes a elegir con confianza. Solo le llevará un minuto.",
    bodyDetailed:
      "Gracias por su visita con {practitioner}. Una reseña verificada ayuda a otros pacientes a elegir con confianza. Solo le llevará un minuto.",
    cta: "Dejar una reseña",
  },

  replies: {
    confirmed: "{clinic}: ¡gracias! Asistencia confirmada para el {when}. ¡Hasta pronto!",
    confirmedShort: "{clinic}: gracias, confirmada {slot}.",
    cancelled: "{clinic}: su cita del {when} se ha cancelado. Reserve otra hora: {url}",
    cancelledShort: "{clinic}: cita {slot} cancelada. Reservar: {url}",
    reschedule: "{clinic}: elija una nueva hora en este enlace: {url}",
    unknown: "{clinic}: no hemos entendido su respuesta. Responda SI para confirmar o NO para cancelar, o visite: {url}",
    none: "{clinic}: no hemos encontrado ninguna cita futura para este número.",
    stop: "{clinic}: hemos desactivado sus SMS. Responda START para volver a activarlos.",
    start: "{clinic}: SMS activados de nuevo. Responda STOP para desactivarlos.",
  },

  unsubscribeConfirmation: {
    subject: "Sus preferencias de mensajes - {clinic}",
    body: "Ya no recibirá mensajes por {channel} sobre sus citas en {clinic}. Puede cambiarlo en cualquier momento desde sus opciones de privacidad.",
    cta: "Sus opciones de privacidad",
    sms: "{clinic}: hemos desactivado sus SMS. Responda START para volver a activarlos.",
  },

  breachNotice: {
    subject: "Importante: un incidente de seguridad que afecta a sus datos - {clinic}",
    body: "Le escribimos para informarle de una violación de la seguridad de los datos personales que puede afectarle. Nos la tomamos muy en serio y queremos explicarle qué ha ocurrido y qué estamos haciendo al respecto.",
    what: "Qué ha ocurrido",
    when: "Cuándo",
    data: "Datos afectados",
    consequences: "Qué puede suponer para usted",
    measures: "Qué hemos hecho",
    advice: "Qué puede hacer usted",
    contact: "Preguntas",
    contactValue: "Póngase en contacto con nuestro delegado de protección de datos: {dpo}",
    sms: "{clinic}: aviso importante sobre sus datos personales. Le rogamos que lo lea detenidamente: {url}",
  },

  ics: {
    summary: "Cita – {clinic}",
    phone: "Tel. {phone}",
  },

  preview: {
    sampleFirstName: "Lucía",
  },
} satisfies DeepPartial<Messages["patientMessages"]>;
