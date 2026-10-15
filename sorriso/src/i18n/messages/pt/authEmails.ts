import type { DeepPartial, Messages } from "../../types";

export default {
  greeting: "Olá {name},",
  footer: {
    why: "Recebe este email devido a atividade na sua conta Sorriso.",
    notYou: "Se não foi você, altere a sua palavra-passe e avise o proprietário da sua clínica.",
  },
  verifyEmail: {
    subject: "Confirme o seu endereço de email",
    body: "Confirme que este é o seu endereço de email para concluir a configuração de {practice} na Sorriso. A ligação é válida durante 24 horas.",
    cta: "Confirmar o meu email",
  },
  verifyEmailAgain: {
    subject: "Confirme o seu endereço de email",
    body: "Confirme que este é o endereço de email da sua conta Sorriso. A ligação é válida durante 24 horas.",
    cta: "Confirmar o meu email",
  },
  verifyPracticeEmail: {
    subject: "Confirme o endereço de email de {practice}",
    body: "{owner} indicou este endereço como email de {practice} na Sorriso. As respostas dos pacientes e os pedidos de privacidade serão enviados para aqui, e a marcação online fica suspensa até o endereço ser confirmado. A ligação é válida durante 24 horas. Se não conhece esta clínica, ignore este email: nada será alterado.",
    cta: "Confirmar este endereço",
  },
  signupExisting: {
    subject: "Alguém tentou criar uma conta com o seu email",
    body: "Alguém, possivelmente você, tentou criar uma nova clínica na Sorriso com este endereço de email, que já tem uma conta. Se foi você, inicie sessão ou reponha a palavra-passe se a esqueceu. Se não foi você, pode ignorar este email: nada foi alterado.",
    cta: "Iniciar sessão",
  },
  passwordReset: {
    subject: "Reponha a sua palavra-passe Sorriso",
    body: "Recebemos um pedido para repor a palavra-passe desta conta. A ligação é válida durante 30 minutos e funciona uma única vez. Se não fez este pedido, ignore este email: a sua palavra-passe mantém-se.",
    cta: "Escolher uma nova palavra-passe",
  },
  passwordChanged: {
    subject: "A sua palavra-passe Sorriso foi alterada",
    body: "A palavra-passe da sua conta foi alterada em {when} e a sessão foi terminada em todos os dispositivos. Se não foi você, reponha de imediato a sua palavra-passe.",
    cta: "Repor a minha palavra-passe",
  },
  invite: {
    subject: "{inviter} convidou-o para {practice} na Sorriso",
    body: "{inviter} convidou-o para se juntar a {practice} na Sorriso como {role}. O convite é válido durante 7 dias.",
    cta: "Aceitar o convite",
  },
  failedLogins: {
    subject: "Tentativas de início de sessão falhadas na sua conta",
    body: "Houve {count} tentativas falhadas de iniciar sessão na sua conta Sorriso nos últimos 15 minutos, pelo que novas tentativas ficam bloqueadas durante algum tempo. Se não foi você, considere alterar a sua palavra-passe e ativar a verificação em dois passos.",
    cta: "Rever a minha segurança",
  },
  newDevice: {
    subject: "Novo início de sessão na sua conta Sorriso",
    body: "Foi iniciada uma sessão na sua conta a partir de um novo dispositivo ({device}) em {when}. Se foi você, não precisa de fazer nada. Caso contrário, termine essa sessão e altere de imediato a sua palavra-passe.",
    cta: "Rever os meus dispositivos",
  },
  apiKeyCreated: {
    subject: "Foi criada uma nova chave de API para {practice}",
    body: "{creator} criou a chave de API \"{name}\" para {practice} em {when}, com este acesso: {scopes}. Expira em {expires}. As chaves de API permitem que software leia e altere dados de pacientes: se não reconhece esta chave, revogue-a já.",
    cta: "Rever chaves de API",
  },
  mfaReset: {
    subject: "A sua verificação em dois passos foi reposta",
    body: "{actor} repôs a verificação em dois passos da sua conta em {practice} em {when}. A sessão foi terminada em todo o lado e irá configurar uma nova aplicação de autenticação no próximo início de sessão.",
    cta: "Iniciar sessão",
  },
} satisfies DeepPartial<Messages["authEmails"]>;
