import { createElement } from "react";
import {
  BarChart3,
  Briefcase,
  Building,
  Calculator,
  Camera,
  Check,
  Clock,
  Droplets,
  FileDown,
  FileText,
  Flame,
  Hammer,
  Home,
  Link as LinkIcon,
  ListChecks,
  Lock,
  Mail,
  MessageSquare,
  Mic,
  Paintbrush,
  Palette,
  Ruler,
  Send,
  ShieldCheck,
  Sparkles,
  Trees,
  Users,
  Wrench,
  Zap,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Maps icon name strings stored in admin-editable content to lucide
 * components. Unknown names fall back to a neutral icon so content edits can
 * never break rendering.
 */
const ICONS: Record<string, LucideIcon> = {
  "message-square": MessageSquare,
  mic: Mic,
  camera: Camera,
  sparkles: Sparkles,
  "list-checks": ListChecks,
  "file-text": FileText,
  calculator: Calculator,
  "file-down": FileDown,
  link: LinkIcon,
  "bar-chart-3": BarChart3,
  "bar-chart": BarChart3,
  users: Users,
  zap: Zap,
  droplets: Droplets,
  hammer: Hammer,
  paintbrush: Paintbrush,
  trees: Trees,
  ruler: Ruler,
  home: Home,
  flame: Flame,
  wrench: Wrench,
  building: Building,
  briefcase: Briefcase,
  check: Check,
  clock: Clock,
  lock: Lock,
  mail: Mail,
  palette: Palette,
  send: Send,
  "shield-check": ShieldCheck,
};

const FALLBACK: LucideIcon = Sparkles;

export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return FALLBACK;
  return ICONS[name.trim().toLowerCase()] ?? FALLBACK;
}

export interface MarketingIconProps extends Omit<LucideProps, "name"> {
  /** Icon name string from admin-editable content, e.g. "message-square". */
  name: string | null | undefined;
}

export function MarketingIcon({ name, ...props }: MarketingIconProps) {
  // Icons are looked up from a static map, so no component is created per render.
  return createElement(resolveIcon(name), { "aria-hidden": true, focusable: "false", ...props });
}
