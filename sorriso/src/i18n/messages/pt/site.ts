import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  meta: {
    title: "{app}: marque o seu dentista online",
    description:
      "Encontre um dentista perto de si, veja a disponibilidade real e marque em segundos. Lembretes por SMS ou email: confirme ou remarque com um toque.",
  },
  header: {
    findDentist: "Encontrar um dentista",
    forPractices: "Para clínicas",
    api: "API",
    login: "Acesso para clínicas",
    bookNow: "Marcar agora",
  },
  footer: {
    tagline: "Marque dentistas online com disponibilidade em tempo real. Lembretes a que os pacientes respondem com uma palavra.",
    patients: "Pacientes",
    findDentist: "Encontrar um dentista",
    emergency: "Urgência dentária",
    cleaning: "Limpeza dentária",
    privacyCenter: "Os seus dados (centro de privacidade)",
    practices: "Clínicas",
    features: "Funcionalidades",
    createPractice: "Criar uma clínica",
    apiWidget: "API e widget de marcação",
    legal: "Informação legal",
    privacy: "Aviso de privacidade",
    cookies: "Cookies",
    terms: "Termos de utilização",
    dpa: "Acordo de subcontratação",
    subprocessors: "Subcontratantes ulteriores",
    accessibility: "Acessibilidade",
    reviewPolicy: "Política de avaliações",
    ranking: "Como são ordenados os resultados",
    copyright: "© {year} {app}",
    demo: "Projeto de demonstração: as clínicas e as pessoas apresentadas são fictícias.",
  },
  notFound: {
    code: "Erro 404",
  },
  home: {
    badge: "Apenas avaliações verificadas de consultas reais",
    heroTitle: "O dentista de que precisa, <em>marcado em 30 segundos.</em>",
    heroBody:
      "Disponibilidade em tempo real de clínicas perto de si. Sem conta, sem filas ao telefone. Receba um lembrete por SMS ou email: responda <b>SIM</b> para confirmar ou altere a consulta com um toque.",
    quickLabel: "Tratamentos mais procurados",
    quick: {
      checkup: "Consulta de controlo",
      hygiene: "Limpeza",
      orthodontics: "Alinhadores e aparelhos",
      pediatric: "Crianças",
      emergency: "Urgência",
    },
    soonestTitle: "Disponíveis mais cedo",
    soonestBody: "Escolha um horário e está feito: estes horários são em tempo real.",
    seeAll: "Ver todos os dentistas",
    how: {
      title: "Como funciona",
      step: "Passo {n}",
      findTitle: "Encontre disponibilidade real",
      findBody: "Compare dentistas por tratamento, preço, avaliações verificadas e próximo horário livre, em todas as unidades onde trabalham.",
      bookTitle: "Marque sem criar conta",
      bookBody: "Escolha um horário e indique o seu nome e número. Recebe uma confirmação imediata com um convite para o calendário.",
      confirmTitle: "Confirme com uma resposta",
      confirmBody: "Lembramos-lhe a consulta por SMS ou email. Responda SIM para confirmar ou NAO para cancelar, ou remarque com um toque.",
    },
    citiesTitle: "Dentistas por cidade",
    cityLink: "Dentistas em {city}",
    cityCount: p({ one: "{count} clínica", other: "{count} clínicas" }),
    practices: {
      kicker: "Para clínicas dentárias",
      title: "Menos faltas. Todas as unidades numa só agenda.",
      body: "Agenda para várias unidades com cadeiras, confirmações por SMS nos dois sentidos, uma lista de espera automática que preenche os cancelamentos e uma API de marcação aberta.",
      features: "Ver as funcionalidades",
      demo: "Experimentar o painel de demonstração",
      offices: "Várias unidades, profissionais e cadeiras, sem marcações duplicadas entre locais",
      rules: "Regras de lembretes por clínica: email 48 horas antes, SMS 24 horas antes, WhatsApp se o ativar",
      replies: "Os pacientes respondem SIM ou NAO e a agenda atualiza-se sozinha",
      waitlist: "Os horários cancelados são oferecidos à lista de espera em segundos",
    },
  },
  forClinics: {
    metaTitle: "Para clínicas dentárias",
    metaDescription:
      "Marcação online, uma agenda para várias unidades e lembretes a que os pacientes respondem, com a privacidade integrada. Exporte tudo a qualquer momento.",
    kicker: "Para clínicas dentárias",
    title: "Ocupe as suas cadeiras. Deixe de andar atrás de confirmações.",
    body: "Marcação online, uma agenda para várias unidades e lembretes a que os pacientes respondem mesmo, num só lugar.",
    signup: "Criar a sua clínica",
    demo: "Abrir o painel de demonstração",
    featuresTitle: "Funcionalidades",
    features: {
      offices: {
        title: "Todas as unidades, uma só agenda",
        body: "Os profissionais trabalham em unidades diferentes em dias diferentes. A disponibilidade é calculada por unidade e ninguém pode ter marcações sobrepostas entre locais.",
      },
      chairs: {
        title: "Cadeiras, intervalos e encerramentos",
        body: "As marcações reservam automaticamente uma cadeira. O tempo de limpeza por tratamento, feriados, manutenção e ausências pessoais bloqueiam a disponibilidade.",
      },
      twoWay: {
        title: "Lembretes por SMS nos dois sentidos",
        body: "Os lembretes pedem aos pacientes que respondam SIM ou NAO, no seu próprio idioma. As respostas confirmam ou cancelam de imediato; qualquer outra resposta é assinalada à receção.",
      },
      rules: {
        title: "Regras de lembretes que controla",
        body: "Por exemplo: email 48 horas antes, SMS 24 horas antes, um SMS curto 2 horas antes. WhatsApp apenas se o ativar e o paciente aceitar.",
      },
      waitlist: {
        title: "Os cancelamentos preenchem-se sozinhos",
        body: "Quando um horário fica livre, é oferecido em segundos aos pacientes compatíveis da lista de espera. Fica com ele quem marcar primeiro, sem telefonemas.",
      },
      board: {
        title: "Quadro de confirmações",
        body: "Veja o dia de amanhã num relance: confirmados, a aguardar e quem precisa de um telefonema, com o motivo indicado. Serve apenas para ajudar: ninguém fica impedido de marcar.",
      },
      reviews: {
        title: "Apenas avaliações verificadas",
        body: "Só podem avaliar os pacientes com uma consulta concluída, e apenas com o seu consentimento. As clínicas podem responder, mas não podem ocultar avaliações.",
      },
      api: {
        title: "API e widget de marcação abertos",
        body: "Incorpore a marcação no seu site com uma única tag script, sincronize com o software da clínica através da API REST e subscreva feeds de calendário.",
      },
      roles: {
        title: "Funções para a sua equipa",
        body: "Proprietários, administradores, receção e profissionais veem apenas aquilo de que precisam. Todos os acessos a uma ficha de paciente ficam registados.",
      },
      privacy: {
        title: "Privacidade por defeito",
        body: "As mensagens e as entradas de calendário não indicam o tratamento. Os pacientes gerem os seus dados e consentimentos num centro de privacidade, sem conta.",
      },
      languages: {
        title: "Oito idiomas",
        body: "Os pacientes marcam e recebem lembretes em italiano, inglês, alemão, francês, espanhol, português, romeno ou polaco.",
      },
    },
    flow: {
      title: "Como funciona uma confirmação",
      book: "O paciente marca online (ou a receção marca por ele) e recebe uma confirmação com um convite para o calendário.",
      email: "48 horas antes: um email a pedir-lhe que confirme com um clique.",
      text: "24 horas antes: um SMS a pedir-lhe que responda SIM para confirmar ou NAO para cancelar.",
      reply: "SIM põe a consulta a verde na sua agenda. NAO cancela-a e oferece o horário à lista de espera.",
      other: "Qualquer outra resposta (\"posso chegar 30 minutos mais tarde?\") chega à sua caixa de entrada e é assinalada na agenda.",
    },
    sms: {
      sender: "Studio Bianchi",
      reminder:
        "Studio Bianchi: lembrete da consulta de qua., 15 out. às 10:30, Via Torino 42, Milano. Responda SIM para confirmar, NAO para cancelar. Detalhes: sorriso.example/a/… STOP para não receber SMS",
      reply: "SIM",
      thanks: "Obrigado! A sua consulta de qua., 15 out. às 10:30 está confirmada. Até breve!",
      caption: "Um lembrete tal como o paciente o recebe: o tratamento nunca é indicado.",
    },
    noLockIn: "Os seus dados continuam a ser seus: exporte tudo a qualquer momento, sem ficar preso.",
    apiDocs: "Ler a documentação da API",
  },
  developers: {
    metaTitle: "API e widget de marcação",
    metaDescription:
      "Incorpore a marcação online no site da sua clínica, marque através da API REST e sincronize com o software da clínica.",
    title: "API e widget de marcação",
    intro:
      "Tudo o que o site {host} faz passa por esta API, por isso a sua integração pode fazer tudo o que um paciente pode. JSON sobre HTTPS, CORS ativado, horas em ISO 8601 (UTC).",
    codeSample: "Exemplo de código",
    attribute: "Atributo",
    field: "Campo",
    description: "Descrição",
    widget: {
      title: "1. Incorporar a marcação no seu site",
      button: "Um botão flutuante \"Marcar consulta\" que abre o formulário de marcação numa janela:",
      inline: "Ou integrado num elemento da sua página, aqui em alemão e para um só profissional:",
      attributesCaption: "Atributos do widget",
      attributes: {
        "data-clinic": "Obrigatório. O endereço da sua clínica na Sorriso (o slug). Sem ele, o script não mostra nada.",
        "data-lang":
          "O idioma do formulário e das mensagens do paciente. Sem ele: o idioma da sua página (o atributo lang), depois o do navegador do visitante e, por fim, o italiano.",
        "data-target":
          "Um seletor CSS: mostra o formulário dentro desse elemento em vez de um botão flutuante. Se nenhum elemento corresponder quando o script é executado, nada é mostrado.",
        "data-practitioner": "Abre o formulário para um só profissional (o respetivo id).",
        "data-service": "Pré-seleciona um tratamento (o respetivo id).",
        "data-location": "Pré-seleciona uma unidade (o respetivo id).",
        "data-label": "O texto do botão flutuante. Sem ele, \"Marcar consulta\" no idioma escolhido.",
        "data-color": "A cor do botão flutuante, como cor CSS.",
        "data-events": "Ativa o evento sorriso:booked na sua página quando uma marcação é concluída.",
        "data-include-id": "Com data-events: inclui o id da consulta no evento.",
      },
      languages: "Valores de idioma (<code>data-lang</code>, <code>patient.locale</code>):",
      eventsTitle: "Eventos de marcação",
      events:
        "Com <code>data-events</code>, a sua página recebe um evento <code>sorriso:booked</code> quando uma marcação é concluída. Não contém dados pessoais, e o id da consulta só é incluído com <code>data-include-id</code>. As mensagens são enviadas apenas para a origem da sua própria página.",
      eventsWarning:
        "Não reencaminhe este evento para ferramentas de publicidade ou de análise (como as tags da Meta ou da Google): revela que um visitante marcou uma consulta de dentista, o que constitui um dado de saúde. Nos termos do acordo de subcontratação, só o pode usar para mostrar a sua própria confirmação.",
      origins:
        "Para impedir que outros sites incorporem o seu formulário de marcação, indique os endereços do seu site em Painel, Definições de privacidade, Sites autorizados. Noutros sites, o widget passa a mostrar apenas uma ligação que abre a página de marcação num novo separador. A verificação baseia-se no endereço que os navegadores dos visitantes enviam com a moldura: o widget pede-o e, se escrever o seu próprio iframe, não lhe atribua <code>referrerpolicy=\"no-referrer\"</code>.",
    },
    booking: {
      title: "2. Marcar através da API",
      fieldsCaption: "Campos da marcação",
      context:
        "Quem é responsável pelos dados da marcação é decidido pelo servidor, nunca por um campo que envie: as marcações feitas com a sua chave de API, o seu widget ou ligações assinadas para a sua clínica são suas (a Sorriso trata-as por sua conta); as marcações iniciadas nas próprias páginas da Sorriso precisam do consentimento do paciente à Sorriso.",
      errors:
        "Os erros têm sempre a mesma forma: um objeto <code>error</code> com um <code>code</code> e uma <code>message</code>. Um horário ocupado devolve 409 com <code>practitioner_busy</code>, <code>no_room</code>, <code>time_off</code>, <code>outside_hours</code> ou <code>too_soon</code>; campos inválidos devolvem 422 com uma lista <code>issues</code>, e uma regra de privacidade ou de idade não cumprida devolve 422 com o seu próprio código e <code>field</code>.",
    },
    fields: {
      locale:
        "O idioma das mensagens do paciente: <code>it</code>, <code>en</code>, <code>de</code>, <code>fr</code>, <code>es</code>, <code>pt</code>, <code>ro</code> ou <code>pl</code>.",
      phoneCountry:
        "O indicativo do país de um número escrito sem prefixo, como <code>39</code> ou <code>49</code>. Os números que começam por + ou 00 mantêm o seu.",
      preferredChannel:
        "<code>sms</code>, <code>email</code> ou <code>whatsapp</code>. WhatsApp apenas se a clínica o tiver ativado, e com <code>privacy.whatsapp</code> definido como true.",
      privacy:
        "Obrigatório sem chave de API. <code>noticeVersion</code> (a versão do aviso de privacidade apresentada), <code>locale</code> e as escolhas do paciente: <code>platformConsent</code>, <code>whatsapp</code>, <code>feedback</code>, <code>marketing</code>. As caixas que o paciente não assinalou são false.",
      relation:
        "Para quem é a consulta: <code>bookedFor</code> é <code>self</code>, <code>minor</code> (com <code>guardian</code>: nome, relação, telefone ou email) ou <code>other_adult</code>.",
      practiceRef: "O marcador da clínica de uma ligação publicada pela sua clínica (?ref=). Sem ele, a marcação conta como feita na Sorriso.",
      fundId: "Opcional: o fundo de saúde ou a seguradora que o paciente vai usar. Só é guardado se a clínica tiver esse fundo na sua lista.",
    },
    sync: {
      title: "3. Sincronizar com o software da clínica",
      keys: "Crie uma chave de API em Painel, Definições, API, escolha os seus âmbitos e envie-a como bearer token. As chaves podem expirar e ser revogadas a qualquer momento.",
      scopesTitle: "Âmbitos",
    },
    scopes: {
      "appointments:read": "Ler as consultas e os recursos que utilizam.",
      "appointments:write": "Criar, alterar e cancelar consultas, registar confirmações, faltas e consultas concluídas.",
      "patients:read": "Ler os nomes e os contactos dos pacientes.",
      "patients:write": "Criar e atualizar pacientes.",
      "notes:read": "Ler as notas que pacientes e equipa escreveram nas consultas. Conceda-o apenas a software clínico.",
      "patients:erase": "Pedir o apagamento dos dados de um paciente (tratado como pedido de privacidade).",
    },
    export: {
      title: "4. Exportar os seus dados",
      body: "Uma clínica pode exportar todos os seus dados a qualquer momento em JSON, CSV e FHIR R4. Os formatos estão descritos no <link>esquema de exportação</link>.",
    },
    reference: "Referência",
    groups: {
      public: "Marcação pública (usada pelo site e pelo widget)",
      patient: "Autosserviço do paciente (token da ligação do paciente)",
      partner: "API de parceiros (o software da sua clínica)",
      infra: "Infraestrutura",
    },
    auth: {
      public: "público",
      token: "token",
      apiKey: "chave de API",
      secret: "segredo",
    },
    endpoints: {
      clinic: "Perfil da clínica, unidades, profissionais (com tratamentos e unidades) e tratamentos que se podem marcar.",
      availability:
        "Horários livres por dia. Sem practitionerId: \"primeiro disponível\", distribuído pelos profissionais. Devolve nextAvailable quando o intervalo está vazio.",
      book: "Marcar um horário. Verificado novamente numa transação de escrita: dois pacientes nunca podem ficar com o mesmo horário.",
      waitlist: "Inscrever-se na lista de espera para um tratamento, opcionalmente para um profissional ou uma unidade, um intervalo de datas e um período do dia.",
      appointment: "A consulta e o que o paciente ainda pode fazer (canCancel, canReschedule).",
      confirm: "Confirmar a comparência.",
      cancel: "Cancelar (o horário é oferecido à lista de espera). Campo opcional no corpo: reason.",
      reschedule: "Mudar para outro horário livre. Campos do corpo: start e, opcionalmente, practitionerId e locationId.",
      resources: "Unidades, cadeiras, profissionais (com horários) e tratamentos, para mapear ids.",
      list: "Listar consultas. Use updatedSince para sincronização incremental.",
      create: "Criar uma consulta com permissões de receção (duração personalizada, fora do horário, id de paciente existente).",
      update: "Remarcar, cancelar, marcar como concluída ou falta, ou registar uma confirmação por telefone.",
      twilio: "Respostas recebidas por SMS e WhatsApp (assinadas pela Twilio). Responde diretamente com TwiML.",
      twilioStatus: "Recibos de entrega (entregue, falhado).",
      cron: "Enviar os lembretes devidos. Chamar a cada 1 a 5 minutos com Authorization: Bearer $CRON_SECRET.",
      ics: "Feed de calendário subscrevível de um profissional (Google, Apple, Outlook).",
    },
  },
} satisfies DeepPartial<Messages["site"]>;
