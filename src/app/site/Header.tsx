import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../../lib/theme";
import { whatsappUrl } from "../../../shared/phone";
import type { PublicSite } from "../../../shared/types";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "../components/ui/sheet";

export function Brand({ site, light }: { site: PublicSite; light?: boolean }) {
  const name = site.settings.trainerName || "João Marcos";
  const [first, ...rest] = name.split(" ");
  return (
    <a href="#inicio" className="flex items-center gap-2.5" aria-label={`${site.settings.businessName} — início`}>
      {site.settings.logoUrl ? (
        <img src={site.settings.logoUrl} alt="" className="size-9 rounded-lg object-cover" />
      ) : (
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground" aria-hidden>
          <svg viewBox="0 0 64 64" className="size-6" fill="currentColor">
            <path d="M14 44V20h6v24zM44 44V20h6v24zM20 30h24v4H20zM9 26h5v12H9zM50 26h5v12h-5z" />
          </svg>
        </span>
      )}
      <span className={`h-display text-2xl leading-none tracking-wide ${light ? "text-ink-foreground" : ""}`}>
        {first} <span className="text-brand">{rest.join(" ")}</span>
      </span>
    </a>
  );
}

export interface NavItem {
  href: string;
  label: string;
}

export function Header({ site, nav }: { site: PublicSite; nav: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const wa = whatsappUrl(site.settings.whatsappNumber, site.settings.whatsappGeneralMessage);

  return (
    <header className={`sticky top-0 z-40 border-b bg-background/90 backdrop-blur transition-shadow ${scrolled ? "border-border shadow-sm" : "border-transparent"}`}>
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <Brand site={site} />
        <nav aria-label="Principal" className="hidden items-center gap-7 text-sm font-semibold lg:flex">
          {nav.map((n) => (
            <a key={n.href} href={n.href} className="py-2 text-foreground/80 transition-colors hover:text-brand">
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <a href="#planos" className="btn btn-primary btn-sm hidden sm:inline-flex">
            Contratar
          </a>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full border border-border lg:hidden"
            aria-label="Abrir menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu size={20} aria-hidden />
          </button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[88vw] max-w-sm border-l bg-background p-0 [&>button]:hidden">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SheetDescription className="sr-only">Navegação do site</SheetDescription>
          <div className="flex h-16 items-center justify-between border-b px-4">
            <Brand site={site} />
            <button type="button" className="inline-flex size-11 items-center justify-center rounded-full border border-border" aria-label="Fechar menu" onClick={() => setOpen(false)}>
              <X size={20} aria-hidden />
            </button>
          </div>
          <nav aria-label="Menu móvel" className="flex flex-col px-4 py-3">
            {nav.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setOpen(false)} className="border-b border-border/70 py-4 text-lg font-semibold">
                {n.label}
              </a>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-3 px-4 pb-8">
            <a href="#planos" onClick={() => setOpen(false)} className="btn btn-primary w-full">
              Ver planos e contratar
            </a>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline w-full">
              Falar no WhatsApp
            </a>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
