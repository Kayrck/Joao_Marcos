import { Star } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { PublicSection, PublicSite } from "../../../shared/types";
import type { SectionKey } from "../../../shared/constants";
import type { SectionContentMap } from "../../../shared/site-content";

export const publicSiteKey = ["public-site"] as const;

export function usePublicSite() {
  return useQuery({ queryKey: publicSiteKey, queryFn: () => api.get<PublicSite>("/api/public/site"), staleTime: 30_000 });
}

export function getSection<K extends SectionKey>(site: PublicSite, key: K) {
  return site.sections.find((s) => s.key === key) as Extract<PublicSection, { key: K }> | undefined;
}

export type SectionOf<K extends SectionKey> = { content: SectionContentMap[K]; image: PublicSection["image"] };

/** Texto com destaque editorial: o trecho entre *asteriscos* vira serifa itálica vermelha. */
export function Accent({ text }: { text: string }): ReactNode {
  const parts = text.split(/\*([^*]+)\*/g);
  return parts.map((p, i) =>
    i % 2 === 1 ? (
      <em key={i} className="font-serif-accent normal-case text-brand">
        {p}
      </em>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    ),
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  center,
  light,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  center?: boolean;
  light?: boolean;
}) {
  return (
    <header className={`max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      {eyebrow && <p className={`eyebrow ${center ? "justify-center" : ""} ${light ? "!text-[#ff8a8e]" : ""}`}>{eyebrow}</p>}
      <h2 className={`h-display mt-3 text-[2.5rem] sm:text-5xl lg:text-6xl ${light ? "text-ink-foreground" : ""}`}>
        <Accent text={title} />
      </h2>
      {subtitle && <p className={`mt-4 text-base sm:text-lg ${light ? "text-ink-muted" : "text-muted-foreground"}`}>{subtitle}</p>}
    </header>
  );
}

export function Stars({ value, size = 18 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Nota ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} aria-hidden className={n <= Math.round(value) ? "fill-primary text-primary" : "text-border"} />
      ))}
    </span>
  );
}

export function SectionSkeleton() {
  return (
    <div className="container-x py-24" aria-busy="true">
      <div className="skeleton h-10 w-2/3 max-w-md" />
      <div className="skeleton mt-6 h-72 w-full" />
    </div>
  );
}
