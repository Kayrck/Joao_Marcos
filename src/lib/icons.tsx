import {
  BadgeCheck,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Dumbbell,
  HeartPulse,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Target,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Conjunto curado de ícones (Lucide) disponíveis para edição no painel. Evita carregar a biblioteca inteira. */
export const ICONS: Record<string, LucideIcon> = {
  "badge-check": BadgeCheck,
  "calendar-check": CalendarCheck,
  "check-circle": CheckCircle2,
  "clipboard-list": ClipboardList,
  clock: Clock,
  dumbbell: Dumbbell,
  "heart-pulse": HeartPulse,
  "map-pin": MapPin,
  "message-circle": MessageCircle,
  "shield-check": ShieldCheck,
  smartphone: Smartphone,
  target: Target,
  "trending-up": TrendingUp,
  users: Users,
  zap: Zap,
};

export const ICON_OPTIONS = Object.keys(ICONS);

export function Icon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  const C = ICONS[name] ?? CheckCircle2;
  return <C size={size} className={className} aria-hidden />;
}
