/** Tipos (DTOs) trocados entre a API e a interface. */
import type {
  AppointmentKind,
  AppointmentStatus,
  ClientStatus,
  LeadStatus,
  MediaKind,
  PaymentMethod,
  PayableStatus,
  PostCategory,
  PostStatus,
  ReceivableStatus,
  ReviewStatus,
  SectionKey,
} from "./constants.js";
import type { SectionContentMap, SiteSettings } from "./site-content.js";

export interface ApiError {
  error: { code: string; message: string; fields?: Record<string, string>; details?: unknown };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ------------------------------------------------------------------ mídia
export interface MediaDto {
  id: string;
  kind: MediaKind;
  url: string;
  thumbnailUrl: string | null;
  embedUrl: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  title: string;
  altText: string;
  category: string;
  externalProvider: string | null;
  createdAt: string;
}

export interface UploadInit {
  key: string;
  upload: { url: string; method: "PUT"; headers: Record<string, string> };
}

// ------------------------------------------------------------------ site
export interface PublicImage {
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
}

export type PublicSection<K extends SectionKey = SectionKey> = {
  [P in K]: { key: P; content: SectionContentMap[P]; image: PublicImage | null };
}[K];

export interface PublicSettings {
  businessName: string;
  trainerName: string;
  whatsappNumber: string;
  contactEmail: string;
  instagramUrl: string;
  facebookUrl: string;
  youtubeUrl: string;
  tiktokUrl: string;
  seoTitle: string;
  seoDescription: string;
  footerText: string;
  whatsappPlanMessage: string;
  whatsappGeneralMessage: string;
  logoUrl: string | null;
}

export interface PublicPrice {
  kind: "promo" | "regular" | "consult";
  cents: number | null;
  promotionName: string | null;
  /** Último dia de validade da promoção (YYYY-MM-DD, fuso America/Fortaleza). */
  validUntilDate: string | null;
}

export interface PublicPlan {
  id: string;
  name: string;
  durationMonths: number;
  description: string;
  features: string[];
  conditions: string;
  badge: string;
  isFeatured: boolean;
  price: PublicPrice;
  /** Valor equivalente por mês (arredondado), quando há preço. */
  perMonthCents: number | null;
}

export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  displayDate: string;
  photoUrl: string | null;
}

export interface PublicPostCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: PostCategory;
  publishedAt: string;
  isFeatured: boolean;
  cover: PublicImage | null;
  hasVideo: boolean;
}

export interface PostBlockText {
  type: "text";
  text: string;
}
export interface PostBlockImage {
  type: "image";
  mediaId: string;
  caption?: string;
}
export interface PostBlockVideo {
  type: "video";
  mediaId: string;
  caption?: string;
}
export type PostBlock = PostBlockText | PostBlockImage | PostBlockVideo;

export interface PublicBlockMedia {
  id: string;
  kind: MediaKind;
  url: string;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  alt: string;
}

export type PublicPostBlock =
  | PostBlockText
  | { type: "image"; media: PublicBlockMedia; caption?: string }
  | { type: "video"; media: PublicBlockMedia; caption?: string };

export interface PublicPostDetail extends PublicPostCard {
  blocks: PublicPostBlock[];
}

export interface PublicSite {
  settings: PublicSettings;
  sections: PublicSection[];
  plans: PublicPlan[];
  activePromotion: { name: string; validUntilDate: string } | null;
  reviews: { items: PublicReview[]; count: number; average: number | null };
  gallery: {
    items: PublicPostCard[];
    nextCursor: string | null;
    categories: { value: PostCategory; count: number }[];
  };
}

// ------------------------------------------------------------------ admin: site
export interface AdminSection<K extends SectionKey = SectionKey> {
  key: K;
  enabled: boolean;
  sortOrder: number;
  content: SectionContentMap[K];
  updatedAt: string;
}

export type AdminSettings = SiteSettings;

// ------------------------------------------------------------------ admin: planos/promoções
export interface AdminPlan {
  id: string;
  name: string;
  durationMonths: number;
  regularPriceCents: number | null;
  description: string;
  features: string[];
  conditions: string;
  badge: string;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
  archivedAt: string | null;
  /** Preço em vigor agora (considerando promoções). */
  currentPrice: PublicPrice;
}

export type PromotionStatus = "active" | "scheduled" | "expired" | "disabled";

export interface AdminPromotion {
  id: string;
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  /** Último dia de validade exibido (inclusivo). */
  validUntilDate: string;
  validUntilTime: string;
  isActive: boolean;
  status: PromotionStatus;
  plans: { planId: string; planName: string; promoPriceCents: number }[];
  createdAt: string;
}

// ------------------------------------------------------------------ admin: auth
export interface AdminMe {
  id: string;
  email: string;
  name: string;
}

export interface AdminSessionInfo {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
  current: boolean;
}

// ------------------------------------------------------------------ CRM
export interface SubscriptionDto {
  id: string;
  clientId: string;
  planId: string | null;
  planName: string;
  durationMonths: number;
  agreedPriceCents: number;
  startsOn: string;
  endsOn: string;
  status: "active" | "cancelled";
  /** Estado calculado: vigente, vencida, futura ou cancelada. */
  phase: "current" | "expired" | "upcoming" | "cancelled";
  daysToEnd: number;
  notes: string;
  cancelledAt: string | null;
  createdAt: string;
}

