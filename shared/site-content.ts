/**
 * Tipos e conteúdo padrão das seções do site e das configurações gerais.
 * O conteúdo real vive no banco (editável em /admin/site e /admin/configuracoes);
 * estes valores são apenas o ponto de partida da instalação inicial.
 *
 * Regra editorial: nenhum número, resultado, certificação ou promessa que o profissional
 * não tenha confirmado. Campos opcionais vazios simplesmente não aparecem no site público.
 */
import type { SectionKey } from "./constants";

export interface IconItem {
  icon: string;
  title: string;
  text: string;
}

export interface HeroContent {
  eyebrow: string;
  titleLine: string;
  titleAccent: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel: string;
  highlights: string[];
  imageMediaId: string | null;
  imageAlt: string;
}

export interface AboutContent {
  eyebrow: string;
  title: string;
  role: string;
  bio: string;
  experience: string;
  methodology: string;
  followUp: string;
  highlights: string[];
  imageMediaId: string | null;
  imageAlt: string;
}

export interface HowContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  steps: IconItem[];
}

export interface BenefitsContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  items: IconItem[];
}

export interface GalleryContent {
  eyebrow: string;
  title: string;
  subtitle: string;
}

export interface PlansContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  footnote: string;
}

export interface ReviewsContent {
  eyebrow: string;
  title: string;
  subtitle: string;
  formTitle: string;
  formIntro: string;
}

export interface FinalCtaContent {
  title: string;
  text: string;
  buttonLabel: string;
  imageMediaId: string | null;
  imageAlt: string;
}

export interface SectionContentMap {
  hero: HeroContent;
  about: AboutContent;
  how_it_works: HowContent;
  benefits: BenefitsContent;
  gallery: GalleryContent;
  plans: PlansContent;
  reviews: ReviewsContent;
  final_cta: FinalCtaContent;
}

export interface SiteSettings {
  businessName: string;
  trainerName: string;
  whatsappNumber: string;
  contactEmail: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  logoMediaId: string | null;
  seoTitle: string;
  seoDescription: string;
  footerText: string;
  /** Use {plano} para o nome do plano. */
  whatsappPlanMessage: string;
  whatsappGeneralMessage: string;
  /** Mensagens usadas pelo administrador para falar com clientes. Use {nome}, {data}, {valor}. */
  renewalMessage: string;
  overdueMessage: string;
  /** Quantos dias antes do vencimento um plano é considerado "próximo do vencimento". */
  expiringDays: number;
}

/** Fotografia padrão do hero/sobre enquanto o administrador não envia outra. */
export const DEFAULT_PHOTO = "/images/joao-marcos.jpeg";

export const DEFAULT_SETTINGS: SiteSettings = {
  businessName: "João Marcos Personal",
  trainerName: "João Marcos",
  whatsappNumber: "558592718614",
  contactEmail: "",
  instagramUrl: "https://www.instagram.com/prof_jmbatista/",
  facebookUrl: "",
  youtubeUrl: "",
  tiktokUrl: "",
  logoMediaId: null,
  seoTitle: "João Marcos | Personal Trainer — Consultoria Online",
  seoDescription:
    "Consultoria de treinamento online com João Marcos: treino personalizado e acompanhamento direto pelo WhatsApp. Planos mensal, bimestral e trimestral.",
  footerText: "Consultoria online de treinamento personalizado.",
  whatsappPlanMessage: "Olá! Tenho interesse no plano {plano} da consultoria online.",
  whatsappGeneralMessage: "Olá, João! Vim pelo seu site e gostaria de saber mais sobre a consultoria online.",
  renewalMessage: "Olá, {nome}! Seu plano da consultoria online vence em {data}. Vamos renovar para continuar seus treinos?",
  overdueMessage:
    "Olá, {nome}! Passando para lembrar do pagamento de {valor}, com vencimento em {data}. Qualquer dúvida é só me chamar.",
  expiringDays: 7,
};

