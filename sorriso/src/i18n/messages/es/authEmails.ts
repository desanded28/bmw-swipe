import type { DeepPartial, Messages } from "../../types";

export default {
  greeting: "Hola, {name}:",
  footer: {
    why: "Recibe este correo debido a la actividad de su cuenta de Sorriso.",
    notYou: "Si no ha sido usted, cambie su contraseña e informe al titular de su clínica.",
  },
  verifyEmail: {
    subject: "Confirme su dirección de correo electrónico",
    body: "Confirme que esta es su dirección de correo electrónico para terminar de configurar {practice} en Sorriso. El enlace es válido durante 24 horas.",
    cta: "Confirmar mi correo electrónico",
  },
  verifyEmailAgain: {
    subject: "Confirme su dirección de correo electrónico",
    body: "Confirme que esta es la dirección de correo electrónico de su cuenta de Sorriso. El enlace es válido durante 24 horas.",
    cta: "Confirmar mi correo electrónico",
  },
  verifyPracticeEmail: {
    subject: "Confirme la dirección de correo electrónico de {practice}",
    body: "{owner} ha indicado esta dirección como correo electrónico de {practice} en Sorriso. Las respuestas de los pacientes y las solicitudes de privacidad se enviarán aquí, y las reservas en línea permanecerán en pausa hasta que se confirme. El enlace es válido durante 24 horas. Si no conoce esta clínica, ignore este correo: no cambiará nada.",
    cta: "Confirmar esta dirección",
  },
  signupExisting: {
    subject: "Alguien ha intentado crear una cuenta con su correo electrónico",
    body: "Alguien, posiblemente usted, ha intentado crear una nueva clínica en Sorriso con esta dirección de correo electrónico, que ya tiene una cuenta. Si ha sido usted, inicie sesión o restablezca su contraseña si la ha olvidado. Si no ha sido usted, puede ignorar este correo: no se ha modificado nada.",
    cta: "Iniciar sesión",
  },
  passwordReset: {
    subject: "Restablezca su contraseña de Sorriso",
    body: "Hemos recibido una solicitud para restablecer la contraseña de esta cuenta. El enlace es válido durante 30 minutos y solo funciona una vez. Si no lo ha solicitado, ignore este correo: su contraseña seguirá siendo la misma.",
    cta: "Elegir una nueva contraseña",
  },
  passwordChanged: {
    subject: "Se ha cambiado su contraseña de Sorriso",
    body: "La contraseña de su cuenta se cambió el {when} y se cerró la sesión en todos los dispositivos. Si no ha sido usted, restablezca su contraseña de inmediato.",
    cta: "Restablecer mi contraseña",
  },
  invite: {
    subject: "{inviter} le ha invitado a {practice} en Sorriso",
    body: "{inviter} le ha invitado a unirse a {practice} en Sorriso como {role}. La invitación es válida durante 7 días.",
    cta: "Aceptar la invitación",
  },
  failedLogins: {
    subject: "Intentos fallidos de inicio de sesión en su cuenta",
    body: "Se han producido {count} intentos fallidos de iniciar sesión en su cuenta de Sorriso en los últimos 15 minutos, por lo que los nuevos intentos quedan bloqueados durante un tiempo. Si no ha sido usted, le recomendamos cambiar su contraseña y activar la verificación en dos pasos.",
    cta: "Revisar mi seguridad",
  },
  newDevice: {
    subject: "Nuevo inicio de sesión en su cuenta de Sorriso",
    body: "Se ha iniciado sesión en su cuenta desde un dispositivo nuevo ({device}) el {when}. Si ha sido usted, no tiene que hacer nada. Si no, cierre esa sesión y cambie su contraseña de inmediato.",
    cta: "Revisar mis dispositivos",
  },
  apiKeyCreated: {
    subject: "Se ha creado una nueva clave de API para {practice}",
    body: "{creator} creó la clave de API «{name}» para {practice} el {when}, con este acceso: {scopes}. Caduca el {expires}. Las claves de API permiten a un software leer y modificar datos de pacientes: si no reconoce esta clave, revóquela ahora.",
    cta: "Revisar las claves de API",
  },
  mfaReset: {
    subject: "Se ha restablecido su verificación en dos pasos",
    body: "{actor} restableció la verificación en dos pasos de su cuenta en {practice} el {when}. Se ha cerrado su sesión en todas partes, y deberá configurar una nueva aplicación de autenticación la próxima vez que inicie sesión.",
    cta: "Iniciar sesión",
  },
} satisfies DeepPartial<Messages["authEmails"]>;
