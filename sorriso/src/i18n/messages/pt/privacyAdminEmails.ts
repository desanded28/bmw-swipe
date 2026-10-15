import type { DeepPartial, Messages } from "../../types";

export default {
  types: {
    access: "acesso aos seus dados",
    rectification: "retificação dos seus dados",
    erasure: "apagamento dos seus dados",
    restriction: "limitação do tratamento dos seus dados",
    portability: "uma cópia dos seus dados para levar para outro lado",
    objection: "oposição ao tratamento dos seus dados",
    consent_withdrawal: "retirada do seu consentimento",
  },

  requestExtended: {
    subject: "O seu pedido de privacidade: precisamos de mais tempo",
    body: "Recebemos o seu pedido de {type} em {received}. Precisamos de mais tempo para lhe responder de forma completa, pelo seguinte motivo: {reason}. Receberá a nossa resposta até {until}. O RGPD (art. 12.º, n.º 3) permite esta prorrogação por um máximo de mais dois meses.",
    sms: "{practice}: precisamos de mais tempo para o seu pedido de privacidade de {received}. Motivo: {reason}. Resposta até {until}.",
  },
  requestGranted: {
    subject: "O seu pedido de privacidade foi concluído",
    body: "Concluímos o seu pedido de {type}, recebido em {received}. A nossa resposta: {reason}",
    sms: "{practice}: o seu pedido de privacidade de {received} foi concluído. {reason}",
  },
  requestPartiallyGranted: {
    subject: "A nossa resposta ao seu pedido de privacidade",
    body: "Respondemos parcialmente ao seu pedido de {type}, recebido em {received}. A nossa resposta e a fundamentação: {reason}. Se não concordar, pode apresentar reclamação à autoridade italiana de proteção de dados (Garante per la protezione dei dati personali, www.garanteprivacy.it) ou recorrer aos tribunais.",
    sms: "{practice}: o seu pedido de privacidade de {received} foi deferido em parte. Motivos: {reason}. Pode reclamar ao Garante (garanteprivacy.it) ou recorrer aos tribunais.",
  },
  requestRefused: {
    subject: "A nossa resposta ao seu pedido de privacidade",
    body: "Não podemos deferir o seu pedido de {type}, recebido em {received}, pelos seguintes motivos: {reason}. Se não concordar, pode apresentar reclamação à autoridade italiana de proteção de dados (Garante per la protezione dei dati personali, www.garanteprivacy.it) ou recorrer aos tribunais.",
    sms: "{practice}: não podemos deferir o seu pedido de privacidade de {received}. Motivos: {reason}. Pode reclamar ao Garante (garanteprivacy.it) ou recorrer aos tribunais.",
  },
  restrictionLifted: {
    subject: "A limitação dos seus dados vai ser levantada",
    body: "Em {since}, o tratamento dos seus dados em {practice} foi limitado. Esta limitação vai agora ser levantada, pelo que a clínica pode voltar a utilizar os seus dados, por exemplo para lhe enviar lembretes das consultas. Se tiver questões ou considerar que a limitação deve continuar, contacte a clínica.",
    sms: "{practice}: a limitação dos seus dados, em vigor desde {since}, vai ser levantada. Contacte-nos se tiver questões.",
  },

  ownerDeadline7: {
    subject: "Pedido de privacidade com prazo dentro de 7 dias",
    body: "Um pedido de {type} recebido por {practice} em {received} tem de ser respondido até {due}. Abra-o no painel para o concluir, ou para prorrogar o prazo com um motivo se precisar mesmo de mais tempo.",
    cta: "Abrir o pedido",
  },
  ownerDeadline2: {
    subject: "Pedido de privacidade com prazo dentro de 2 dias",
    body: "Um pedido de {type} recebido por {practice} em {received} tem de ser respondido até {due}. Responder fora de prazo viola o art. 12.º, n.º 3, do RGPD: conclua-o agora.",
    cta: "Abrir o pedido",
  },

  subprocessorsChanged: {
    subject: "A lista de subcontratantes ulteriores da Sorriso mudou",
    body: "A Sorriso atualizou a lista de subcontratantes ulteriores que tratam os dados de {practice} (versão {version}, em vigor desde {effective}). Analise-a e aceite-a no painel. Se se opuser a uma alteração, escreva para {email} no prazo de 30 dias: procuraremos consigo uma solução e, se não existir, pode pôr termo ao contrato sem penalização.",
    cta: "Analisar a lista",
  },

  closureRequested: {
    subject: "A sua conta Sorriso está a ser encerrada",
    body: "Recebemos o pedido de encerramento da conta de {practice} em {date}. A marcação online parou e a clínica deixou de aparecer na pesquisa. Pode transferir todos os seus dados até {purge}; nessa data, serão apagados definitivamente. Pode cancelar o encerramento antes dessa data a partir do painel.",
    cta: "Transferir os seus dados",
  },
  closureCancelled: {
    subject: "Encerramento da conta cancelado",
    body: "O encerramento da conta de {practice} foi cancelado e nenhum dado será apagado. A marcação online através da sua própria página de marcação, widget e ligações volta a funcionar. A clínica continua oculta na pesquisa da Sorriso até a voltar a incluir nas Definições.",
  },
  closureCertificate: {
    subject: "Certificado de apagamento: {practice}",
    body: "Em {date}, apagámos definitivamente os dados de {practice} dos sistemas da Sorriso, conforme acordado no acordo de subcontratação. As cópias de segurança cifradas que ainda os contêm expiram em {backups} e são depois substituídas. O certificado indica o que foi apagado.",
    cta: "Ver o certificado",
  },

  footer: {
    rights: "Recebe esta mensagem porque exerceu os seus direitos de proteção de dados.",
    staff: "Recebe esta mensagem como proprietário de uma clínica que utiliza a Sorriso.",
  },
} satisfies DeepPartial<Messages["privacyAdminEmails"]>;
