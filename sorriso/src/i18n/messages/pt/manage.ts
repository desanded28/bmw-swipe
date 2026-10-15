import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "A sua consulta",
    description: "Consulte, confirme, altere ou cancele a sua consulta.",
  },
  greeting: "Olá {name},",
  title: "A sua consulta em {clinic}",
  status: {
    cancelled: "Cancelada",
    requested: "A aguardar a confirmação da clínica",
    completed: "Concluída",
    no_show: "Falta",
    confirmed: "Marcada e confirmada",
    pending: "Marcada: confirme, por favor",
  },
  details: {
    when: "Quando",
    timeRange: "{start}–{end}",
    treatment: "Tratamento",
    where: "Onde",
    address: "{address}, {city}",
    phone: "Telefone",
  },
  confirm: {
    title: "Vai estar presente?",
    body: "A confirmação ajuda {clinic} a planear o dia e garante o seu horário.",
    button: "Sim, vou estar presente",
    done: "Obrigado! A sua comparência está confirmada.",
  },
  reschedule: {
    button: "Remarcar",
    title: "Escolha um novo horário com {practitioner}",
    moveTo: "Mudar a sua consulta para {when}?",
    moveToOffice: "Mudar a sua consulta para {when} em {office}?",
    confirm: "Confirmar o novo horário",
    done: "Feito: a sua consulta foi alterada.",
    closed: p({
      one: "A remarcação online termina {count} hora antes da consulta.",
      other: "A remarcação online termina {count} horas antes da consulta.",
    }),
    call: "Para a alterar, ligue para o <tel>{phone}</tel>.",
  },
  cancel: {
    button: "Cancelar consulta",
    title: "Cancelar esta consulta?",
    late: p({
      one: "Falta menos de {count} hora para a sua consulta. Mesmo assim, ao cancelar liberta o horário para alguém da lista de espera: obrigado por nos avisar.",
      other: "Faltam menos de {count} horas para a sua consulta. Mesmo assim, ao cancelar liberta o horário para alguém da lista de espera: obrigado por nos avisar.",
    }),
    body: "O seu horário será oferecido aos pacientes da lista de espera.",
    reason: "Motivo",
    reasonHint: "Opcional. Visível apenas para a clínica. Não inclua dados de saúde.",
    confirm: "Sim, cancelar",
    keep: "Manter",
    done: "A sua consulta foi cancelada.",
  },
  calendar: {
    appleOutlook: "Apple ou Outlook",
    google: "Calendário Google",
  },
  review: {
    title: "Como correu a sua consulta?",
    button: "Deixar uma avaliação",
  },
  rebook: "Marcar outra consulta",
  privateLink: "Mantenha esta ligação privada: qualquer pessoa que a tenha pode gerir esta consulta.",
  clinicPage: "Página de {clinic}",
  invalid: {
    title: "Esta ligação não funciona",
    body: "Pode estar incompleta ou mal escrita. Verifique se abriu a ligação completa da sua mensagem, ou contacte a sua clínica.",
  },
  expired: {
    title: "Esta ligação expirou",
    body: "Para proteger a sua privacidade, as ligações das consultas deixam de funcionar algum tempo depois da consulta. Para marcar de novo ou pedir informações sobre uma consulta anterior, contacte diretamente a sua clínica.",
    privacyCenter: "Para ver os dados que as clínicas têm sobre si, utilize o centro de privacidade.",
  },
  rateLimited: {
    title: "Demasiados pedidos",
    body: p({
      one: "Esta página foi aberta demasiadas vezes num curto espaço de tempo. Tente novamente dentro de {count} minuto.",
      other: "Esta página foi aberta demasiadas vezes num curto espaço de tempo. Tente novamente dentro de {count} minutos.",
    }),
  },
  preview: {
    title: "A sua consulta",
    body: "Abra esta ligação no navegador para ver e gerir a sua consulta.",
  },
  home: "Ir para a página inicial",
} satisfies DeepPartial<Messages["manage"]>;
