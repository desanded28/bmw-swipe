import type { DeepPartial, Messages } from "../../types";

export default {
  moderationRequestHidden: {
    subject: "A sua avaliação de {practice} foi denunciada",
    body:
      "A sua avaliação de {practice} foi denunciada aos moderadores da Sorriso e está oculta enquanto a verificam. Pode dar-nos a sua versão até {date}: lemo-la antes de decidir. Também pode eliminar a sua avaliação.",
    cta: "Responder aos moderadores",
    sms: "Sorriso: a sua avaliação de {practice} foi denunciada. Pode responder até {date}: {url}",
  },
  moderationRequestVisible: {
    subject: "A sua avaliação de {practice} foi denunciada",
    body:
      "A sua avaliação de {practice} foi denunciada aos moderadores da Sorriso. Continua publicada enquanto a verificam. Pode dar-nos a sua versão até {date}: lemo-la antes de decidir. Também pode eliminar a sua avaliação.",
    cta: "Responder aos moderadores",
    sms: "Sorriso: a sua avaliação de {practice} foi denunciada. Pode responder até {date}: {url}",
  },
  decisionKept: {
    subject: "A sua avaliação de {practice}: decisão",
    body:
      "Os moderadores da Sorriso analisaram a denúncia sobre a sua avaliação de {practice} e decidiram mantê-la publicada. Motivos: {reason}",
    cta: "Ver a decisão",
    sms: "Sorriso: a sua avaliação de {practice} continua publicada. Detalhes: {url}",
  },
  decisionRemoved: {
    subject: "A sua avaliação de {practice}: decisão",
    body:
      "Os moderadores da Sorriso decidiram remover a sua avaliação de {practice}. Motivos: {reason} Se não concordar, pode recorrer uma vez, até {date}; também pode recorrer a um organismo certificado de resolução extrajudicial de litígios ou a um tribunal.",
    cta: "Ver a decisão ou recorrer",
    sms: "Sorriso: a sua avaliação de {practice} foi removida. Motivos e recurso: {url}",
  },
  finalKept: {
    subject: "A sua avaliação de {practice}: decisão sobre o recurso",
    body:
      "Outro moderador analisou o recurso sobre a sua avaliação de {practice} e decidiu mantê-la publicada. Motivos: {reason} Esta decisão é definitiva na Sorriso.",
    cta: "Ver a decisão",
    sms: "Sorriso: após o recurso, a sua avaliação de {practice} continua publicada. Detalhes: {url}",
  },
  finalRemoved: {
    subject: "A sua avaliação de {practice}: decisão sobre o recurso",
    body:
      "Outro moderador analisou o recurso sobre a sua avaliação de {practice} e decidiu removê-la. Motivos: {reason} Esta decisão é definitiva na Sorriso; pode ainda recorrer a um organismo certificado de resolução extrajudicial de litígios ou a um tribunal.",
    cta: "Ver a decisão",
    sms: "Sorriso: após o recurso, a sua avaliação de {practice} foi removida. Detalhes: {url}",
  },
  heldPublished: {
    subject: "A sua avaliação de {practice} foi publicada",
    body: "Um moderador verificou a sua avaliação de {practice} e publicou-a. Obrigado por ajudar outros pacientes.",
    sms: "Sorriso: a sua avaliação de {practice} já está publicada. Obrigado!",
  },
  heldRemoved: {
    subject: "A sua avaliação de {practice} não foi publicada",
    body:
      "Um moderador verificou a sua avaliação de {practice} e não a publicou. Motivos: {reason} Se não concordar, pode recorrer uma vez, até {date}.",
    cta: "Ver a decisão ou recorrer",
    sms: "Sorriso: a sua avaliação de {practice} não foi publicada. Motivos e recurso: {url}",
  },
  practice: {
    keptSubject: "Denúncia de avaliação: decisão (mantida)",
    keptBody:
      "Os moderadores da Sorriso analisaram a sua denúncia sobre uma avaliação de {practice} e decidiram mantê-la publicada. Motivos: {reason}",
    removedSubject: "Denúncia de avaliação: decisão (removida)",
    removedBody:
      "Os moderadores da Sorriso analisaram a sua denúncia sobre uma avaliação de {practice} e decidiram removê-la. Motivos: {reason}",
    appeal: "Pode recorrer uma vez a partir da página Avaliações do seu painel. Depois disso, pode recorrer a um organismo certificado de resolução extrajudicial de litígios ou a um tribunal.",
    final: "Esta foi a decisão sobre um recurso e é definitiva na Sorriso. Pode ainda recorrer a um organismo certificado de resolução extrajudicial de litígios ou a um tribunal.",
    authorMayAppeal: "O autor da avaliação pode recorrer desta decisão uma vez; se o fizer, decide outro moderador e enviaremos o resultado por email.",
    open: "Abrir a página Avaliações",
    footer: "Moderação da Sorriso · recebe este email porque a sua clínica denunciou uma avaliação.",
  },
  notice: {
    receivedSubject: "Recebemos a sua denúncia sobre uma avaliação",
    receivedBody: "Obrigado: recebemos a sua denúncia sobre uma avaliação de {practice}. Um moderador decidirá sem demora injustificada e enviar-lhe-á o resultado por email.",
    decisionSubject: "A sua denúncia sobre uma avaliação: decisão",
    keptBody: "Verificámos a avaliação de {practice} que denunciou e decidimos mantê-la. Motivos: {reason}",
    removedBody: "Verificámos a avaliação de {practice} que denunciou e removemo-la. Motivos: {reason}",
    redress: "Se não concordar, pode recorrer a um organismo certificado de resolução extrajudicial de litígios ou a um tribunal.",
    footer: "Moderação da Sorriso · recebe este email porque enviou uma denúncia sobre uma avaliação.",
  },
  detailsReview: "Avaliação",
  detailsGround: "Motivo da denúncia",
  detailsDecision: "Decisão",
} satisfies DeepPartial<Messages["reviewEmails"]>;