export interface ClientListItem {
  id: string;
  fullName: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  isActive: boolean;
  archivedAt: string | null;
  status: ClientStatus;
  createdAt: string;
  currentPlanName: string | null;
  currentEndsOn: string | null;
  daysToEnd: number | null;
  expiringSoon: boolean;
}

export interface ClientDetail extends ClientListItem {
  notes: string;
  anonymizedAt: string | null;
  subscriptions: SubscriptionDto[];
  receivables: ReceivableDto[];
  totals: { receivedCents: number; pendingCents: number; overdueCents: number };
  appointments: AppointmentDto[];
}

export interface LeadNoteDto {
  id: string;
  body: string;
  createdAt: string;
}

export interface LeadDto {
  id: string;
  fullName: string;
  phone: string | null;
  whatsapp: string | null;
  source: string;
  interest: string;
  status: LeadStatus;
  firstContactOn: string;
  consentGiven: boolean;
  convertedClientId: string | null;
  createdAt: string;
  notes?: LeadNoteDto[];
}

// ------------------------------------------------------------------ financeiro
export interface PaymentDto {
  id: string;
  receivableId: string;
  amountCents: number;
  paidOn: string;
  method: PaymentMethod;
  notes: string;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
}

export interface ReceivableDto {
  id: string;
  description: string;
  clientId: string | null;
  clientName: string | null;
  clientWhatsapp: string | null;
  subscriptionId: string | null;
  amountCents: number;
  receivedCents: number;
  remainingCents: number;
  dueDate: string;
  status: ReceivableStatus;
  notes: string;
  cancelReason: string | null;
  lastMethod: PaymentMethod | null;
  receivedOn: string | null;
  payments: PaymentDto[];
  createdAt: string;
}

export interface PayableDto {
  id: string;
  description: string;
  categoryId: string;
  categoryName: string;
  amountCents: number;
  dueDate: string;
  paidOn: string | null;
  paymentMethod: PaymentMethod | null;
  status: PayableStatus;
  notes: string;
  cancelReason: string | null;
  createdAt: string;
}

export interface ExpenseCategoryDto {
  id: string;
  name: string;
  isActive: boolean;
}

export interface FinanceSummary {
  period: { from: string; to: string };
  receivedCents: number;
  pendingReceivableCents: number;
  overdueReceivableCents: number;
  paidExpensesCents: number;
  pendingExpensesCents: number;
  overdueExpensesCents: number;
  /** Recebimentos efetivos − despesas efetivamente pagas. */
  realizedBalanceCents: number;
  /** Saldo realizado + a receber pendente − a pagar pendente (vencimentos no período). */
  projectedBalanceCents: number;
}

export interface MonthlyFinance {
  month: string;
  receivedCents: number;
  paidCents: number;
  balanceCents: number;
  pendingReceivableCents: number;
  pendingExpensesCents: number;
}

// ------------------------------------------------------------------ agenda
export interface AppointmentDto {
  id: string;
  clientId: string | null;
  clientName: string;
  kind: AppointmentKind;
  title: string;
  startsAt: string;
  endsAt: string;
  notes: string;
  status: AppointmentStatus;
  createdAt: string;
}

// ------------------------------------------------------------------ avaliações
export interface ReviewDto {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  displayDate: string;
  photoMediaId: string | null;
  photoUrl: string | null;
  rejectionNote: string | null;
  moderatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntryDto {
  id: number;
  action: string;
  summary: string | null;
  createdAt: string;
  adminName: string | null;
}

// ------------------------------------------------------------------ publicações
export interface PostDto {
  id: string;
  title: string;
  slug: string;
  summary: string;
  category: PostCategory;
  body: PostBlock[];
  coverMediaId: string | null;
  coverUrl: string | null;
  status: PostStatus;
  /** Calculado: rascunho, agendada (data futura) ou publicada. */
  visibility: "draft" | "scheduled" | "published";
  publishedAt: string | null;
  sortOrder: number;
  isFeatured: boolean;
  authorizationConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------------ dashboard, alertas, relatórios
export interface DashboardData {
  period: { from: string; to: string };
  kpis: {
    clientsTotal: number;
    clientsActive: number;
    clientsInactive: number;
    clientsNewInPeriod: number;
    expiringSoon: number;
    expired: number;
    receivedCents: number;
    pendingReceivableCents: number;
    overdueReceivableCents: number;
    paidExpensesCents: number;
    pendingExpensesCents: number;
    realizedBalanceCents: number;
    projectedBalanceCents: number;
    pendingReviews: number;
    upcomingAppointments: number;
    leadsWaiting: number;
  };
  monthly: MonthlyFinance[];
  clientsByMonth: { month: string; newClients: number; activeAtEnd: number }[];
  planDistribution: { planName: string; durationMonths: number; clients: number }[];
  receivedVsPending: { receivedCents: number; pendingCents: number; overdueCents: number };
  upcoming: AppointmentDto[];
}

export interface AlertItem {
  id: string;
  type:
    | "review_pending"
    | "receivable_overdue"
    | "payable_due_soon"
    | "payable_overdue"
    | "plan_expiring"
    | "plan_expired"
    | "lead_new"
    | "appointment_soon";
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string;
  date: string | null;
  href: string;
  whatsapp?: { number: string; message: string } | null;
}
