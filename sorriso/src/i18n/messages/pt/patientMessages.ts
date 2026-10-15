/**
 * European Portuguese patient messages. Rules: see messages/en/patientMessages.ts.
 * SMS: straight quotes only, no ellipsis. Portuguese accents (ã, ç, á, ó...) are not GSM-7, so the
 * full texts are UCS-2; the `*Short` texts use plain ASCII only so that they stay in GSM-7.
 * Reply words: SIM (confirm), NAO (cancel), STOP, START (src/lib/inbound.ts).
 * Email bodies start with a capital letter: in Portuguese the text after the greeting is a new sentence.
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  format: {
    slot: "{day}/{month} {time}",
  },

  email: {
    greeting: "Olá {name},",
    when: "Quando",
    where: "Onde",
    service: "Tratamento",
    with: "Com",
    patient: "Paciente",
    manage: "Gerir consulta",
    confirm: "Confirmar presença",
    cancel: "Cancelar",
    reschedule: "Remarcar",
    calendar: "Adicionar ao calendário",
    detailsOnline: "Encontra todos os pormenores da consulta na página da sua consulta.",
  },

  privacyFooter: {
    sender: "{name} · {address}",
    phone: "Tel.: {phone}",
    why: "Recebe este email porque tem uma consulta em {clinic}.",
    whyGuardian: "Recebe este email porque é o contacto para as consultas de {patient} em {clinic}.",
    whyWaitlist: "Recebe este email porque se inscreveu na lista de espera de {clinic}.",
    whyGeneric: "Recebe este email porque é paciente de {clinic}.",
    object:
      "Pode opor-se aos lembretes ou retirar qualquer consentimento a qualquer momento nas suas escolhas de privacidade, ou respondendo STOP às nossas mensagens SMS.",
    notice: "Aviso de privacidade",
    preferences: "As suas escolhas de privacidade",
  },

  booked: {
    subject: "Consulta marcada - {clinic} - {date}",
    subjectDetailed: "Consulta marcada: {service}, {date}",
    body: "A sua consulta está marcada. Vamos enviar-lhe um lembrete antes da consulta.",
    sms: "{clinic}: consulta marcada para {when}. Gerir: {url} Aviso de privacidade: {privacy} STOP para não receber SMS",
    smsShort: "{clinic}: consulta marcada para {slot}. Gerir: {url}",
    smsDetailed: "{clinic}: marcada, {service} com {practitioner} {when}. Gerir: {url} STOP para não receber SMS",
  },

  requested: {
    subject: "Pedido recebido - {clinic} - {date}",
    subjectDetailed: "Pedido recebido: {service}",
    body: "Recebemos o seu pedido. A clínica vai confirmá-lo em breve e receberá um email.",
  },

  approved: {
    subject: "Consulta confirmada - {clinic} - {date}",
    subjectDetailed: "Consulta confirmada pela clínica: {service}, {date}",
    body: "A clínica aceitou o seu pedido. Seguem os detalhes da sua consulta.",
    sms: "{clinic}: a sua consulta de {when} está confirmada. Gerir: {url} Aviso de privacidade: {privacy} STOP para não receber SMS",
    smsShort: "{clinic}: consulta confirmada para {slot}. Gerir: {url}",
  },

  reminder: {
    subject: "Lembrete de consulta - {clinic} - {date}",
    subjectDetailed: "Lembrete de consulta: {service}, {date}",
    body: "Lembramos-lhe a sua próxima consulta.",
    bodyAsk: "Lembramos-lhe a sua próxima consulta. Pode confirmar a sua presença com um clique?",
    sms: "{clinic}: lembrete da consulta de {when}, {address}. Detalhes: {url} STOP para não receber SMS",
    smsAsk:
      "{clinic}: lembrete da consulta de {when}, {address}. Responda SIM para confirmar, NAO para cancelar. Detalhes: {url} STOP para não receber SMS",
    smsShort: "{clinic}: consulta {slot}. Detalhes: {url}",
    smsAskShort: "{clinic}: consulta {slot}. SIM para confirmar, NAO para cancelar. {url}",
    smsDetailed: "{clinic}: olá {name}, lembrete: {service} com {practitioner} {when}, {address}. Detalhes: {url}",
    smsAskDetailed:
      "{clinic}: olá {name}, lembrete: {service} com {practitioner} {when}, {address}. Responda SIM para confirmar, NAO para cancelar. Detalhes: {url}",
  },

  cancelled: {
    subject: "Consulta cancelada - {clinic} - {date}",
    body: "A sua consulta foi cancelada, como pediu.",
    bodyByPractice: "Lamentamos, mas a clínica teve de cancelar a sua consulta. Pode marcar um novo horário quando quiser.",
    sms: "{clinic}: a sua consulta de {when} foi cancelada. Marcar de novo: {url}",
    smsShort: "{clinic}: consulta {slot} cancelada. {url}",
    rebook: "Marcar de novo",
  },

  rescheduled: {
    subject: "Consulta alterada - {clinic} - {date}",
    subjectDetailed: "Consulta alterada: {service}, {date}",
    body: "A sua consulta foi alterada. Este é o novo horário.",
    sms: "{clinic}: a sua consulta passou para {when}, {address}. Detalhes: {url}",
    smsShort: "{clinic}: consulta alterada para {slot}. {url}",
  },

  waitlist: {
    subject: "Vagou um horário - {clinic} - {date}",
    body: "Vagou um horário para {when}. Fica com ele quem marcar primeiro: se lhe convier, marque já.",
    sms: "{clinic}: vagou um horário para {when}. Fica com ele quem marcar primeiro: {url}",
    smsShort: "{clinic}: vaga livre {slot}: {url}",
    cta: "Marcar este horário",
  },

  review: {
    subject: "Como correu a sua consulta em {clinic}?",
    body: "Obrigado pela sua visita. Uma avaliação verificada ajuda outros pacientes a escolher com confiança. Demora um minuto.",
    bodyDetailed:
      "Obrigado pela sua consulta com {practitioner}. Uma avaliação verificada ajuda outros pacientes a escolher com confiança. Demora um minuto.",
    cta: "Deixar uma avaliação",
  },

  replies: {
    confirmed: "{clinic}: obrigado! Presença confirmada para {when}. Até breve!",
    confirmedShort: "{clinic}: obrigado, confirmada para {slot}.",
    cancelled: "{clinic}: a sua consulta de {when} foi cancelada. Marque um novo horário: {url}",
    cancelledShort: "{clinic}: consulta {slot} cancelada. Marcar de novo: {url}",
    reschedule: "{clinic}: escolha um novo horário aqui: {url}",
    unknown: "{clinic}: não percebemos. Responda SIM para confirmar ou NAO para cancelar, ou abra: {url}",
    none: "{clinic}: não encontrámos nenhuma consulta futura para este número.",
    stop: "{clinic}: não receberá mais SMS nossos. Responda START para os reativar.",
    start: "{clinic}: SMS reativados. Responda STOP para os desativar.",
  },

  unsubscribeConfirmation: {
    subject: "As suas preferências de mensagens - {clinic}",
    body: "Deixará de receber mensagens por {channel} sobre as suas consultas em {clinic}. Pode alterar isto a qualquer momento nas suas escolhas de privacidade.",
    cta: "As suas escolhas de privacidade",
    sms: "{clinic}: não receberá mais SMS nossos. Responda START para os reativar.",
  },

  breachNotice: {
    subject: "Importante: um incidente de segurança que envolve os seus dados - {clinic}",
    body: "Escrevemos-lhe para o informar de uma violação de dados pessoais que o pode afetar. Levamos o assunto a sério e queremos que saiba o que aconteceu e o que estamos a fazer.",
    what: "O que aconteceu",
    when: "Quando",
    data: "Dados envolvidos",
    consequences: "O que pode significar para si",
    measures: "O que fizemos",
    advice: "O que pode fazer",
    contact: "Questões",
    contactValue: "Contacte o nosso encarregado da proteção de dados: {dpo}",
    sms: "{clinic}: aviso importante sobre os seus dados pessoais. Leia-o com atenção: {url}",
  },

  ics: {
    summary: "Consulta – {clinic}",
    phone: "Tel.: {phone}",
  },

  preview: {
    sampleFirstName: "Joana",
  },
} satisfies DeepPartial<Messages["patientMessages"]>;
