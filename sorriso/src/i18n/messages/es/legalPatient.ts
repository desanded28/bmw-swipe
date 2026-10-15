/**
 * TEXTO LEGAL: traducción al español. El italiano (it/legalPatient.ts) es la versión autorizada y
 * prevalece en caso de discrepancia. Borrador pendiente de revisión por un DPD o abogado
 * (docs/i18n/glossary-es.md, "Needs lawyer review").
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    practiceTitle: "Información sobre privacidad: {practice}",
    practiceDescription: "Cómo trata {practice} los datos personales de sus pacientes, y cuáles son sus derechos.",
    minorTitle: "Privacidad para jóvenes: {practice}",
    minorDescription: "Qué hace {practice} con la información sobre usted, explicado de forma sencilla.",
    platformTitle: "Información sobre privacidad de Sorriso",
    platformDescription: "Cómo trata Sorriso los datos personales cuando usted busca un dentista, reserva o escribe una reseña, y cuáles son sus derechos.",
    staffTitle: "Información sobre privacidad para el personal de las clínicas",
    staffDescription: "Cómo se tratan sus datos cuando utiliza el panel de Sorriso, y cómo funciona el registro de accesos.",
    practitionerTitle: "Información sobre privacidad para profesionales",
    practitionerDescription: "Cómo trata Sorriso los datos de los profesionales que figuran en su directorio.",
    cookiesTitle: "Política de cookies",
    cookiesDescription: "Las pocas cookies técnicas que utiliza Sorriso, y por qué no hay banner de cookies.",
  },
  page: {
    version: "Versión {version}",
    updated: "En vigor desde el {date}",
    italianPrevails: "Esto es una traducción. En caso de discrepancia, prevalece la versión italiana.",
    italianLink: "Leer la versión italiana",
    contents: "Índice",
    practiceLink: "Información completa de la clínica",
    minorsLink: "Versión para jóvenes",
    platformLink: "Información sobre privacidad de Sorriso",
    cookiesLink: "Política de cookies",
    privacyCenterLink: "Ir al centro de privacidad",
    otherNotices: "Otras informaciones",
    staffLink: "Para el personal de las clínicas",
    practitionerLink: "Para profesionales",
    patientLink: "Para pacientes",
    backToTop: "Volver arriba",
  },
  sections: {
    summary: "En resumen",
    controller: "Quién es responsable de sus datos",
    roles: "Los dos papeles de Sorriso",
    data: "Qué datos tratamos",
    purposes: "Para qué los tratamos y con qué base jurídica",
    marketplace: "Si reservó en Sorriso",
    withdrawal: "Si retira su consentimiento",
    recipients: "Quién recibe sus datos",
    transfers: "Transferencias fuera del Espacio Económico Europeo",
    retention: "Cuánto tiempo conservamos sus datos",
    rights: "Sus derechos",
    complaint: "Reclamaciones",
    mandatory: "¿Está obligado a facilitarnos sus datos?",
    automated: "Decisiones automatizadas y elaboración de perfiles",
    minors: "Niños y jóvenes",
    monitoring: "El registro de accesos",
    profile: "Su perfil público",
    cookies: "Cookies",
    changes: "Cambios en esta información",
    who: "Quién cuida de su información",
    what: "Qué información usamos",
    why: "Para qué la usamos",
    parents: "Sus padres o su tutor",
    keep: "Cuánto tiempo la guardamos",
    youCan: "Qué puede hacer",
    help: "Si algo no va bien",
    full: "La información completa",
    cookieList: "Cookies que utilizamos",
    storage: "Almacenamiento en su navegador",
    thirdParties: "Terceros",
    legalBasis: "Base jurídica",
    control: "Cómo controlar las cookies",
    widget: "El widget de reservas en los sitios web de las clínicas",
  },
  controller: {
    name: "Responsable del tratamiento: {name}",
    vat: "NIF/IVA: {vat}",
    address: "Dirección: {address}",
    contact: "Contacto de privacidad: {email}",
    phone: "Teléfono: {phone}",
    dpo: "Delegado de protección de datos (DPD): {name}, {email}",
    dpoEmail: "Delegado de protección de datos (DPD): {email}",
    noDpo: "La clínica no ha designado un delegado de protección de datos: para cualquier cuestión de privacidad, escriba al contacto indicado arriba.",
    processor:
      "Sorriso presta el software de reservas como encargado del tratamiento de la clínica (art. 28 del RGPD): actúa únicamente siguiendo las instrucciones documentadas de la clínica y en virtud de un contrato de encargo del tratamiento.",
    platformDpo: "Puede contactar con el delegado de protección de datos (DPD) de Sorriso en {email}.",
  },
  bases: {
    art6_1_a: "su consentimiento (art. 6.1.a) del RGPD)",
    art6_1_b: "el servicio que usted solicita, o las medidas que solicita antes de recibirlo (art. 6.1.b) del RGPD)",
    art6_1_c: "una obligación legal del responsable (art. 6.1.c) del RGPD)",
    art6_1_f: "el interés legítimo del responsable, al que usted puede oponerse (art. 6.1.f) del RGPD)",
    art9_2_a: "su consentimiento explícito para los datos que puedan referirse a su salud (art. 9.2.a) del RGPD)",
    art9_2_f: "la formulación, el ejercicio o la defensa de reclamaciones (art. 9.2.f) del RGPD)",
    art9_2_h:
      "la asistencia sanitaria prestada por profesionales sujetos al secreto profesional (art. 9.2.h) y 9.3 del RGPD, art. 2-septies del Código italiano de protección de datos)",
  },
  purposes: {
    item: "{title}. {body} Base jurídica: {bases}.",
    booking_practice: {
      title: "Reserva",
      body: "Para recibir y registrar su reserva, comprobar la disponibilidad y confirmarle la cita.",
    },
    booking_marketplace: {
      title: "Reservas hechas en Sorriso",
      body: "Cuando reserva desde las páginas de búsqueda de Sorriso: para enviar su reserva a la clínica que ha elegido y gestionar los recordatorios y los cambios. Los datos de la reserva pueden revelar información sobre su salud, por lo que Sorriso le pide su consentimiento explícito.",
    },
    appointment_management: {
      title: "Gestión de sus citas",
      body: "Para mantener sus citas y su ficha en la clínica, organizar la agenda y permitirle confirmar, cambiar o cancelar en línea.",
    },
    reminders: {
      title: "Confirmaciones y recordatorios",
      body: "Para enviarle confirmaciones de reserva y recordatorios por SMS, correo electrónico o, si lo elige, WhatsApp. Los mensajes son discretos: no indican tratamientos ni notas, salvo que la clínica haya optado por mensajes detallados y su contacto esté verificado. Puede desactivar cualquier canal en cualquier momento.",
    },
    waitlist: {
      title: "Lista de espera",
      body: "Si se apunta a la lista de espera: para avisarle cuando se libere una hora antes.",
    },
    recalls: {
      title: "Avisos de revisión",
      body: "Para recordarle cuándo le toca la próxima revisión, si su dentista ha fijado un intervalo. Cada aviso le permite dejar de recibirlos, y puede oponerse en cualquier momento.",
    },
    feedback_requests: {
      title: "Invitaciones a dar su opinión",
      body: "Solo si usted lo acepta: una única invitación a dar su opinión después de la visita. Puede retirar su consentimiento en cualquier momento.",
    },
    reviews: {
      title: "Reseñas",
      body: "Si escribe una reseña y acepta su publicación: para publicarla, mostrar que procede de una visita real y moderarla. Puede eliminarla en cualquier momento desde el centro de privacidad.",
    },
    marketing: {
      title: "Novedades y ofertas",
      body: "Solo si usted lo acepta: novedades y ofertas de la clínica. Nunca es necesario para reservar ni para recibir tratamiento, y su consentimiento caduca tras 24 meses sin contacto.",
    },
    no_show_tracking: {
      title: "Historial de citas a las que no acudió",
      body: "Para registrar las citas a las que no acudió en los últimos 24 meses, organizar la agenda y ofrecerle ayuda, como un recordatorio adicional. Nunca le impide reservar. Puede oponerse en cualquier momento.",
    },
    adaptive_reminders: {
      title: "Recordatorios adaptativos",
      body: "Para enviarle un recordatorio adicional cuando, según su historial de citas, sea más probable que no acuda a una cita. Se trata de una elaboración de perfiles (art. 4.4 del RGPD): solo añade ayuda y nunca limita sus reservas. Puede oponerse en cualquier momento y recibir entonces los recordatorios estándar.",
    },
    anamnesis: {
      title: "Formulario de historial médico",
      body: "Si la clínica le pide que lo rellene antes de la visita: para preparar su tratamiento de forma segura. Sus respuestas se cifran y solo las ve el personal clínico.",
    },
    partner_api: {
      title: "Software de gestión conectado",
      body: "Si la clínica conecta su propio software de gestión a la agenda: para mantener ambos sincronizados. Ese software es un destinatario elegido por la clínica.",
    },
    directory: {
      title: "Directorio",
      body: "Para mostrar clínicas y profesionales en los resultados de búsqueda de Sorriso y en sus páginas públicas.",
    },
    ranking: {
      title: "Orden de los resultados de búsqueda",
      body: "Para ordenar los resultados de búsqueda según criterios publicados: la primera hora libre, las valoraciones, la fiabilidad, el grado de cumplimentación del perfil y la distancia. Nadie puede pagar por aparecer más arriba. Puede oponerse en cualquier momento.",
    },
    privacy_center: {
      title: "Centro de privacidad",
      body: "Para encontrar las fichas que las clínicas de Sorriso tienen asociadas a un número de teléfono o una dirección de correo electrónico que usted ha verificado con un código de un solo uso, de modo que pueda ejercer sus derechos en un único lugar.",
    },
    staff_accounts: {
      title: "Cuentas del personal",
      body: "Para dar al personal de las clínicas un acceso personal y seguro al panel: inicio de sesión, verificación en dos pasos, sesiones y aceptación de las instrucciones para el personal.",
    },
    security_logs: {
      title: "Seguridad y registro de accesos",
      body: "Para registrar quién abre y modifica las fichas de los pacientes, protegerlas frente a usos indebidos y mostrar a los pacientes quién ha accedido a sus datos.",
    },
    privacy_requests: {
      title: "Solicitudes de privacidad",
      body: "Para tramitar las solicitudes que las personas presentan sobre sus datos, responderlas en los plazos legales y conservar la prueba de ello.",
    },
  },
  services: {
    hosting: "alojamiento de la aplicación",
    database: "base de datos",
    sms: "mensajes SMS",
    whatsapp: "mensajes de WhatsApp, solo para las clínicas que los activan y los pacientes que los eligen",
    email: "correo electrónico",
    backups: "copias de seguridad",
  },
  transferTools: {
    eu: "sin transferencia (UE/EEE)",
    dpf: "Marco de Privacidad de Datos UE-EE. UU. (decisión de adecuación de la Comisión Europea de 10 de julio de 2023)",
    scc: "cláusulas contractuales tipo aprobadas por la Comisión Europea (art. 46 del RGPD)",
    dpf_scc: "Marco de Privacidad de Datos UE-EE. UU., con las cláusulas contractuales tipo de la Comisión Europea como garantía subsidiaria",
  },
  data: {
    intro: "Tratamos:",
    identity: "datos identificativos y de contacto: nombre, apellidos, número de móvil, dirección de correo electrónico, fecha de nacimiento, y el idioma y el canal que prefiere;",
    appointments:
      "datos de las citas: fecha, hora, tratamiento, profesional, sede, estado y citas a las que no acudió. Pueden revelar información sobre su salud;",
    yourWords: "lo que usted decide contarnos: notas añadidas a una reserva, respuestas a nuestros mensajes y, si la clínica lo utiliza, el formulario de historial médico;",
    guardian: "en el caso de menores: los datos del progenitor o tutor legal que reserva y recibe los mensajes;",
    records: "los registros de sus consentimientos y opciones, y de las solicitudes de privacidad que presente;",
    technical: "datos técnicos necesarios para la seguridad: hashes con clave (HMAC) de su dirección IP, nunca la dirección en sí.",
    source:
      "Recibimos estos datos de usted o de la persona que reservó para usted: un progenitor o tutor legal, u otro adulto que reservó en su nombre. En ese caso, también enviamos esta información a su propio contacto, si lo tenemos (art. 14 del RGPD).",
  },
  platformData: {
    intro: "Sorriso trata, para sus propios servicios:",
    booking:
      "cuando usted reserva desde sus páginas de búsqueda: su nombre, sus contactos, su fecha de nacimiento si la facilita, la clínica, el tratamiento, la fecha y la hora elegidos, y el registro de su consentimiento;",
    reviews: "cuando escribe una reseña: la valoración, el texto, el nombre que se muestra y la visita a la que se refiere;",
    privacyCenter:
      "cuando utiliza el centro de privacidad: un hash con clave del número de teléfono o de la dirección de correo electrónico que verifica, los códigos de un solo uso enviados (almacenados solo como hashes) y una cookie de sesión válida durante 30 minutos;",
    technical: "por seguridad: hashes con clave (HMAC) de las direcciones IP y de los navegadores, nunca las direcciones en sí.",
  },
  recipients: {
    intro: "Sus datos solo los ven quienes los necesitan:",
    staff: "el personal autorizado de la clínica (recepción y personal clínico), cada uno con el acceso que requiere su función;",
    sorriso: "Sorriso, que gestiona el software de reservas como encargado del tratamiento de la clínica;",
    practices: "la clínica en la que reserva, que recibe su reserva y pasa a ser responsable de su propia copia;",
    providers: "los proveedores técnicos indicados a continuación (subencargados del tratamiento), vinculados por contratos de encargo del tratamiento;",
    authorities: "las autoridades públicas, solo cuando la ley lo exija.",
    notSold: "Sus datos nunca se venden ni se utilizan con fines publicitarios.",
    provider: "{name} ({entity}): {service}, {region}.",
    providerNoRegion: "{name} ({entity}): {service}.",
    fullList: "La lista completa y actualizada de subencargados está disponible en {url}.",
  },
  transfers: {
    intro:
      "Algunos proveedores pertenecen a grupos con sede en los Estados Unidos. Aunque sus servidores estén en la UE, esto puede considerarse una transferencia fuera del Espacio Económico Europeo. Estas transferencias están amparadas por:",
    item: "{name}: {tool}.",
    assessment: "Sorriso ha evaluado estas transferencias (evaluación de impacto de las transferencias). Puede solicitar una copia de las garantías escribiendo a {email}.",
    none: "Sus datos no se transfieren fuera del Espacio Económico Europeo.",
  },
  retention: {
    intro: "Solo conservamos los datos durante el tiempo necesario:",
    patientInactiveMonths:
      "su ficha en la clínica: {period} después de su última visita, o más tiempo solo cuando la clínica deba conservar la documentación clínica por ley;",
    neverSeenPatientMonths: "fichas de personas que nunca acudieron a una visita: {period};",
    patientNoteDays: "notas que añade a una reserva: {period} después de la cita;",
    messageBodyMonths: "el texto de los mensajes: {period}; después solo se conservan la fecha, el canal y el estado de entrega;",
    messageMetaMonths: "registros de los mensajes (fecha, canal, estado de entrega): {period};",
    reminderDays: "programaciones de recordatorios: {period} después de su envío;",
    providerMessageDays: "copias conservadas por el proveedor de SMS y WhatsApp: se eliminan transcurridos {period};",
    waitlistDays: "entradas de la lista de espera: {period} después de su cierre;",
    auditMonths: "el registro de accesos: {period};",
    formSubmissionMonths: "formularios de historial médico: {period}, y solo una vez incorporados a la historia clínica de la clínica;",
    consentMonths: "registros de sus consentimientos y opciones: hasta {period}, para poder acreditarlos;",
    privacyRequestMonths: "solicitudes de privacidad y sus respuestas: {period} después de su cierre;",
    marketingLapse: "el consentimiento para novedades y ofertas caduca tras 24 meses sin contacto.",
    after:
      "Al final de estos plazos, los datos se suprimen o se seudonimizan automáticamente. Los registros de citas seudonimizados ya no muestran su nombre ni sus contactos y solo se conservan con fines estadísticos y para los archivos de la clínica.",
    platformBookings: "datos de las reservas del directorio: mientras se gestione la reserva, y nunca más tiempo del que la clínica conserve su propia copia;",
    platformReviews: "reseñas publicadas: hasta que usted las elimine o se retiren;",
    platformCodes: "códigos de un solo uso: se eliminan {period} después de caducar; las sesiones del centro de privacidad finalizan a los 30 minutos;",
  },
  rights: {
    intro: "Tiene derecho a:",
    access: "acceder a sus datos y recibir una copia (art. 15 del RGPD);",
    rectification: "obtener la rectificación de los datos inexactos y que se completen los incompletos (art. 16);",
    erasure: "obtener la supresión de sus datos cuando ya no sean necesarios o retire su consentimiento, salvo lo que la ley nos obligue a conservar (art. 17);",
    restriction: "obtener la limitación del tratamiento, por ejemplo mientras se comprueba una corrección (art. 18);",
    portability: "recibir los datos que nos facilitó en un formato estructurado y de lectura mecánica, o que se transmitan a otro responsable (art. 20);",
    objection: "oponerse al tratamiento basado en el interés legítimo, incluida la elaboración de perfiles (art. 21);",
    withdraw: "retirar su consentimiento en cualquier momento, sin que ello afecte al tratamiento realizado con anterioridad (art. 7.3);",
    automated: "no ser objeto de decisiones basadas únicamente en el tratamiento automatizado (art. 22).",
    how: "Cómo: en línea, en el centro de privacidad en {url}, al que se accede con un código de un solo uso enviado a su teléfono o a su correo electrónico; desde el enlace de los mensajes de su cita; o escribiendo a {email}.",
    howNoContact:
      "Cómo: en línea, en el centro de privacidad en {url}, al que se accede con un código de un solo uso enviado a su teléfono o a su correo electrónico, o desde el enlace de los mensajes de su cita.",
    deadline:
      "Respondemos en el plazo de un mes. En el caso de solicitudes complejas, este plazo puede prorrogarse otros dos meses, y le explicaremos el motivo dentro del primer mes (art. 12.3 del RGPD). El ejercicio de sus derechos es gratuito.",
    recipientsInformed: "Cuando rectificamos o suprimimos sus datos, o limitamos su uso, también lo comunicamos a los destinatarios a los que se los enviamos (art. 19 del RGPD).",
  },
  complaint: {
    body: "Si considera que sus datos se tratan de forma ilícita, puede presentar una reclamación ante la autoridad italiana de protección de datos, el Garante per la protezione dei dati personali (Piazza Venezia 11, 00187 Roma, www.garanteprivacy.it), o ante la autoridad del país de la UE en el que resida o trabaje (art. 77 del RGPD). También puede acudir a los tribunales (art. 79 del RGPD).",
  },
  mandatory: {
    practice:
      "Para reservar debe facilitar su nombre y un número de móvil o una dirección de correo electrónico: sin ellos, la clínica no puede reservar ni recordarle la cita. La fecha de nacimiento es opcional, pero obligatoria cuando se reserva para un menor. Todos los consentimientos son opcionales: negarse nunca le impide reservar ni recibir tratamiento.",
    platform:
      "El consentimiento para reservar a través de Sorriso solo es necesario para reservar desde las páginas de búsqueda de Sorriso. Si prefiere no darlo, puede reservar directamente con la clínica, en su propio sitio web o por teléfono.",
  },
  automated: {
    none: "No se toma ninguna decisión sobre usted basada únicamente en medios automatizados (art. 22 del RGPD).",
    profiling:
      "Esta clínica utiliza recordatorios adaptativos: su historial de citas se utiliza para decidir si enviarle un recordatorio adicional. Se trata de una elaboración de perfiles, pero solo añade ayuda y nunca limita sus reservas. Puede oponerse en cualquier momento.",
    platform:
      "Los resultados de búsqueda se ordenan según criterios publicados, y las reseñas se comprueban automáticamente antes de su publicación para detectar datos de salud; siempre es una persona quien decide si una reseña se retira. No se toma ninguna decisión con efectos jurídicos o significativamente similares basada únicamente en medios automatizados.",
  },
  minors: {
    body: "Las citas de los menores de 14 años las reserva un progenitor o tutor legal, que recibe los mensajes y presta los consentimientos necesarios (art. 2-quinquies del Código italiano de protección de datos). A partir de los 14 años, los jóvenes pueden reservar y tomar estas decisiones por sí mismos. El acceso de un progenitor o tutor a través del centro de privacidad finaliza cuando el menor cumple 18 años.",
    link: "Hay una versión de esta información redactada para jóvenes en {url}.",
  },
  marketplace: {
    body: "Si reservó desde las páginas de búsqueda de Sorriso, Sorriso es también responsable autónomo del tratamiento de esa reserva: la envía a la clínica y gestiona los recordatorios y los cambios, con su consentimiento explícito (art. 9.2.a) del RGPD). La información de Sorriso explica cómo: {url}.",
    withdraw:
      "Si retira ese consentimiento, Sorriso deja de realizar su propio tratamiento, mientras que la clínica conserva lo que necesita para atenderle (art. 9.2.h) del RGPD).",
  },
  withdrawal: {
    platform:
      "Si retira su consentimiento para reservar a través de Sorriso, Sorriso deja de realizar su propio tratamiento de esa reserva: deja de conservarla en su historial del directorio y de enviar sus propios mensajes e invitaciones al respecto. La clínica conserva lo que necesita para atenderle, como responsable del tratamiento, en virtud del art. 9.2.h) del RGPD, con Sorriso como su encargado del tratamiento. La retirada no afecta al tratamiento realizado con anterioridad.",
  },
  roles: {
    intro: "Sorriso desempeña dos papeles:",
    controller:
      "responsable autónomo del tratamiento para sus propios servicios: las reservas iniciadas en las páginas de búsqueda de Sorriso, el directorio de clínicas y profesionales, las reseñas publicadas, el orden de los resultados de búsqueda y el centro de privacidad. Esta información se refiere a ellos;",
    processor:
      "encargado del tratamiento de las clínicas (art. 28 del RGPD) para todo lo que llega a través de los propios canales de una clínica: su sitio web, su widget de reservas o sus enlaces, su personal y su software. Para ello, el responsable del tratamiento es la clínica y se aplica su propia información sobre privacidad, que encontrará en la página de la clínica.",
  },
  changes: {
    body: "Actualizamos esta información cuando cambia nuestro tratamiento y conservamos todas las versiones anteriores: puede solicitar la que estaba en vigor cuando reservó. Esta es la versión {version}.",
  },
  cookiesLink: {
    body: "Sorriso solo utiliza cookies técnicas, y ninguna cookie de terceros: consulte la política de cookies en {url}.",
  },
  summary: {
    practice:
      "{practice} utiliza sus datos para reservar y gestionar sus citas dentales, enviarle confirmaciones y recordatorios, y mantener su ficha en la clínica. Es necesario para prestarle la asistencia que solicita (art. 6.1.b) y art. 9.2.h) del RGPD). Todo lo opcional, como las invitaciones a dar su opinión o las novedades, requiere un consentimiento independiente, que puede retirar en cualquier momento.",
    platform:
      "Sorriso le ayuda a encontrar una clínica dental y a reservar con ella. Cuando reserva desde las páginas de búsqueda de Sorriso, Sorriso envía su reserva a la clínica con su consentimiento. Cuando reserva a través del sitio web, el widget de reservas o el personal de una clínica, la clínica es responsable de sus datos y Sorriso solo gestiona el software por cuenta de ella.",
    rights:
      "Puede consultar, corregir, descargar o suprimir sus datos, limitar su uso u oponerse a él y retirar su consentimiento en cualquier momento: en línea, en el centro de privacidad, con un código de un solo uso, o escribiendo a {email}. También puede presentar una reclamación ante la autoridad italiana de protección de datos (Garante).",
    rightsNoContact:
      "Puede consultar, corregir, descargar o suprimir sus datos, limitar su uso u oponerse a él y retirar su consentimiento en cualquier momento, en línea, en el centro de privacidad, con un código de un solo uso. También puede presentar una reclamación ante la autoridad italiana de protección de datos (Garante).",
  },
  minor: {
    summary: "Esta página explica, con palabras sencillas, qué hace {practice} con la información sobre usted cuando tiene una cita en el dentista.",
    who: "{controller} es responsable de su información. Si tiene preguntas, usted o sus padres pueden escribir a {email}.",
    whoNoContact: "{controller} es responsable de su información. Si tiene preguntas, usted o sus padres pueden preguntar en la clínica.",
    whatIntro: "Usamos:",
    whatName: "su nombre y su fecha de nacimiento;",
    whatAppointments: "sus citas: cuándo son y para qué son;",
    whatContact: "el teléfono o el correo electrónico al que enviamos los recordatorios: el suyo, o el de su madre, su padre o su tutor;",
    whatMessages: "los mensajes que enviamos y las respuestas que recibimos.",
    why: "Para reservar sus visitas, recordárselas y cuidar de sus dientes con seguridad. Nunca la usamos para publicidad y nunca la vendemos.",
    parents:
      "Si tiene menos de 14 años, su madre, su padre o su tutor reserva por usted, recibe los recordatorios y decide sobre todo lo que es opcional. A partir de los 14 años puede reservar y decidir por sí mismo. Cuando cumpla 18 años, sus padres ya no podrán ver sus datos a través del centro de privacidad.",
    keep: "Solo el tiempo necesario para su atención, y el tiempo que la ley obliga a la clínica a guardarla. Después, se borra.",
    youCan:
      "Puede pedir ver su información, corregirla si hay algo mal o borrarla cuando ya no se necesite. Puede hacerlo en el centro de privacidad en {url}, o pedir ayuda a su madre, su padre o su tutor.",
    help: "Si cree que su información no se trata como es debido, usted o sus padres pueden presentar una reclamación ante la autoridad italiana de protección de datos (Garante per la protezione dei dati personali, www.garanteprivacy.it).",
    full: "Esta es una versión simplificada. La información completa está en {url}.",
  },
  staff: {
    summary:
      "Esta información está dirigida a las personas que utilizan el panel de Sorriso en una clínica dental: titulares, administradores, recepción y profesionales. Explica qué datos sobre usted se tratan y cómo funciona el registro de accesos.",
    controllers:
      "Sorriso es responsable del tratamiento de su cuenta de usuario (inicio de sesión, verificación en dos pasos, sesiones). La clínica para la que trabaja es responsable del registro de accesos y de todo lo demás que usted hace en su agenda; Sorriso es su encargado del tratamiento.",
    dataIntro: "Tratamos:",
    dataAccount: "su nombre, su dirección de correo electrónico, su rol y su idioma preferido;",
    dataSecurity:
      "su contraseña (almacenada solo como hash), su secreto de verificación en dos pasos (cifrado) y sus códigos de recuperación (en hash);",
    dataSessions: "sus sesiones e intentos de inicio de sesión, con hashes con clave de la dirección IP y del navegador;",
    dataLog: "el registro de accesos: qué fichas de pacientes abre o modifica, cuándo y con qué acción;",
    dataLegal: "su aceptación de las instrucciones para el personal y de otros documentos legales.",
    monitoring:
      "El registro de accesos es una medida de seguridad exigida para los datos de salud (art. 32 del RGPD). Registra la fecha y la hora, su usuario, la ficha y la acción, nunca el contenido que lee. La clínica puede revisarlo para comprobar que las fichas solo se abren con fines asistenciales y administrativos, y para investigar usos indebidos. Dado que se le informa de ello en esta información y en las instrucciones para el personal, la información del registro puede utilizarse para fines relacionados con su relación laboral, dentro de los límites del art. 4.3 de la Ley italiana 300/1970 y de la normativa de protección de datos.",
    retentionSessions: "sesiones: hasta que caducan; intentos de inicio de sesión: {period};",
    retentionLog: "el registro de accesos: según lo establezca la clínica, como mínimo {period};",
    retentionLegal: "aceptaciones de documentos legales: 10 años, el plazo de prescripción para poder acreditarlas;",
    retentionAccount: "su cuenta: hasta que se cierre o usted deje la clínica.",
    rights:
      "Tiene los derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición (arts. 15 a 21 del RGPD). Para su cuenta, escriba a Sorriso a {email}; para el registro de accesos, a la clínica para la que trabaja.",
    rightsNoContact:
      "Tiene los derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición (arts. 15 a 21 del RGPD). Para su cuenta, escriba a Sorriso; para el registro de accesos, a la clínica para la que trabaja.",
  },
  practitioner: {
    summary:
      "Esta información está dirigida a los dentistas y demás profesionales que figuran en el directorio de Sorriso. Explica cómo trata Sorriso sus datos profesionales, las comprobaciones de su colegiación y las reseñas que escriben los pacientes sobre usted.",
    controllers:
      "Sorriso es responsable del tratamiento del directorio, de su perfil público, de las reseñas y del orden de los resultados de búsqueda. La clínica con la que trabaja es responsable de su agenda y de los datos de sus pacientes; para ellos, Sorriso es su encargado del tratamiento.",
    dataIntro: "Tratamos:",
    dataProfile: "su nombre, su título, su especialidad, su biografía, los idiomas que habla, la clínica y las sedes en las que trabaja y su disponibilidad;",
    dataAlbo:
      "su inscripción en el registro profesional (Albo degli Odontoiatri o dei Medici Chirurghi), la provincia y el número, y las especialidades reconocidas que en él figuran;",
    dataReviews: "las valoraciones y reseñas que escriben los pacientes sobre las visitas con usted, sus respuestas y las posibles denuncias;",
    dataMetrics: "las métricas utilizadas para ordenar los resultados de búsqueda: cancelaciones por parte del personal, grado de cumplimentación del perfil y visitas a su perfil.",
    profile:
      "Su perfil solo se hace público después de que usted o la clínica lo aprueben, y puede retirarse del directorio en cualquier momento. Las especialidades legalmente reconocidas solo se muestran después de que Sorriso las haya comprobado en el registro público.",
    reviews:
      "Solo los pacientes con una visita verificada pueden escribir una reseña sobre usted. Puede responder y denunciar una reseña; cada decisión sobre una denuncia va acompañada de una motivación y puede recurrirse una vez.",
    retentionProfile: "su perfil: hasta que usted o la clínica lo retiren del directorio;",
    retentionReviews: "reseñas: hasta que su autor las elimine o se retiren;",
    retentionMetrics: "métricas de clasificación: calculadas sobre los últimos 180 días.",
    rights:
      "Tiene los derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición (arts. 15 a 21 del RGPD), incluido el derecho a oponerse a la clasificación. Escriba a Sorriso a {email}.",
    rightsNoContact:
      "Tiene los derechos de acceso, rectificación, supresión, limitación, portabilidad y oposición (arts. 15 a 21 del RGPD), incluido el derecho a oponerse a la clasificación. Escriba a Sorriso.",
  },
  cookies: {
    summary:
      "Sorriso no utiliza cookies publicitarias ni de seguimiento, y las páginas no cargan nada de servidores de otras empresas mientras navega. Solo utilizamos las pocas cookies técnicas que el sitio necesita para funcionar. No requieren su consentimiento, por eso no hay banner de cookies.",
    item: "{name}: {purpose} Duración: {duration}.",
    staffSession: {
      name: "Sesión del personal ({names})",
      purpose: "mantiene la sesión del personal de la clínica abierta en el panel. Solo se instala cuando el personal inicia sesión.",
      duration: "hasta el cierre de sesión, como máximo 24 horas, y 30 minutos sin actividad",
    },
    locale: {
      name: "Idioma ({names})",
      purpose: "recuerda el idioma que eligió con el selector de idioma. Solo se instala cuando elige un idioma.",
      duration: "1 año",
    },
    privacyCenter: {
      name: "Centro de privacidad ({names})",
      purpose: "mantiene su sesión abierta en el centro de privacidad después de introducir un código de un solo uso.",
      duration: "30 minutos",
    },
    storageIntro: "Aparte de estas cookies, Sorriso solo guarda lo siguiente en el almacenamiento de su navegador. Nunca sale de su dispositivo y solo se guarda cuando utiliza la función:",
    storageItem: "{key}: {purpose}",
    storageItems: {
      dashboardPrivacyScreen:
        "recuerda, en ese dispositivo, si el personal de la clínica activó la pantalla de privacidad del panel, que difumina los nombres de los pacientes en el calendario para que las personas que están en recepción no puedan leerlos. Se conserva hasta que se desactiva.",
    },
    thirdPartiesIntro:
      "Las páginas no cargan scripts, fuentes, imágenes ni marcos de otras empresas. Solo hay dos excepciones, y únicamente cuando usted las solicita:",
    map: "el mapa de la página de una clínica solo aparece después de hacer clic para mostrarlo. En ese momento, su navegador lo carga desde OpenStreetMap (OpenStreetMap Foundation), que recibe su dirección IP conforme a su propia política de privacidad: https://osmfoundation.org/wiki/Privacy_Policy;",
    links: "los enlaces, como los de indicaciones para llegar, abren otros sitios web, por ejemplo Google Maps, en una pestaña nueva: esos sitios aplican sus propias políticas.",
    legalBasis:
      "Las cookies técnicas están permitidas sin consentimiento por el art. 122 del Código italiano de protección de datos y por las directrices del Garante sobre cookies y otras herramientas de seguimiento de 10 de junio de 2021. Esta política le informa sobre ellas.",
    control:
      "Puede eliminar las cookies en cualquier momento desde los ajustes de su navegador. Sin las cookies técnicas, el inicio de sesión y la memorización de su idioma no funcionarán.",
    widget:
      "El widget de reservas que aparece en el sitio web de una clínica no instala cookies propias. El sitio web de la clínica puede utilizar otras cookies: consulte su propia política de cookies.",
  },
} satisfies DeepPartial<Messages["legalPatient"]>;
