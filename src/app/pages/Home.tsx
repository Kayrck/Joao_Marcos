import { MessageCircle } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { whatsappUrl } from "../../../shared/phone";
import type { PublicSite } from "../../../shared/types";
import { FinalCta, Footer } from "../site/FinalCta";
import { Gallery } from "../site/Gallery";
import { Header, type NavItem } from "../site/Header";
import { Hero } from "../site/Hero";
import { Plans } from "../site/Plans";
import { Reviews } from "../site/Reviews";
import { About, Benefits, HowItWorks } from "../site/Sections";
import { usePublicSite } from "../site/common";

/** Atualiza título, descrição, Open Graph e dados estruturados com o que o administrador configurou. */
function useSeo(site: PublicSite | undefined) {
  useEffect(() => {
    if (!site) return;
    const s = site.settings;
    document.title = s.seoTitle || s.businessName;
    const set = (sel: string, attr: string, val: string) => {
      const el = document.head.querySelector<HTMLMetaElement>(sel);
      if (el) el.setAttribute(attr, val);
    };
    set('meta[name="description"]', "content", s.seoDescription);
    set('meta[property="og:title"]', "content", s.seoTitle || s.businessName);
    set('meta[property="og:description"]', "content", s.seoDescription);
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ProfessionalService",
      name: s.businessName,
      description: s.seoDescription,
      url: window.location.origin,
      image: `${window.location.origin}/images/joao-marcos.jpeg`,
      sameAs: [s.instagramUrl, s.facebookUrl, s.youtubeUrl, s.tiktokUrl].filter(Boolean),
      ...(site.reviews.count > 0 && site.reviews.average
        ? { aggregateRating: { "@type": "AggregateRating", ratingValue: site.reviews.average, reviewCount: site.reviews.count } }
        : {}),
    });
    document.head.appendChild(ld);
    return () => ld.remove();
  }, [site]);
}

const SECTION_VIEWS: Record<string, (p: { site: PublicSite }) => ReactNode> = {
  about: (p) => <About {...p} />,
  how_it_works: (p) => <HowItWorks {...p} />,
  benefits: (p) => <Benefits {...p} />,
  gallery: (p) => <Gallery {...p} />,
  plans: (p) => <Plans {...p} />,
  reviews: (p) => <Reviews {...p} />,
  final_cta: (p) => <FinalCta {...p} />,
};

const NAV_BY_SECTION: Record<string, NavItem> = {
  about: { href: "#sobre", label: "Sobre" },
  how_it_works: { href: "#como-funciona", label: "Consultoria Online" },
  gallery: { href: "#galeria", label: "Resultados" },
  reviews: { href: "#avaliacoes", label: "Avaliações" },
  plans: { href: "#planos", label: "Planos" },
  final_cta: { href: "#contato", label: "Contato" },
};

export function Home() {
  const { data: site, isLoading, isError, refetch } = usePublicSite();
  useSeo(site);

  // links com #ancora (ex.: /#planos) só funcionam depois que o conteúdo é carregado da API
  useEffect(() => {
    if (!site || !window.location.hash) return;
    const el = document.querySelector(window.location.hash);
    if (el) requestAnimationFrame(() => el.scrollIntoView());
  }, [site]);

  if (isLoading)
    return (
      <div aria-busy="true" role="status" aria-label="Carregando">
        <div className="h-16 border-b border-border" />
        <div className="container-x grid gap-8 py-12 lg:grid-cols-2">
          <div className="space-y-5">
            <div className="skeleton h-5 w-40" />
            <div className="skeleton h-40 w-full" />
            <div className="skeleton h-24 w-5/6" />
          </div>
          <div className="skeleton aspect-[4/5] w-full" />
        </div>
      </div>
    );

  if (isError || !site)
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="font-display text-4xl font-extrabold uppercase">Não foi possível carregar o site</h1>
          <p className="mt-2 text-muted-foreground">Verifique sua conexão e tente novamente.</p>
          <button type="button" className="btn btn-primary mt-6" onClick={() => refetch()}>
            Tentar novamente
          </button>
        </div>
      </main>
    );

  const order = site.sections.map((s) => s.key).filter((k) => k !== "hero");
  const nav: NavItem[] = [{ href: "#inicio", label: "Início" }, ...order.map((k) => NAV_BY_SECTION[k]).filter(Boolean)];
  // "Contato" fica sempre por último na navegação
  nav.sort((a, b) => (a.label === "Contato" ? 1 : b.label === "Contato" ? -1 : 0));
  const wa = whatsappUrl(site.settings.whatsappNumber, site.settings.whatsappGeneralMessage);

  return (
    <div className="min-h-screen">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Pular para o conteúdo
      </a>
      <Header site={site} nav={nav} />
      <main id="conteudo">
        <Hero site={site} />
        {order.map((k) => (
          <div key={k}>{SECTION_VIEWS[k]?.({ site })}</div>
        ))}
      </main>
      <Footer site={site} nav={nav} />
      <a
        href={wa}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Falar no WhatsApp"
        className="fixed bottom-5 right-4 z-30 grid size-14 place-items-center rounded-full bg-[#1fa855] text-white shadow-[var(--shadow-pop)] transition-transform active:scale-95 sm:hidden"
      >
        <MessageCircle size={26} className="fill-current" aria-hidden />
      </a>
    </div>
  );
}
