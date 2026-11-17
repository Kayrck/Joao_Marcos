import { ArrowRight, CheckCircle2, MessageCircle, Tag } from "lucide-react";
import { formatBRL, formatDateBR } from "../../../shared/format";
import { whatsappUrl } from "../../../shared/phone";
import type { PublicSite } from "../../../shared/types";
import { Accent, getSection } from "./common";

export function Hero({ site }: { site: PublicSite }) {
  const hero = getSection(site, "hero");
  if (!hero) return null;
  const c = hero.content;
  const wa = whatsappUrl(site.settings.whatsappNumber, site.settings.whatsappGeneralMessage);
  const priced = site.plans.filter((p) => p.price.cents !== null);
  const cheapest = priced.length ? priced.reduce((a, b) => (a.price.cents! <= b.price.cents! ? a : b)) : null;

  return (
    <section id="inicio" className="relative overflow-hidden bg-surface">
      {/* forma decorativa (referência: círculo de destaque atrás da foto) */}
      <div aria-hidden className="pointer-events-none absolute -right-24 top-24 size-[22rem] rounded-full bg-brand-soft lg:-right-10 lg:top-10 lg:size-[40rem]" />
      <div className="container-x relative grid gap-10 pb-14 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:pb-24 lg:pt-16">
        <div className="reveal">
          {c.eyebrow && <p className="eyebrow">{c.eyebrow}</p>}
          <h1 className="h-display mt-4 text-[3.05rem] min-[400px]:text-[3.5rem] sm:text-7xl lg:text-[6.5rem]">
            {c.titleLine}
            {c.titleAccent && (
              <>
                <br />
                <span className="text-brand">
                  <Accent text={c.titleAccent} />
                </span>
              </>
            )}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">{c.subtitle}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href="#planos" className="btn btn-ink sm:min-w-52">
              {c.primaryCtaLabel}
              <ArrowRight size={18} aria-hidden />
            </a>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-outline sm:min-w-52">
              <MessageCircle size={18} aria-hidden />
              {c.secondaryCtaLabel}
            </a>
          </div>

          {c.highlights.length > 0 && (
            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-foreground/80">
              {c.highlights.map((h) => (
                <li key={h} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 size={17} className="text-primary" aria-hidden />
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="reveal relative mx-auto w-full max-w-md lg:max-w-none" style={{ animationDelay: "0.1s" }}>
          {hero.image && (
            <div className="relative overflow-hidden rounded-[2rem] border border-border shadow-[var(--shadow-pop)]">
              <img
                src={hero.image.url}
                alt={hero.image.alt}
                width={hero.image.width ?? 1018}
                height={hero.image.height ?? 1280}
                className="aspect-[4/5] w-full object-cover"
                {...({ fetchpriority: "high" } as object)}
                decoding="async"
              />
            </div>
          )}
          {site.activePromotion ? (
            <div className="absolute -bottom-5 left-4 right-4 rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-pop)] sm:left-auto sm:right-[-0.75rem] sm:w-72">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                <Tag size={14} aria-hidden /> Promoção vigente
              </p>
              <p className="mt-1 text-sm text-foreground">
                {cheapest ? <>Planos a partir de <strong>{formatBRL(cheapest.price.cents!)}</strong>. </> : null}
                Válida até <strong>{formatDateBR(site.activePromotion.validUntilDate)}</strong>.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
