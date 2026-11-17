import { Quote } from "lucide-react";
import { useState } from "react";
import { formatDateBR } from "../../../shared/format";
import type { PublicSite } from "../../../shared/types";
import { SectionHeading, Stars, getSection } from "./common";
import { ReviewForm } from "./forms";

/** AVALIAÇÕES — só aprovadas aparecem; o formulário envia para moderação. */
export function Reviews({ site }: { site: PublicSite }) {
  const s = getSection(site, "reviews");
  const [all, setAll] = useState(false);
  if (!s) return null;
  const c = s.content;
  const { items, count, average } = site.reviews;
  const shown = all ? items : items.slice(0, 3);

  return (
    <section id="avaliacoes" className="bg-background py-16 sm:py-24">
      <div className="container-x">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <SectionHeading eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />
          {count > 0 && average !== null && (
            <div className="card-surface flex items-center gap-4 px-5 py-4">
              <p className="font-display text-5xl font-extrabold leading-none">{String(average).replace(".", ",")}</p>
              <div>
                <Stars value={average} />
                <p className="mt-1 text-sm text-muted-foreground">
                  {count} {count === 1 ? "avaliação" : "avaliações"}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={`mt-10 grid gap-8 ${items.length > 0 ? "lg:grid-cols-[1.4fr_1fr]" : "mx-auto max-w-xl"}`}>
          {items.length > 0 && (
            <div>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {shown.map((r) => (
                  <li key={r.id} className="card-surface flex flex-col p-5">
                    <Quote size={26} className="text-primary/70" aria-hidden />
                    <p className="mt-3 flex-1 text-[0.97rem] leading-relaxed">{r.body}</p>
                    <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                      {r.photoUrl ? (
                        <img src={r.photoUrl} alt="" loading="lazy" className="size-11 rounded-full object-cover" />
                      ) : (
                        <span className="grid size-11 place-items-center rounded-full bg-brand-soft font-bold text-brand-soft-foreground" aria-hidden>
                          {r.authorName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-bold">{r.authorName}</p>
                        <p className="text-xs text-muted-foreground">{formatDateBR(r.displayDate)}</p>
                      </div>
                      <div className="ml-auto">
                        <Stars value={r.rating} size={15} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {items.length > 3 && !all && (
                <div className="mt-6 text-center">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setAll(true)}>
                    Ver mais avaliações
                  </button>
                </div>
              )}
            </div>
          )}
          <ReviewForm title={c.formTitle || "Deixe sua avaliação"} intro={c.formIntro} />
        </div>
      </div>
    </section>
  );
}
