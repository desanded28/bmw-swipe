import type { DeepPartial, Messages } from "../../types";

export default {
  meta: {
    title: "Declaração de acessibilidade",
    description: "O nível de acessibilidade do site e do serviço de marcações {app}, as suas limitações conhecidas e como comunicar uma barreira.",
  },
  title: "Declaração de acessibilidade",
  translationNotice: "Esta é uma tradução. Em caso de divergência, prevalece a <link>versão italiana</link>.",
  intro:
    "A {provider} pretende que o seu site e o seu serviço de marcações possam ser utilizados por todos, incluindo pessoas que usam um leitor de ecrã, apenas o teclado, ampliação do ecrã ou controlo por voz.",
  legalBasis:
    "Esta declaração é publicada ao abrigo do Ato Europeu da Acessibilidade (Diretiva (UE) 2019/882), transposto em Itália pelo Decreto Legislativo 82/2022, e da Lei 4/2004.",
  scope: {
    title: "O que esta declaração abrange",
    body: "O site público {host}: pesquisa, páginas de clínicas e de profissionais, formulários de marcação e de lista de espera, a página da consulta a que se acede a partir das confirmações e dos lembretes, o centro de privacidade, as páginas legais e o widget de marcação que as clínicas incorporam nos seus próprios sites.",
  },
  status: {
    title: "Estado de conformidade",
    body: "Concebemos e testamos o serviço segundo as Diretrizes de Acessibilidade para Conteúdo Web (WCAG) 2.2, nível AA. A norma europeia harmonizada a que a lei se refere, EN 301 549 v3.2.1, incorpora as WCAG 2.1 de nível AA. O serviço está parcialmente conforme com as WCAG 2.1 de nível AA: as partes indicadas em limitações conhecidas ainda não estão totalmente conformes.",
  },
  features: {
    title: "O que fazemos",
    keyboard:
      "O site foi concebido para ser utilizado apenas com o teclado, com um indicador de foco visível e uma ligação para saltar para o conteúdo principal.",
    screenReader:
      "As páginas estão estruturadas com títulos e regiões. Os campos dos formulários têm etiquetas, e os erros e as mensagens de estado são anunciados pelos leitores de ecrã.",
    steps: "O formulário de marcação desloca o foco para cada novo passo, mantém o que escreveu quando volta atrás e explica cada erro junto do respetivo campo.",
    contrast: "O texto e os controlos dos formulários cumprem as relações de contraste do nível AA das WCAG, e nenhuma informação é transmitida apenas pela cor.",
    motion: "As animações são desativadas quando o seu dispositivo pede movimento reduzido.",
    zoom: "As páginas foram concebidas para funcionar com zoom a 200% e em ecrãs pequenos sem deslocamento horizontal.",
    languages:
      "O site está disponível em oito idiomas, e cada página declara o seu idioma para que os leitores de ecrã o pronunciem corretamente.",
    help: "Os contactos da clínica são apresentados no mesmo lugar no formulário de marcação e na página da sua consulta.",
  },
  limitations: {
    title: "Limitações conhecidas",
    practiceContent:
      "Os textos escritos pelas clínicas (descrições de tratamentos, biografias dos profissionais) são apresentados no idioma em que a clínica os escreveu, que pode ser diferente do idioma da página.",
    dates:
      "Os campos de data usam o seletor de datas do próprio navegador, cuja acessibilidade varia entre navegadores e leitores de ecrã. Pode sempre escrever a data.",
    maps: "Os mapas nas páginas das clínicas são apenas uma ajuda visual: a morada é sempre indicada em texto.",
    widget:
      "Quando o widget de marcação está incorporado no site de uma clínica, a acessibilidade da página envolvente é da responsabilidade da clínica.",
    messages: "Os lembretes por SMS são texto simples e não podem ter formatação; as suas ligações abrem páginas abrangidas por esta declaração.",
    exports: "As transferências de dados do centro de privacidade (JSON, CSV) são ficheiros legíveis por máquina, não documentos destinados a leitura.",
    workaround: "Se alguma destas limitações o impedir de marcar, ligue para a clínica: o número de telefone está na página da clínica e no formulário de marcação.",
  },
  preparation: {
    title: "Como foi preparada esta declaração",
    body: "Esta declaração foi preparada em {date} por autoavaliação, com base em verificações automáticas do código do site executadas a cada alteração (etiquetas, mensagens de erro, gestão do foco, relações de contraste). Ainda não foi concluída uma revisão manual apenas com o teclado e com leitores de ecrã (NVDA com Firefox no Windows, VoiceOver com Safari no iOS); atualizaremos esta declaração quando estiver concluída. A última revisão foi feita em {reviewed}.",
  },
  feedback: {
    title: "Comentários e contactos",
    body: "Se encontrar uma barreira ou precisar de informação deste site noutro formato, escreva para <mail>{email}</mail>. Indique o endereço da página e o que aconteceu. Responderemos no prazo de 30 dias.",
    noEmail:
      "Se encontrar uma barreira ou precisar de informação deste site noutro formato, contacte-nos através dos dados indicados no <link>aviso de privacidade</link>. Indique o endereço da página e o que aconteceu. Responderemos no prazo de 30 dias.",
  },
  enforcement: {
    title: "Procedimento de aplicação",
    body: "Se não ficar satisfeito com a nossa resposta, ou se não a receber no prazo de 30 dias, pode comunicar a situação à AgID (Agenzia per l'Italia Digitale), a autoridade que fiscaliza a acessibilidade digital em Itália, através do formulário em <link>form.agid.gov.it</link>.",
  },
} satisfies DeepPartial<Messages["accessibility"]>;
