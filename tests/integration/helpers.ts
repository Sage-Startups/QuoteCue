import { prisma } from "@/lib/db";
import { seedPlatform } from "@/lib/seed/platform";
import { createWorkspaceFromOnboarding } from "@/lib/services/workspace";

let platformSeeded = false;

export async function ensurePlatform(): Promise<void> {
  if (platformSeeded) return;
  await seedPlatform();
  platformSeeded = true;
}

export async function createUser(name = "Test User") {
  const email = `${name.toLowerCase().replace(/\s+/g, ".")}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  return prisma.user.create({ data: { name, email, emailVerified: true } });
}

export async function createWorkspace(userId: string, businessName = "Test Workspace") {
  await ensurePlatform();
  const { workspaceId } = await createWorkspaceFromOnboarding(userId, {
    fullName: "Test User",
    businessName,
    tradeSlug: "electrician",
    addressLine1: "1 Test Street",
    addressLine2: "",
    city: "Leeds",
    region: "",
    postalCode: "LS1 1AA",
    country: "GB",
    phone: "",
    email: "",
    website: "",
    currency: "GBP",
    taxMode: "VAT",
    taxLabel: "",
    taxRatePercent: 20,
    pricingMode: "TAX_EXCLUSIVE",
    labourRate: 45,
    labourRateUnit: "HOUR",
    callOutFee: 0,
    paymentTerms: "Payment due within 14 days.",
    quoteValidityDays: 30,
    brandColor: "#0f1f3d",
    logoObjectId: "",
    includeCatalogue: true,
    createSampleQuote: false,
  });
  return workspaceId;
}

export async function cleanupWorkspace(workspaceId: string) {
  await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
}
