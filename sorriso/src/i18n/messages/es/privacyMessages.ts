import type { DeepPartial, Messages } from "../../types";

export default {
  requestReceipt: {
    subject: "Hemos recibido su solicitud de privacidad",
    body: "{controller} recibió su solicitud ({type}) el {date}. Recibirá una respuesta antes del {due}. Si una solicitud compleja requiere más tiempo, se le explicará el motivo antes de esa fecha.",
    sms: "{controller} ha recibido su solicitud de privacidad ({type}). Respuesta antes del {due}.",
  },
  contactChangedPhone: {
    sms: "Se ha cambiado el número de móvil de su ficha en {practice} desde el centro de privacidad de Sorriso. ¿No ha sido usted? Llame a la clínica.",
  },
  contactChangedEmail: {
    subject: "Se han cambiado sus datos de contacto",
    body: "La dirección de correo electrónico de su ficha en {practice} se cambió desde el centro de privacidad de Sorriso el {date}. Si no ha sido usted, póngase en contacto con la clínica de inmediato.",
  },
  bookedForYou: {
    subject: "Se ha reservado una cita para usted en {practice}",
    body: "{booker} ha reservado para usted una cita en {practice} el {when}. La clínica utiliza sus datos para gestionarla. A continuación le explicamos cómo se tratan sus datos y cuáles son sus derechos, incluido cómo consultarlos, corregirlos o suprimirlos.",
    cta: "Leer la información sobre privacidad",
    sms: "{booker} ha reservado para usted una cita en {practice} el {when}. Privacidad: {url}",
  },
  confirmBooking: {
    subject: "Confirme la cita reservada para usted",
    body: "{booker} ha reservado para usted una cita en {practice} el {when} a través de Sorriso. Solo usted puede confirmarla y aceptar cómo trata Sorriso la reserva. Si no la confirma en un plazo de {hours} horas, se cancelará.",
    cta: "Confirmar o rechazar",
    sms: "{booker} ha reservado para usted una cita en {practice} con Sorriso. Confirme en {hours} h: {url}",
  },
  adultNotConfirmed: {
    subject: "Se ha cancelado la cita que reservó",
    body: "La cita que reservó para {name} en {practice} el {when} se ha cancelado, porque {name} no la confirmó a tiempo. Solo el paciente puede confirmar una reserva hecha para él en Sorriso: puede volver a reservar por sí mismo.",
    sms: "Se ha cancelado la cita de {name} en {practice} del {when}, porque {name} no la ha confirmado a tiempo.",
  },
  requestTypes: {
    access: "acceso a sus datos",
    rectification: "rectificación de sus datos",
    erasure: "supresión de sus datos",
    restriction: "limitación del tratamiento",
    portability: "una copia de sus datos para llevarlos a otro lugar",
    objection: "oposición al tratamiento",
    consent_withdrawal: "retirada del consentimiento",
  },
  footer: {
    privacyCenter: "Recibe este mensaje por una solicitud realizada en el centro de privacidad de Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyMessages"]>;
