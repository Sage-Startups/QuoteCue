import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  Package,
  FileText,
  Sparkles,
  HardDrive,
  Mail,
  Megaphone,
  LayoutTemplate,
  MessageSquareCode,
  ToggleLeft,
  Settings,
  Palette,
  Activity,
  Clock,
  Webhook,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/super-admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/super-admin/users", label: "Users", icon: Users },
  { href: "/super-admin/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/super-admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/super-admin/plans", label: "Plans and credits", icon: Package },
  { href: "/super-admin/quotes", label: "Quotes", icon: FileText },
  { href: "/super-admin/ai-usage", label: "AI usage", icon: Sparkles },
  { href: "/super-admin/storage", label: "Storage", icon: HardDrive },
  { href: "/super-admin/emails", label: "Email activity", icon: Mail },
  { href: "/super-admin/marketing", label: "Marketing content", icon: Megaphone },
  { href: "/super-admin/trade-templates", label: "Trade templates", icon: LayoutTemplate },
  { href: "/super-admin/prompts", label: "AI prompts", icon: MessageSquareCode },
  { href: "/super-admin/feature-flags", label: "Feature flags", icon: ToggleLeft },
  { href: "/super-admin/settings", label: "Site settings", icon: Settings },
  { href: "/super-admin/branding", label: "Branding", icon: Palette },
  { href: "/super-admin/system-health", label: "System health", icon: Activity },
  { href: "/super-admin/jobs", label: "Background jobs", icon: Clock },
  { href: "/super-admin/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/super-admin/audit-log", label: "Audit log", icon: ScrollText },
];
