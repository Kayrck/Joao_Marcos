/** Constantes e rótulos compartilhados entre API e interface. */

export const TIMEZONE = "America/Fortaleza";
/** Fortaleza não adota horário de verão: offset fixo UTC-3. */
export const TZ_OFFSET = "-03:00";

export const PAYMENT_METHODS = [
  "pix",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "boleto",
  "outro",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de crédito",
  cartao_debito: "Cartão de débito",
  transferencia: "Transferência",
  boleto: "Boleto",
  outro: "Outro",
};

export const CLIENT_STATUSES = ["active", "inactive", "pending", "expired", "archived"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  pending: "Pendente",
  expired: "Vencido",
  archived: "Arquivado",
};

export const LEAD_STATUSES = ["new", "in_progress", "awaiting", "converted", "not_converted"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Novo contato",
  in_progress: "Em atendimento",
  awaiting: "Aguardando retorno",
  converted: "Convertido",
  not_converted: "Não convertido",
};

export const RECEIVABLE_STATUSES = ["pending", "overdue", "received", "cancelled"] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];
export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  pending: "Pendente",
  overdue: "Atrasado",
  received: "Recebido",
  cancelled: "Cancelado",
};

export const PAYABLE_STATUSES = ["pending", "overdue", "paid", "cancelled"] as const;
export type PayableStatus = (typeof PAYABLE_STATUSES)[number];
export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  pending: "Pendente",
  overdue: "Atrasado",
  paid: "Pago",
  cancelled: "Cancelado",
};

export const APPOINTMENT_KINDS = ["aula", "avaliacao", "retorno", "outro"] as const;
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];
export const APPOINTMENT_KIND_LABELS: Record<AppointmentKind, string> = {
  aula: "Aula particular",
  avaliacao: "Avaliação",
  retorno: "Retorno",
  outro: "Outro",
};
export const APPOINTMENT_STATUSES = ["scheduled", "completed", "cancelled", "no_show"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: "Agendado",
  completed: "Realizado",
  cancelled: "Cancelado",
  no_show: "Faltou",
};

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Rejeitada",
};

export const POST_CATEGORIES = [
  "treinamentos",
  "execucao",
  "dicas",
  "bastidores",
  "fotografias",
  "videos",
  "educativo",
  "registros",
  "resultados",
] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];
export const POST_CATEGORY_LABELS: Record<PostCategory, string> = {
  treinamentos: "Treinamentos",
  execucao: "Execução de exercícios",
  dicas: "Dicas",
  bastidores: "Bastidores",
  fotografias: "Fotografias",
  videos: "Vídeos",
  educativo: "Conteúdo educativo",
  registros: "Registros de atividades",
  resultados: "Resultados autorizados",
};
export const POST_STATUSES = ["draft", "published"] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const MEDIA_KINDS = ["image", "video", "external_video"] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const ALLOWED_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;
export const ALLOWED_VIDEO_MIME = ["video/mp4", "video/webm", "video/quicktime"] as const;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

export const SECTION_KEYS = [
  "hero",
  "about",
  "how_it_works",
  "benefits",
  "gallery",
  "plans",
  "reviews",
  "final_cta",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];
export const SECTION_LABELS: Record<SectionKey, string> = {
  hero: "Início (hero)",
  about: "Sobre o personal",
  how_it_works: "Como funciona",
  benefits: "Diferenciais",
  gallery: "Galeria de treinamentos",
  plans: "Planos e promoções",
  reviews: "Avaliações",
  final_cta: "Chamada final",
};
/** A seção hero é sempre a primeira e não pode ser desativada ou movida. */
export const LOCKED_SECTIONS: SectionKey[] = ["hero"];
