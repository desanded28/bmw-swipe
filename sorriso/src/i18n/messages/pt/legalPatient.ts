/**
 * TEXTO JURÍDICO: a versão italiana prevalece. Tradução para português europeu feita a partir do
 * inglês; rascunho a rever por um advogado ou EPD (docs/i18n/glossary-pt.md, "Needs lawyer review").
 */
import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    practiceTitle: "Aviso de privacidade: {practice}",
    practiceDescription: "Como {practice} trata os dados pessoais dos seus pacientes, e os seus direitos.",
    minorTitle: "Privacidade para jovens: {practice}",
    minorDescription: "O que {practice} faz com as informações sobre ti, em palavras simples.",
    platformTitle: "Aviso de privacidade da Sorriso",
    platformDescription: "Como a Sorriso trata os dados pessoais quando procura um dentista, marca uma consulta ou escreve uma avaliação, e os seus direitos.",
    staffTitle: "Aviso de privacidade para a equipa das clínicas",
    staffDescription: "Como são tratados os seus dados quando utiliza o painel da Sorriso, e como funciona o registo de acessos.",
    practitionerTitle: "Aviso de privacidade para profissionais",
    practitionerDescription: "Como a Sorriso trata os dados dos profissionais incluídos no seu diretório.",
    cookiesTitle: "Aviso sobre cookies",
    cookiesDescription: "Os poucos cookies técnicos que a Sorriso utiliza, e porque não existe um banner de cookies.",
  },
  page: {
    version: "Versão {version}",
    updated: "Em vigor desde {date}",
    italianPrevails: "Esta é uma tradução. Em caso de divergência, prevalece a versão italiana.",
    italianLink: "Ler a versão italiana",
    contents: "Índice",
    practiceLink: "Aviso completo da clínica",
    minorsLink: "Versão para jovens",
    platformLink: "Aviso de privacidade da Sorriso",
    cookiesLink: "Aviso sobre cookies",
    privacyCenterLink: "Ir para o centro de privacidade",
    otherNotices: "Outros avisos",
    staffLink: "Para a equipa das clínicas",
    practitionerLink: "Para profissionais",
    patientLink: "Para pacientes",
    backToTop: "Voltar ao início",
  },
  sections: {
    summary: "Em resumo",
    controller: "Quem é responsável pelos seus dados",
    roles: "As duas funções da Sorriso",
    data: "Que dados tratamos",
    purposes: "Porque os tratamos e com que fundamento jurídico",
    marketplace: "Se marcou na Sorriso",
    withdrawal: "Se retirar o seu consentimento",
    recipients: "Quem recebe os seus dados",
    transfers: "Transferências para fora do Espaço Económico Europeu",
    retention: "Durante quanto tempo conservamos os seus dados",
    rights: "Os seus direitos",
    complaint: "Reclamações",
    mandatory: "É obrigado a fornecer-nos os seus dados?",
    automated: "Decisões automatizadas e definição de perfis",
    minors: "Crianças e jovens",
    monitoring: "O registo de acessos",
    profile: "O seu perfil público",
    cookies: "Cookies",
    changes: "Alterações a este aviso",
    who: "Quem cuida das tuas informações",
    what: "Que informações usamos",
    why: "Porque as usamos",
    parents: "Os teus pais ou tutor",
    keep: "Durante quanto tempo as guardamos",
    youCan: "O que podes fazer",
    help: "Se alguma coisa estiver mal",
    full: "O aviso completo",
    cookieList: "Cookies que utilizamos",
    storage: "Armazenamento no seu navegador",
    thirdParties: "Terceiros",
    legalBasis: "Fundamento jurídico",
    control: "Como controlar os cookies",
    widget: "O widget de marcação nos sites das clínicas",
  },
  controller: {
    name: "Responsável pelo tratamento: {name}",
    vat: "Número de IVA: {vat}",
    address: "Morada: {address}",
    contact: "Contacto para questões de privacidade: {email}",
    phone: "Telefone: {phone}",
    dpo: "Encarregado da proteção de dados (EPD): {name}, {email}",
    dpoEmail: "Encarregado da proteção de dados (EPD): {email}",
    noDpo: "A clínica não designou um encarregado da proteção de dados: para qualquer questão de privacidade, escreva para o contacto acima.",
    processor:
      "A Sorriso fornece o software de marcações como subcontratante da clínica (art. 28.º do RGPD): atua apenas mediante instruções documentadas da clínica e ao abrigo de um acordo de subcontratação.",
    platformDpo: "O encarregado da proteção de dados (EPD) da Sorriso pode ser contactado através de {email}.",
  },
  bases: {
    art6_1_a: "o seu consentimento (art. 6.º, n.º 1, alínea a), do RGPD)",
    art6_1_b: "o serviço que pede, ou diligências pré-contratuais a seu pedido (art. 6.º, n.º 1, alínea b), do RGPD)",
    art6_1_c: "uma obrigação jurídica do responsável pelo tratamento (art. 6.º, n.º 1, alínea c), do RGPD)",
    art6_1_f: "os interesses legítimos do responsável pelo tratamento, aos quais se pode opor (art. 6.º, n.º 1, alínea f), do RGPD)",
    art9_2_a: "o seu consentimento explícito para dados que possam dizer respeito à sua saúde (art. 9.º, n.º 2, alínea a), do RGPD)",
    art9_2_f: "a declaração, o exercício ou a defesa de um direito num processo judicial (art. 9.º, n.º 2, alínea f), do RGPD)",
    art9_2_h:
      "a prestação de cuidados de saúde por profissionais sujeitos a sigilo profissional (art. 9.º, n.º 2, alínea h), e n.º 3, do RGPD, art. 2-septies do Código italiano da Privacidade)",
  },
  purposes: {
    item: "{title}. {body} Fundamento jurídico: {bases}.",
    booking_practice: {
      title: "Marcação",
      body: "Para receber e registar a sua marcação, verificar a disponibilidade e confirmar-lhe a consulta.",
    },
    booking_marketplace: {
      title: "Marcações feitas na Sorriso",
      body: "Quando marca a partir das páginas de pesquisa da Sorriso: para encaminhar a sua marcação para a clínica que escolheu e gerir os lembretes e as alterações. Os dados da marcação podem revelar informações sobre a sua saúde, por isso a Sorriso pede o seu consentimento explícito.",
    },
    appointment_management: {
      title: "Gestão das suas consultas",
      body: "Para manter as suas consultas e a sua ficha na clínica, organizar a agenda e permitir-lhe confirmar, alterar ou cancelar online.",
    },
    reminders: {
      title: "Confirmações e lembretes",
      body: "Para enviar confirmações de marcação e lembretes por SMS, email ou, se o escolher, WhatsApp. As mensagens são discretas: não mostram tratamentos nem notas, a menos que a clínica tenha escolhido mensagens detalhadas e o seu contacto tenha sido verificado. Pode desativar qualquer canal a qualquer momento.",
    },
    waitlist: {
      title: "Lista de espera",
      body: "Se se inscrever na lista de espera: para o avisar quando vagar um horário mais cedo.",
    },
    recalls: {
      title: "Chamadas para consultas de controlo",
      body: "Para o lembrar quando o seu dentista definiu um intervalo até à próxima consulta de controlo. Cada chamada permite-lhe pará-las, e pode opor-se a qualquer momento.",
    },
    feedback_requests: {
      title: "Convites para dar a sua opinião",
      body: "Apenas se aceitar: um único convite para dar a sua opinião após a consulta. Pode retirar o seu consentimento a qualquer momento.",
    },
    reviews: {
      title: "Avaliações",
      body: "Se escrever uma avaliação e aceitar a sua publicação: para a publicar, mostrar que provém de uma consulta real e moderá-la. Pode eliminá-la a qualquer momento no centro de privacidade.",
    },
    marketing: {
      title: "Novidades e ofertas",
      body: "Apenas se aceitar: novidades e ofertas da clínica. Nunca é necessário para marcar ou para ser tratado, e o seu consentimento caduca após 24 meses sem contacto.",
    },
    no_show_tracking: {
      title: "Histórico de faltas",
      body: "Para registar as faltas às consultas nos últimos 24 meses, organizar a agenda e oferecer ajuda, como um lembrete adicional. Nunca o impede de marcar. Pode opor-se a qualquer momento.",
    },
    adaptive_reminders: {
      title: "Lembretes adaptativos",
      body: "Para enviar um lembrete adicional quando, com base no seu histórico de consultas, é mais provável que falte a uma consulta. Trata-se de definição de perfis (art. 4.º, n.º 4, do RGPD): apenas acrescenta ajuda e nunca limita as suas marcações. Pode opor-se a qualquer momento e passar a receber os lembretes normais.",
    },
    anamnesis: {
      title: "Questionário de historial clínico",
      body: "Se a clínica lhe pedir que o preencha antes da consulta: para preparar o seu tratamento em segurança. As suas respostas são cifradas e só os profissionais de saúde as veem.",
    },
    partner_api: {
      title: "Software da clínica ligado",
      body: "Se a clínica ligar o seu próprio software de gestão à agenda: para manter ambos sincronizados. Esse software é um destinatário escolhido pela clínica.",
    },
    directory: {
      title: "Diretório",
      body: "Para mostrar clínicas e profissionais nos resultados de pesquisa da Sorriso e nas respetivas páginas públicas.",
    },
    ranking: {
      title: "Ordem dos resultados de pesquisa",
      body: "Para ordenar os resultados de pesquisa segundo critérios publicados: o horário livre mais próximo, as classificações, a fiabilidade, o perfil completo e a distância. Ninguém pode pagar para ficar mais bem posicionado. Pode opor-se a qualquer momento.",
    },
    privacy_center: {
      title: "Centro de privacidade",
      body: "Para encontrar as fichas que as clínicas na Sorriso têm associadas a um número de telefone ou endereço de email que verificou com um código único, para que possa exercer os seus direitos num só lugar.",
    },
    staff_accounts: {
      title: "Contas da equipa",
      body: "Para dar à equipa das clínicas um acesso pessoal e seguro ao painel: início de sessão, verificação em dois passos, sessões e aceitação das instruções para a equipa.",
    },
    security_logs: {
      title: "Segurança e registo de acessos",
      body: "Para registar quem abre e altera as fichas dos pacientes, protegê-las contra utilizações indevidas e mostrar aos pacientes quem acedeu aos seus dados.",
    },
    privacy_requests: {
      title: "Pedidos de privacidade",
      body: "Para tratar os pedidos que as pessoas fazem sobre os seus dados, responder-lhes dentro dos prazos legais e conservar a respetiva prova.",
    },
  },
  services: {
    hosting: "alojamento da aplicação",
    database: "base de dados",
    sms: "mensagens SMS",
    whatsapp: "mensagens de WhatsApp, apenas para as clínicas que as ativam e os pacientes que as escolhem",
    email: "email",
    backups: "cópias de segurança",
  },
  transferTools: {
    eu: "sem transferência (UE/EEE)",
    dpf: "Quadro de Privacidade de Dados UE-EUA (decisão de adequação da Comissão Europeia de 10 de julho de 2023)",
    scc: "cláusulas contratuais-tipo aprovadas pela Comissão Europeia (art. 46.º do RGPD)",
    dpf_scc: "Quadro de Privacidade de Dados UE-EUA, com as cláusulas contratuais-tipo da Comissão Europeia como alternativa",
  },
  data: {
    intro: "Tratamos:",
    identity: "dados de identificação e de contacto: nome, apelido, número de telemóvel, endereço de email, data de nascimento, e o idioma e o canal que prefere;",
    appointments:
      "dados das consultas: data, hora, tratamento, profissional, unidade, estado e faltas. Podem revelar informações sobre a sua saúde;",
    yourWords: "o que decide dizer-nos: notas acrescentadas a uma marcação, respostas às nossas mensagens e, se a clínica o utilizar, o questionário de historial clínico;",
    guardian: "no caso de crianças: os dados do pai, da mãe ou do tutor legal que marca e recebe as mensagens;",
    records: "registos dos seus consentimentos e escolhas, e dos pedidos de privacidade que faz;",
    technical: "dados técnicos necessários para a segurança: hashes com chave (HMAC) do seu endereço IP, nunca o próprio endereço.",
    source:
      "Recebemos estes dados de si, ou da pessoa que marcou por si: o pai, a mãe ou o tutor legal, ou outro adulto que marcou em seu nome. Nesse caso, enviamos também este aviso para o seu próprio contacto, se o tivermos (art. 14.º do RGPD).",
  },
  platformData: {
    intro: "A Sorriso trata, para os seus próprios serviços:",
    booking:
      "quando marca a partir das suas páginas de pesquisa: o seu nome, contactos, data de nascimento se indicada, a clínica, o tratamento, a data e a hora escolhidos, e o registo do seu consentimento;",
    reviews: "quando escreve uma avaliação: a classificação, o texto, o nome apresentado e a consulta a que se refere;",
    privacyCenter:
      "quando utiliza o centro de privacidade: um hash com chave do número de telefone ou endereço de email que verifica, os códigos únicos enviados para esse contacto (guardados apenas como hashes) e um cookie de sessão válido durante 30 minutos;",
    technical: "para a segurança: hashes com chave (HMAC) dos endereços IP e dos navegadores, nunca os próprios endereços.",
  },
  recipients: {
    intro: "Os seus dados só são vistos por quem precisa deles:",
    staff: "a equipa autorizada da clínica (receção e profissionais de saúde), cada um com o acesso de que a sua função necessita;",
    sorriso: "a Sorriso, que gere o software de marcações como subcontratante da clínica;",
    practices: "a clínica onde marca, que recebe a sua marcação e passa a ser responsável pelo tratamento da sua própria cópia;",
    providers: "os fornecedores técnicos indicados abaixo (subcontratantes ulteriores), vinculados por acordos de subcontratação;",
    authorities: "autoridades públicas, apenas quando a lei o exigir.",
    notSold: "Os seus dados nunca são vendidos nem utilizados para publicidade.",
    provider: "{name} ({entity}): {service}, {region}.",
    providerNoRegion: "{name} ({entity}): {service}.",
    fullList: "A lista completa e atualizada de subcontratantes ulteriores está em {url}.",
  },
  transfers: {
    intro:
      "Alguns fornecedores pertencem a grupos sediados nos Estados Unidos. Mesmo quando os seus servidores estão na UE, tal pode constituir uma transferência para fora do Espaço Económico Europeu. Estas transferências estão abrangidas por:",
    item: "{name}: {tool}.",
    assessment: "A Sorriso avaliou estas transferências (avaliação de impacto das transferências). Pode pedir uma cópia das garantias escrevendo para {email}.",
    none: "Os seus dados não são transferidos para fora do Espaço Económico Europeu.",
  },
  retention: {
    intro: "Conservamos os dados apenas enquanto forem necessários:",
    patientInactiveMonths:
      "a sua ficha na clínica: {period} após a sua última consulta, ou mais tempo apenas quando a clínica tiver de conservar documentação clínica por lei;",
    neverSeenPatientMonths: "fichas de pessoas que nunca vieram a uma consulta: {period};",
    patientNoteDays: "notas que acrescenta a uma marcação: {period} após a consulta;",
    messageBodyMonths: "o texto das mensagens: {period}, após o qual ficam apenas a data, o canal e o estado de entrega;",
    messageMetaMonths: "registos das mensagens (data, canal, estado de entrega): {period};",
    reminderDays: "agendamentos de lembretes: {period} após o envio;",
    providerMessageDays: "cópias conservadas pelo fornecedor de SMS e WhatsApp: apagadas após {period};",
    waitlistDays: "inscrições na lista de espera: {period} após o seu encerramento;",
    auditMonths: "o registo de acessos: {period};",
    formSubmissionMonths: "questionários de historial clínico: {period}, e apenas depois de integrados no processo clínico da clínica;",
    consentMonths: "registos dos seus consentimentos e escolhas: até {period}, para os poder provar;",
    privacyRequestMonths: "pedidos de privacidade e respetivas respostas: {period} após o seu encerramento;",
    marketingLapse: "o consentimento para novidades e ofertas caduca após 24 meses sem contacto.",
    after:
      "No fim destes prazos, os dados são apagados ou pseudonimizados automaticamente. Os registos de consultas pseudonimizados deixam de mostrar o seu nome ou contactos e são conservados apenas para estatísticas e para os registos da clínica.",
    platformBookings: "dados das marcações do marketplace: enquanto a marcação for gerida, e nunca mais tempo do que a clínica conservar a sua própria cópia;",
    platformReviews: "avaliações publicadas: até as eliminar ou serem removidas;",
    platformCodes: "códigos únicos: apagados {period} após expirarem; as sessões do centro de privacidade terminam ao fim de 30 minutos;",
  },
  rights: {
    intro: "Tem direito a:",
    access: "aceder aos seus dados e receber uma cópia (art. 15.º do RGPD);",
    rectification: "obter a retificação dos dados inexatos e que os dados incompletos sejam completados (art. 16.º);",
    erasure: "obter o apagamento dos seus dados quando já não forem necessários ou retirar o consentimento, exceto o que a lei nos obriga a conservar (art. 17.º);",
    restriction: "obter a limitação do tratamento, por exemplo enquanto uma retificação é verificada (art. 18.º);",
    portability: "receber os dados que nos forneceu num formato estruturado e de leitura automática, ou que sejam transmitidos a outro responsável pelo tratamento (art. 20.º);",
    objection: "opor-se ao tratamento baseado em interesses legítimos, incluindo a definição de perfis (art. 21.º);",
    withdraw: "retirar o seu consentimento a qualquer momento, sem comprometer o tratamento efetuado antes (art. 7.º, n.º 3);",
    automated: "não ficar sujeito a decisões tomadas exclusivamente com base no tratamento automatizado (art. 22.º).",
    how: "Como: online, no centro de privacidade em {url}, onde entra com um código único enviado para o seu telefone ou email; a partir da ligação nas mensagens das suas consultas; ou escrevendo para {email}.",
    howNoContact:
      "Como: online, no centro de privacidade em {url}, onde entra com um código único enviado para o seu telefone ou email, ou a partir da ligação nas mensagens das suas consultas.",
    deadline:
      "Respondemos no prazo de um mês. Para pedidos complexos, este prazo pode ser prorrogado por mais dois meses, e informamo-lo do motivo no primeiro mês (art. 12.º, n.º 3, do RGPD). O exercício dos seus direitos é gratuito.",
    recipientsInformed: "Quando retificamos ou apagamos os seus dados, ou limitamos a sua utilização, informamos também os destinatários a quem os enviámos (art. 19.º do RGPD).",
  },
  complaint: {
    body: "Se considerar que os seus dados são tratados de forma ilícita, pode apresentar reclamação à autoridade italiana de proteção de dados, o Garante per la protezione dei dati personali (Piazza Venezia 11, 00187 Roma, www.garanteprivacy.it), ou à autoridade do país da UE onde vive ou trabalha (art. 77.º do RGPD). Pode também recorrer aos tribunais (art. 79.º do RGPD).",
  },
  mandatory: {
    practice:
      "Para marcar, tem de indicar o seu nome e um número de telemóvel ou um endereço de email: sem eles, a clínica não pode marcar a consulta nem lembrá-lo dela. A data de nascimento é opcional, mas obrigatória quando marca para uma criança. Todos os consentimentos são opcionais: recusar nunca o impede de marcar nem de ser tratado.",
    platform:
      "O consentimento para a marcação através da Sorriso só é necessário para marcar a partir das páginas de pesquisa da Sorriso. Se preferir não o dar, pode marcar diretamente com a clínica, no site da clínica ou por telefone.",
  },
  automated: {
    none: "Nenhuma decisão a seu respeito é tomada exclusivamente por meios automatizados (art. 22.º do RGPD).",
    profiling:
      "Esta clínica utiliza lembretes adaptativos: o seu histórico de consultas é utilizado para decidir se lhe envia um lembrete adicional. Trata-se de definição de perfis, mas apenas acrescenta ajuda e nunca limita as suas marcações. Pode opor-se a qualquer momento.",
    platform:
      "Os resultados de pesquisa são ordenados segundo critérios publicados, e as avaliações são verificadas automaticamente quanto a dados de saúde antes da publicação; é sempre uma pessoa que decide se uma avaliação é removida. Nenhuma decisão que produza efeitos jurídicos ou efeitos igualmente significativos é tomada exclusivamente por meios automatizados.",
  },
  minors: {
    body: "As crianças com menos de 14 anos são marcadas pelo pai, pela mãe ou pelo tutor legal, que recebe as mensagens e dá eventuais consentimentos (art. 2-quinquies do Código italiano da Privacidade). A partir dos 14 anos, os jovens podem marcar e fazer estas escolhas sozinhos. O acesso do pai, da mãe ou do tutor legal através do centro de privacidade termina quando a criança faz 18 anos.",
    link: "Uma versão deste aviso escrita para jovens está disponível em {url}.",
  },
  marketplace: {
    body: "Se marcou a partir das páginas de pesquisa da Sorriso, a Sorriso é também responsável autónomo pelo tratamento dessa marcação: encaminha-a para a clínica e gere os lembretes e as alterações, com o seu consentimento explícito (art. 9.º, n.º 2, alínea a), do RGPD). O aviso da Sorriso explica como: {url}.",
    withdraw:
      "Se retirar esse consentimento, a Sorriso cessa o seu próprio tratamento, enquanto a clínica conserva o que precisa para o tratar (art. 9.º, n.º 2, alínea h), do RGPD).",
  },
  withdrawal: {
    platform:
      "Se retirar o seu consentimento para a marcação através da Sorriso, a Sorriso cessa o seu próprio tratamento dessa marcação: deixa de a manter no seu histórico do marketplace e de enviar as suas próprias mensagens e convites sobre ela. A clínica conserva o que precisa para o tratar, como responsável pelo tratamento, ao abrigo do art. 9.º, n.º 2, alínea h), do RGPD, com a Sorriso como subcontratante. A retirada não compromete o tratamento efetuado antes dela.",
  },
  roles: {
    intro: "A Sorriso tem duas funções:",
    controller:
      "responsável autónomo pelo tratamento para os seus próprios serviços: marcações iniciadas nas páginas de pesquisa da Sorriso, o diretório de clínicas e profissionais, as avaliações publicadas, a ordem dos resultados de pesquisa e o centro de privacidade. Este aviso abrange-os;",
    processor:
      "subcontratante das clínicas (art. 28.º do RGPD) para tudo o que chega pelos canais próprios de uma clínica: o seu site, widget de marcação ou ligações, a sua equipa e o seu software. Para estes, a clínica é a responsável pelo tratamento e aplica-se o seu próprio aviso: encontra-o na página da clínica.",
  },
  changes: {
    body: "Atualizamos este aviso quando o nosso tratamento muda e conservamos todas as versões anteriores: pode pedir a que estava em vigor quando marcou. Esta é a versão {version}.",
  },
  cookiesLink: {
    body: "A Sorriso utiliza apenas cookies técnicos e nenhum cookie de terceiros: consulte o aviso sobre cookies em {url}.",
  },
  summary: {
    practice:
      "{practice} utiliza os seus dados para marcar e gerir as suas consultas dentárias, enviar-lhe confirmações e lembretes, e manter a sua ficha na clínica. Isto é necessário para prestar os cuidados que pede (art. 6.º, n.º 1, alínea b), e art. 9.º, n.º 2, alínea h), do RGPD). Tudo o que é opcional, como convites para dar a sua opinião ou novidades, precisa do seu consentimento separado, que pode retirar a qualquer momento.",
    platform:
      "A Sorriso ajuda-o a encontrar uma clínica dentária e a marcar consulta. Quando marca a partir das páginas de pesquisa da Sorriso, a Sorriso encaminha a sua marcação para a clínica com o seu consentimento. Quando marca através do site, do widget de marcação ou da equipa de uma clínica, a clínica é responsável pelos seus dados e a Sorriso apenas gere o software por conta dela.",
    rights:
      "Pode consultar, corrigir, transferir ou apagar os seus dados, limitar a sua utilização ou opor-se a ela, e retirar o consentimento a qualquer momento: online, no centro de privacidade, com um código único, ou escrevendo para {email}. Pode também apresentar reclamação à autoridade italiana de proteção de dados (Garante).",
    rightsNoContact:
      "Pode consultar, corrigir, transferir ou apagar os seus dados, limitar a sua utilização ou opor-se a ela, e retirar o consentimento a qualquer momento, online, no centro de privacidade, com um código único. Pode também apresentar reclamação à autoridade italiana de proteção de dados (Garante).",
  },
  minor: {
    summary: "Esta página explica, em palavras simples, o que {practice} faz com as informações sobre ti quando tens uma consulta no dentista.",
    who: "{controller} é responsável pelas tuas informações. Se tiveres perguntas, tu ou os teus pais podem escrever para {email}.",
    whoNoContact: "{controller} é responsável pelas tuas informações. Se tiveres perguntas, tu ou os teus pais podem perguntar na clínica.",
    whatIntro: "Usamos:",
    whatName: "o teu nome e a tua data de nascimento;",
    whatAppointments: "as tuas consultas: quando são e para que são;",
    whatContact: "o número de telefone ou o email para onde enviamos os lembretes: o teu, ou o dos teus pais ou do teu tutor;",
    whatMessages: "as mensagens que enviamos e as respostas que recebemos.",
    why: "Para marcar as tuas consultas, lembrar-te delas e cuidar dos teus dentes em segurança. Nunca as usamos para publicidade e nunca as vendemos.",
    parents:
      "Se tiveres menos de 14 anos, são os teus pais ou o teu tutor que marcam por ti, recebem os lembretes e decidem sobre tudo o que é opcional. A partir dos 14 anos podes marcar e decidir sozinho. Quando fizeres 18 anos, os teus pais deixam de poder ver as tuas fichas através do centro de privacidade.",
    keep: "Só durante o tempo necessário para os teus cuidados e durante o tempo que a lei obriga a clínica a guardá-las. Depois disso, são apagadas.",
    youCan:
      "Podes pedir para ver as tuas informações, corrigi-las se alguma coisa estiver errada ou apagá-las quando já não forem necessárias. Podes fazê-lo no centro de privacidade em {url}, ou pedir ajuda aos teus pais ou ao teu tutor.",
    help: "Se achares que as tuas informações não são tratadas como deve ser, tu ou os teus pais podem apresentar reclamação à autoridade italiana de proteção de dados (Garante per la protezione dei dati personali, www.garanteprivacy.it).",
    full: "Esta é uma versão simplificada. O aviso completo está em {url}.",
  },
  staff: {
    summary:
      "Este aviso destina-se às pessoas que utilizam o painel da Sorriso numa clínica dentária: proprietários, administradores, receção e profissionais. Explica que dados seus são tratados e como funciona o registo de acessos.",
    controllers:
      "A Sorriso é a responsável pelo tratamento da sua conta de utilizador (início de sessão, verificação em dois passos, sessões). A clínica para a qual trabalha é a responsável pelo tratamento do registo de acessos e de tudo o resto que faz na agenda dela; a Sorriso é a sua subcontratante.",
    dataIntro: "Tratamos:",
    dataAccount: "o seu nome, endereço de email, função e idioma preferido;",
    dataSecurity:
      "a sua palavra-passe (guardada apenas como hash), o segredo da sua verificação em dois passos (cifrado) e os códigos de recuperação (em hash);",
    dataSessions: "as suas sessões e tentativas de início de sessão, com hashes com chave do endereço IP e do navegador;",
    dataLog: "o registo de acessos: que fichas de pacientes abre ou altera, quando e com que ação;",
    dataLegal: "a sua aceitação das instruções para a equipa e de outros documentos legais.",
    monitoring:
      "O registo de acessos é uma medida de segurança exigida para os dados de saúde (art. 32.º do RGPD). Regista a data e a hora, o seu utilizador, a ficha e a ação, nunca o conteúdo que lê. A clínica pode analisá-lo para verificar que as fichas só são abertas para fins de prestação de cuidados e de administração, e para investigar utilizações indevidas. Como é informado deste registo neste aviso e nas instruções para a equipa, as informações do registo podem ser utilizadas para fins relacionados com a sua relação de trabalho, dentro dos limites do art. 4.º, n.º 3, da Lei italiana n.º 300/1970 e da legislação de proteção de dados.",
    retentionSessions: "sessões: até expirarem; tentativas de início de sessão: {period};",
    retentionLog: "o registo de acessos: conforme definido pela clínica, no mínimo {period};",
    retentionLegal: "aceitações de documentos legais: 10 anos, o prazo de prescrição para as provar;",
    retentionAccount: "a sua conta: até ser encerrada ou até deixar a clínica.",
    rights:
      "Tem os direitos de acesso, retificação, apagamento, limitação, portabilidade e oposição (art. 15.º a 21.º do RGPD). Para a sua conta, escreva à Sorriso para {email}; para o registo de acessos, à clínica para a qual trabalha.",
    rightsNoContact:
      "Tem os direitos de acesso, retificação, apagamento, limitação, portabilidade e oposição (art. 15.º a 21.º do RGPD). Para a sua conta, escreva à Sorriso; para o registo de acessos, à clínica para a qual trabalha.",
  },
  practitioner: {
    summary:
      "Este aviso destina-se aos dentistas e outros profissionais apresentados no diretório da Sorriso. Explica como a Sorriso trata os seus dados profissionais, as verificações da sua inscrição profissional e as avaliações que os pacientes escrevem sobre si.",
    controllers:
      "A Sorriso é a responsável pelo tratamento do diretório, do seu perfil público, das avaliações e da ordem dos resultados de pesquisa. A clínica com que trabalha é a responsável pelo tratamento da sua agenda e dos dados dos seus pacientes; para estes, a Sorriso é a sua subcontratante.",
    dataIntro: "Tratamos:",
    dataProfile: "o seu nome, título, especialidade, biografia, idiomas falados, a clínica e as unidades onde trabalha e a sua disponibilidade;",
    dataAlbo:
      "a sua inscrição na ordem profissional (Albo degli Odontoiatri ou dei Medici Chirurghi), a província e o número, e as especializações reconhecidas que nela constam;",
    dataReviews: "as classificações e avaliações que os pacientes escrevem sobre consultas consigo, as suas respostas e eventuais denúncias;",
    dataMetrics: "as métricas utilizadas para ordenar os resultados de pesquisa: cancelamentos pela equipa, perfil completo e visualizações do seu perfil.",
    profile:
      "O seu perfil só se torna público depois de o aprovar ou de a clínica o aprovar, e pode retirar-se do marketplace a qualquer momento. As especializações legalmente reconhecidas só são apresentadas depois de a Sorriso as ter verificado no registo público.",
    reviews:
      "Só os pacientes com uma consulta verificada o podem avaliar. Pode responder e denunciar uma avaliação; cada decisão sobre uma denúncia é fundamentada e pode ser contestada uma vez.",
    retentionProfile: "o seu perfil: até o retirar ou a clínica o retirar do diretório;",
    retentionReviews: "avaliações: até o autor as eliminar ou serem removidas;",
    retentionMetrics: "métricas de ordenação: calculadas sobre os últimos 180 dias.",
    rights:
      "Tem os direitos de acesso, retificação, apagamento, limitação, portabilidade e oposição (art. 15.º a 21.º do RGPD), incluindo o direito de se opor à ordenação. Escreva à Sorriso para {email}.",
    rightsNoContact:
      "Tem os direitos de acesso, retificação, apagamento, limitação, portabilidade e oposição (art. 15.º a 21.º do RGPD), incluindo o direito de se opor à ordenação. Escreva à Sorriso.",
  },
  cookies: {
    summary:
      "A Sorriso não utiliza cookies de publicidade nem de rastreamento, e as páginas não carregam nada de servidores de outras empresas enquanto navega. Utilizamos apenas os poucos cookies técnicos de que o site precisa para funcionar. Não precisam do seu consentimento, e é por isso que não existe um banner de cookies.",
    item: "{name}: {purpose} Duração: {duration}.",
    staffSession: {
      name: "Sessão da equipa ({names})",
      purpose: "mantém a sessão da equipa da clínica iniciada no painel. Só é definido quando a equipa inicia sessão.",
      duration: "até terminar a sessão, no máximo 24 horas, e 30 minutos sem atividade",
    },
    locale: {
      name: "Idioma ({names})",
      purpose: "memoriza o idioma que escolheu com o seletor de idioma. Só é definido quando escolhe um idioma.",
      duration: "1 ano",
    },
    privacyCenter: {
      name: "Centro de privacidade ({names})",
      purpose: "mantém a sua sessão no centro de privacidade depois de introduzir um código único.",
      duration: "30 minutos",
    },
    storageIntro: "Além destes cookies, a Sorriso guarda apenas o seguinte no armazenamento do seu navegador. Nunca sai do seu dispositivo e só é definido quando utiliza a funcionalidade:",
    storageItem: "{key}: {purpose}",
    storageItems: {
      dashboardPrivacyScreen:
        "memoriza, nesse dispositivo, se a equipa da clínica ativou o ecrã de privacidade do painel, que desfoca os nomes dos pacientes na agenda para que as pessoas na receção não os possam ler. Mantém-se até ser desativado.",
    },
    thirdPartiesIntro:
      "As páginas não carregam scripts, tipos de letra, imagens nem molduras de outras empresas. Há duas exceções, que só acontecem quando as pede:",
    map: "o mapa na página de uma clínica só aparece depois de clicar para o mostrar. O seu navegador carrega-o então a partir do OpenStreetMap (OpenStreetMap Foundation), que recebe o seu endereço IP nos termos da sua própria política de privacidade: https://osmfoundation.org/wiki/Privacy_Policy;",
    links: "ligações como as indicações de percurso abrem outros sites, por exemplo o Google Maps, num novo separador: esses sites aplicam as suas próprias políticas.",
    legalBasis:
      "Os cookies técnicos são permitidos sem consentimento pelo art. 122.º do Código italiano da Privacidade e pelas diretrizes do Garante sobre cookies e outros instrumentos de rastreamento de 10 de junho de 2021. Este aviso informa-o sobre eles.",
    control:
      "Pode eliminar os cookies nas definições do seu navegador a qualquer momento. Sem os cookies técnicos, o início de sessão e a memorização do seu idioma não funcionarão.",
    widget:
      "O widget de marcação apresentado no site de uma clínica não define cookies próprios. O site da clínica pode utilizar outros cookies: consulte o respetivo aviso sobre cookies.",
  },
} satisfies DeepPartial<Messages["legalPatient"]>;
