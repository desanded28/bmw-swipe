/**
 * Traducción al español de it/consents.ts (el texto italiano es la versión autorizada). Borrador:
 * debe revisarlo un DPD o un abogado antes de su uso en producción (docs/i18n/glossary-es.md).
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  platform_booking_art9: {
    title: "Reserva a través de Sorriso",
    label:
      "Doy mi consentimiento para que Sorriso trate los datos relativos a mi reserva, que pueden revelar información sobre mi salud, con el fin de enviarla a la clínica elegida y gestionar los recordatorios y los cambios.",
    description:
      "Solo es necesario si reserva desde las páginas de búsqueda de Sorriso: para este servicio, Sorriso es responsable autónomo del tratamiento (art. 9, apartado 2, letra a), del RGPD). Puede retirar su consentimiento en cualquier momento desde el centro de privacidad. En ese caso, Sorriso dejará de tratar sus datos, mientras que la clínica conservará los datos necesarios para atenderle. La retirada no afecta a la licitud del tratamiento realizado con anterioridad. Si prefiere no dar su consentimiento, puede reservar directamente con la clínica.",
  },
  whatsapp_channel: {
    title: "Mensajes de WhatsApp",
    label: "Acepto recibir por WhatsApp los mensajes relativos a mis citas.",
    description:
      "WhatsApp es un servicio de Meta. Los mensajes se envían a través de Twilio y pueden tratarse en los Estados Unidos, sobre la base del Marco de Privacidad de Datos UE-EE. UU. y de las cláusulas contractuales tipo. Meta puede saber que usted está en contacto con esta clínica. Puede volver a los SMS o al correo electrónico en cualquier momento.",
  },
  sms_channel: {
    title: "Mensajes SMS",
    label: "Envíenme por SMS las confirmaciones y los recordatorios de mis citas.",
    description:
      "Estos mensajes forman parte del servicio de reservas y solo contienen lo estrictamente necesario: clínica, fecha, hora y un enlace. Puede dejar de recibirlos en cualquier momento respondiendo STOP o desde sus preferencias.",
  },
  email_channel: {
    title: "Correo electrónico",
    label: "Envíenme por correo electrónico las confirmaciones y los recordatorios de mis citas.",
    description:
      "Estos correos forman parte del servicio de reservas. Puede dejar de recibirlos en cualquier momento mediante el enlace para darse de baja que incluye cada correo o desde sus preferencias.",
  },
  feedback_request: {
    title: "Invitaciones a dar su opinión",
    label: "Después de la visita, envíenme una breve invitación a dar mi opinión.",
    description:
      "Recibirá un único mensaje unos días después de la cita. Dar su opinión es opcional. Puede retirar este consentimiento en cualquier momento.",
  },
  review_publication: {
    title: "Publicación de la reseña",
    label:
      "Doy mi consentimiento para que se publique mi reseña en Sorriso y en la página de {practice}. La reseña indica que he tenido una visita con {practitioner}. Puedo eliminarla en cualquier momento desde el centro de privacidad.",
    description:
      "De forma predeterminada, la reseña aparece como «Paciente verificado». No incluya datos sobre su salud: las reseñas que los contienen se revisan antes de publicarse. Si retira su consentimiento, la reseña se elimina.",
  },
  marketing: {
    title: "Novedades y ofertas",
    label: "Deseo recibir novedades y ofertas de {practice}.",
    description:
      "Opcional: no es necesario para reservar ni para recibir tratamiento. Puede retirar su consentimiento en cualquier momento desde cualquier mensaje o desde el centro de privacidad. El consentimiento caduca tras 24 meses sin contacto.",
  },
  adaptive_reminders: {
    title: "Recordatorios adaptativos",
    label: "Adapten el momento y el número de mis recordatorios en función de mis citas anteriores.",
    description:
      "La clínica puede enviarle un recordatorio adicional cuando sea más probable que no acuda a una cita, en función de su historial de citas. Se trata de una elaboración de perfiles basada en el interés legítimo, que nunca limita la posibilidad de reservar. Puede oponerse en cualquier momento: recibirá los recordatorios estándar.",
  },
  no_show_tracking: {
    title: "Historial de citas a las que no acudió",
    label: "La clínica puede registrar las citas a las que no acudo.",
    description:
      "Las citas a las que no ha acudido en los últimos 24 meses se contabilizan para organizar la agenda y ofrecerle ayuda, por ejemplo un recordatorio adicional. Nunca le impiden reservar. Puede oponerse en cualquier momento.",
  },
  recalls: {
    title: "Avisos de revisión",
    label: "Avísenme cuando el dentista me recomiende una revisión.",
    description:
      "Los avisos de revisión solo se envían si el dentista ha fijado para usted un intervalo entre revisiones. Cada aviso incluye una forma de dejar de recibirlos. Puede oponerse en cualquier momento.",
  },
} satisfies DeepPartial<Messages["consents"]>;
