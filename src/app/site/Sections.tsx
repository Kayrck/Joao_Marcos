import { Icon } from "../../lib/icons";
import type { PublicSite } from "../../../shared/types";
import { Accent, SectionHeading, getSection } from "./common";

const Paragraphs = ({ text, className = "" }: { text: string; className?: string }) => (
  <>
    {text
      .split(/\n{2,}|\n/)
      .filter(Boolean)
      .map((p, i) => (
        <p key={i} className={className}>
          {p}
        </p>
      ))}
  </>
);

/** SOBRE — só renderiza os campos preenchidos (nada de textos de preenchimento). */
export function About({ site }: { site: PublicSite }) {
  const s = getSection(site, "about");
  if (!s) return null;
  const c = s.content;
  const blocks: { title: string; text: string }[] = [
    { title: "Experiência", text: c.experience },
    { title: "Metodologia", text: c.methodology },
    { title: "Como acompanho você", text: c.followUp },
  ].filter((b) => b.text.trim());

  return (
    <section id="sobre" className="bg-background py-16 sm:py-24">
      <div className="container-x grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
        {s.image && (
          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div aria-hidden className="absolute -bottom-4 -left-4 size-3/4 rounded-[2rem] bg-brand-soft" />
            <img
              src={s.image.url}
              alt={s.image.alt}
              width={s.image.width ?? 1018}
              height={s.image.height ?? 1280}
              loading="lazy"
              decoding="async"
              className="relative aspect-[4/5] w-full rounded-[2rem] border border-border object-cover"
            />
          </div>
        )}
        <div>
          <SectionHeading eyebrow={c.eyebrow} title={c.title} />
          {c.role && <p className="mt-2 text-lg font-semibold text-brand">{c.role}</p>}
          <div className="mt-5 space-y-4 text-lg leading-relaxed text-muted-foreground">
            <Paragraphs text={c.bio} />
          </div>
          {blocks.length > 0 && (
            <dl className="mt-8 grid gap-4 sm:grid-cols-2">
              {blocks.map((b) => (
                <div key={b.title} className="card-surface p-5 sm:[&:last-child:nth-child(odd)]:col-span-2">
                  <dt className="font-display text-xl font-bold uppercase tracking-wide">{b.title}</dt>
                  <dd className="mt-2 text-muted-foreground">{b.text}</dd>
                </div>
              ))}
            </dl>
          )}
          {c.highlights.length > 0 && (
            <ul className="mt-6 flex flex-wrap gap-2">
              {c.highlights.map((h) => (
                <li key={h} className="rounded-full bg-brand-soft px-4 py-1.5 text-sm font-semibold text-brand-soft-foreground">
                  {h}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** COMO FUNCIONA — etapas numeradas. */
export function HowItWorks({ site }: { site: PublicSite }) {
  const s = getSection(site, "how_it_works");
  if (!s) return null;
  const c = s.content;
  return (
    <section id="como-funciona" className="bg-surface py-16 sm:py-24">
      <div className="container-x">
        <SectionHeading eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {c.steps.map((step, i) => (
            <li key={i} className="card-surface relative overflow-hidden p-6">
              <span aria-hidden className="font-display absolute right-4 top-1 text-7xl font-extrabold text-brand-soft">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="relative grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <Icon name={step.icon} size={24} />
              </span>
              <h3 className="relative mt-5 font-display text-2xl font-bold uppercase leading-tight">{step.title}</h3>
              <p className="relative mt-2 text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** DIFERENCIAIS — painel escuro com faixa de benefícios (inspirado na referência 1). */
export function Benefits({ site }: { site: PublicSite }) {
  const s = getSection(site, "benefits");
  if (!s) return null;
  const c = s.content;
  return (
    <section id="diferenciais" className="bg-background py-16 sm:py-20">
      <div className="container-x">
        <div className="overflow-hidden rounded-[2rem] bg-ink px-5 py-10 text-ink-foreground sm:px-10 sm:py-14">
          <SectionHeading eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} light />
          <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0">
            {c.items.map((item, i) => (
              <li key={i} className="flex gap-4 lg:flex-col lg:border-l lg:border-white/10 lg:px-6 lg:first:border-l-0 lg:first:pl-0">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl border border-white/15 text-[#ff8a8e]">
                  <Icon name={item.icon} size={24} />
                </span>
                <div>
                  <h3 className="font-display text-2xl font-bold uppercase leading-tight">
                    <Accent text={item.title} />
                  </h3>
                  <p className="mt-1.5 text-ink-muted">{item.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
