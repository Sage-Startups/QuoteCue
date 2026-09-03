import type { PlanKey } from "@/generated/prisma/enums";

export const ENTITLEMENT_KEYS = {
  CUSTOM_LOGO: "Custom business logo on quotes",
  REMOVE_BRANDING: "Remove QuoteCue branding from PDFs",
  FULL_BRANDING: "Full custom branding (colours and footer)",
  PDF_DOWNLOAD: "PDF downloads",
  ACCEPTANCE_LINKS: "Customer acceptance links",
  BASIC_ANALYTICS: "Basic analytics",
  ADVANCED_ANALYTICS: "Advanced analytics",
  CUSTOM_TEMPLATES: "Custom quote templates",
  PRIORITY_SUPPORT: "Priority email support",
  TEAM_ACCOUNTS: "Team accounts",
  CSV_EXPORT: "CSV exports",
} as const;

export type EntitlementKey = keyof typeof ENTITLEMENT_KEYS;

export interface PlanSeed {
  key: PlanKey;
  kind: "SUBSCRIPTION" | "CREDIT_PACK";
  name: string;
  description: string;
  monthlyPriceMinor: number;
  annualPriceMinor: number;
  oneTimePriceMinor: number;
  aiGenerationsPerPeriod: number;
  creditsGranted: number;
  maxMembers: number;
  storageAllowanceMb: number;
  highlight: boolean;
  sortOrder: number;
  featureBullets: string[];
  entitlements: EntitlementKey[];
  stripeEnv?: { monthly?: string; annual?: string; oneTime?: string };
}

/** Default plan catalogue. Super admins can edit these in the database. */
export const PLAN_SEEDS: PlanSeed[] = [
  {
    key: "FREE",
    kind: "SUBSCRIPTION",
    name: "Free trial",
    description: "Try QuoteCue with three AI quote generations. No card required.",
    monthlyPriceMinor: 0,
    annualPriceMinor: 0,
    oneTimePriceMinor: 0,
    aiGenerationsPerPeriod: 0,
    creditsGranted: 3,
    maxMembers: 1,
    storageAllowanceMb: 250,
    highlight: false,
    sortOrder: 0,
    featureBullets: ["3 AI quote generations", "1 user", "PDF downloads with QuoteCue branding", "Customer acceptance links", "No card required"],
    entitlements: ["PDF_DOWNLOAD", "ACCEPTANCE_LINKS", "BASIC_ANALYTICS"],
  },
  {
    key: "STARTER",
    kind: "SUBSCRIPTION",
    name: "Starter",
    description: "For sole traders sending a handful of quotes every week.",
    monthlyPriceMinor: 1900,
    annualPriceMinor: 19000,
    oneTimePriceMinor: 0,
    aiGenerationsPerPeriod: 25,
    creditsGranted: 0,
    maxMembers: 1,
    storageAllowanceMb: 2000,
    highlight: false,
    sortOrder: 1,
    featureBullets: ["25 AI quote generations per month", "1 user", "Custom business logo", "PDF downloads", "Customer acceptance links", "Basic analytics"],
    entitlements: ["CUSTOM_LOGO", "REMOVE_BRANDING", "PDF_DOWNLOAD", "ACCEPTANCE_LINKS", "BASIC_ANALYTICS", "CSV_EXPORT"],
    stripeEnv: { monthly: "STRIPE_STARTER_MONTHLY_PRICE_ID", annual: "STRIPE_STARTER_ANNUAL_PRICE_ID" },
  },
  {
    key: "PRO",
    kind: "SUBSCRIPTION",
    name: "Pro",
    description: "For growing teams that quote every day.",
    monthlyPriceMinor: 3900,
    annualPriceMinor: 39000,
    oneTimePriceMinor: 0,
    aiGenerationsPerPeriod: 100,
    creditsGranted: 0,
    maxMembers: 5,
    storageAllowanceMb: 10000,
    highlight: true,
    sortOrder: 2,
    featureBullets: ["100 AI quote generations per month", "Up to 5 users", "Full custom branding", "Advanced analytics", "Custom templates", "Priority email support"],
    entitlements: ["CUSTOM_LOGO", "REMOVE_BRANDING", "FULL_BRANDING", "PDF_DOWNLOAD", "ACCEPTANCE_LINKS", "BASIC_ANALYTICS", "ADVANCED_ANALYTICS", "CUSTOM_TEMPLATES", "PRIORITY_SUPPORT", "TEAM_ACCOUNTS", "CSV_EXPORT"],
    stripeEnv: { monthly: "STRIPE_PRO_MONTHLY_PRICE_ID", annual: "STRIPE_PRO_ANNUAL_PRICE_ID" },
  },
  {
    key: "CREDIT_PACK_5",
    kind: "CREDIT_PACK",
    name: "5 extra AI generations",
    description: "Top up any plan with five additional AI quote generations. Credits never expire.",
    monthlyPriceMinor: 0,
    annualPriceMinor: 0,
    oneTimePriceMinor: 900,
    aiGenerationsPerPeriod: 0,
    creditsGranted: 5,
    maxMembers: 0,
    storageAllowanceMb: 0,
    highlight: false,
    sortOrder: 10,
    featureBullets: ["5 AI generations", "Never expire", "Works with any plan"],
    entitlements: [],
    stripeEnv: { oneTime: "STRIPE_CREDIT_PACK_PRICE_ID" },
  },
];
