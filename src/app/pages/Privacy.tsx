import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router";
import { ThemeToggle } from "../../lib/theme";
import { usePublicSite } from "../site/common";

/** Aviso de privacidade (LGPD). Texto-base: recomenda-se revisão por assessoria jurídica. */
export function Privacy() {
  const { data } = usePublicSite();
  const name = data?.settings.businessName ?? "João Marcos Personal";
  const contact = data?.settings.contactEmail || "pelo WhatsApp divulgado neste site";
  useEffect(() => {
    document.title = `Política de privacidade | ${name}`;
  }, [name]);

  const H = ({ children }: { children: string }) => <h2 className="font-display mt-8 text-2xl font-extrabold uppercase">{children}</h2>;
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container-x flex h-16 items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold text-brand">
            <ArrowLeft size={18} aria-hidden /> Voltar ao site
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="container-x max-w-3xl py-12 text-foreground/90">
        <h1 className="h-display text-5xl">Política de privacidade</h1>
        <p className="mt-3 text-muted-foreground">Como {name} trata os dados pessoais, em linha com a Lei Geral de Proteção de Dados (LGPD).</p>

        <H>Quais dados coletamos e para quê</H>
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li><strong>Formulário de contato:</strong> nome, WhatsApp e mensagem opcional, para retornar seu contato sobre a consultoria online.</li>
          <li><strong>Formulário de avaliação:</strong> nome, nota e texto, para análise e eventual publicação neste site. Só publicamos com a sua autorização e após aprovação.</li>
          <li><strong>Alunos:</strong> nome, contatos, plano contratado, datas e pagamentos, para prestar o serviço, cobrar e acompanhar o seu plano.</li>
        </ul>

        <H>Base legal e compartilhamento</H>
        <p className="mt-3">Tratamos os dados com base no seu consentimento (formulários) e na execução do serviço contratado (alunos). Não vendemos nem compartilhamos seus dados com terceiros para publicidade. Os dados ficam em provedores de infraestrutura (banco de dados e hospedagem) contratados apenas para operar este site.</p>

        <H>Por quanto tempo guardamos</H>
        <p className="mt-3">Contatos que não viram clientes e avaliações rejeitadas podem ser excluídos a qualquer momento. Dados de alunos são mantidos enquanto durar o relacionamento e pelo prazo necessário para obrigações financeiras e legais.</p>

        <H>Seus direitos</H>
        <p className="mt-3">Você pode pedir confirmação do tratamento, acesso, correção, anonimização ou exclusão dos seus dados, e revogar o consentimento. Para isso, fale conosco {contact}.</p>

        <H>Segurança</H>
        <p className="mt-3">Os dados administrativos ficam atrás de login protegido, com acesso restrito ao profissional responsável. Este site não usa cookies de publicidade; usamos apenas o armazenamento do navegador para lembrar o tema (claro/escuro) e, na área restrita, para manter a sessão de acesso.</p>
      </main>
    </div>
  );
}
