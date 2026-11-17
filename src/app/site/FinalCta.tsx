import { Facebook, Instagram, Mail, MessageCircle, Phone, Youtube } from "lucide-react";
import { Link } from "react-router";
import { formatPhone, whatsappUrl } from "../../../shared/phone";
import type { PublicSite } from "../../../shared/types";
import { Brand, type NavItem } from "./Header";
import { Accent, getSection } from "./common";
import { LeadForm } from "./forms";

/** CHAMADA FINAL — painel escuro com fotografia, botão de WhatsApp e formulário de contato. */
export function FinalCta({ site }: { site: PublicSite }) {
  const s = getSection(site, "final_cta");
  if (!s) return null;
  const c = s.content;
  const wa = whatsappUrl(site.settings.whatsappNumber, site.settings.whatsappGeneralMessage);
  return (
    <section id="contato" className="bg-background py-12 sm:py-20">
      <div className="container-x">
        <div className="grid overflow-hidden rounded-[2rem] bg-ink text-ink-foreground lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative p-6 sm:p-12">
            {s.image && (
              <img src={s.image.url} alt="" aria-hidden loading="lazy" className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/2 object-cover opacity-25 [mask-image:linear-gradient(to_left,black,transparent)] lg:block" />
            )}
            <div className="relative">
              <h2 className="h-display text-5xl sm:text-6xl lg:text-7xl">
                <Accent text={c.title} />
              </h2>
              <p className="mt-4 max-w-lg text-lg text-ink-muted">{c.text}</p>
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-primary mt-7 w-full sm:w-auto">
                <MessageCircle size={19} aria-hidden />
                {c.buttonLabel}
              </a>
              {site.settings.whatsappNumber && <p className="mt-4 text-sm text-ink-muted">WhatsApp: {formatPhone(site.settings.whatsappNumber)}</p>}
            </div>
          </div>
          <div className="bg-ink p-4 sm:p-8 lg:p-10">
            <LeadForm />
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer({ site, nav }: { site: PublicSite; nav: NavItem[] }) {
  const st = site.settings;
  const socials = [
    { href: st.instagramUrl, label: "Instagram", Icon: Instagram },
    { href: st.facebookUrl, label: "Facebook", Icon: Facebook },
    { href: st.youtubeUrl, label: "YouTube", Icon: Youtube },
  ].filter((x) => x.href);
  return (
    <footer className="bg-ink pb-24 pt-14 text-ink-foreground sm:pb-10">
      <div className="container-x">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Brand site={site} light />
            {st.footerText && <p className="mt-4 max-w-sm text-ink-muted">{st.footerText}</p>}
            {(socials.length > 0 || st.tiktokUrl) && (
              <ul className="mt-5 flex gap-2.5">
                {socials.map(({ href, label, Icon }) => (
                  <li key={label}>
                    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="grid size-11 place-items-center rounded-full border border-white/20 transition-colors hover:bg-primary hover:border-primary">
                      <Icon size={20} aria-hidden />
                    </a>
                  </li>
                ))}
                {st.tiktokUrl && (
                  <li>
                    <a href={st.tiktokUrl} target="_blank" rel="noopener noreferrer" className="grid h-11 place-items-center rounded-full border border-white/20 px-4 text-sm font-bold transition-colors hover:border-primary hover:bg-primary">
                      TikTok
                    </a>
                  </li>
                )}
              </ul>
            )}
          </div>
          <nav aria-label="Rodapé">
            <p className="font-display text-xl font-bold uppercase tracking-wide">Navegação</p>
            <ul className="mt-3 space-y-1">
              {nav.map((n) => (
                <li key={n.href}>
                  <a href={n.href} className="inline-block py-1.5 text-ink-muted transition-colors hover:text-white">
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div>
            <p className="font-display text-xl font-bold uppercase tracking-wide">Contato</p>
            <ul className="mt-3 space-y-2 text-ink-muted">
              {st.whatsappNumber && (
                <li>
                  <a href={whatsappUrl(st.whatsappNumber, st.whatsappGeneralMessage)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 py-1 hover:text-white">
                    <Phone size={17} aria-hidden /> WhatsApp {formatPhone(st.whatsappNumber)}
                  </a>
                </li>
              )}
              {st.contactEmail && (
                <li>
                  <a href={`mailto:${st.contactEmail}`} className="inline-flex items-center gap-2 py-1 hover:text-white">
                    <Mail size={17} aria-hidden /> {st.contactEmail}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {st.businessName}. Todos os direitos reservados.
          </p>
          <p className="flex gap-4">
            <Link to="/privacidade" className="hover:text-white">
              Política de privacidade
            </Link>
            <Link to="/admin" className="hover:text-white">
              Área restrita
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
