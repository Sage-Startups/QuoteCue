import { LayoutDashboard, FileText, PlusCircle, Users, ListChecks, LayoutTemplate, BarChart3, UserPlus, CreditCard, Building2, UserCircle, LifeBuoy, Mail, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  devOnly?: boolean;
  exact?: boolean;
}

export const APP_NAV: NavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/quotes", label: "Quotes", icon: FileText },
  { href: "/app/quotes/new", label: "New quote", icon: PlusCircle, exact: true },
  { href: "/app/customers", label: "Customers", icon: Users },
  { href: "/app/catalogue", label: "Service catalogue", icon: ListChecks },
  { href: "/app/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/app/team", label: "Team", icon: UserPlus, adminOnly: true },
  { href: "/app/billing", label: "Billing", icon: CreditCard, adminOnly: true },
  { href: "/app/settings", label: "Business settings", icon: Building2, adminOnly: true },
  { href: "/app/account", label: "Personal account", icon: UserCircle },
  { href: "/app/help", label: "Help", icon: LifeBuoy },
  { href: "/app/dev/emails", label: "Email previews", icon: Mail, devOnly: true },
];

export const MOBILE_PRIMARY_NAV: NavItem[] = [
  { href: "/app", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/app/quotes", label: "Quotes", icon: FileText },
  { href: "/app/quotes/new", label: "New", icon: PlusCircle, exact: true },
  { href: "/app/customers", label: "Customers", icon: Users },
];
