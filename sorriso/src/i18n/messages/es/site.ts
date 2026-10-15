import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "{app}: pida cita con su dentista en línea",
    description:
      "Encuentre un dentista cerca de usted, consulte la disponibilidad real y reserve en segundos. Recordatorios por SMS o correo electrónico: confirme o cambie la cita con un toque.",
  },
  header: {
    findDentist: "Buscar dentista",
    forPractices: "Para clínicas",
    api: "API",
    login: "Acceso clínicas",
    bookNow: "Reservar ahora",
  },
  footer: {
    tagline: "Reserve cita con dentistas en línea con disponibilidad en tiempo real. Recordatorios que los pacientes pueden responder con una sola palabra.",
    patients: "Pacientes",
    findDentist: "Buscar dentista",
    emergency: "Urgencia dental",
    cleaning: "Limpieza dental",
    privacyCenter: "Sus datos (centro de privacidad)",
    practices: "Clínicas",
    features: "Funciones",
    createPractice: "Crear una clínica",
    apiWidget: "API y widget de reservas",
    legal: "Información legal",
    privacy: "Información sobre privacidad",
    cookies: "Política de cookies",
    terms: "Condiciones del servicio",
    dpa: "Contrato de encargo del tratamiento",
    subprocessors: "Subencargados del tratamiento",
    accessibility: "Accesibilidad",
    reviewPolicy: "Política de reseñas",
    ranking: "Cómo se ordenan los resultados",
    copyright: "© {year} {app}",
    demo: "Proyecto de demostración: las clínicas y las personas que aparecen son ficticias.",
  },
  notFound: {
    code: "Error 404",
  },
  home: {
    badge: "Solo reseñas verificadas de visitas reales",
    heroTitle: "El dentista que necesita, <em>reservado en 30 segundos.</em>",
    heroBody:
      "Disponibilidad en tiempo real de clínicas cerca de usted. Sin registro y sin esperas al teléfono. Reciba un recordatorio por SMS o correo electrónico: responda <b>SI</b> para confirmar o cambie la cita con un toque.",
    quickLabel: "Tratamientos más buscados",
    quick: {
      checkup: "Revisión",
      hygiene: "Limpieza",
      orthodontics: "Alineadores y brackets",
      pediatric: "Niños",
      emergency: "Urgencias",
    },
    soonestTitle: "Disponibles antes",
    soonestBody: "Elija una hora y listo: estas horas están actualizadas al momento.",
    seeAll: "Ver todos los dentistas",
    how: {
      title: "Cómo funciona",
      step: "Paso {n}",
      findTitle: "Encuentre disponibilidad real",
      findBody: "Compare dentistas por tratamiento, precio, reseñas verificadas y próxima hora libre, en todas las sedes en las que trabajan.",
      bookTitle: "Reserve sin registrarse",
      bookBody: "Elija una hora y añada su nombre y su número. Recibirá una confirmación al instante con una invitación de calendario.",
      confirmTitle: "Confirme respondiendo",
      confirmBody: "Le enviamos un recordatorio por SMS o correo electrónico. Responda SI para confirmar o NO para cancelar, o cambie la cita con un toque.",
    },
    citiesTitle: "Dentistas por ciudad",
    cityLink: "Dentistas en {city}",
    cityCount: p({ one: "{count} clínica", other: "{count} clínicas" }),
    practices: {
      kicker: "Para clínicas dentales",
      title: "Menos ausencias. Todas las sedes en un solo calendario.",
      body: "Agenda para varias sedes con sillones, confirmaciones bidireccionales por SMS, una lista de espera automática que recupera las cancelaciones y una API de reservas abierta.",
      features: "Ver las funciones",
      demo: "Probar el panel de demostración",
      offices: "Varias sedes, profesionales y sillones, sin reservas duplicadas entre sedes",
      rules: "Reglas de recordatorio por clínica: correo electrónico 48 horas antes, SMS 24 horas antes, WhatsApp si lo activa",
      replies: "Los pacientes responden SI o NO, y el calendario se actualiza solo",
      waitlist: "Las horas canceladas se ofrecen a la lista de espera en cuestión de segundos",
    },
  },
  forClinics: {
    metaTitle: "Para clínicas dentales",
    metaDescription:
      "Reservas en línea, un calendario para varias sedes y recordatorios que los pacientes responden, con la privacidad integrada. Exporte todos sus datos en cualquier momento.",
    kicker: "Para clínicas dentales",
    title: "Llene sus sillones. Deje de perseguir confirmaciones.",
    body: "Reservas en línea, un calendario para varias sedes y recordatorios que los pacientes realmente responden, todo en un mismo lugar.",
    signup: "Cree su clínica",
    demo: "Abrir el panel de demostración",
    featuresTitle: "Funciones",
    features: {
      offices: {
        title: "Todas las sedes, un solo calendario",
        body: "Los profesionales trabajan en distintas sedes según el día. La disponibilidad se calcula por sede, y nadie puede tener dos reservas a la vez en sedes distintas.",
      },
      chairs: {
        title: "Sillones, márgenes y cierres",
        body: "Las reservas asignan un sillón automáticamente. El tiempo de preparación de cada tratamiento, los festivos, el mantenimiento y las ausencias personales bloquean la disponibilidad.",
      },
      twoWay: {
        title: "Recordatorios por SMS con respuesta",
        body: "Los recordatorios piden a los pacientes que respondan SI o NO, en su propio idioma. Las respuestas confirman o cancelan al momento; cualquier otra respuesta se señala a recepción.",
      },
      rules: {
        title: "Reglas de recordatorio a su medida",
        body: "Por ejemplo: correo electrónico 48 horas antes, SMS 24 horas antes y un SMS breve 2 horas antes. WhatsApp solo si usted lo activa y el paciente lo acepta.",
      },
      waitlist: {
        title: "Las cancelaciones se recuperan solas",
        body: "Cuando se libera una hora, se ofrece en segundos a los pacientes de la lista de espera que encajan. Se la queda quien reserva primero, sin llamadas.",
      },
      board: {
        title: "Panel de confirmaciones",
        body: "Vea el día de mañana de un vistazo: confirmados, pendientes y a quién conviene llamar, con el motivo indicado. Solo sirve para ayudar: a nadie se le deniega una reserva.",
      },
      reviews: {
        title: "Solo reseñas verificadas",
        body: "Solo pueden opinar los pacientes que han completado una visita, y solo con su consentimiento. Las clínicas pueden responder, pero no ocultar reseñas.",
      },
      api: {
        title: "API y widget de reservas abiertos",
        body: "Integre las reservas en su sitio web con una sola etiqueta script, sincronícelas con su software de gestión mediante la API REST y suscríbase a los calendarios.",
      },
      roles: {
        title: "Roles para su equipo",
        body: "Titulares, administradores, recepción y profesionales ven cada uno lo que necesitan. Cada acceso a la ficha de un paciente queda registrado.",
      },
      privacy: {
        title: "Privacidad por defecto",
        body: "Los mensajes y las entradas de calendario no mencionan el tratamiento. Los pacientes gestionan sus datos y consentimientos en un centro de privacidad, sin necesidad de cuenta.",
      },
      languages: {
        title: "Ocho idiomas",
        body: "Los pacientes reservan y reciben recordatorios en italiano, inglés, alemán, francés, español, portugués, rumano o polaco.",
      },
    },
    flow: {
      title: "Cómo funciona una confirmación",
      book: "El paciente reserva en línea (o usted lo hace desde recepción) y recibe una confirmación con una invitación de calendario.",
      email: "48 horas antes: un correo electrónico que le pide confirmar con un clic.",
      text: "24 horas antes: un SMS que le pide responder SI para confirmar o NO para cancelar.",
      reply: "Con SI, la cita se pone en verde en su calendario. Con NO, se cancela y la hora se ofrece a la lista de espera.",
      other: "Cualquier otra respuesta («¿puedo llegar 30 minutos más tarde?») llega a su bandeja de entrada y se señala en el calendario.",
    },
    sms: {
      sender: "Clínica Bianchi",
      reminder:
        "Clínica Bianchi: recordatorio de cita el mié, 15 oct a las 10:30, Via Torino 42, Milano. Responda SI para confirmar, NO para cancelar. Detalles: sorriso.example/a/… STOP para no recibir SMS",
      reply: "SI",
      thanks: "¡Gracias! Su cita del mié, 15 oct a las 10:30 queda confirmada. ¡Hasta pronto!",
      caption: "Un recordatorio tal como lo recibe el paciente: el tratamiento nunca se menciona.",
    },
    noLockIn: "Sus datos siguen siendo suyos: expórtelos todos en cualquier momento, sin permanencia.",
    apiDocs: "Leer la documentación de la API",
  },
  developers: {
    metaTitle: "API y widget de reservas",
    metaDescription:
      "Integre las reservas en línea en el sitio web de su clínica, reserve mediante la API REST y sincronícelas con su software de gestión.",
    title: "API y widget de reservas",
    intro:
      "Todo lo que hace el sitio web {host} pasa por esta API, de modo que su integración puede hacer todo lo que puede hacer un paciente. JSON sobre HTTPS, CORS habilitado, horas en ISO 8601 (UTC).",
    codeSample: "Ejemplo de código",
    attribute: "Atributo",
    field: "Campo",
    description: "Descripción",
    widget: {
      title: "1. Integre las reservas en su sitio web",
      button: "Un botón flotante «Pedir cita» que abre el formulario de reserva en un cuadro de diálogo:",
      inline: "O integrado en un elemento de su página, aquí en alemán y para un solo profesional:",
      attributesCaption: "Atributos del widget",
      attributes: {
        "data-clinic": "Obligatorio. La dirección de su clínica en Sorriso (el slug). Sin él, el script no muestra nada.",
        "data-lang":
          "El idioma del formulario y de los mensajes al paciente. Si falta: el idioma de su página (su atributo lang), después el del navegador del visitante y, por último, el italiano.",
        "data-target":
          "Un selector CSS: muestra el formulario dentro de ese elemento en lugar de un botón flotante. Si ningún elemento coincide cuando se ejecuta el script, no se muestra nada.",
        "data-practitioner": "Abre el formulario para un solo profesional (su id).",
        "data-service": "Preselecciona un tratamiento (su id).",
        "data-location": "Preselecciona una sede (su id).",
        "data-label": "El texto del botón flotante. Si falta, «Pedir cita» en el idioma elegido.",
        "data-color": "El color del botón flotante, como color CSS.",
        "data-events": "Activa el evento sorriso:booked en su página cuando se completa una reserva.",
        "data-include-id": "Con data-events: incluye el id de la cita en el evento.",
      },
      languages: "Valores de idioma (<code>data-lang</code>, <code>patient.locale</code>):",
      eventsTitle: "Eventos de reserva",
      events:
        "Con <code>data-events</code>, su página recibe un evento <code>sorriso:booked</code> cuando se completa una reserva. No contiene datos personales, y el id de la cita solo con <code>data-include-id</code>. Los mensajes se envían únicamente al origen de su propia página.",
      eventsWarning:
        "No reenvíe este evento a herramientas publicitarias o de analítica (como las etiquetas de Meta o Google): revela que un visitante ha reservado una cita dental, lo que constituye un dato de salud. Según el contrato de encargo del tratamiento, solo puede utilizarlo para mostrar su propia confirmación.",
      origins:
        "Para impedir que otros sitios web integren su formulario de reserva, indique las direcciones de su sitio web en Panel, Ajustes de privacidad, Sitios web permitidos. En cualquier otro sitio, el widget mostrará solo un enlace que abre la página de reserva en una pestaña nueva. La comprobación se basa en la dirección que los navegadores de sus visitantes envían con el marco: el widget la solicita y, si escribe su propio iframe, no le asigne <code>referrerpolicy=\"no-referrer\"</code>.",
    },
    booking: {
      title: "2. Reserve mediante la API",
      fieldsCaption: "Campos de la reserva",
      context:
        "Quién es responsable de los datos de la reserva lo decide el servidor, nunca un campo que usted envíe: las reservas hechas con su clave de API, su widget o enlaces firmados para su clínica son suyas (Sorriso las trata por cuenta de usted); las reservas iniciadas en las propias páginas de Sorriso requieren el consentimiento del paciente a Sorriso.",
      errors:
        "Los errores tienen una única forma: un objeto <code>error</code> con un <code>code</code> y un <code>message</code>. Una hora ocupada devuelve 409 con <code>practitioner_busy</code>, <code>no_room</code>, <code>time_off</code>, <code>outside_hours</code> o <code>too_soon</code>; los campos no válidos devuelven 422 con una lista <code>issues</code>, y una regla de privacidad o de edad incumplida, 422 con su propio código y <code>field</code>.",
    },
    fields: {
      locale:
        "El idioma de los mensajes al paciente: <code>it</code>, <code>en</code>, <code>de</code>, <code>fr</code>, <code>es</code>, <code>pt</code>, <code>ro</code> o <code>pl</code>.",
      phoneCountry:
        "El prefijo telefónico de país de un número escrito sin prefijo, como <code>39</code> o <code>49</code>. Los números que empiezan por + o 00 conservan el suyo.",
      preferredChannel:
        "<code>sms</code>, <code>email</code> o <code>whatsapp</code>. WhatsApp solo si la clínica lo ha activado y con <code>privacy.whatsapp</code> en true.",
      privacy:
        "Obligatorio sin clave de API. <code>noticeVersion</code> (la versión de la información sobre privacidad mostrada), <code>locale</code> y las opciones del paciente: <code>platformConsent</code>, <code>whatsapp</code>, <code>feedback</code>, <code>marketing</code>. Las casillas que el paciente no marcó son false.",
      relation:
        "Para quién es la cita: <code>bookedFor</code> es <code>self</code>, <code>minor</code> (con <code>guardian</code>: nombre, relación, teléfono o correo electrónico) u <code>other_adult</code>.",
      practiceRef: "El marcador de clínica de un enlace publicado por su clínica (?ref=). Sin él, la reserva se considera hecha en Sorriso.",
      fundId: "Opcional: el fondo sanitario o la aseguradora que utilizará el paciente. Solo se conserva si la clínica trabaja con ese fondo.",
    },
    sync: {
      title: "3. Sincronice con su software de gestión",
      keys: "Cree una clave de API en Panel, Ajustes, API, elija sus permisos y envíela como token de portador (bearer). Las claves pueden caducar y revocarse en cualquier momento.",
      scopesTitle: "Permisos",
    },
    scopes: {
      "appointments:read": "Leer las citas y los recursos que utilizan.",
      "appointments:write": "Crear, cambiar y cancelar citas, y registrar confirmaciones, ausencias y visitas realizadas.",
      "patients:read": "Leer los nombres y los datos de contacto de los pacientes.",
      "patients:write": "Crear y actualizar pacientes.",
      "notes:read": "Leer las notas que pacientes y personal han escrito en las citas. Concédalo solo a software clínico.",
      "patients:erase": "Solicitar la supresión de los datos de un paciente (se gestiona como una solicitud de privacidad).",
    },
    export: {
      title: "4. Exporte sus datos",
      body: "Una clínica puede exportar todos sus datos en cualquier momento en JSON, CSV y FHIR R4. Los formatos se describen en el <link>esquema de exportación</link>.",
    },
    reference: "Referencia",
    groups: {
      public: "Reserva pública (la usan el sitio web y el widget)",
      patient: "Autoservicio del paciente (token del enlace del paciente)",
      partner: "API para socios (su software de gestión)",
      infra: "Infraestructura",
    },
    auth: {
      public: "pública",
      token: "token de enlace",
      apiKey: "clave de API",
      secret: "secreto",
    },
    endpoints: {
      clinic: "Perfil de la clínica, sedes, profesionales (con tratamientos y sedes) y tratamientos reservables.",
      availability:
        "Horas libres por día. Sin practitionerId: «primera disponibilidad», repartida entre los profesionales. Devuelve nextAvailable cuando el intervalo está vacío.",
      book: "Reservar una hora. Se vuelve a comprobar en una transacción de escritura: dos pacientes nunca pueden obtener la misma hora.",
      waitlist: "Apuntarse a la lista de espera para un tratamiento y, opcionalmente, un profesional o una sede, un intervalo de fechas y un momento del día.",
      appointment: "La cita y lo que el paciente aún puede hacer (canCancel, canReschedule).",
      confirm: "Confirmar la asistencia.",
      cancel: "Cancelar (la hora se ofrece a la lista de espera). Campo opcional del cuerpo: reason.",
      reschedule: "Cambiar a otra hora libre. Campos del cuerpo: start y, opcionalmente, practitionerId y locationId.",
      resources: "Sedes, sillones, profesionales (con horarios) y tratamientos, para correlacionar los id.",
      list: "Listar citas. Use updatedSince para la sincronización incremental.",
      create: "Crear una cita con permisos de recepción (duración personalizada, fuera de horario, id de paciente existente).",
      update: "Cambiar, cancelar, marcar como realizada o como ausencia, o registrar una confirmación telefónica.",
      twilio: "Respuestas entrantes por SMS y WhatsApp (firmadas por Twilio). Responde en línea con TwiML.",
      twilioStatus: "Confirmaciones de entrega (entregado, fallido).",
      cron: "Enviar los recordatorios pendientes. Llamar cada 1 a 5 minutos con Authorization: Bearer $CRON_SECRET.",
      ics: "El calendario suscribible de un profesional (Google, Apple, Outlook).",
    },
  },
} satisfies DeepPartial<Messages["site"]>;
