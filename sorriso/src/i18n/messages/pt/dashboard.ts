import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "Painel",
    template: "{page} · {app}",
  },
  skipToContent: "Saltar para o conteúdo principal",

  nav: {
    label: "Painel",
    overview: "Resumo",
    calendar: "Agenda",
    confirmations: "Confirmações",
    messages: "Mensagens",
    patients: "Pacientes",
    duplicates: "Possíveis duplicados",
    waitlist: "Lista de espera",
    recalls: "Chamadas de controlo",
    reviews: "Avaliações",
    analytics: "Estatísticas",
    team: "Equipa e horários",
    services: "Tratamentos",
    locations: "Unidades e cadeiras",
    reminders: "Lembretes",
    settings: "Definições",
    funds: "Fundos de saúde",
    api: "API",
    privacyRequests: "Pedidos de privacidade",
    privacySettings: "Definições de privacidade",
    audit: "Registo de auditoria",
    security: "A minha segurança",
    platform: "Plataforma",
    platformPrivacy: "Caixa de privacidade da plataforma",
    groups: {
      setup: "Configuração",
      privacy: "Privacidade",
      account: "Conta",
    },
    count: p({ one: "{count} por tratar", other: "{count} por tratar" }),
  },

  sidebar: {
    home: "Resumo do painel",
    publicPage: "Página pública",
    publicPageNewTab: "A sua página pública (abre num novo separador)",
    switchPractice: "Mudar de clínica",
    logout: "Terminar sessão",
    language: "Idioma do painel",
    languageAuto: "Automático ({language})",
  },

  language: {
    saved: "Idioma guardado.",
    invalid: "Escolha um dos idiomas da lista.",
  },

  toast: {
    region: "Notificações",
    dismiss: "Fechar",
  },

  form: {
    saved: "Guardado.",
  },

  notFound: {
    title: "Página não encontrada",
    body: "Esta página do painel não existe ou foi movida.",
    back: "Voltar ao resumo",
  },

  denied: "Não tem permissão para abrir essa página. Se precisar dela, peça a um proprietário ou administrador da clínica.",

  overview: {
    title: "Resumo",
    greeting: {
      morning: "Bom dia, {name}",
      afternoon: "Boa tarde, {name}",
      evening: "Boa noite, {name}",
    },
    subtitle: "{date} · {practice}",
    openCalendar: "Abrir agenda",
    welcome: {
      title: "Bem-vindo! Quatro passos para começar",
      team: "Adicione os seus dentistas e higienistas, com os respetivos horários em cada unidade",
      services: "Defina tratamentos, durações e preços",
      reminders: "Escolha quando são enviados os lembretes (SMS, WhatsApp, email)",
      widget: "Incorpore o widget de marcação no seu site",
    },
    stats: {
      today: "Hoje",
      todayHint: p({ one: "{count} confirmada ou concluída", other: "{count} confirmadas ou concluídas" }),
      tomorrow: "Confirmadas para amanhã",
      tomorrowHint: "{confirmed} de {total} · {open} por contactar",
      noShow: "Taxa de faltas (30 dias)",
      noShowHint: "Faltas: {noShows} · consultas: {visits}",
      online: "Marcações online (7 dias)",
      onlineHint: "Preenchidas a partir da lista de espera (30 dias): {refilled} · em espera: {waiting}",
      none: "–",
    },
    demo: {
      all: "Modo de demonstração: os emails, SMS e mensagens de WhatsApp são capturados na página Mensagens em vez de serem entregues.",
      email: "Modo de demonstração: os emails são capturados na página Mensagens em vez de serem entregues.",
      text: "Modo de demonstração: os SMS e as mensagens de WhatsApp são capturados na página Mensagens em vez de serem entregues.",
      connect: "Ligar fornecedores",
    },
    attention: "Requer a sua atenção",
    attentionCount: p({ one: "{count} consulta", other: "{count} consultas" }),
    agenda: "Agenda de hoje",
    noneToday: "Sem consultas hoje.",
    tomorrowLink: "Confirmações de amanhã",
  },

  confirmations: {
    title: "Confirmações",
    tabs: {
      label: "Que consultas",
      tomorrow: "Amanhã",
      week: "Próximos 7 dias",
      requests: "Pedidos online",
      outcome: "Registar resultado",
      cancelled: "Canceladas recentemente",
    },
    descriptions: {
      tomorrow: "Quem vem amanhã. Contacte quem ainda não confirmou: os pacientes com faltas anteriores estão assinalados.",
      week: "Tudo o que está marcado para a próxima semana.",
      requests: "Marcações online a aguardar a sua aprovação (quando a clínica revê as marcações online).",
      outcome: "Consultas passadas sem resultado. Marque-as como concluídas (o que envia o pedido de avaliação) ou como falta.",
      cancelled: "Horários futuros libertados por cancelamentos. Foram oferecidos automaticamente aos pacientes compatíveis da lista de espera.",
    },
    onlyPending: "Apenas a aguardar confirmação ({count})",
    riskSorted: "Em cada dia, as consultas não confirmadas com maior risco de falta aparecem primeiro.",
    empty: "Nada a mostrar aqui.",
  },

  waitlist: {
    title: "Lista de espera",
    description:
      "Quando uma consulta é cancelada ou alterada, o horário é oferecido a até 3 pacientes compatíveis por SMS, WhatsApp ou email. Fica com ele o primeiro a marcar.",
    emptyTitle: "Ninguém está à espera",
    emptyBody: "Os pacientes podem inscrever-se a partir da página de marcação quando nenhum horário lhes convém.",
    waiting: "Em espera",
    anyPractitioner: "Qualquer profissional",
    anyOffice: "Qualquer unidade",
    preference: "{practitioner} · {office}",
    window: "{from} – {to}",
    partOfDay: {
      any: "Qualquer hora",
      morning: "Manhãs",
      afternoon: "Tardes",
    },
    offers: p({ one: "{count} oferta enviada", other: "{count} ofertas enviadas" }),
    remove: "Remover",
    removeConfirm: "Remover este paciente da lista de espera?",
    note: "Nota do paciente: {note}",
    restricted: "Ficha com tratamento limitado: os contactos e a nota estão ocultos.",
    openRecord: "Abrir a ficha do paciente (é necessário um motivo)",
    booked: "Marcadas recentemente a partir da lista de espera",
    bookedBadge: "Marcada",
  },
} satisfies DeepPartial<Messages["dashboard"]>;
