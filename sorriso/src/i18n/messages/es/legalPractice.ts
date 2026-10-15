/**
 * TEXTO LEGAL: traducción al español. El italiano es la versión autorizada y prevalece en caso de
 * discrepancia. Borrador pendiente de revisión por un DPD o abogado (docs/i18n/glossary-es.md).
 */
import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  staffInstructions: {
    title: "Instrucciones para el personal que trata datos de pacientes",
    intro:
      "Está autorizado a tratar datos personales de los pacientes, incluidos datos de salud, por cuenta de la clínica. Siga estas instrucciones en todos los aspectos de su trabajo.",
    confidentiality:
      "Mantenga la confidencialidad de todo lo que sepa sobre los pacientes, durante su trabajo en la clínica y después de él. No hable nunca de los pacientes donde otras personas puedan oír o ver.",
    needToKnow:
      "Abra solo los pacientes y las citas que necesite para su tarea. Su rol determina lo que puede ver; no pida a sus compañeros accesos que usted no tiene.",
    freeText:
      "No escriba información de salud en campos que se comparten fuera de la clínica, como los mensajes a los pacientes, las entradas de calendario o las notas enviadas a otros proveedores. Los datos clínicos van en la historia clínica.",
    breaches:
      "Comunique de inmediato al titular de la clínica la pérdida de un dispositivo, un mensaje enviado a la persona equivocada o cualquier otra posible violación de datos: la clínica dispone de 72 horas para notificarla al Garante.",
    personalDevices:
      "No copie, exporte ni reenvíe datos de pacientes a dispositivos personales, a cuentas personales de correo o de mensajería, ni a ningún servicio que la clínica no haya aprobado.",
    calendarSync:
      "Si sincroniza su agenda con un calendario personal, mantenga el nivel de detalle mínimo: solo horas, sin nombres de pacientes ni tratamientos.",
    accessLog:
      "Cada acceso a los datos de los pacientes queda registrado en un registro de auditoría que la clínica puede revisar para proteger a los pacientes. El registro no se utiliza para controlar su rendimiento.",
    adTools:
      "No conecte nunca el widget de reservas ni el sitio web de la clínica a herramientas publicitarias o de analítica de forma que les revele quién ha reservado: el hecho de que alguien haya pedido cita con un dentista es información de salud.",
    restricted:
      "Algunas fichas están restringidas a petición del paciente. Abra una solo cuando realmente lo necesite, e indique el motivo que le pide el sistema: cada acceso queda registrado.",
    accept: "He leído estas instrucciones y las cumpliré",
    version: "Versión {version}",
  },

  common: {
    version: "Versión {version}",
    effective: "En vigor desde el {date}",
    italianPrevails: "Traducción: en caso de discrepancia, prevalece la versión italiana.",
    print: "Imprimir o guardar como PDF",
    contents: "Índice",
    notConfigured: "Sin configurar",
    onRequest: "Previa solicitud",
    platformParty: "{name}, {address} (contacto de privacidad: {email})",
    platformPartyShort: "{name} (contacto de privacidad: {email})",
    backToTop: "Volver arriba",
  },

  purposes: {
    booking_practice: {
      activity: "Reserva de citas (canales de la clínica)",
      purpose:
        "Reserva, modificación y cancelación de las citas solicitadas a través del sitio web de la clínica, su widget de reservas, sus propios enlaces, el teléfono, la recepción y las integraciones que elija.",
    },
    booking_marketplace: {
      activity: "Reservas iniciadas en las páginas de búsqueda de Sorriso",
      purpose: "Envío de la reserva a la clínica elegida y su gestión, con el consentimiento explícito del paciente (Sorriso como responsable autónomo del tratamiento).",
    },
    appointment_management: {
      activity: "Agenda y fichas de pacientes",
      purpose: "Gestión del calendario, los sillones y los profesionales de la clínica, del historial de citas de los pacientes y de las notas administrativas de la clínica.",
    },
    reminders: {
      activity: "Confirmaciones y recordatorios",
      purpose:
        "Envío de confirmaciones de reserva, recordatorios, cambios y cancelaciones por SMS, correo electrónico o, cuando la clínica lo activa y el paciente lo elige, WhatsApp; tratamiento de las respuestas.",
    },
    waitlist: {
      activity: "Lista de espera",
      purpose: "Ofrecimiento de las horas que quedan libres a los pacientes que pidieron que se les avisara de citas anteriores.",
    },
    recalls: {
      activity: "Avisos de revisión",
      purpose: "Recordatorio de una revisión a los pacientes cuyo dentista ha fijado un intervalo para ellos.",
    },
    feedback_requests: {
      activity: "Invitaciones a dar su opinión",
      purpose: "Invitación a los pacientes que lo consintieron a dar su opinión después de una visita.",
    },
    reviews: {
      activity: "Reseñas publicadas",
      purpose: "Publicación en Sorriso de las reseñas de pacientes verificados con su consentimiento (Sorriso como responsable autónomo del tratamiento).",
    },
    marketing: {
      activity: "Novedades y ofertas",
      purpose: "Envío de novedades y ofertas de la clínica a los pacientes que lo aceptaron.",
    },
    no_show_tracking: {
      activity: "Historial de citas a las que no se acudió",
      purpose: "Recuento de las citas a las que no se acudió en los últimos 24 meses para organizar la agenda y ofrecer ayuda adicional; nunca para denegar la asistencia.",
    },
    adaptive_reminders: {
      activity: "Recordatorios adaptativos",
      purpose:
        "Estimación, a partir del historial de citas, de cuándo resulta útil un recordatorio adicional (elaboración de perfiles sin ningún efecto sobre el acceso a la asistencia; el paciente puede oponerse).",
    },
    anamnesis: {
      activity: "Historial médico previo a la visita",
      purpose: "Recogida del cuestionario de historial médico antes de la visita, firmado con un código de un solo uso, para el profesional sanitario.",
    },
    partner_api: {
      activity: "Integraciones (API para socios)",
      purpose: "Intercambio de datos de reservas con el software que conecta la clínica, como su sistema de gestión o su centro de llamadas.",
    },
    directory: {
      activity: "Directorio de clínicas y profesionales",
      purpose: "Publicación de los perfiles de las clínicas y de los profesionales que los aprobaron.",
    },
    ranking: {
      activity: "Clasificación de las búsquedas",
      purpose: "Ordenación de los resultados de búsqueda con criterios neutrales que se explican a los usuarios.",
    },
    privacy_center: {
      activity: "Centro de privacidad de los pacientes",
      purpose: "Permitir a los pacientes encontrar sus fichas en las distintas clínicas, descargarlas y ejercer sus derechos.",
    },
    staff_accounts: {
      activity: "Cuentas del personal",
      purpose: "Gestión de las cuentas del personal de la clínica y de sus derechos de acceso.",
    },
    security_logs: {
      activity: "Registro de accesos y seguridad",
      purpose:
        "Registro de quién ha accedido a los datos de los pacientes o los ha modificado, para proteger a los pacientes y detectar usos indebidos. Se informa al personal (art. 4 de la Ley italiana 300/1970); el registro no se utiliza para controlar el rendimiento.",
    },
    privacy_requests: {
      activity: "Solicitudes de protección de datos",
      purpose: "Recepción y respuesta, en los plazos legales, de las solicitudes de ejercicio de los derechos de protección de datos.",
    },
  },

  legalBases: {
    art6_1_a: "Consentimiento (art. 6.1.a) del RGPD)",
    art6_1_b: "Contrato o medidas precontractuales (art. 6.1.b))",
    art6_1_c: "Obligación legal (art. 6.1.c))",
    art6_1_f: "Interés legítimo (art. 6.1.f))",
    art9_2_a: "Consentimiento explícito para datos de salud (art. 9.2.a))",
    art9_2_f: "Formulación o defensa de reclamaciones (art. 9.2.f))",
    art9_2_h: "Asistencia sanitaria sujeta al secreto profesional (art. 9.2.h) y 9.3)",
  },

  dataCategories: {
    identity: "datos identificativos (nombre, fecha de nacimiento)",
    contact: "datos de contacto (teléfono, correo electrónico)",
    appointment: "datos de las citas (fecha, hora, clínica, profesional)",
    health_inferred: "datos que pueden revelar información sobre la salud (recibir asistencia dental, tipo de tratamiento)",
    health: "datos de salud (notas, historial médico)",
    minor: "datos de menores",
    guardian: "datos de progenitores y tutores legales",
    message_content: "contenido de los mensajes",
    consent_record: "registros de consentimiento",
    review: "reseñas",
    professional: "datos profesionales de los profesionales sanitarios",
    account: "datos de la cuenta",
    technical: "datos técnicos (dirección IP seudonimizada, navegador)",
    aggregated_metrics: "estadísticas agregadas",
  },

  subjects: {
    patients: "pacientes",
    guardians: "progenitores y tutores legales",
    bookers: "personas que reservan para otra persona",
    practitioners: "profesionales",
    staff: "personal de la clínica",
    reviewers: "autores de reseñas",
  },

  transferTools: {
    eu: "Sin transferencia: proveedor de la UE/EEE",
    dpf: "Marco de Privacidad de Datos UE-EE. UU. (art. 45 del RGPD)",
    scc: "Cláusulas contractuales tipo (art. 46.2.c) del RGPD)",
    dpf_scc: "Marco de Privacidad de Datos UE-EE. UU., con cláusulas contractuales tipo como garantía subsidiaria",
  },

  units: {
    months: p({ one: "{count} mes", other: "{count} meses" }),
    days: p({ one: "{count} día", other: "{count} días" }),
    hours: p({ one: "{count} hora", other: "{count} horas" }),
  },

  retention: {
    patientInactiveMonths:
      "Ficha del paciente: {period} después de la última visita; después, se limita o se seudonimiza según elija la clínica (más tiempo cuando deba conservarse la historia clínica).",
    neverSeenPatientMonths: "Fichas de personas que nunca tuvieron una cita: {period}.",
    messageBodyMonths: "Texto de los mensajes: {period}.",
    messageMetaMonths: "Registro de mensajes (destinatario, fecha, estado): {period}.",
    reminderDays: "Recordatorios programados: {period} después de la cita.",
    waitlistDays: "Solicitudes de lista de espera: {period} después de su última fecha útil; las cerradas, a los 30 días.",
    patientNoteDays: "La nota de reserva del paciente y el motivo de cancelación: {period} después de la visita.",
    auditMonths: "Registro de accesos: {period}.",
    providerMessageDays: "Copias conservadas por el proveedor de mensajería: {period}.",
    formSubmissionMonths: "Formularios de historial médico, una vez copiados en la historia clínica: {period}.",
    consentMonths: "Registros de consentimiento de pacientes que ya no figuran en los archivos: {period}.",
    privacyRequestMonths: "Solicitudes cerradas: {period}.",
    marketingLapse: "El consentimiento para novedades y ofertas caduca tras 24 meses sin contacto.",
    contract: "Mientras se preste el servicio y, después, durante el plazo de prescripción.",
  },

  register: {
    title: "Registro de las actividades de tratamiento",
    intro:
      "Art. 30.1 del RGPD. Generado a partir de lo que Sorriso hace para la clínica y de su configuración actual; añada las actividades que realiza fuera de Sorriso. Manténgalo actualizado y muéstrelo al Garante cuando se lo solicite.",
    controller: "Responsable del tratamiento",
    vat: "NIF/IVA",
    address: "Domicilio social",
    contact: "Contacto de privacidad",
    dpo: "Delegado de protección de datos",
    none: "—",
    generated: "Generado el {date}",
    columns: {
      activity: "Actividad de tratamiento",
      purpose: "Finalidad",
      legalBasis: "Base jurídica",
      subjects: "Interesados",
      dataCategories: "Categorías de datos personales",
      recipients: "Destinatarios",
      transfers: "Transferencias fuera de la UE",
      retention: "Plazos de supresión",
      security: "Medidas de seguridad",
    },
    recipient: "{name} ({service})",
    processor: "Sorriso, como encargado del tratamiento en virtud del contrato de encargo",
    transfer: "{name}: {tool}",
    noTransfers: "Ninguna",
    security: {
      platform:
        "Cifrado a nivel de campo de notas y mensajes; acceso basado en roles; registro de accesos a prueba de manipulaciones; conservación automatizada; copias de seguridad cifradas en la UE; personal instruido y sujeto a confidencialidad.",
      mfaRequired: "Inicio de sesión en dos pasos obligatorio para todo el personal.",
      mfaOptional: "Inicio de sesión en dos pasos disponible, pero no obligatorio.",
      sessions: p({ one: "Las sesiones caducan al cabo de {count} hora.", other: "Las sesiones caducan al cabo de {count} horas." }),
      discreet: "Los mensajes nunca mencionan el tratamiento.",
      detailed: "Los mensajes pueden mencionar el tratamiento (por decisión de la clínica).",
    },
  },

  controls: {
    encryption: {
      title: "Cifrado de los campos sensibles",
      body: "Las notas, los textos de los mensajes, las respuestas del historial médico y demás textos libres se cifran en la base de datos con AES-256-GCM, con claves que se guardan fuera de la base de datos.",
    },
    transport: {
      title: "Cifrado en tránsito",
      body: "Todas las conexiones utilizan TLS; se indica a los navegadores que usen solo HTTPS y las páginas aplican una política de seguridad de contenidos estricta.",
    },
    access_control: {
      title: "Acceso basado en roles",
      body: "Cada rol del personal ve solo lo que necesita: recepción no tiene acceso a las notas clínicas; las exportaciones, la supresión y los ajustes están reservados a los titulares y administradores.",
    },
    mfa: {
      title: "Inicio de sesión en dos pasos",
      body: "El personal inicia sesión con una contraseña y un código de una aplicación de autenticación; las operaciones sensibles vuelven a pedir el código.",
    },
    sessions: {
      title: "Límites de las sesiones",
      body: "Las sesiones caducan tras el periodo que fija la clínica y tras un tiempo de inactividad; el personal puede revocarlas.",
    },
    audit_log: {
      title: "Registro de accesos a prueba de manipulaciones",
      body: "Cada acceso a los datos de los pacientes y cada modificación se registran en un registro encadenado mediante hashes que la clínica puede verificar y exportar; los extremos de la cadena se guardan fuera de la base de datos.",
    },
    pseudonymous_logs: {
      title: "Registros sin datos personales",
      body: "Los registros de la aplicación enmascaran los números de teléfono y las direcciones de correo electrónico; las direcciones IP solo se guardan como hashes con clave.",
    },
    rate_limiting: {
      title: "Protección frente a abusos",
      body: "El inicio de sesión, los códigos de un solo uso y los puntos de acceso públicos de reserva tienen un límite de solicitudes.",
    },
    links: {
      title: "Enlaces de paciente con caducidad",
      body: "Los enlaces de los mensajes contienen tokens aleatorios, guardados solo como hashes, que caducan después de la visita.",
    },
    otp: {
      title: "Códigos de un solo uso",
      body: "Los códigos se guardan solo como hashes, caducan a los 5 minutos y se bloquean tras varios intentos fallidos.",
    },
    discreet_messages: {
      title: "Mensajes discretos",
      body: "De forma predeterminada, los SMS, los mensajes de WhatsApp, los asuntos de los correos y las entradas de calendario nunca mencionan el tratamiento, la especialidad ni las notas.",
    },
    retention: {
      title: "Conservación automatizada",
      body: "Un proceso diario suprime, oculta o seudonimiza los datos cuando finaliza su plazo de conservación.",
    },
    erasure: {
      title: "Supresión y limitación",
      body: "Las clínicas pueden exportar, seudonimizar o limitar los datos de un paciente en un solo paso; las fichas restringidas exigen un motivo para cada acceso.",
    },
    backups: {
      title: "Copias de seguridad",
      body: "Las copias de seguridad cifradas con recuperación a un momento dado se conservan en la UE durante un periodo limitado y después se sobrescriben.",
    },
    key_rotation: {
      title: "Gestión de claves",
      body: "Las claves de cifrado pueden rotarse sin interrupción del servicio; las claves antiguas solo sirven para descifrar.",
    },
    no_trackers: {
      title: "Sin rastreadores de terceros",
      body: "Las páginas de Sorriso no cargan scripts, fuentes, píxeles ni cookies publicitarias de terceros; esto se comprueba automáticamente.",
    },
    staff_instructions: {
      title: "Personal instruido",
      body: "Cada miembro del personal acepta instrucciones escritas de protección de datos antes de trabajar con datos de pacientes; las aceptaciones quedan registradas.",
    },
    breach_procedure: {
      title: "Procedimiento ante violaciones de datos",
      body: "Un procedimiento documentado para evaluar, contener y notificar las violaciones de la seguridad de los datos personales, con notificación a la clínica en un plazo de 24 horas.",
    },
  },

  subprocessors: {
    title: "Subencargados del tratamiento",
    description: "Los proveedores que utiliza Sorriso para tratar los datos de las clínicas, dónde los tratan y cómo se protegen las transferencias.",
    intro:
      "Cuando una clínica utiliza Sorriso, Sorriso trata los datos de los pacientes por cuenta de la clínica como su encargado del tratamiento (art. 28 del RGPD). Sorriso utiliza los proveedores que se indican a continuación. Cada uno está vinculado por un contrato de encargo del tratamiento con obligaciones al menos tan estrictas como las del contrato de encargo de Sorriso.",
    noticeRule:
      "Sorriso informa a las clínicas de cualquier subencargado nuevo o sustituido con una antelación mínima de 30 días, por correo electrónico y en el panel. La clínica puede oponerse dentro de ese plazo; si no se encuentra una solución, puede resolver el contrato sin penalización antes de que se aplique el cambio.",
    transfersNote:
      "Un proveedor cuya sociedad matriz se encuentra en los Estados Unidos puede verse obligado a dar acceso a los datos aunque sus servidores estén en la UE. Esas transferencias se basan en el Marco de Privacidad de Datos UE-EE. UU., con cláusulas contractuales tipo como garantía subsidiaria, y se valoran en una evaluación de impacto de las transferencias.",
    columns: {
      name: "Proveedor",
      entity: "Entidad jurídica",
      service: "Servicio",
      data: "Datos",
      region: "Ubicación",
      transfer: "Garantía de la transferencia",
      dpa: "Contrato",
    },
    onlyWhatsapp: "Solo para las clínicas que activan WhatsApp, y solo para los pacientes que lo eligen.",
    parent: "Sociedad matriz: {parent}",
    viewDpa: "Contrato de encargo del proveedor",
    service: {
      hosting: "Alojamiento de la aplicación",
      database: "Base de datos",
      sms: "Mensajes SMS",
      whatsapp: "Mensajes de WhatsApp",
      email: "Envío de correo electrónico",
      backups: "Copias de seguridad",
    },
    data: {
      all_platform_data: "todos los datos almacenados en Sorriso",
      contact: "datos de contacto",
      message_content: "contenido de los mensajes",
      message_metadata: "metadatos de los mensajes",
      technical: "datos técnicos",
    },
    changelog: "Historial de cambios",
    change: {
      initial: "Primera lista publicada.",
      added: "Se ha añadido {name}.",
      removed: "Se ha eliminado {name}.",
      changed: "Se han modificado los datos de {name}.",
    },
    announced: "Anunciado el {date}",
  },

  dpa: {
    title: "Contrato de encargo del tratamiento",
    description: "El contrato previsto en el art. 28 del RGPD entre cada clínica (responsable del tratamiento) y Sorriso (encargado del tratamiento).",
    intro:
      "Este contrato forma parte de las condiciones del servicio. Se aplica siempre que Sorriso trata datos personales por cuenta de una clínica. La clínica lo acepta en el panel; la aceptación queda registrada con su versión, fecha e idioma.",
    parties: {
      title: "1. Partes y funciones",
      body: "Responsable del tratamiento: la clínica que utiliza Sorriso. Encargado del tratamiento: {platform}.\n\nEl Responsable decide por qué y cómo se tratan los datos de los pacientes en las reservas que recibe a través de sus propios canales: su sitio web y su widget de reservas, sus propios enlaces, el teléfono y la recepción, y las integraciones que conecta. Sorriso trata esos datos únicamente como encargado del tratamiento del Responsable.",
    },
    subject: {
      title: "2. Objeto, duración, naturaleza y finalidad",
      body: "Objeto: el servicio de reservas en línea, recordatorios, lista de espera, avisos de revisión y gestión de pacientes descrito en las condiciones del servicio.\n\nDuración: mientras exista la cuenta de la clínica y, después, hasta que los datos se supriman o se devuelvan conforme a la cláusula 11.\n\nNaturaleza y finalidad, tipos de datos y categorías de interesados: según se describe en el Anexo I, que se genera a partir del tratamiento que Sorriso realiza efectivamente.",
    },
    instructions: {
      title: "3. Instrucciones documentadas (art. 28.3.a))",
      body: "Sorriso trata los datos personales únicamente siguiendo las instrucciones documentadas del Responsable: este contrato, las condiciones del servicio, la configuración del Responsable en el panel y las operaciones que realiza su personal. Esto incluye las transferencias a terceros países, que solo se realizan según se describe en el Anexo III.\n\nEl Responsable encarga a Sorriso el envío de invitaciones a dar su opinión a los pacientes que lo consintieron, así como la aplicación de los plazos de conservación fijados en el panel.\n\nSi el Derecho de la UE o el Derecho italiano obligan a Sorriso a tratar los datos de otro modo, Sorriso informará al Responsable antes del tratamiento, salvo que la ley lo prohíba. Sorriso informará inmediatamente al Responsable si, en su opinión, una instrucción infringe la normativa de protección de datos.",
    },
    confidentiality: {
      title: "4. Confidencialidad (art. 28.3.b))",
      body: "Sorriso garantiza que las personas que autoriza a tratar los datos están sujetas a confidencialidad, reciben instrucciones de protección de datos y acceden a los datos solo en la medida en que su tarea lo requiere. El personal de Sorriso nunca accede a las fichas de los pacientes salvo para prestar la asistencia técnica que haya solicitado el Responsable, para mantener la seguridad del servicio o cuando lo exija la ley; dichos accesos quedan registrados.",
    },
    security: {
      title: "5. Seguridad (art. 28.3.c) y art. 32)",
      body: "Sorriso aplica las medidas técnicas y organizativas del Anexo II, teniendo en cuenta el estado de la técnica, los costes y los riesgos para los pacientes, en particular porque los datos pueden revelar información sobre la salud. Sorriso revisa estas medidas periódicamente y no reduce el nivel general de protección.",
    },
    subprocessors: {
      title: "6. Subencargados del tratamiento (art. 28.2 y 28.4)",
      body: "El Responsable otorga a Sorriso una autorización general para recurrir a los subencargados indicados en el Anexo III y en la página pública de subencargados. Sorriso informará al Responsable de cualquier incorporación o sustitución prevista con una antelación mínima de 30 días, por correo electrónico y en el panel. El Responsable podrá oponerse dentro de ese plazo por motivos razonables de protección de datos; si no se encuentra una solución, el Responsable podrá resolver el servicio afectado sin penalización antes de que se aplique el cambio.\n\nSorriso impone contractualmente a cada subencargado las mismas obligaciones de protección de datos que las de este contrato, y sigue siendo plenamente responsable ante el Responsable del cumplimiento de dichas obligaciones.",
    },
    rights: {
      title: "7. Derechos de los interesados (art. 28.3.e))",
      body: "Sorriso ayuda al Responsable a responder a las solicitudes de ejercicio de los derechos del capítulo III del RGPD con herramientas del panel: la bandeja de solicitudes con sus plazos, la exportación en JSON, CSV y FHIR, la rectificación, la limitación y la supresión mediante seudonimización.\n\nSi una solicitud relativa al tratamiento del Responsable llega a Sorriso, Sorriso la remitirá al Responsable en un plazo de 2 días hábiles y no la responderá en nombre del Responsable, salvo para informar al solicitante de que se ha remitido.",
    },
    assistance: {
      title: "8. Asistencia en el cumplimiento de las obligaciones del Responsable (art. 28.3.f))",
      body: "Teniendo en cuenta la naturaleza del tratamiento y la información de que dispone, Sorriso asiste al Responsable en materia de seguridad (art. 32), notificación y comunicación de violaciones de datos (arts. 33 y 34), evaluaciones de impacto relativas a la protección de datos y consulta previa (arts. 35 y 36). Sorriso pone a disposición su propia evaluación de impacto de la plataforma y su evaluación de impacto de las transferencias.",
    },
    breach: {
      title: "9. Violaciones de la seguridad de los datos personales",
      body: "Sorriso notificará al Responsable, sin dilación indebida y en cualquier caso en un plazo de 24 horas desde que tenga conocimiento de ella, cualquier violación de la seguridad de los datos personales que afecte a los datos del Responsable. La notificación describirá, en la medida en que se conozcan, la naturaleza de la violación, las categorías y el número aproximado de pacientes y registros afectados, las consecuencias probables y las medidas adoptadas o propuestas. Sorriso irá completando la información a medida que disponga de ella, de modo que el Responsable pueda notificarla al Garante en un plazo de 72 horas y, cuando proceda, informar a los pacientes.",
    },
    audits: {
      title: "10. Información y auditorías (art. 28.3.h))",
      body: "Sorriso pone a disposición del Responsable toda la información necesaria para demostrar el cumplimiento del art. 28: este contrato, el registro de actividades de tratamiento, las medidas de seguridad, las certificaciones o los informes de auditoría cuando existan, y el registro de accesos del panel. Sorriso permite auditorías e inspecciones por parte del Responsable o de un auditor designado por este, sujeto a confidencialidad, con un preaviso mínimo de 30 días, en horario laboral y sin perturbar el servicio; las auditorías corren a cargo del Responsable, salvo que revelen un incumplimiento sustancial.",
    },
    deletion: {
      title: "11. Devolución y supresión al finalizar (art. 28.3.g))",
      body: "El Responsable puede descargar todos sus datos en cualquier momento, en formatos documentados (JSON, CSV y FHIR R4), sin coste alguno. Cuando el Responsable cierra su cuenta, las reservas en línea se detienen de inmediato, los datos siguen disponibles para su descarga durante 60 días (una transición de 30 días y al menos otros 30 días para recuperarlos) y, después, se suprimen de los sistemas de Sorriso. Sorriso emite un certificado de supresión en el que se indica qué se ha suprimido y cuándo. Las copias de seguridad cifradas se sobrescriben dentro de su plazo de conservación y no se restauran salvo para recuperarse de un incidente. Sorriso solo conserva los datos durante más tiempo cuando lo exija el Derecho de la UE o el Derecho italiano, y únicamente para ese fin.",
    },
    transfers: {
      title: "12. Transferencias fuera de la UE",
      body: "Los datos se alojan en la UE. Algunos subencargados pertenecen a grupos con sede en los Estados Unidos; las garantías de transferencia de cada uno se indican en el Anexo III, y se ha evaluado su impacto. Sorriso no transfiere los datos del Responsable a ningún otro tercer país sin informar previamente al Responsable conforme a la cláusula 6.",
    },
    ownPurposes: {
      title: "13. Tratamientos de los que Sorriso es responsable",
      body: "Para algunas actividades, Sorriso es responsable autónomo del tratamiento, no encargado del Responsable, y así lo comunica a los pacientes en su propia información sobre privacidad: las reservas iniciadas en las páginas de búsqueda de Sorriso (con el consentimiento explícito del paciente), las reseñas publicadas, el directorio y la clasificación de las búsquedas, el centro de privacidad de los pacientes y las cuentas del personal. Sorriso no utiliza los datos que trata por cuenta del Responsable para ningún otro fin propio, y nunca los vende ni los utiliza con fines publicitarios.",
    },
    controller: {
      title: "14. Obligaciones del Responsable",
      body: "El Responsable garantiza que dispone de una base jurídica para el tratamiento, facilita a los pacientes su información sobre privacidad (Sorriso genera una a partir de la configuración de la clínica), instruye a su personal y mantiene actualizados su configuración, sus plazos de conservación y su registro de actividades de tratamiento. El Responsable no conecta el widget de reservas ni las páginas de Sorriso a herramientas publicitarias o de analítica de forma que les revele quién ha reservado.",
    },
    liability: {
      title: "15. Responsabilidad y duración",
      body: "Cada parte responde conforme a lo dispuesto en el art. 82 del RGPD y en las condiciones del servicio. Este contrato estará vigente mientras Sorriso trate datos personales por cuenta del Responsable. En caso de conflicto con las condiciones del servicio en materia de protección de datos, prevalecerá este contrato.",
    },
    law: {
      title: "16. Legislación aplicable",
      body: "Este contrato se rige por la legislación italiana. Las controversias se someten a la jurisdicción establecida en las condiciones del servicio.",
    },
    annex1: {
      title: "Anexo I — Descripción del tratamiento",
      intro: "El tratamiento que Sorriso realiza como encargado, generado a partir del registro de finalidades de la plataforma.",
    },
    annex2: {
      title: "Anexo II — Medidas técnicas y organizativas",
      intro: "Las medidas vigentes a día de hoy. Esta lista se genera a partir de los controles implementados en la plataforma.",
    },
    annex3: {
      title: "Anexo III — Subencargados del tratamiento",
      intro: "La lista actual (versión {version}). La página pública conserva el historial de cambios.",
    },
  },

  terms: {
    title: "Condiciones del servicio para clínicas",
    description: "El contrato entre Sorriso y las clínicas dentales que lo utilizan.",
    intro:
      "Estas condiciones regulan el uso de Sorriso por parte de las clínicas dentales («la clínica») y se celebran con {platform}. La clínica las acepta en el panel; la aceptación queda registrada con su versión, fecha e idioma.",
    service: {
      title: "1. El servicio",
      body: "Sorriso ofrece reservas en línea para el sitio web de la clínica y para las páginas de búsqueda de Sorriso, un calendario para profesionales, sillones y sedes, confirmaciones y recordatorios, una lista de espera, avisos de revisión, fichas de pacientes para la gestión administrativa y herramientas para cumplir las obligaciones de protección de datos. Sorriso no es un prestador de asistencia sanitaria ni ofrece consejo médico.",
    },
    account: {
      title: "2. Cuentas y personal",
      body: "La clínica designa a un titular que gestiona su cuenta e invita al personal asignándole un rol. La clínica es responsable del uso que su personal hace del servicio, mantiene la confidencialidad de las credenciales de acceso y activa el inicio de sesión en dos pasos. Cada miembro del personal debe aceptar las instrucciones de protección de datos antes de trabajar con datos de pacientes.",
    },
    data: {
      title: "3. Protección de datos",
      body: "Para los datos de los pacientes que reservan a través de los propios canales de la clínica, la clínica es la responsable del tratamiento y Sorriso su encargado: se aplica el contrato de encargo del tratamiento, que forma parte de estas condiciones. Para las reservas iniciadas en las páginas de búsqueda de Sorriso, las reseñas, el directorio y el centro de privacidad, Sorriso es responsable autónomo del tratamiento, como se explica en su información sobre privacidad.",
    },
    obligations: {
      title: "4. Obligaciones de la clínica",
      body: "La clínica facilita información exacta sobre sus servicios, precios, profesionales y disponibilidad; respeta las reservas que acepta; utiliza los datos de los pacientes únicamente con fines asistenciales y administrativos; y no utiliza Sorriso para enviar comunicaciones no solicitadas.",
    },
    marketplace: {
      title: "5. Búsqueda, clasificación y reseñas",
      body: "Las clínicas solo aparecen en las búsquedas de Sorriso si figuran en el directorio y con profesionales que hayan aprobado su perfil. La clasificación utiliza criterios neutrales publicados en la página de clasificación; ningún pago influye en la posición. Solo los pacientes con una visita realizada pueden escribir reseñas, y las clínicas no pueden eliminarlas: pueden responder y denunciar una reseña, sobre lo que Sorriso decide de forma motivada y con una única posibilidad de recurso.",
    },
    availability: {
      title: "6. Disponibilidad y asistencia técnica",
      body: "Sorriso actúa con la diligencia razonable para mantener el servicio disponible y seguro, y anuncia con antelación los mantenimientos programados. La asistencia técnica está disponible por correo electrónico en días laborables.",
    },
    fees: {
      title: "7. Tarifas",
      body: "Las tarifas, en su caso, son las del plan elegido por la clínica, que se muestran en el panel. Sorriso anuncia los cambios de precio con una antelación mínima de 30 días. Las exportaciones y el cambio a otro proveedor son gratuitos.",
    },
    ip: {
      title: "8. Propiedad intelectual",
      body: "La clínica conserva todos los derechos sobre sus contenidos y datos. Sorriso conserva todos los derechos sobre el software. La clínica concede a Sorriso el derecho a mostrar su perfil público y sus contenidos para los fines del servicio.",
    },
    suspension: {
      title: "9. Suspensión",
      body: "Sorriso solo puede suspender una cuenta por un incumplimiento grave de estas condiciones, un riesgo para la seguridad o una obligación legal, comunicando previamente por escrito los motivos a la clínica cuando sea posible y, a más tardar, en el momento en que la suspensión surta efecto. La clínica puede impugnar la decisión mediante el procedimiento de reclamaciones.",
    },
    exit: {
      title: "10. Resolución, cambio de proveedor y recuperación de los datos",
      body: "La clínica puede cerrar su cuenta en cualquier momento desde el panel, sin plazo de preaviso. Las reservas en línea se detienen de inmediato; la clínica conserva el acceso durante una transición de 30 días y al menos otros 30 días para recuperar sus datos en JSON, CSV y FHIR, de forma gratuita, y Sorriso la ayuda a migrar a otro proveedor. Después, los datos se suprimen y se emite un certificado de supresión. Sorriso puede resolver el contrato con un preaviso de dos meses, o de inmediato en caso de incumplimiento grave.",
    },
    liability: {
      title: "11. Responsabilidad",
      body: "Ninguna de las partes excluye su responsabilidad por dolo o culpa grave, ni cuando la ley no lo permita. En los demás casos, la responsabilidad de cada parte se limita a los daños directos previsibles. Sorriso no es responsable de los servicios clínicos de la clínica.",
    },
    complaints: {
      title: "12. Reclamaciones y mediación",
      body: "La clínica puede enviar reclamaciones a Sorriso a través del panel o por correo electrónico; Sorriso responde en un plazo de 15 días hábiles. Sorriso está dispuesto a recurrir a la mediación para resolver extrajudicialmente las controversias, conforme a lo previsto en el Reglamento (UE) 2019/1150.",
    },
    changes: {
      title: "13. Modificaciones de estas condiciones",
      body: "Sorriso anuncia las modificaciones con una antelación mínima de 30 días por correo electrónico y en el panel, salvo que una ley exija un cambio más rápido. Si la clínica no está de acuerdo, podrá resolver el contrato antes de que se aplique la modificación, sin coste alguno.",
    },
    law: {
      title: "14. Legislación aplicable y tribunales",
      body: "Estas condiciones se rigen por la legislación italiana. Son competentes los tribunales del domicilio social de Sorriso, sin perjuicio de las normas imperativas.",
    },
  },

  docs: {
    dpa: "Contrato de encargo del tratamiento",
    terms: "Condiciones del servicio",
    subprocessors: "Subencargados del tratamiento",
    staff_instructions: "Instrucciones para el personal",
  },
} satisfies DeepPartial<Messages["legalPractice"]>;
