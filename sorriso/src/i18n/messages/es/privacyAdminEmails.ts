import type { DeepPartial, Messages } from "../../types";

export default {
  types: {
    access: "acceso a sus datos",
    rectification: "rectificación de sus datos",
    erasure: "supresión de sus datos",
    restriction: "limitación del tratamiento de sus datos",
    portability: "una copia de sus datos para llevarlos a otro lugar",
    objection: "oposición al tratamiento de sus datos",
    consent_withdrawal: "retirada de su consentimiento",
  },

  requestExtended: {
    subject: "Su solicitud de privacidad: necesitamos más tiempo",
    body: "Recibimos su solicitud de {type} el {received}. Necesitamos más tiempo para responderla por completo, por el siguiente motivo: {reason}. Recibirá nuestra respuesta antes del {until}. El RGPD (art. 12.3) permite esta prórroga de hasta dos meses más.",
    sms: "{practice}: necesitamos más tiempo para su solicitud de privacidad del {received}. Motivo: {reason}. Respuesta antes del {until}.",
  },
  requestGranted: {
    subject: "Su solicitud de privacidad se ha completado",
    body: "Hemos completado su solicitud de {type}, recibida el {received}. Nuestra respuesta: {reason}",
    sms: "{practice}: su solicitud de privacidad del {received} se ha completado. {reason}",
  },
  requestPartiallyGranted: {
    subject: "Nuestra respuesta a su solicitud de privacidad",
    body: "Hemos atendido parcialmente su solicitud de {type}, recibida el {received}. Nuestra respuesta y los motivos: {reason}. Si no está de acuerdo, puede presentar una reclamación ante la autoridad italiana de protección de datos (Garante per la protezione dei dati personali, www.garanteprivacy.it) o acudir a los tribunales.",
    sms: "{practice}: su solicitud de privacidad del {received} se ha atendido en parte. Motivos: {reason}. Puede reclamar ante el Garante (garanteprivacy.it) o acudir a los tribunales.",
  },
  requestRefused: {
    subject: "Nuestra respuesta a su solicitud de privacidad",
    body: "No podemos atender su solicitud de {type}, recibida el {received}, por los siguientes motivos: {reason}. Si no está de acuerdo, puede presentar una reclamación ante la autoridad italiana de protección de datos (Garante per la protezione dei dati personali, www.garanteprivacy.it) o acudir a los tribunales.",
    sms: "{practice}: no podemos atender su solicitud de privacidad del {received}. Motivos: {reason}. Puede reclamar ante el Garante (garanteprivacy.it) o acudir a los tribunales.",
  },
  restrictionLifted: {
    subject: "Se va a levantar la limitación de sus datos",
    body: "El {since} se limitó el tratamiento de sus datos en {practice}. Esta limitación se va a levantar, por lo que la clínica podrá volver a utilizar sus datos, por ejemplo para enviarle recordatorios de sus citas. Si tiene preguntas o considera que debería mantenerse, póngase en contacto con la clínica.",
    sms: "{practice}: se va a levantar la limitación de sus datos, vigente desde el {since}. Contacte con nosotros si tiene alguna duda.",
  },

  ownerDeadline7: {
    subject: "Solicitud de privacidad: vence en 7 días",
    body: "Una solicitud de {type} recibida por {practice} el {received} debe responderse antes del {due}. Ábrala en el panel para completarla o, si realmente necesita más tiempo, para ampliar el plazo indicando un motivo.",
    cta: "Abrir la solicitud",
  },
  ownerDeadline2: {
    subject: "Solicitud de privacidad: vence en 2 días",
    body: "Una solicitud de {type} recibida por {practice} el {received} debe responderse antes del {due}. Responder tarde infringe el art. 12.3 del RGPD: complétela ahora.",
    cta: "Abrir la solicitud",
  },

  subprocessorsChanged: {
    subject: "La lista de subencargados del tratamiento de Sorriso ha cambiado",
    body: "Sorriso ha actualizado la lista de subencargados que tratan los datos de {practice} (versión {version}, en vigor desde el {effective}). Revísela y acéptela en el panel. Si se opone a un cambio, escriba a {email} en un plazo de 30 días: buscaremos una solución con usted y, si no la hay, podrá resolver el contrato sin penalización.",
    cta: "Revisar la lista",
  },

  closureRequested: {
    subject: "Su cuenta de Sorriso se está cerrando",
    body: "El {date} recibimos la solicitud de cierre de la cuenta de {practice}. Las reservas en línea se han detenido y la clínica ya no aparece en las búsquedas. Puede descargar todos sus datos hasta el {purge}; en esa fecha se suprimirán definitivamente. Hasta entonces, puede cancelar el cierre desde el panel.",
    cta: "Descargar sus datos",
  },
  closureCancelled: {
    subject: "Cierre de la cuenta cancelado",
    body: "Se ha cancelado el cierre de la cuenta de {practice} y no se suprimirá ningún dato. Las reservas en línea a través de su propia página de reserva, su widget y sus enlaces vuelven a funcionar. La clínica seguirá oculta en las búsquedas de Sorriso hasta que vuelva a incluirla en el directorio desde Ajustes.",
  },
  closureCertificate: {
    subject: "Certificado de supresión: {practice}",
    body: "El {date} suprimimos definitivamente los datos de {practice} de los sistemas de Sorriso, conforme a lo acordado en el contrato de encargo del tratamiento. Las copias de seguridad cifradas que aún los contienen caducan el {backups} y después se sobrescriben. El certificado indica qué se ha suprimido.",
    cta: "Ver el certificado",
  },

  footer: {
    rights: "Recibe este mensaje porque ha ejercido sus derechos de protección de datos.",
    staff: "Recibe este mensaje como titular de una clínica que utiliza Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyAdminEmails"]>;
