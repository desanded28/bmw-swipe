# Glosario español (es-ES)

Locale `es`, español de España. Fuente de las claves: `src/i18n/messages/en/*.ts`. Fuente de los
textos legales y de consentimiento: el italiano (`it`), que prevalece en caso de discrepancia.

## Registro y estilo

- **Usted** en todos los textos al paciente y al personal (imperativo de usted: "Compruebe",
  "Introduzca", "Elija"). Nunca tú.
- Botones y acciones de menú en **infinitivo** ("Guardar", "Cancelar", "Reservar cita").
- Títulos y etiquetas con mayúscula solo en la primera palabra (no "Title Case").
- Signos de apertura ¿ ¡ siempre. Comillas latinas « » en interfaz y correos; en **SMS** solo comillas
  rectas ' y ".
- Fechas y números no están en los diccionarios: vienen de `datefmt.ts` / `number.ts`.
- Género: "el/la profesional", "paciente" (invariable). Se evita el desdoblamiento "o/a" salvo
  cuando no hay alternativa neutra.

## SMS (patientMessages, careMessages, privacyMessages, common.otp)

- Alfabeto GSM-7: sin «», sin "…", sin rayas – —, sin comillas tipográficas. Á, í, ó, ú no son GSM-7
  (é, ñ, ü, ¿, ¡ sí): se acepta UCS-2 dentro del presupuesto de 3 segmentos, y la clínica puede activar
  la transliteración ASCII (`smsAsciiFallback`).
- Palabra de confirmación: **SI** (sin tilde, como en italiano). Cancelar: **NO**. Baja: **STOP**.
- Discreción: nunca se añaden tratamiento, profesional ni categoría si el inglés no los tiene.
- Formas más cortas posibles: "Resp." no; se escribe "Responda".

## Términos

| Inglés | Español (es-ES) | Notas |
| --- | --- | --- |
| appointment | cita | "visita" solo para la visita médica en sí |
| book / booking | reservar / reserva; "pedir cita" en textos al paciente | |
| practice / studio (it. studio dentistico) | clínica (clínica dental) | nunca "estudio" ni "consulta" en la interfaz |
| location / office | sede | |
| practitioner | profesional | "el/la profesional" |
| dentist | dentista | "odontólogo" solo en textos legales/sanitarios |
| hygienist | higienista dental | |
| reception | recepción | |
| owner (role) | titular | |
| admin (role) | administrador | |
| patient | paciente | |
| check-up | revisión | |
| recall | aviso de revisión | "recordar la revisión" como verbo |
| waitlist | lista de espera | |
| reminder | recordatorio | |
| confirm attendance | confirmar asistencia | |
| no-show | ausencia; estado: "No acudió" | "paciente que no acude" |
| slot | hueco (personal); hora disponible (paciente) | |
| chair | sillón | |
| treatment / service | tratamiento / servicio | |
| review | reseña | |
| feedback | opinión / valoración | |
| verified patient | paciente verificado | |
| consent | consentimiento | |
| withdraw consent | retirar el consentimiento | RGPD art. 7.3 |
| object / objection | oponerse / oposición | |
| data controller | responsable del tratamiento | |
| joint controller | corresponsable del tratamiento | |
| processor | encargado del tratamiento | |
| sub-processor | subencargado del tratamiento | |
| data subject | interesado | |
| privacy notice | información sobre privacidad / política de privacidad | |
| privacy center | centro de privacidad | |
| rights request | solicitud de ejercicio de derechos | |
| access / rectification / erasure / restriction / portability | acceso / rectificación / supresión / limitación del tratamiento / portabilidad | terminología oficial del RGPD |
| data breach | violación de la seguridad de los datos | "brecha de datos" en textos breves |
| supervisory authority | autoridad de control (en Italia: el Garante) | |
| DPO | DPD (delegado de protección de datos) | |
| DPA (art. 28) | contrato de encargo del tratamiento | |
| GDPR | RGPD | |
| legitimate interest | interés legítimo | |
| special categories (health data) | categorías especiales de datos (datos de salud) | art. 9 |
| retention | conservación | |
| pseudonymised / anonymised | seudonimizado / anonimizado | |
| health fund (it. fondo sanitario) | fondo sanitario | concepto italiano; "mutua" sería engañoso |
| direct / indirect (fund) | gestión directa / indirecta | |
| anamnesis / medical history | anamnesis / historial médico | |
| guardian | tutor legal | |
| minor | menor | |
| other adult (contact) | otro adulto | |
| step-up verification | verificación adicional | |
| two-factor authentication | verificación en dos pasos | |
| passkey | llave de acceso | |
| one-time code | código de un solo uso / código de verificación | |
| audit log | registro de auditoría | |
| embed (widget) | widget integrado | |
| marketplace | directorio Sorriso | |
| no-show risk | riesgo de ausencia | |
| export | exportación / exportar | |
| Sorriso, SMS, WhatsApp, API, FHIR, OK, ICS, PDF, CSV | sin traducir | "Email" se traduce como "correo electrónico"/"email" según espacio |

## Aviso de traducción (textos legales)

"Traducción: en caso de discrepancia, prevalece la versión italiana."

## Pendiente de revisión jurídica (Needs lawyer review)

Todos los textos siguientes son traducciones del inglés (el italiano es la versión autorizada) y deben
ser revisados por un abogado o DPD hispanohablante antes de su uso en producción:

- `consents.*` (todos los propósitos: títulos, etiquetas y descripciones; traducidos desde el
  italiano de referencia `it/consents.ts`).
- `legalPatient.*` (aviso de privacidad del paciente, condiciones de uso, cookies, aviso de traducción).
- `legalPractice.*` (condiciones para clínicas, contrato de encargo del tratamiento art. 28, lista de
  subencargados, instrucciones al personal, aviso de traducción).
- `privacy.*` claves sobre derechos del interesado, supresión, menores, tutores y retirada del
  consentimiento.
- `privacyAdmin.*` claves sobre violaciones de datos, plazos de respuesta, conservación y DPIA.
- `privacyMessages.*` y `privacyAdminEmails.*` (notificaciones de violación de datos y respuestas a
  solicitudes de derechos).
- `booking.*` textos de consentimiento del paso de menores / tutor legal.
- `reviews.*` y `reviewEmails.*` textos sobre publicación de reseñas y consentimiento.

## Revisión nativa

- Traducción: agente de traducción WP9 (es-ES), 2026-10-15.
- Revisión por hablante nativo: **pendiente** (firma: ____________________, fecha: __________).
