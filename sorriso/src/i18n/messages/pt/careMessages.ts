import type { DeepPartial, Messages } from "../../types";

export default {
  recall: {
    subject: "{clinic}: está na altura da sua consulta de controlo",
    body: "Está na altura de marcar a próxima consulta de controlo em {clinic}. Escolha online um horário que lhe convenha ou ligue para a clínica. Se preferir não receber estes lembretes, pode cancelá-los em {optout}.",
    cta: "Marcar consulta de controlo",
    sms: "{clinic}: está na altura da sua consulta de controlo. Marque: {url} Para parar estes lembretes: {optout}",
    smsShort: "{clinic}: é altura da sua consulta de controlo. Marque: {url} Parar: {optout}",
  },
  practiceMoved: {
    subject: "{clinic} precisa de alterar a sua consulta",
    body: "Lamentamos: {clinic} não pode recebê-lo em {when}, como previsto. Escolha um novo horário com um toque ou peça à clínica que lhe ligue.",
    cta: "Escolher um novo horário",
    sms: "{clinic}: lamentamos, temos de alterar a sua consulta de {when}. Escolha um novo horário: {url}",
    smsShort: "{clinic}: temos de alterar a consulta de {when}. Novo horario: {url}",
  },
  anamnesisInvite: {
    subject: "{clinic}: preencha o seu historial clínico antes da consulta",
    body: "Antes da sua consulta de {when}, preencha um breve questionário de historial clínico. Demora cerca de três minutos e ajuda o dentista a tratá-lo em segurança. As suas respostas são cifradas e só a equipa clínica as pode ler.",
    cta: "Preencher o questionário",
    sms: "{clinic}: antes da sua consulta de {when}, preencha o questionário de historial clínico: {url}",
    smsShort: "{clinic}: preencha o historial clinico antes de {when}: {url}",
  },
} satisfies DeepPartial<Messages["careMessages"]>;
