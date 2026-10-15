/**
 * TEXTO JURÍDICO: a versão italiana prevalece. Tradução para português europeu feita a partir do
 * inglês; rascunho a rever por um advogado ou EPD (docs/i18n/glossary-pt.md, "Needs lawyer review").
 */
import type { DeepPartial, Messages } from "../../types";
import { p } from "../../plural";

export default {
  staffInstructions: {
    title: "Instruções para a equipa que trata dados de pacientes",
    intro:
      "Está autorizado a tratar dados pessoais de pacientes, incluindo dados de saúde, por conta da clínica. Siga estas instruções em todas as partes do seu trabalho.",
    confidentiality:
      "Mantenha confidencial tudo o que souber sobre os pacientes, durante e após o seu trabalho com a clínica. Nunca fale de pacientes onde outras pessoas possam ouvir ou ver.",
    needToKnow:
      "Abra apenas os pacientes e as consultas de que precisa para a sua tarefa. A sua função determina o que pode ver; não peça aos colegas acessos que não tem.",
    freeText:
      "Não escreva informações de saúde em campos partilhados fora da clínica, como mensagens aos pacientes, entradas de calendário ou notas enviadas a outros prestadores. Os dados clínicos pertencem ao processo clínico.",
    breaches:
      "Comunique de imediato ao proprietário da clínica a perda de um dispositivo, uma mensagem enviada à pessoa errada ou qualquer outra possível violação: a clínica tem 72 horas para notificar o Garante.",
    personalDevices:
      "Não copie, exporte nem reencaminhe dados de pacientes para dispositivos pessoais, emails ou contas de mensagens pessoais, nem para qualquer serviço que a clínica não tenha aprovado.",
    calendarSync:
      "Se sincronizar a sua agenda com um calendário pessoal, mantenha a definição de detalhe mínimo: apenas as horas, sem nomes de pacientes nem tratamentos.",
    accessLog:
      "Cada acesso a dados de pacientes fica registado num registo de auditoria que a clínica pode analisar para proteger os pacientes. O registo não é utilizado para avaliar o seu desempenho.",
    adTools:
      "Nunca ligue o widget de marcação ou o site da clínica a ferramentas de publicidade ou de análise de forma que lhes revele quem marcou: o facto de alguém ter marcado um dentista é uma informação de saúde.",
    restricted:
      "Algumas fichas têm o tratamento limitado a pedido do paciente. Abra uma apenas quando for realmente necessário e indique o motivo que o sistema pede: cada acesso fica registado.",
    accept: "Li estas instruções e vou cumpri-las",
    version: "Versão {version}",
  },

  common: {
    version: "Versão {version}",
    effective: "Em vigor desde {date}",
    italianPrevails: "Tradução: em caso de divergência, prevalece a versão italiana.",
    print: "Imprimir ou guardar como PDF",
    contents: "Índice",
    notConfigured: "Não configurado",
    onRequest: "Mediante pedido",
    platformParty: "{name}, {address} (contacto para privacidade: {email})",
    platformPartyShort: "{name} (contacto para privacidade: {email})",
    backToTop: "Voltar ao início",
  },

  purposes: {
    booking_practice: {
      activity: "Marcação de consultas (canais da clínica)",
      purpose:
        "Marcação, alteração e cancelamento de consultas pedidas através do site da clínica, do widget de marcação, das suas próprias ligações, do telefone, da receção e das integrações que escolhe.",
    },
    booking_marketplace: {
      activity: "Marcações iniciadas nas páginas de pesquisa da Sorriso",
      purpose: "Encaminhamento da marcação para a clínica escolhida e respetiva gestão, com o consentimento explícito do paciente (Sorriso como responsável autónomo pelo tratamento).",
    },
    appointment_management: {
      activity: "Agenda e fichas de pacientes",
      purpose: "Gestão da agenda, das cadeiras e dos profissionais da clínica, do histórico de consultas dos pacientes e das notas administrativas da clínica.",
    },
    reminders: {
      activity: "Confirmações e lembretes",
      purpose:
        "Envio de confirmações de marcação, lembretes, alterações e cancelamentos por SMS, email ou, quando a clínica o ativa e o paciente o escolhe, WhatsApp; tratamento das respostas.",
    },
    waitlist: {
      activity: "Lista de espera",
      purpose: "Oferta de horários que ficam livres aos pacientes que pediram para ser avisados de consultas mais cedo.",
    },
    recalls: {
      activity: "Chamadas para consultas de controlo",
      purpose: "Lembrar os pacientes de uma consulta de controlo quando o seu dentista definiu um intervalo para eles.",
    },
    feedback_requests: {
      activity: "Convites para dar opinião",
      purpose: "Convidar os pacientes que deram o seu consentimento a dar a sua opinião após uma consulta.",
    },
    reviews: {
      activity: "Avaliações publicadas",
      purpose: "Publicação na Sorriso das avaliações de pacientes verificados, com o seu consentimento (Sorriso como responsável autónomo pelo tratamento).",
    },
    marketing: {
      activity: "Novidades e ofertas",
      purpose: "Envio de novidades e ofertas da clínica aos pacientes que o aceitaram.",
    },
    no_show_tracking: {
      activity: "Histórico de faltas",
      purpose: "Contagem das faltas às consultas dos últimos 24 meses para organizar a agenda e oferecer ajuda adicional; nunca para recusar cuidados.",
    },
    adaptive_reminders: {
      activity: "Lembretes adaptativos",
      purpose:
        "Estimar, a partir do histórico de consultas, quando um lembrete adicional ajuda (definição de perfis sem qualquer efeito no acesso aos cuidados; o paciente pode opor-se).",
    },
    anamnesis: {
      activity: "Historial clínico antes da consulta",
      purpose: "Recolha do questionário de historial clínico antes da consulta, assinado com um código único, para o profissional de saúde.",
    },
    partner_api: {
      activity: "Integrações (API de parceiros)",
      purpose: "Troca de dados de marcação com o software que a clínica liga, como o seu sistema de gestão ou centro de atendimento telefónico.",
    },
    directory: {
      activity: "Diretório de clínicas e profissionais",
      purpose: "Publicação dos perfis das clínicas e dos profissionais que os aprovaram.",
    },
    ranking: {
      activity: "Ordenação da pesquisa",
      purpose: "Ordenação dos resultados de pesquisa com critérios neutros explicados aos utilizadores.",
    },
    privacy_center: {
      activity: "Centro de privacidade dos pacientes",
      purpose: "Permitir que os pacientes encontrem as suas fichas em várias clínicas, as transfiram e exerçam os seus direitos.",
    },
    staff_accounts: {
      activity: "Contas da equipa",
      purpose: "Gestão das contas da equipa das clínicas e dos respetivos direitos de acesso.",
    },
    security_logs: {
      activity: "Registo de acessos e segurança",
      purpose:
        "Registo de quem acedeu ou alterou dados de pacientes, para proteger os pacientes e detetar utilizações indevidas. A equipa é informada (art. 4.º da Lei italiana n.º 300/1970); o registo não é utilizado para avaliar o desempenho.",
    },
    privacy_requests: {
      activity: "Pedidos de proteção de dados",
      purpose: "Receção e resposta a pedidos de exercício de direitos de proteção de dados dentro dos prazos legais.",
    },
  },

  legalBases: {
    art6_1_a: "Consentimento (art. 6.º, n.º 1, alínea a), do RGPD)",
    art6_1_b: "Contrato ou diligências pré-contratuais (art. 6.º, n.º 1, alínea b))",
    art6_1_c: "Obrigação jurídica (art. 6.º, n.º 1, alínea c))",
    art6_1_f: "Interesse legítimo (art. 6.º, n.º 1, alínea f))",
    art9_2_a: "Consentimento explícito para dados de saúde (art. 9.º, n.º 2, alínea a))",
    art9_2_f: "Declaração ou defesa de um direito num processo judicial (art. 9.º, n.º 2, alínea f))",
    art9_2_h: "Cuidados de saúde sob sigilo profissional (art. 9.º, n.º 2, alínea h), e n.º 3)",
  },

  dataCategories: {
    identity: "dados de identificação (nome, data de nascimento)",
    contact: "dados de contacto (telefone, email)",
    appointment: "dados das consultas (data, hora, clínica, profissional)",
    health_inferred: "dados que podem revelar a saúde (receber cuidados dentários, tipo de tratamento)",
    health: "dados de saúde (notas, historial clínico)",
    minor: "dados de menores",
    guardian: "dados de pais e tutores legais",
    message_content: "conteúdo das mensagens",
    consent_record: "registos de consentimento",
    review: "avaliações",
    professional: "dados profissionais dos profissionais de saúde",
    account: "dados de conta",
    technical: "dados técnicos (endereço IP pseudonimizado, navegador)",
    aggregated_metrics: "estatísticas agregadas",
  },

  subjects: {
    patients: "pacientes",
    guardians: "pais e tutores legais",
    bookers: "pessoas que marcam para outra pessoa",
    practitioners: "profissionais",
    staff: "equipa da clínica",
    reviewers: "autores de avaliações",
  },

  transferTools: {
    eu: "Sem transferência: fornecedor da UE/EEE",
    dpf: "Quadro de Privacidade de Dados UE-EUA (art. 45.º do RGPD)",
    scc: "Cláusulas contratuais-tipo (art. 46.º, n.º 2, alínea c), do RGPD)",
    dpf_scc: "Quadro de Privacidade de Dados UE-EUA, com cláusulas contratuais-tipo como alternativa",
  },

  units: {
    months: p({ one: "{count} mês", other: "{count} meses" }),
    days: p({ one: "{count} dia", other: "{count} dias" }),
    hours: p({ one: "{count} hora", other: "{count} horas" }),
  },

  retention: {
    patientInactiveMonths:
      "Ficha do paciente: {period} após a última consulta; depois, limitada ou pseudonimizada conforme a escolha da clínica (mais tempo quando o processo clínico tiver de ser conservado).",
    neverSeenPatientMonths: "Fichas de pessoas que nunca tiveram consulta: {period}.",
    messageBodyMonths: "Texto das mensagens: {period}.",
    messageMetaMonths: "Registo de mensagens (destinatário, data, estado): {period}.",
    reminderDays: "Lembretes agendados: {period} após a consulta.",
    waitlistDays: "Pedidos da lista de espera: {period} após a última data útil; os encerrados, após 30 dias.",
    patientNoteDays: "A nota da marcação do paciente e o motivo de cancelamento: {period} após a consulta.",
    auditMonths: "Registo de acessos: {period}.",
    providerMessageDays: "Cópias conservadas pelo fornecedor de mensagens: {period}.",
    formSubmissionMonths: "Questionários de historial clínico, depois de copiados para o processo clínico: {period}.",
    consentMonths: "Registos de consentimento de pacientes que já não constam dos registos: {period}.",
    privacyRequestMonths: "Pedidos encerrados: {period}.",
    marketingLapse: "O consentimento para novidades e ofertas caduca após 24 meses sem contacto.",
    contract: "Enquanto o serviço for prestado e, depois, durante o prazo de prescrição.",
  },

  register: {
    title: "Registo das atividades de tratamento",
    intro:
      "Art. 30.º, n.º 1, do RGPD. Gerado a partir do que a Sorriso faz para a clínica e das suas definições atuais; acrescente as atividades que realiza fora da Sorriso. Mantenha-o atualizado e apresente-o ao Garante quando lhe for pedido.",
    controller: "Responsável pelo tratamento",
    vat: "Número de IVA",
    address: "Sede",
    contact: "Contacto para privacidade",
    dpo: "Encarregado da proteção de dados",
    none: "—",
    generated: "Gerado em {date}",
    columns: {
      activity: "Atividade de tratamento",
      purpose: "Finalidade",
      legalBasis: "Fundamento jurídico",
      subjects: "Titulares dos dados",
      dataCategories: "Categorias de dados pessoais",
      recipients: "Destinatários",
      transfers: "Transferências para fora da UE",
      retention: "Prazos de apagamento",
      security: "Medidas de segurança",
    },
    recipient: "{name} ({service})",
    processor: "Sorriso, como subcontratante nos termos do acordo de subcontratação",
    transfer: "{name}: {tool}",
    noTransfers: "Nenhuma",
    security: {
      platform:
        "Cifragem ao nível do campo de notas e mensagens; acesso baseado em funções; registo de acessos inviolável; conservação automatizada; cópias de segurança cifradas na UE; equipa instruída e sujeita a confidencialidade.",
      mfaRequired: "Verificação em dois passos obrigatória para toda a equipa.",
      mfaOptional: "Verificação em dois passos disponível mas não obrigatória.",
      sessions: p({ one: "As sessões expiram ao fim de {count} hora.", other: "As sessões expiram ao fim de {count} horas." }),
      discreet: "As mensagens nunca indicam o tratamento.",
      detailed: "As mensagens podem indicar o tratamento (escolha da clínica).",
    },
  },

  controls: {
    encryption: {
      title: "Cifragem dos campos sensíveis",
      body: "As notas, os textos das mensagens, as respostas do historial clínico e outros textos livres são cifrados na base de dados com AES-256-GCM, com chaves guardadas fora da base de dados.",
    },
    transport: {
      title: "Cifragem em trânsito",
      body: "Todas as ligações utilizam TLS; os navegadores são instruídos a utilizar apenas HTTPS e as páginas têm uma política de segurança de conteúdos rigorosa.",
    },
    access_control: {
      title: "Acesso baseado em funções",
      body: "Cada função da equipa vê apenas aquilo de que precisa: a receção não tem acesso às notas clínicas; as exportações, o apagamento e as definições estão reservados aos proprietários e administradores.",
    },
    mfa: {
      title: "Verificação em dois passos",
      body: "A equipa inicia sessão com uma palavra-passe e um código de autenticação; as operações sensíveis voltam a pedir o código.",
    },
    sessions: {
      title: "Limites das sessões",
      body: "As sessões expiram após um período definido pela clínica e após inatividade; a equipa pode terminá-las.",
    },
    audit_log: {
      title: "Registo de acessos inviolável",
      body: "Cada acesso e alteração a dados de pacientes fica registado num registo encadeado por hashes que a clínica pode verificar e exportar; os topos da cadeia são guardados fora da base de dados.",
    },
    pseudonymous_logs: {
      title: "Registos sem dados pessoais",
      body: "Os registos da aplicação ocultam números de telefone e endereços de email; os endereços IP são guardados apenas como hashes com chave.",
    },
    rate_limiting: {
      title: "Proteção contra abusos",
      body: "O início de sessão, os códigos únicos e os pontos de acesso públicos de marcação têm limites de pedidos.",
    },
    links: {
      title: "Ligações de pacientes com prazo",
      body: "As ligações nas mensagens contêm tokens aleatórios, guardados apenas como hashes, que expiram após a consulta.",
    },
    otp: {
      title: "Códigos únicos",
      body: "Os códigos são guardados apenas como hashes, expiram ao fim de 5 minutos e ficam bloqueados após tentativas erradas repetidas.",
    },
    discreet_messages: {
      title: "Mensagens discretas",
      body: "Por predefinição, os SMS, as mensagens de WhatsApp, os assuntos dos emails e as entradas de calendário nunca indicam o tratamento, a especialidade ou notas.",
    },
    retention: {
      title: "Conservação automatizada",
      body: "Uma tarefa diária apaga, oculta ou pseudonimiza os dados quando termina o respetivo prazo de conservação.",
    },
    erasure: {
      title: "Apagamento e limitação",
      body: "As clínicas podem exportar, pseudonimizar ou limitar um paciente num só passo; as fichas limitadas exigem um motivo para cada acesso.",
    },
    backups: {
      title: "Cópias de segurança",
      body: "As cópias de segurança cifradas com recuperação para um momento específico são conservadas na UE durante um período limitado e, depois, substituídas.",
    },
    key_rotation: {
      title: "Gestão de chaves",
      body: "As chaves de cifragem podem ser rodadas sem interrupção do serviço; as chaves antigas servem apenas para decifrar.",
    },
    no_trackers: {
      title: "Sem rastreadores de terceiros",
      body: "As páginas da Sorriso não carregam scripts, tipos de letra, píxeis ou cookies de publicidade de terceiros; isto é verificado automaticamente.",
    },
    staff_instructions: {
      title: "Equipa instruída",
      body: "Cada membro da equipa aceita instruções escritas de proteção de dados antes de trabalhar com dados de pacientes; as aceitações ficam registadas.",
    },
    breach_procedure: {
      title: "Procedimento em caso de violação",
      body: "Um procedimento documentado para avaliar, conter e notificar violações de dados pessoais, com notificação à clínica no prazo de 24 horas.",
    },
  },

  subprocessors: {
    title: "Subcontratantes ulteriores",
    description: "Os fornecedores que a Sorriso utiliza para tratar os dados das clínicas, onde os tratam e como estão protegidas as transferências.",
    intro:
      "Quando uma clínica utiliza a Sorriso, a Sorriso trata dados de pacientes por conta da clínica, como sua subcontratante (art. 28.º do RGPD). A Sorriso utiliza os fornecedores abaixo. Cada um está vinculado por um acordo de subcontratação com obrigações pelo menos tão rigorosas como as do acordo de subcontratação da Sorriso.",
    noticeRule:
      "A Sorriso informa as clínicas de qualquer subcontratante ulterior novo ou substituído pelo menos 30 dias antes da alteração, por email e no painel. Uma clínica pode opor-se dentro desse prazo; se não for encontrada uma solução, pode pôr termo ao contrato sem penalização antes de a alteração produzir efeitos.",
    transfersNote:
      "Um fornecedor cuja empresa-mãe esteja nos Estados Unidos pode ser obrigado a dar acesso a dados mesmo quando os seus servidores estão na UE. Essas transferências baseiam-se no Quadro de Privacidade de Dados UE-EUA, com cláusulas contratuais-tipo como alternativa, e são avaliadas numa avaliação de impacto das transferências.",
    columns: {
      name: "Fornecedor",
      entity: "Entidade jurídica",
      service: "Serviço",
      data: "Dados",
      region: "Onde",
      transfer: "Garantia de transferência",
      dpa: "Acordo",
    },
    onlyWhatsapp: "Apenas para as clínicas que ativam o WhatsApp, e apenas para os pacientes que o escolhem.",
    parent: "Empresa-mãe: {parent}",
    viewDpa: "Acordo de subcontratação do fornecedor",
    service: {
      hosting: "Alojamento da aplicação",
      database: "Base de dados",
      sms: "Mensagens SMS",
      whatsapp: "Mensagens de WhatsApp",
      email: "Envio de emails",
      backups: "Cópias de segurança",
    },
    data: {
      all_platform_data: "todos os dados guardados na Sorriso",
      contact: "dados de contacto",
      message_content: "conteúdo das mensagens",
      message_metadata: "metadados das mensagens",
      technical: "dados técnicos",
    },
    changelog: "Histórico de alterações",
    change: {
      initial: "Primeira lista publicada.",
      added: "Adicionado {name}.",
      removed: "Removido {name}.",
      changed: "Alterados os dados de {name}.",
    },
    announced: "Anunciado em {date}",
  },

  dpa: {
    title: "Acordo de subcontratação",
    description: "O acordo nos termos do art. 28.º do RGPD entre cada clínica (responsável pelo tratamento) e a Sorriso (subcontratante).",
    intro:
      "Este acordo faz parte dos termos de utilização. Aplica-se sempre que a Sorriso trata dados pessoais por conta de uma clínica. A clínica aceita-o no painel; a aceitação fica registada com a respetiva versão, data e idioma.",
    parties: {
      title: "1. Partes e funções",
      body: "Responsável pelo tratamento: a clínica que utiliza a Sorriso. Subcontratante: {platform}.\n\nO Responsável pelo tratamento decide porquê e como são tratados os dados dos pacientes nas marcações que recebe através dos seus próprios canais: o seu site e widget de marcação, as suas próprias ligações, o telefone e a receção, e as integrações que liga. A Sorriso trata esses dados apenas como subcontratante do Responsável pelo tratamento.",
    },
    subject: {
      title: "2. Objeto, duração, natureza e finalidade",
      body: "Objeto: o serviço de marcação online, lembretes, lista de espera, chamadas de controlo e gestão de pacientes descrito nos termos de utilização.\n\nDuração: enquanto existir a conta da clínica e, depois, até os dados serem apagados ou devolvidos nos termos da secção 11.\n\nNatureza e finalidade, tipos de dados e categorias de titulares dos dados: conforme descrito no Anexo I, gerado a partir do tratamento que a Sorriso efetivamente realiza.",
    },
    instructions: {
      title: "3. Instruções documentadas (art. 28.º, n.º 3, alínea a))",
      body: "A Sorriso trata os dados pessoais apenas mediante instruções documentadas do Responsável pelo tratamento: este acordo, os termos de utilização, as definições do Responsável pelo tratamento no painel e as operações realizadas pela sua equipa. Tal inclui as transferências para países terceiros, que só ocorrem conforme descrito no Anexo III.\n\nO Responsável pelo tratamento instrui a Sorriso a enviar convites para dar opinião aos pacientes que os consentiram, e a aplicar os prazos de conservação definidos no painel.\n\nSe a Sorriso for obrigada pelo direito da UE ou italiano a tratar os dados de outra forma, informa o Responsável pelo tratamento antes do tratamento, salvo se a lei o proibir. A Sorriso informa imediatamente o Responsável pelo tratamento se, no seu entender, uma instrução violar a legislação de proteção de dados.",
    },
    confidentiality: {
      title: "4. Confidencialidade (art. 28.º, n.º 3, alínea b))",
      body: "A Sorriso garante que as pessoas que autoriza a tratar os dados estão sujeitas a confidencialidade, recebem instruções de proteção de dados e só acedem aos dados na medida em que a sua tarefa o exija. A equipa da Sorriso nunca acede a fichas de pacientes, exceto para prestar o suporte que o Responsável pelo tratamento pediu, para manter o serviço seguro ou quando a lei o exija; esse acesso fica registado.",
    },
    security: {
      title: "5. Segurança (art. 28.º, n.º 3, alínea c), e art. 32.º)",
      body: "A Sorriso aplica as medidas técnicas e organizativas do Anexo II, tendo em conta as técnicas mais avançadas, os custos e os riscos para os pacientes, em especial porque os dados podem revelar informações de saúde. A Sorriso revê estas medidas regularmente e não reduz o nível global de proteção.",
    },
    subprocessors: {
      title: "6. Subcontratantes ulteriores (art. 28.º, n.os 2 e 4)",
      body: "O Responsável pelo tratamento dá à Sorriso uma autorização geral para recorrer aos subcontratantes ulteriores indicados no Anexo III e na página pública de subcontratantes ulteriores. A Sorriso informa o Responsável pelo tratamento de qualquer aditamento ou substituição prevista com pelo menos 30 dias de antecedência, por email e no painel. O Responsável pelo tratamento pode opor-se dentro desse prazo por motivos razoáveis de proteção de dados; se não for encontrada uma solução, o Responsável pelo tratamento pode pôr termo ao serviço afetado sem penalização antes de a alteração produzir efeitos.\n\nA Sorriso impõe por contrato a cada subcontratante ulterior as mesmas obrigações de proteção de dados previstas neste acordo, e continua a ser plenamente responsável perante o Responsável pelo tratamento pelo seu cumprimento.",
    },
    rights: {
      title: "7. Direitos dos titulares dos dados (art. 28.º, n.º 3, alínea e))",
      body: "A Sorriso ajuda o Responsável pelo tratamento a responder aos pedidos de exercício dos direitos previstos no Capítulo III do RGPD com ferramentas no painel: a caixa de pedidos com os respetivos prazos, a exportação em JSON, CSV e FHIR, a retificação, a limitação e o apagamento por pseudonimização.\n\nSe um pedido relativo ao tratamento do Responsável pelo tratamento chegar à Sorriso, a Sorriso reencaminha-o para o Responsável pelo tratamento no prazo de 2 dias úteis e não lhe responde em nome do Responsável pelo tratamento, exceto para informar o requerente de que foi reencaminhado.",
    },
    assistance: {
      title: "8. Assistência no cumprimento das obrigações do Responsável pelo tratamento (art. 28.º, n.º 3, alínea f))",
      body: "Tendo em conta a natureza do tratamento e a informação de que dispõe, a Sorriso presta assistência ao Responsável pelo tratamento em matéria de segurança (art. 32.º), notificação e comunicação de violações (art. 33.º e 34.º), avaliações de impacto sobre a proteção de dados e consulta prévia (art. 35.º e 36.º). A Sorriso disponibiliza a sua própria avaliação de impacto da plataforma e a sua avaliação de impacto das transferências.",
    },
    breach: {
      title: "9. Violações de dados pessoais",
      body: "A Sorriso notifica o Responsável pelo tratamento sem demora injustificada e, em qualquer caso, no prazo de 24 horas após ter conhecimento de uma violação de dados pessoais que afete os dados do Responsável pelo tratamento. A notificação descreve, na medida do que for conhecido, a natureza da violação, as categorias e o número aproximado de pacientes e de registos afetados, as consequências prováveis e as medidas adotadas ou propostas. A Sorriso acrescenta informações à medida que ficam disponíveis, para que o Responsável pelo tratamento possa notificar o Garante no prazo de 72 horas e, quando necessário, informar os pacientes.",
    },
    audits: {
      title: "10. Informações e auditorias (art. 28.º, n.º 3, alínea h))",
      body: "A Sorriso disponibiliza ao Responsável pelo tratamento todas as informações necessárias para demonstrar o cumprimento do art. 28.º: este acordo, o registo das atividades de tratamento, as medidas de segurança, as certificações ou relatórios de auditoria quando disponíveis, e o registo de acessos no painel. A Sorriso permite auditorias e inspeções pelo Responsável pelo tratamento ou por um auditor por ele mandatado, sujeito a confidencialidade, com pelo menos 30 dias de pré-aviso, durante o horário de expediente e sem perturbar o serviço; as auditorias ficam a cargo do Responsável pelo tratamento, salvo se revelarem um incumprimento material.",
    },
    deletion: {
      title: "11. Devolução e apagamento no termo (art. 28.º, n.º 3, alínea g))",
      body: "O Responsável pelo tratamento pode transferir todos os seus dados a qualquer momento, em formatos documentados (JSON, CSV e FHIR R4), gratuitamente. Quando o Responsável pelo tratamento encerra a sua conta, a marcação online para de imediato, os dados ficam disponíveis para transferência durante 60 dias (uma transição de 30 dias e pelo menos 30 dias para os recuperar) e, depois, são apagados dos sistemas da Sorriso. A Sorriso emite um certificado de apagamento que indica o que foi apagado e quando. As cópias de segurança cifradas são substituídas dentro do respetivo prazo de conservação e não são restauradas, exceto para recuperar de um incidente. A Sorriso só conserva os dados durante mais tempo quando o direito da UE ou italiano o exija, e apenas para esse fim.",
    },
    transfers: {
      title: "12. Transferências para fora da UE",
      body: "Os dados estão alojados na UE. Alguns subcontratantes ulteriores pertencem a grupos sediados nos Estados Unidos; as garantias de transferência de cada um estão indicadas no Anexo III, e o seu impacto foi avaliado. A Sorriso não transfere os dados do Responsável pelo tratamento para nenhum outro país terceiro sem informar previamente o Responsável pelo tratamento nos termos da secção 6.",
    },
    ownPurposes: {
      title: "13. Tratamentos de que a Sorriso é responsável",
      body: "Para algumas atividades, a Sorriso é responsável autónomo pelo tratamento, e não subcontratante do Responsável pelo tratamento, e informa os pacientes desse facto no seu próprio aviso de privacidade: as marcações iniciadas nas páginas de pesquisa da Sorriso (com o consentimento explícito do paciente), as avaliações publicadas, o diretório e a ordenação da pesquisa, o centro de privacidade dos pacientes e as contas da equipa. A Sorriso não utiliza os dados que trata para o Responsável pelo tratamento para nenhuma outra finalidade própria, e nunca os vende nem os utiliza para publicidade.",
    },
    controller: {
      title: "14. Obrigações do Responsável pelo tratamento",
      body: "O Responsável pelo tratamento garante que dispõe de um fundamento jurídico para o tratamento, fornece aos pacientes o seu aviso de privacidade (a Sorriso gera um a partir das definições da clínica), dá instruções à sua equipa e mantém atualizados as suas definições, os prazos de conservação e o registo das atividades de tratamento. O Responsável pelo tratamento não liga o widget de marcação ou as páginas da Sorriso a ferramentas de publicidade ou de análise de forma que lhes revele quem marcou.",
    },
    liability: {
      title: "15. Responsabilidade e duração",
      body: "Cada parte é responsável nos termos do art. 82.º do RGPD e dos termos de utilização. Este acordo vigora enquanto a Sorriso tratar dados pessoais para o Responsável pelo tratamento. Em caso de conflito com os termos de utilização em matéria de proteção de dados, prevalece este acordo.",
    },
    law: {
      title: "16. Lei aplicável",
      body: "Este acordo rege-se pela lei italiana. Os litígios ficam sujeitos à jurisdição prevista nos termos de utilização.",
    },
    annex1: {
      title: "Anexo I — Descrição do tratamento",
      intro: "O tratamento que a Sorriso realiza como subcontratante, gerado a partir do registo de finalidades da plataforma.",
    },
    annex2: {
      title: "Anexo II — Medidas técnicas e organizativas",
      intro: "As medidas atualmente em vigor. Esta lista é gerada a partir dos controlos implementados na plataforma.",
    },
    annex3: {
      title: "Anexo III — Subcontratantes ulteriores",
      intro: "A lista atual (versão {version}). A página pública conserva o histórico de alterações.",
    },
  },

  terms: {
    title: "Termos de utilização para clínicas",
    description: "O contrato entre a Sorriso e as clínicas dentárias que a utilizam.",
    intro:
      "Estes termos regem a utilização da Sorriso pelas clínicas dentárias (\"a clínica\") e são celebrados com {platform}. A clínica aceita-os no painel; a aceitação fica registada com a respetiva versão, data e idioma.",
    service: {
      title: "1. O serviço",
      body: "A Sorriso fornece marcação online para o site da clínica e para as páginas de pesquisa da Sorriso, uma agenda para profissionais, cadeiras e unidades, confirmações e lembretes, uma lista de espera, chamadas de controlo, fichas de pacientes para fins administrativos e ferramentas para cumprir as obrigações de proteção de dados. A Sorriso não é um prestador de cuidados de saúde e não presta aconselhamento médico.",
    },
    account: {
      title: "2. Contas e equipa",
      body: "A clínica designa um proprietário que gere a sua conta e convida membros da equipa com uma função. A clínica é responsável pela utilização do serviço pela sua equipa, mantém confidenciais as credenciais de acesso e ativa a verificação em dois passos. Cada membro da equipa tem de aceitar as instruções de proteção de dados antes de trabalhar com dados de pacientes.",
    },
    data: {
      title: "3. Proteção de dados",
      body: "Para os dados dos pacientes que marcam através dos canais próprios da clínica, a clínica é a responsável pelo tratamento e a Sorriso a sua subcontratante: aplica-se o acordo de subcontratação, que faz parte destes termos. Para as marcações iniciadas nas páginas de pesquisa da Sorriso, as avaliações, o diretório e o centro de privacidade, a Sorriso é responsável autónomo pelo tratamento, conforme explicado no seu aviso de privacidade.",
    },
    obligations: {
      title: "4. Obrigações da clínica",
      body: "A clínica fornece informações exatas sobre os seus serviços, preços, profissionais e disponibilidade; cumpre as marcações que aceita; utiliza os dados dos pacientes apenas para fins de prestação de cuidados e de administração; e não utiliza a Sorriso para enviar comunicações não solicitadas.",
    },
    marketplace: {
      title: "5. Pesquisa, ordenação e avaliações",
      body: "As clínicas só aparecem na pesquisa da Sorriso se estiverem incluídas e com profissionais que aprovaram o seu perfil. A ordenação utiliza critérios neutros publicados na página de ordenação; nenhum pagamento influencia a posição. Só os pacientes com uma consulta concluída podem avaliar, e as clínicas não podem remover avaliações: podem responder e denunciar uma avaliação, sobre a qual a Sorriso decide com fundamentação e possibilidade de um recurso.",
    },
    availability: {
      title: "6. Disponibilidade e suporte",
      body: "A Sorriso atua com diligência razoável para manter o serviço disponível e seguro e anuncia antecipadamente as manutenções programadas. O suporte está disponível por email nos dias úteis.",
    },
    fees: {
      title: "7. Preços",
      body: "Os preços, se existirem, são os do plano escolhido pela clínica, apresentados no painel. A Sorriso anuncia as alterações de preço com pelo menos 30 dias de antecedência. As exportações e a mudança para outro fornecedor são gratuitas.",
    },
    ip: {
      title: "8. Propriedade intelectual",
      body: "A clínica mantém todos os direitos sobre os seus conteúdos e dados. A Sorriso mantém todos os direitos sobre o software. A clínica concede à Sorriso o direito de apresentar o seu perfil público e os seus conteúdos para os fins do serviço.",
    },
    suspension: {
      title: "9. Suspensão",
      body: "A Sorriso só pode suspender uma conta por incumprimento grave destes termos, por um risco de segurança ou por uma obrigação legal, comunicando previamente os motivos à clínica por escrito sempre que possível e, o mais tardar, no momento em que a suspensão produz efeitos. A clínica pode contestar a decisão através do procedimento de reclamações.",
    },
    exit: {
      title: "10. Cessação, mudança de fornecedor e recuperação dos dados",
      body: "A clínica pode encerrar a sua conta a qualquer momento a partir do painel, sem pré-aviso. A marcação online para de imediato; a clínica mantém o acesso durante uma transição de 30 dias e pelo menos mais 30 dias para recuperar os seus dados em JSON, CSV e FHIR, gratuitamente, e a Sorriso ajuda-a a mudar para outro fornecedor. Os dados são depois apagados e é emitido um certificado de apagamento. A Sorriso pode pôr termo ao contrato com dois meses de pré-aviso, ou de imediato em caso de incumprimento grave.",
    },
    liability: {
      title: "11. Responsabilidade",
      body: "Nenhuma das partes exclui a responsabilidade por dolo ou negligência grave, ou quando a lei não o permita. Fora destes casos, a responsabilidade de cada parte limita-se aos danos diretos previsíveis. A Sorriso não é responsável pelos serviços clínicos da clínica.",
    },
    complaints: {
      title: "12. Reclamações e mediação",
      body: "A clínica pode enviar reclamações à Sorriso através do painel ou por email; a Sorriso responde no prazo de 15 dias úteis. A Sorriso está disposta a recorrer à mediação para resolver litígios extrajudicialmente, conforme previsto no Regulamento (UE) 2019/1150.",
    },
    changes: {
      title: "13. Alterações a estes termos",
      body: "A Sorriso anuncia as alterações com pelo menos 30 dias de antecedência, por email e no painel, salvo se uma lei exigir uma alteração mais rápida. Se a clínica não concordar, pode pôr termo ao contrato antes de a alteração produzir efeitos, sem encargos.",
    },
    law: {
      title: "14. Lei aplicável e foro",
      body: "Estes termos regem-se pela lei italiana. São competentes os tribunais da sede da Sorriso, sem prejuízo das normas imperativas.",
    },
  },

  docs: {
    dpa: "Acordo de subcontratação",
    terms: "Termos de utilização",
    subprocessors: "Subcontratantes ulteriores",
    staff_instructions: "Instruções para a equipa",
  },
} satisfies DeepPartial<Messages["legalPractice"]>;
