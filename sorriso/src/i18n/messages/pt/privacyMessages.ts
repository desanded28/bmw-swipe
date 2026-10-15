import type { DeepPartial, Messages } from "../../types";

export default {
  requestReceipt: {
    subject: "Recebemos o seu pedido de privacidade",
    body: "{controller} recebeu o seu pedido ({type}) em {date}. Receberá uma resposta até {due}. Se for necessário mais tempo por se tratar de um pedido complexo, será informado do motivo antes dessa data.",
    sms: "{controller} recebeu o seu pedido de privacidade ({type}). Resposta até {due}.",
  },
  contactChangedPhone: {
    sms: "O número de telemóvel da sua ficha em {practice} foi alterado no centro de privacidade Sorriso. Não foi você? Contacte a clínica.",
  },
  contactChangedEmail: {
    subject: "Os seus contactos foram alterados",
    body: "O endereço de email da sua ficha em {practice} foi alterado no centro de privacidade Sorriso em {date}. Se não foi você, contacte de imediato a clínica.",
  },
  bookedForYou: {
    subject: "Foi marcada uma consulta para si em {practice}",
    body: "{booker} marcou uma consulta para si em {practice} para {when}. A clínica utiliza os seus dados para a gerir. Saiba como os seus dados são tratados e quais são os seus direitos, incluindo como consultá-los, corrigi-los ou apagá-los.",
    cta: "Ler o aviso de privacidade",
    sms: "{booker} marcou uma consulta para si em {practice} para {when}. Aviso de privacidade: {url}",
  },
  confirmBooking: {
    subject: "Confirme a consulta marcada para si",
    body: "{booker} marcou uma consulta para si em {practice} para {when} através da Sorriso. Só você a pode confirmar e aceitar a forma como a Sorriso trata a marcação. Se não a confirmar no prazo de {hours} horas, será cancelada.",
    cta: "Confirmar ou recusar",
    sms: "{booker} marcou uma consulta para si em {practice} via Sorriso. Confirme em {hours}h: {url}",
  },
  adultNotConfirmed: {
    subject: "A consulta que marcou foi cancelada",
    body: "A consulta que marcou para {name} em {practice} para {when} foi cancelada, porque {name} não a confirmou a tempo. Só o próprio paciente pode confirmar uma marcação feita em seu nome na Sorriso, e pode voltar a marcar diretamente.",
    sms: "A consulta que marcou para {name} em {practice} para {when} foi cancelada: {name} não a confirmou a tempo.",
  },
  requestTypes: {
    access: "acesso aos seus dados",
    rectification: "retificação dos seus dados",
    erasure: "apagamento dos seus dados",
    restriction: "limitação do tratamento",
    portability: "uma cópia dos seus dados para levar para outro lado",
    objection: "oposição ao tratamento",
    consent_withdrawal: "retirada do consentimento",
  },
  footer: {
    privacyCenter: "Recebe esta mensagem devido a um pedido feito no centro de privacidade Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyMessages"]>;