export const DEFAULT_SECTIONS: { key: SectionKey; enabled: boolean; content: SectionContentMap[SectionKey] }[] = [
  {
    key: "hero",
    enabled: true,
    content: {
      eyebrow: "Consultoria online",
      titleLine: "Treine melhor.",
      titleAccent: "Evolua todo dia.",
      subtitle:
        "Treinos personalizados para o seu objetivo e acompanhamento direto com o personal João Marcos, onde você estiver.",
      primaryCtaLabel: "Ver planos",
      secondaryCtaLabel: "Falar no WhatsApp",
      highlights: ["Treino personalizado", "Acompanhamento pelo WhatsApp", "100% online"],
      imageMediaId: null,
      imageAlt: "João Marcos, personal trainer",
    } satisfies HeroContent,
  },
  {
    key: "about",
    enabled: true,
    content: {
      eyebrow: "Sobre",
      title: "João Marcos",
      role: "Personal trainer",
      bio: "Sou personal trainer e acompanho meus alunos de forma online, com treinos pensados para o objetivo, o nível e a rotina de cada pessoa.",
      experience: "",
      methodology:
        "Tudo começa com uma avaliação inicial para entender seu histórico, suas metas e sua rotina. Com isso, monto o seu treino e ajusto o plano conforme a sua evolução.",
      followUp: "O acompanhamento é feito diretamente pelo WhatsApp, para tirar dúvidas e manter você no caminho.",
      highlights: [],
      imageMediaId: null,
      imageAlt: "João Marcos, personal trainer",
    } satisfies AboutContent,
  },
  {
    key: "how_it_works",
    enabled: true,
    content: {
      eyebrow: "Passo a passo",
      title: "Como funciona a consultoria online",
      subtitle: "Do primeiro contato à evolução, tudo acontece de forma simples e direta.",
      steps: [
        {
          icon: "message-circle",
          title: "Contratação",
          text: "Escolha o plano e chame o João pelo WhatsApp para iniciar.",
        },
        {
          icon: "clipboard-list",
          title: "Avaliação inicial",
          text: "Você responde sobre histórico, rotina, limitações e objetivos.",
        },
        {
          icon: "dumbbell",
          title: "Treino personalizado",
          text: "Você recebe um plano montado para o seu objetivo, nível e rotina.",
        },
        {
          icon: "trending-up",
          title: "Acompanhamento e evolução",
          text: "Tire dúvidas pelo WhatsApp e tenha o plano ajustado conforme evolui.",
        },
      ],
    } satisfies HowContent,
  },
  {
    key: "benefits",
    enabled: true,
    content: {
      eyebrow: "Diferenciais",
      title: "Por que treinar com acompanhamento",
      subtitle: "",
      items: [
        {
          icon: "target",
          title: "Treino sob medida",
          text: "Exercícios escolhidos para o seu objetivo, nível e rotina, sem planilha pronta.",
        },
        {
          icon: "message-circle",
          title: "Acompanhamento direto",
          text: "Dúvidas e ajustes conversados diretamente com o João pelo WhatsApp.",
        },
        {
          icon: "map-pin",
          title: "Treine onde quiser",
          text: "Em casa, na academia ou ao ar livre: o plano se adapta ao seu local de treino.",
        },
        {
          icon: "shield-check",
          title: "Técnica e progressão",
          text: "Foco na execução correta e na evolução gradual das cargas.",
        },
      ],
    } satisfies BenefitsContent,
  },
  {
    key: "gallery",
    enabled: true,
    content: {
      eyebrow: "Conteúdo",
      title: "Treinos, técnica e bastidores",
      subtitle: "Vídeos e fotos do trabalho do João.",
    } satisfies GalleryContent,
  },
  {
    key: "plans",
    enabled: true,
    content: {
      eyebrow: "Planos",
      title: "Escolha o período do seu acompanhamento",
      subtitle: "O mesmo serviço de consultoria online, em três períodos de contratação.",
      footnote: "Dúvidas sobre os planos? Chame o João no WhatsApp.",
    } satisfies PlansContent,
  },
  {
    key: "reviews",
    enabled: true,
    content: {
      eyebrow: "Avaliações",
      title: "O que dizem os alunos",
      subtitle: "",
      formTitle: "Já treina com o João? Deixe sua avaliação",
      formIntro: "Sua avaliação passa por uma análise antes de aparecer no site.",
    } satisfies ReviewsContent,
  },
  {
    key: "final_cta",
    enabled: true,
    content: {
      title: "Comece sua consultoria online",
      text: "Chame o João no WhatsApp e tire suas dúvidas antes de escolher o plano.",
      buttonLabel: "Falar com o João",
      imageMediaId: null,
      imageAlt: "João Marcos, personal trainer",
    } satisfies FinalCtaContent,
  },
];

export const DEFAULT_PLANS = [
  { name: "Mensal", months: 1, promo: 10000, featured: false, badge: "" },
  { name: "Bimestral", months: 2, promo: 15000, featured: false, badge: "" },
  { name: "Trimestral", months: 3, promo: 20000, featured: true, badge: "Menor valor por mês" },
];

export const DEFAULT_PLAN_FEATURES = [
  "Treino personalizado",
  "Acompanhamento pelo WhatsApp",
  "Vídeos de execução dos exercícios",
  "Ajustes conforme a sua evolução",
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Equipamentos",
  "Alimentação",
  "Transporte",
  "Software",
  "Marketing",
  "Serviços",
  "Outros",
];
