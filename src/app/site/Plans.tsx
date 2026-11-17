import { CheckCircle2, MessageCircle, Tag } from "lucide-react";
import { formatBRL, formatDateBR, planMessage } from "../../../shared/format";
import { whatsappUrl } from "../../../shared/phone";
import type { PublicPlan, PublicSite } from "../../../shared/types";
import { SectionHeading, getSection } from "./common";

function Price({ plan }: { plan: PublicPlan }) {
  const { price } = plan;
  if (price.cents === null) {
    return (
      <div className="mt-5">
        <p className="font-display text-4xl font-extrabold uppercase">Consulte valores</p>
        <p className="mt-1 text-sm text-muted-foreground">Fale com o João para saber o valor atual.</p>
      </div>
    );
  }
  const months = plan.durationMonths;
  return (
    <div className="mt-5">
      <p className="flex items-baseline gap-1.5">
        <span className="text-lg font-bold text-muted-foreground">R$</span>
        <span className="font-display text-6xl font-extrabold leading-none tracking-tight">{formatBRL(price.cents).replace(/[^\d,.]/g, "").replace(/,00$/, "")}</span>
        <span className="text-sm font-medium text-muted-foreground">{months === 1 ? "por mês" : `por ${months} meses`}</span>
      </p>
      {months > 1 && plan.perMonthCents !== null && <p className="mt-1 text-sm text-muted-foreground">equivale a {formatBRL(plan.perMonthCents)} por mês</p>}
      {price.kind === "promo" && price.validUntilDate && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-soft-foreground">
          <Tag size={13} aria-hidden />
          Valor promocional até {formatDateBR(price.validUntilDate)}
        </p>
      )}
    </div>
  );
}

export function Plans({ site }: { site: PublicSite }) {
  const s = getSection(site, "plans");
  if (!s) return null;
  const c = s.content;
  return (
    <section id="planos" className="bg-surface py-16 sm:py-24">
      <div className="container-x">
        <SectionHeading eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} center />

        {site.activePromotion && (
          <p className="mx-auto mt-6 flex w-fit max-w-full items-center gap-2 rounded-full border border-brand-line bg-brand-soft px-4 py-2 text-center text-sm font-semibold text-brand-soft-foreground">
            <Tag size={16} className="shrink-0" aria-hidden />
            Valores promocionais válidos até {formatDateBR(site.activePromotion.validUntilDate)}
          </p>
        )}

        {site.plans.length === 0 ? (
          <p className="mt-10 text-center text-muted-foreground">Os planos serão divulgados em breve. Fale com o João no WhatsApp.</p>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {site.plans.map((plan) => {
              const href = whatsappUrl(site.settings.whatsappNumber, planMessage(site.settings.whatsappPlanMessage, plan.name));
              return (
                <article
                  key={plan.id}
                  className={`relative flex flex-col rounded-[1.75rem] border bg-card p-6 sm:p-7 ${plan.isFeatured ? "border-primary shadow-[var(--shadow-pop)] md:-translate-y-3" : "border-border shadow-[var(--shadow-card)]"}`}
                >
                  {plan.badge && (
                    <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground">{plan.badge}</span>
                  )}
                  <h3 className="font-display text-3xl font-extrabold uppercase">{plan.name}</h3>
                  <p className="text-sm font-semibold text-brand">Consultoria online · {plan.durationMonths} {plan.durationMonths === 1 ? "mês" : "meses"}</p>
                  {plan.description && <p className="mt-2 text-muted-foreground">{plan.description}</p>}
                  <Price plan={plan} />
                  {plan.features.length > 0 && (
                    <ul className="mt-6 flex-1 space-y-2.5 border-t border-border pt-5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-[0.95rem]">
                          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  {plan.conditions && <p className="mt-4 text-xs text-muted-foreground">{plan.conditions}</p>}
                  <a href={href} target="_blank" rel="noopener noreferrer" className={`btn mt-6 w-full ${plan.isFeatured ? "btn-primary" : "btn-ink"}`}>
                    <MessageCircle size={18} aria-hidden />
                    Contratar plano {plan.name.toLowerCase()}
                  </a>
                </article>
              );
            })}
          </div>
        )}
        {c.footnote && <p className="mt-10 text-center text-sm text-muted-foreground">{c.footnote}</p>}
      </div>
    </section>
  );
}
